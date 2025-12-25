import { pool } from '../db/database';
import { Plan, Subscription, UsageStats, UsageRecord } from '../types/subscription';
import { FEATURE_DEFINITIONS, FeatureCode } from '../config/features';
import Redis from 'ioredis';
import { getWebSocketService } from './WebSocketService';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

export class SubscriptionService {
  /**
   * 获取套餐配置（带 Redis 缓存）
   */
  async getPlanConfig(planCode: string): Promise<Plan | null> {
    const cacheKey = `plan:${planCode}`;
    
    try {
      // 尝试从缓存获取
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Redis 缓存读取失败，降级为数据库查询:', error);
    }

    // 从数据库查询
    const result = await pool.query(
      `SELECT p.*, 
        json_agg(
          json_build_object(
            'id', f.id,
            'plan_id', f.plan_id,
            'feature_code', f.feature_code,
            'feature_name', f.feature_name,
            'feature_value', f.feature_value,
            'feature_unit', f.feature_unit
          )
        ) as features
      FROM subscription_plans p
      LEFT JOIN plan_features f ON p.id = f.plan_id
      WHERE p.plan_code = $1
      GROUP BY p.id`,
      [planCode]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const plan = result.rows[0];

    try {
      // 缓存 1 小时
      await redis.setex(cacheKey, 3600, JSON.stringify(plan));
    } catch (error) {
      console.error('Redis 缓存写入失败:', error);
    }

    return plan;
  }

  /**
   * 获取所有激活的套餐
   */
  async getAllActivePlans(): Promise<Plan[]> {
    const result = await pool.query(
      `SELECT p.*, 
        json_agg(
          json_build_object(
            'id', f.id,
            'plan_id', f.plan_id,
            'feature_code', f.feature_code,
            'feature_name', f.feature_name,
            'feature_value', f.feature_value,
            'feature_unit', f.feature_unit
          )
        ) as features
      FROM subscription_plans p
      LEFT JOIN plan_features f ON p.id = f.plan_id
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY p.display_order ASC`
    );

    return result.rows;
  }

  /**
   * 获取用户当前订阅
   */
  async getUserActiveSubscription(userId: number): Promise<Subscription | null> {
    const result = await pool.query(
      `SELECT s.*, 
        json_build_object(
          'id', p.id,
          'plan_code', p.plan_code,
          'plan_name', p.plan_name,
          'price', p.price,
          'billing_cycle', p.billing_cycle,
          'description', p.description
        ) as plan
      FROM user_subscriptions s
      LEFT JOIN subscription_plans p ON s.plan_id = p.id
      WHERE s.user_id = $1 AND s.status = 'active'
      ORDER BY s.end_date DESC
      LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * 检查用户是否可以执行某个操作
   */
  async canUserPerformAction(userId: number, featureCode: FeatureCode): Promise<boolean> {
    // 获取用户订阅
    const subscription = await this.getUserActiveSubscription(userId);
    if (!subscription || !subscription.plan) {
      return false;
    }

    // 获取套餐配置
    const plan = await this.getPlanConfig(subscription.plan.plan_code);
    if (!plan) {
      return false;
    }

    // 查找功能配额
    const feature = plan.features.find(f => f.feature_code === featureCode);
    if (!feature) {
      return false;
    }

    // -1 表示无限制
    if (feature.feature_value === -1) {
      return true;
    }

    // 获取当前使用量
    const usage = await this.getUserUsage(userId, featureCode);
    
    return usage < feature.feature_value;
  }

  /**
   * 获取用户使用量
   */
  async getUserUsage(userId: number, featureCode: FeatureCode): Promise<number> {
    const featureDef = FEATURE_DEFINITIONS[featureCode];
    const { periodStart, periodEnd } = this.getPeriodDates(featureDef.resetPeriod);

    const result = await pool.query(
      `SELECT usage_count FROM user_usage
       WHERE user_id = $1 AND feature_code = $2 AND period_start = $3`,
      [userId, featureCode, periodStart]
    );

    return result.rows.length > 0 ? result.rows[0].usage_count : 0;
  }

  /**
   * 记录用户使用量
   */
  async recordUsage(userId: number, featureCode: FeatureCode, amount: number = 1): Promise<void> {
    const featureDef = FEATURE_DEFINITIONS[featureCode];
    const { periodStart, periodEnd } = this.getPeriodDates(featureDef.resetPeriod);

    await pool.query(
      `INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, feature_code, period_start)
       DO UPDATE SET usage_count = user_usage.usage_count + $3, updated_at = CURRENT_TIMESTAMP`,
      [userId, featureCode, amount, periodStart, periodEnd]
    );

    // 获取当前使用量
    const currentUsage = await this.getUserUsage(userId, featureCode);
    
    // 检测配额使用异常
    const { AnomalyDetectionService } = await import('./AnomalyDetectionService');
    await AnomalyDetectionService.checkQuotaUsageAnomaly(userId, featureCode, currentUsage);

    // 推送配额更新通知
    try {
      const wsService = getWebSocketService();
      const stats = await this.getUserUsageStats(userId);
      wsService.broadcast(userId, 'quota_updated', {
        feature_code: featureCode,
        amount,
        stats
      });
    } catch (error) {
      console.error('推送配额更新失败:', error);
    }
  }

  /**
   * 获取用户使用统计
   */
  async getUserUsageStats(userId: number): Promise<UsageStats[]> {
    const subscription = await this.getUserActiveSubscription(userId);
    if (!subscription || !subscription.plan) {
      return [];
    }

    const plan = await this.getPlanConfig(subscription.plan.plan_code);
    if (!plan) {
      return [];
    }

    const stats: UsageStats[] = [];

    for (const feature of plan.features) {
      const used = await this.getUserUsage(userId, feature.feature_code as FeatureCode);
      const limit = feature.feature_value;
      const remaining = limit === -1 ? -1 : Math.max(0, limit - used);
      const percentage = limit === -1 ? 0 : Math.min(100, (used / limit) * 100);

      const featureDef = FEATURE_DEFINITIONS[feature.feature_code as FeatureCode];
      const resetTime = this.getNextResetTime(featureDef.resetPeriod);

      stats.push({
        feature_code: feature.feature_code,
        feature_name: feature.feature_name,
        limit,
        used,
        remaining,
        percentage,
        unit: feature.feature_unit,
        reset_time: resetTime
      });
    }

    return stats;
  }

  /**
   * 为用户开通订阅
   */
  async activateSubscription(userId: number, planId: number, durationMonths: number = 1): Promise<Subscription> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + durationMonths);

    const result = await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
       VALUES ($1, $2, 'active', $3, $4)
       RETURNING *`,
      [userId, planId, startDate, endDate]
    );

    const subscription = result.rows[0];

    // 推送订阅更新通知
    try {
      const wsService = getWebSocketService();
      wsService.broadcast(userId, 'subscription_updated', {
        action: 'activated',
        subscription
      });
    } catch (error) {
      console.error('推送订阅更新失败:', error);
    }

    return subscription;
  }

  /**
   * 清除套餐缓存
   */
  async clearPlanCache(planCode: string): Promise<void> {
    try {
      await redis.del(`plan:${planCode}`);
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  }

  /**
   * 获取周期日期
   */
  private getPeriodDates(resetPeriod: 'daily' | 'monthly' | 'never'): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (resetPeriod === 'daily') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (resetPeriod === 'monthly') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else {
      // never - 使用一个固定的远期日期
      periodStart = new Date(2000, 0, 1);
      periodEnd = new Date(2099, 11, 31);
    }

    return { periodStart, periodEnd };
  }

  /**
   * 获取下次重置时间
   */
  private getNextResetTime(resetPeriod: 'daily' | 'monthly' | 'never'): string | undefined {
    if (resetPeriod === 'never') {
      return undefined;
    }

    const now = new Date();
    let resetTime: Date;

    if (resetPeriod === 'daily') {
      resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    } else {
      resetTime = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    }

    return resetTime.toISOString();
  }

  /**
   * 升级套餐（立即生效，计算差价）
   */
  async upgradePlan(userId: number, newPlanId: number): Promise<{ order_no: string; amount_due: number }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 获取当前订阅
      const currentSub = await this.getUserActiveSubscription(userId);
      if (!currentSub) {
        throw new Error('当前没有激活的订阅');
      }

      // 获取新套餐信息
      const newPlanResult = await client.query(
        'SELECT * FROM subscription_plans WHERE id = $1',
        [newPlanId]
      );

      if (newPlanResult.rows.length === 0) {
        throw new Error('目标套餐不存在');
      }

      const newPlan = newPlanResult.rows[0];
      const currentPlan = await client.query(
        'SELECT * FROM subscription_plans WHERE id = $1',
        [currentSub.plan_id]
      );

      // 检查是否是升级（价格更高）
      if (newPlan.price <= currentPlan.rows[0].price) {
        throw new Error('只能升级到更高价格的套餐');
      }

      // 计算剩余天数
      const now = new Date();
      const endDate = new Date(currentSub.end_date);
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // 计算差价（按剩余天数比例）
      const dailyOldPrice = currentPlan.rows[0].price / 30;
      const dailyNewPrice = newPlan.price / 30;
      const amountDue = Math.max(0, (dailyNewPrice - dailyOldPrice) * daysRemaining);

      // 创建升级订单
      const orderNo = `UPG${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      await client.query(
        `INSERT INTO orders (order_no, user_id, plan_id, amount, status, order_type)
         VALUES ($1, $2, $3, $4, 'pending', 'upgrade')`,
        [orderNo, userId, newPlanId, amountDue]
      );

      await client.query('COMMIT');

      return { order_no: orderNo, amount_due: amountDue };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 应用升级（支付成功后调用）
   */
  async applyUpgrade(userId: number, newPlanId: number): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 获取当前订阅
      const currentSub = await this.getUserActiveSubscription(userId);
      if (!currentSub) {
        throw new Error('当前没有激活的订阅');
      }

      // 更新订阅套餐（立即生效）
      await client.query(
        `UPDATE user_subscriptions 
         SET plan_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newPlanId, currentSub.id]
      );

      // 清除使用量统计（升级后重置配额）
      await client.query(
        'DELETE FROM user_usage WHERE user_id = $1',
        [userId]
      );

      await client.query('COMMIT');

      // 清除缓存
      const newPlan = await client.query(
        'SELECT plan_code FROM subscription_plans WHERE id = $1',
        [newPlanId]
      );
      if (newPlan.rows.length > 0) {
        await this.clearPlanCache(newPlan.rows[0].plan_code);
      }

      // 推送订阅更新通知
      try {
        const wsService = getWebSocketService();
        const updatedSub = await this.getUserActiveSubscription(userId);
        wsService.broadcast(userId, 'subscription_updated', {
          action: 'upgraded',
          subscription: updatedSub
        });
      } catch (error) {
        console.error('推送订阅更新失败:', error);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}


export const subscriptionService = new SubscriptionService();
