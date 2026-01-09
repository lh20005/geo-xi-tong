import { pool } from '../db/database';
import { getWebSocketService } from './WebSocketService';
import { QuotaInitializationService } from './QuotaInitializationService';

// 延迟获取 WebSocket 服务实例，避免在模块加载时初始化
const getWsService = () => {
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  return getWebSocketService(jwtSecret);
};

interface SubscriptionDetail {
  subscription_id: number;
  plan_id: number;
  plan_code: string;
  plan_name: string;
  price: number;
  status: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  is_paused: boolean;
  paused_at: string | null;
  pause_reason: string | null;
  is_gift: boolean;
  custom_quotas: Record<string, number> | null;
  features: Array<{
    feature_code: string;
    feature_name: string;
    feature_value: number;
    current_usage: number;
    usage_percentage: number;
  }>;
}

interface AdjustmentHistory {
  id: number;
  user_id: number;
  username: string;
  adjustment_type: string;
  adjustment_type_label: string;
  old_plan_name: string | null;
  new_plan_name: string | null;
  old_end_date: string | null;
  new_end_date: string | null;
  days_added: number | null;
  quota_adjustments: any;
  reason: string | null;
  admin_note: string | null;
  admin_username: string;
  created_at: string;
}

class UserSubscriptionManagementService {
  /**
   * 获取用户订阅详情
   */
  async getUserSubscriptionDetail(userId: number): Promise<SubscriptionDetail | null> {
    try {
      console.log(`[UserSubscriptionManagement] 获取用户 ${userId} 的订阅详情`);
      
      const result = await pool.query(
        'SELECT * FROM get_user_subscription_detail($1)',
        [userId]
      );

      console.log(`[UserSubscriptionManagement] 查询结果行数: ${result.rows.length}`);

      if (result.rows.length === 0) {
        console.log(`[UserSubscriptionManagement] 用户 ${userId} 没有活跃订阅`);
        return null;
      }

      console.log(`[UserSubscriptionManagement] 成功获取用户 ${userId} 的订阅详情`);
      return result.rows[0];
    } catch (error) {
      console.error(`[UserSubscriptionManagement] 获取订阅详情失败:`, error);
      throw error;
    }
  }

  /**
   * 升级套餐
   */
  async upgradePlan(
    userId: number,
    newPlanId: number,
    adminId: number,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 获取当前订阅
      const currentSub = await client.query(
        `SELECT id, plan_id, end_date, status 
         FROM user_subscriptions 
         WHERE user_id = $1 AND status = 'active' AND end_date > CURRENT_TIMESTAMP
         ORDER BY end_date DESC LIMIT 1`,
        [userId]
      );

      if (currentSub.rows.length === 0) {
        throw new Error('用户没有活跃的订阅');
      }

      const subscription = currentSub.rows[0];
      const oldPlanId = subscription.plan_id;
      const oldEndDate = subscription.end_date;

      // 获取新套餐信息（包含 billing_cycle）
      const newPlan = await client.query(
        'SELECT plan_code, plan_name, duration_days, billing_cycle FROM subscription_plans WHERE id = $1',
        [newPlanId]
      );

      if (newPlan.rows.length === 0) {
        throw new Error('新套餐不存在');
      }

      // 根据 billing_cycle 计算天数，优先使用 duration_days，否则按计费周期计算
      let newDurationDays = newPlan.rows[0].duration_days;
      if (!newDurationDays || newDurationDays <= 0) {
        // 如果没有设置 duration_days，根据 billing_cycle 计算
        const billingCycle = newPlan.rows[0].billing_cycle;
        switch (billingCycle) {
          case 'yearly':
            newDurationDays = 365;
            break;
          case 'quarterly':
            newDurationDays = 90;
            break;
          case 'monthly':
          default:
            newDurationDays = 30;
            break;
        }
      }

      // 设置结束日期为 N 天后的 23:59:59，确保完整天数
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + newDurationDays);
      newEndDate.setHours(23, 59, 59, 999);

      // 更新订阅
      await client.query(
        `UPDATE user_subscriptions 
         SET plan_id = $1, end_date = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newPlanId, newEndDate, subscription.id]
      );

      // 清空自定义配额（使用新套餐的默认配额）
      await client.query(
        'UPDATE user_subscriptions SET custom_quotas = NULL WHERE id = $1',
        [subscription.id]
      );

      // 使用统一服务处理配额变更（清除旧配额、初始化新配额、更新存储配额）
      await QuotaInitializationService.handlePlanChange(userId, newPlanId, client);

      // 记录调整历史
      await client.query(
        `INSERT INTO subscription_adjustments 
         (user_id, subscription_id, adjustment_type, old_plan_id, new_plan_id, 
          old_end_date, new_end_date, reason, admin_id, ip_address, user_agent)
         VALUES ($1, $2, 'upgrade', $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          subscription.id,
          oldPlanId,
          newPlanId,
          oldEndDate,
          newEndDate,
          reason,
          adminId,
          ipAddress,
          userAgent,
        ]
      );

      await client.query('COMMIT');

      // 发送 WebSocket 通知
      getWsService().sendToUser(userId, 'subscription:upgraded', {
        newPlanName: newPlan.rows[0].plan_name,
        newEndDate: newEndDate.toISOString(),
      });

      console.log(`[SubscriptionManagement] 用户 ${userId} 升级到套餐 ${newPlanId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 延期订阅
   */
  async extendSubscription(
    userId: number,
    daysToAdd: number,
    adminId: number,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 获取当前订阅
      const currentSub = await client.query(
        `SELECT id, plan_id, end_date 
         FROM user_subscriptions 
         WHERE user_id = $1 AND status = 'active' AND end_date > CURRENT_TIMESTAMP
         ORDER BY end_date DESC LIMIT 1`,
        [userId]
      );

      if (currentSub.rows.length === 0) {
        throw new Error('用户没有活跃的订阅');
      }

      const subscription = currentSub.rows[0];
      const oldEndDate = subscription.end_date;

      // 计算新的结束日期
      const newEndDate = new Date(oldEndDate);
      newEndDate.setDate(newEndDate.getDate() + daysToAdd);

      // 更新订阅
      await client.query(
        'UPDATE user_subscriptions SET end_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newEndDate, subscription.id]
      );

      // 记录调整历史
      await client.query(
        `INSERT INTO subscription_adjustments 
         (user_id, subscription_id, adjustment_type, old_end_date, new_end_date, 
          days_added, reason, admin_id, ip_address, user_agent)
         VALUES ($1, $2, 'extend', $3, $4, $5, $6, $7, $8, $9)`,
        [userId, subscription.id, oldEndDate, newEndDate, daysToAdd, reason, adminId, ipAddress, userAgent]
      );

      await client.query('COMMIT');

      // 发送 WebSocket 通知
      getWsService().sendToUser(userId, 'subscription:extended', {
        daysAdded: daysToAdd,
        newEndDate: newEndDate.toISOString(),
      });

      console.log(`[SubscriptionManagement] 用户 ${userId} 订阅延期 ${daysToAdd} 天`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 调整配额
   */
  async adjustQuota(
    userId: number,
    featureCode: string,
    newValue: number,
    isPermanent: boolean,
    adminId: number,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 获取当前订阅
      const currentSub = await client.query(
        `SELECT us.id, us.custom_quotas, pf.feature_value, pf.feature_name
         FROM user_subscriptions us
         JOIN plan_features pf ON pf.plan_id = us.plan_id AND pf.feature_code = $2
         WHERE us.user_id = $1 AND us.status = 'active' AND us.end_date > CURRENT_TIMESTAMP
         ORDER BY us.end_date DESC LIMIT 1`,
        [userId, featureCode]
      );

      if (currentSub.rows.length === 0) {
        throw new Error('用户没有活跃的订阅或该功能不存在');
      }

      const subscription = currentSub.rows[0];
      const oldValue = subscription.custom_quotas?.[featureCode] ?? subscription.feature_value;

      // 更新自定义配额
      const customQuotas = subscription.custom_quotas || {};
      customQuotas[featureCode] = newValue;

      await client.query(
        'UPDATE user_subscriptions SET custom_quotas = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(customQuotas), subscription.id]
      );

      // 记录调整历史
      const quotaAdjustments = {
        [featureCode]: {
          feature_name: subscription.feature_name,
          old: oldValue,
          new: newValue,
          is_permanent: isPermanent,
        },
      };

      await client.query(
        `INSERT INTO subscription_adjustments 
         (user_id, subscription_id, adjustment_type, quota_adjustments, reason, admin_id, ip_address, user_agent)
         VALUES ($1, $2, 'quota_adjust', $3, $4, $5, $6, $7)`,
        [userId, subscription.id, JSON.stringify(quotaAdjustments), reason, adminId, ipAddress, userAgent]
      );

      await client.query('COMMIT');

      // 发送 WebSocket 通知
      getWsService().sendToUser(userId, 'quota:adjusted', {
        featureCode,
        oldValue,
        newValue,
      });

      // 如果是存储空间配额调整，额外发送存储配额变更通知
      if (featureCode === 'storage_space') {
        getWsService().sendToUser(userId, 'storage_quota_changed', {
          userId,
          newQuotaMB: newValue,
          oldQuotaMB: oldValue,
        });
      }

      console.log(`[SubscriptionManagement] 用户 ${userId} 配额调整: ${featureCode} ${oldValue} -> ${newValue}`);
      
      // 同步配额到所有系统
      const { QuotaSyncService } = await import('./QuotaSyncService');
      await QuotaSyncService.syncUserQuota(userId, `配额调整: ${featureCode}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 重置配额
   */
  async resetQuota(
    userId: number,
    featureCode: string,
    adminId: number,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 获取当前使用量
      const usage = await client.query(
        'SELECT usage_count FROM user_usage WHERE user_id = $1 AND feature_code = $2 AND period_end > CURRENT_TIMESTAMP',
        [userId, featureCode]
      );

      const oldUsage = usage.rows[0]?.usage_count || 0;

      // 重置使用量
      await client.query(
        'DELETE FROM user_usage WHERE user_id = $1 AND feature_code = $2',
        [userId, featureCode]
      );

      // 记录调整历史
      const quotaAdjustments = {
        [featureCode]: {
          action: 'reset',
          old_usage: oldUsage,
          new_usage: 0,
        },
      };

      await client.query(
        `INSERT INTO subscription_adjustments 
         (user_id, subscription_id, adjustment_type, quota_adjustments, reason, admin_id, ip_address, user_agent)
         VALUES ($1, NULL, 'quota_adjust', $2, $3, $4, $5, $6)`,
        [userId, JSON.stringify(quotaAdjustments), reason, adminId, ipAddress, userAgent]
      );

      await client.query('COMMIT');

      // 发送 WebSocket 通知
      getWsService().sendToUser(userId, 'quota:reset', {
        featureCode,
        oldUsage,
      });

      console.log(`[SubscriptionManagement] 用户 ${userId} 配额重置: ${featureCode}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 暂停订阅
   */
  async pauseSubscription(
    userId: number,
    adminId: number,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 获取当前订阅
      const currentSub = await client.query(
        'SELECT id FROM user_subscriptions WHERE user_id = $1 AND status = $2 AND end_date > CURRENT_TIMESTAMP ORDER BY end_date DESC LIMIT 1',
        [userId, 'active']
      );

      if (currentSub.rows.length === 0) {
        throw new Error('用户没有活跃的订阅');
      }

      const subscriptionId = currentSub.rows[0].id;

      // 暂停订阅
      await client.query(
        'UPDATE user_subscriptions SET paused_at = CURRENT_TIMESTAMP, pause_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [reason, subscriptionId]
      );

      // 记录调整历史
      await client.query(
        `INSERT INTO subscription_adjustments 
         (user_id, subscription_id, adjustment_type, reason, admin_id, ip_address, user_agent)
         VALUES ($1, $2, 'pause', $3, $4, $5, $6)`,
        [userId, subscriptionId, reason, adminId, ipAddress, userAgent]
      );

      await client.query('COMMIT');

      // 发送 WebSocket 通知
      getWsService().sendToUser(userId, 'subscription:paused', { reason });

      console.log(`[SubscriptionManagement] 用户 ${userId} 订阅已暂停`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 恢复订阅
   */
  async resumeSubscription(
    userId: number,
    adminId: number,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 获取当前订阅
      const currentSub = await client.query(
        'SELECT id FROM user_subscriptions WHERE user_id = $1 AND status = $2 AND paused_at IS NOT NULL ORDER BY end_date DESC LIMIT 1',
        [userId, 'active']
      );

      if (currentSub.rows.length === 0) {
        throw new Error('用户没有已暂停的订阅');
      }

      const subscriptionId = currentSub.rows[0].id;

      // 恢复订阅
      await client.query(
        'UPDATE user_subscriptions SET paused_at = NULL, pause_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [subscriptionId]
      );

      // 记录调整历史
      await client.query(
        `INSERT INTO subscription_adjustments 
         (user_id, subscription_id, adjustment_type, reason, admin_id, ip_address, user_agent)
         VALUES ($1, $2, 'resume', $3, $4, $5, $6)`,
        [userId, subscriptionId, reason, adminId, ipAddress, userAgent]
      );

      await client.query('COMMIT');

      // 发送 WebSocket 通知
      getWsService().sendToUser(userId, 'subscription:resumed', {});

      console.log(`[SubscriptionManagement] 用户 ${userId} 订阅已恢复`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 取消订阅
   * 取消后自动为用户开通免费版订阅，配额按免费版实时配置重置
   */
  async cancelSubscription(
    userId: number,
    immediate: boolean,
    adminId: number,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 获取当前订阅
      const currentSub = await client.query(
        'SELECT id, plan_id, end_date FROM user_subscriptions WHERE user_id = $1 AND status = $2 ORDER BY end_date DESC LIMIT 1',
        [userId, 'active']
      );

      if (currentSub.rows.length === 0) {
        throw new Error('用户没有活跃的订阅');
      }

      const subscription = currentSub.rows[0];
      const oldEndDate = subscription.end_date;
      const oldPlanId = subscription.plan_id;

      // 获取免费版套餐（包含 duration_days 配置）
      const freePlanResult = await client.query(
        `SELECT id, plan_code, plan_name, duration_days FROM subscription_plans WHERE plan_code = 'free' AND is_active = true`
      );

      if (freePlanResult.rows.length === 0) {
        throw new Error('免费版套餐不存在或未激活');
      }

      const freePlan = freePlanResult.rows[0];

      // 检查当前是否已经是免费版
      if (subscription.plan_id === freePlan.id) {
        throw new Error('当前已是免费版，无法取消');
      }

      if (immediate) {
        // 立即取消：将当前订阅标记为已取消
        await client.query(
          'UPDATE user_subscriptions SET status = $1, end_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['cancelled', subscription.id]
        );

        // 创建新的免费版订阅（根据商品配置的 duration_days 计算有效期）
        const startDate = new Date();
        const endDate = new Date();
        const durationDays = freePlan.duration_days || 365; // 默认1年，但优先使用配置
        endDate.setDate(endDate.getDate() + durationDays);

        await client.query(
          `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date, is_gift, gift_reason)
           VALUES ($1, $2, 'active', $3, $4, true, $5)`,
          [userId, freePlan.id, startDate, endDate, `管理员取消订阅后自动回退: ${reason}`]
        );

        // 清除旧的配额使用记录
        await client.query('DELETE FROM user_usage WHERE user_id = $1', [userId]);

        // 使用统一服务初始化免费版配额（重置使用量）
        await QuotaInitializationService.initializeUserQuotas(userId, freePlan.id, { resetUsage: true, client });

        // 使用统一服务更新存储空间配额
        await QuotaInitializationService.updateStorageQuota(userId, freePlan.id, client);

        console.log(`[SubscriptionManagement] 用户 ${userId} 已回退到免费版`);
      } else {
        // 到期后取消（标记为不续费，到期后系统会自动处理）
        await client.query(
          'UPDATE user_subscriptions SET auto_renew = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [subscription.id]
        );
      }

      // 记录调整历史
      await client.query(
        `INSERT INTO subscription_adjustments 
         (user_id, subscription_id, adjustment_type, old_plan_id, new_plan_id, old_end_date, new_end_date, reason, admin_id, ip_address, user_agent)
         VALUES ($1, $2, 'cancel', $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          subscription.id,
          oldPlanId,
          immediate ? freePlan.id : null,
          oldEndDate,
          immediate ? new Date() : oldEndDate,
          reason,
          adminId,
          ipAddress,
          userAgent,
        ]
      );

      await client.query('COMMIT');

      // 发送 WebSocket 通知
      getWsService().sendToUser(userId, 'subscription:cancelled', { 
        immediate,
        newPlanName: immediate ? freePlan.plan_name : null
      });

      console.log(`[SubscriptionManagement] 用户 ${userId} 订阅已取消 (立即: ${immediate})`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 赠送套餐
   */
  async giftSubscription(
    userId: number,
    planId: number,
    durationDays: number,
    adminId: number,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 获取套餐信息
      const plan = await client.query(
        'SELECT plan_name FROM subscription_plans WHERE id = $1',
        [planId]
      );

      if (plan.rows.length === 0) {
        throw new Error('套餐不存在');
      }

      // 将用户现有的 active 订阅标记为已替换
      await client.query(
        `UPDATE user_subscriptions 
         SET status = 'replaced', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);

      // 创建赠送订阅
      const result = await client.query(
        `INSERT INTO user_subscriptions 
         (user_id, plan_id, status, start_date, end_date, is_gift, gift_reason)
         VALUES ($1, $2, 'active', $3, $4, TRUE, $5)
         RETURNING id`,
        [userId, planId, startDate, endDate, reason]
      );

      const subscriptionId = result.rows[0].id;

      // 使用统一服务处理配额变更（清除旧配额、初始化新配额、更新存储配额）
      await QuotaInitializationService.handlePlanChange(userId, planId, client);

      // 记录调整历史
      await client.query(
        `INSERT INTO subscription_adjustments 
         (user_id, subscription_id, adjustment_type, new_plan_id, new_end_date, 
          days_added, reason, admin_id, ip_address, user_agent)
         VALUES ($1, $2, 'gift', $3, $4, $5, $6, $7, $8, $9)`,
        [userId, subscriptionId, planId, endDate, durationDays, reason, adminId, ipAddress, userAgent]
      );

      await client.query('COMMIT');

      // 发送 WebSocket 通知
      getWsService().sendToUser(userId, 'subscription:gifted', {
        planName: plan.rows[0].plan_name,
        durationDays,
        endDate: endDate.toISOString(),
      });

      console.log(`[SubscriptionManagement] 用户 ${userId} 获得赠送套餐: ${planId} (${durationDays}天)`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取调整历史
   */
  async getAdjustmentHistory(
    userId: number,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ history: AdjustmentHistory[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const result = await pool.query(
      `SELECT * FROM v_subscription_adjustment_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM subscription_adjustments WHERE user_id = $1',
      [userId]
    );

    return {
      history: result.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }
}

export const userSubscriptionManagementService = new UserSubscriptionManagementService();
