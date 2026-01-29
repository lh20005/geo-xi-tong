/**
 * 加量包服务
 * 负责加量包的购买资格检查、开通和管理
 */

import { pool } from '../db/database';
import { getWebSocketService } from './WebSocketService';

export interface BoosterQuota {
  id: number;
  userId: number;
  boosterSubscriptionId: number;
  featureCode: string;
  quotaLimit: number;
  quotaUsed: number;
  remaining: number;
  status: 'active' | 'expired' | 'exhausted';
  createdAt: Date;
  expiresAt: Date;
  sourceType?: 'booster' | 'annual_addon';  // 来源类型
  planName?: string;  // 套餐名称
}

export interface BoosterSummary {
  [featureCode: string]: {
    totalLimit: number;
    totalUsed: number;
    totalRemaining: number;
    activePackCount: number;
    earliestExpiration: Date | null;
  };
}

export interface BoosterSubscription {
  id: number;
  userId: number;
  planId: number;
  planType: 'booster';
  status: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export class BoosterPackService {
  /**
   * 检查用户是否可以购买加量包
   * @param userId 用户ID（可选，未认证时为 undefined）
   * @returns 购买资格和原因
   */
  async canPurchaseBooster(userId?: number): Promise<{
    canPurchase: boolean;
    reason?: 'NOT_AUTHENTICATED' | 'NO_ACTIVE_SUBSCRIPTION';
    message?: string;
  }> {
    // 未认证用户不能购买
    if (!userId) {
      return {
        canPurchase: false,
        reason: 'NOT_AUTHENTICATED',
        message: '请先登录'
      };
    }

    // 检查用户是否有活跃的基础订阅（包括免费版）
    const result = await pool.query(
      `SELECT id, plan_id FROM user_subscriptions 
       WHERE user_id = $1 
         AND status = 'active' 
         AND COALESCE(plan_type, 'base') = 'base'
         AND end_date > CURRENT_TIMESTAMP
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        canPurchase: false,
        reason: 'NO_ACTIVE_SUBSCRIPTION',
        message: '请先激活订阅后再购买加量包'
      };
    }

    return { canPurchase: true };
  }

  /**
   * 开通加量包（支付成功后调用）
   * @param userId 用户ID
   * @param planId 加量包套餐ID
   * @param orderId 订单ID
   * @returns 创建的加量包订阅
   */
  async activateBoosterPack(
    userId: number,
    planId: number,
    orderId: number
  ): Promise<BoosterSubscription> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. 获取加量包套餐信息
      const planResult = await client.query(
        `SELECT sp.*, 
          json_agg(
            json_build_object(
              'featureCode', pf.feature_code,
              'featureName', pf.feature_name,
              'featureValue', pf.feature_value,
              'featureUnit', pf.feature_unit
            )
          ) FILTER (WHERE pf.id IS NOT NULL) as features
        FROM subscription_plans sp
        LEFT JOIN plan_features pf ON pf.plan_id = sp.id
        WHERE sp.id = $1 AND sp.plan_type = 'booster'
        GROUP BY sp.id`,
        [planId]
      );

      if (planResult.rows.length === 0) {
        throw new Error('加量包不存在');
      }

      const plan = planResult.rows[0];
      const features = plan.features || [];

      // 2. 计算过期时间
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + (plan.duration_days || 30));
      endDate.setHours(23, 59, 59, 999);

      // 3. 创建加量包订阅记录
      const subscriptionResult = await client.query(
        `INSERT INTO user_subscriptions (
          user_id, plan_id, plan_type, status, start_date, end_date
        ) VALUES ($1, $2, 'booster', 'active', $3, $4)
        RETURNING *`,
        [userId, planId, startDate, endDate]
      );

      const subscription = subscriptionResult.rows[0];

      // 4. 为每个功能创建加量包配额记录（快照当时的配额值）
      for (const feature of features) {
        if (feature.featureValue > 0) {
          await client.query(
            `INSERT INTO user_booster_quotas (
              user_id, booster_subscription_id, feature_code, 
              quota_limit, quota_used, status, expires_at
            ) VALUES ($1, $2, $3, $4, 0, 'active', $5)`,
            [userId, subscription.id, feature.featureCode, feature.featureValue, endDate]
          );
        }
      }

      // 5. 记录使用记录（审计）
      await client.query(
        `INSERT INTO usage_records (
          user_id, feature_code, amount, resource_type, resource_id, metadata, source
        ) VALUES ($1, 'booster_activation', 1, 'booster', $2, $3, 'booster')`,
        [userId, subscription.id, JSON.stringify({
          planId,
          planName: plan.plan_name,
          orderId,
          features: features.map((f: any) => ({
            featureCode: f.featureCode,
            quotaLimit: f.featureValue
          }))
        })]
      );

      await client.query('COMMIT');

      // 6. 推送通知
      try {
        const wsService = getWebSocketService();
        wsService.broadcast(userId, 'booster_activated', {
          subscriptionId: subscription.id,
          planName: plan.plan_name,
          expiresAt: endDate
        });
      } catch (error) {
        console.error('推送加量包开通通知失败:', error);
      }

      return {
        id: subscription.id,
        userId: subscription.user_id,
        planId: subscription.plan_id,
        planType: 'booster',
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        createdAt: subscription.created_at
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('开通加量包失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取用户的活跃加量包配额
   * @param userId 用户ID
   * @param featureCode 功能代码（可选）
   * @returns 加量包配额列表
   */
  async getUserActiveBoosterQuotas(
    userId: number,
    featureCode?: string
  ): Promise<BoosterQuota[]> {
    let query = `
      SELECT 
        ubq.id,
        ubq.user_id as "userId",
        ubq.booster_subscription_id as "boosterSubscriptionId",
        ubq.feature_code as "featureCode",
        ubq.quota_limit as "quotaLimit",
        ubq.quota_used as "quotaUsed",
        (ubq.quota_limit - ubq.quota_used) as remaining,
        ubq.status,
        ubq.created_at as "createdAt",
        ubq.expires_at as "expiresAt",
        COALESCE(ubq.source_type, 'booster') as "sourceType",
        sp.plan_name as "planName"
      FROM user_booster_quotas ubq
      JOIN user_subscriptions us ON ubq.booster_subscription_id = us.id
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE ubq.user_id = $1 
        AND ubq.status = 'active'
        AND ubq.expires_at > CURRENT_TIMESTAMP
    `;

    const params: any[] = [userId];

    if (featureCode) {
      query += ` AND ubq.feature_code = $2`;
      params.push(featureCode);
    }

    query += ` ORDER BY ubq.created_at ASC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * 获取用户的加量包汇总
   * @param userId 用户ID
   * @returns 按功能代码分组的加量包汇总
   */
  async getUserBoosterSummary(userId: number): Promise<BoosterSummary> {
    const result = await pool.query(
      `SELECT * FROM get_user_booster_summary($1)`,
      [userId]
    );

    const summary: BoosterSummary = {};
    for (const row of result.rows) {
      summary[row.feature_code] = {
        totalLimit: row.total_limit,
        totalUsed: row.total_used,
        totalRemaining: row.total_remaining,
        activePackCount: row.active_pack_count,
        earliestExpiration: row.earliest_expiration
      };
    }

    return summary;
  }

  /**
   * 获取用户的加量包订阅历史
   * @param userId 用户ID
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 加量包订阅历史
   */
  async getUserBoosterHistory(
    userId: number,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    records: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * pageSize;

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total 
       FROM user_subscriptions 
       WHERE user_id = $1 AND plan_type = 'booster'`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取分页数据
    const result = await pool.query(
      `SELECT 
        us.id,
        us.plan_id as "planId",
        sp.plan_name as "planName",
        us.status,
        us.start_date as "startDate",
        us.end_date as "endDate",
        us.created_at as "createdAt",
        COALESCE(us.source_type, 'normal') as "sourceType",
        (
          SELECT json_agg(json_build_object(
            'featureCode', ubq.feature_code,
            'quotaLimit', ubq.quota_limit,
            'quotaUsed', ubq.quota_used,
            'status', ubq.status,
            'sourceType', COALESCE(ubq.source_type, 'booster')
          ))
          FROM user_booster_quotas ubq
          WHERE ubq.booster_subscription_id = us.id
        ) as quotas
      FROM user_subscriptions us
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE us.user_id = $1 AND us.plan_type = 'booster'
      ORDER BY us.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset]
    );

    return {
      records: result.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * 检查用户是否有受保护的年度订阅
   * @param userId 用户ID
   * @returns 受保护的年度订阅信息，如果没有则返回 null
   */
  async getProtectedAnnualSubscription(userId: number): Promise<{
    subscriptionId: number;
    planId: number;
    planCode: string;
    planName: string;
    startDate: Date;
    endDate: Date;
  } | null> {
    const result = await pool.query(
      `SELECT * FROM get_user_protected_annual_subscription($1)`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      subscriptionId: row.subscription_id,
      planId: row.plan_id,
      planCode: row.plan_code,
      planName: row.plan_name,
      startDate: row.start_date,
      endDate: row.end_date
    };
  }

  /**
   * 将套餐转换为加量包配额（年度套餐用户额外购买时使用）
   * @param userId 用户ID
   * @param planId 购买的套餐ID
   * @param orderId 订单ID
   * @returns 创建的加量包订阅
   */
  async activateAnnualAddonPack(
    userId: number,
    planId: number,
    orderId: number
  ): Promise<BoosterSubscription> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. 检查用户是否有受保护的年度订阅
      const protectedSub = await this.getProtectedAnnualSubscription(userId);
      if (!protectedSub) {
        throw new Error('用户没有受保护的年度订阅');
      }

      // 2. 获取套餐信息
      const planResult = await client.query(
        `SELECT sp.*, 
          json_agg(
            json_build_object(
              'featureCode', pf.feature_code,
              'featureName', pf.feature_name,
              'featureValue', pf.feature_value,
              'featureUnit', pf.feature_unit
            )
          ) FILTER (WHERE pf.id IS NOT NULL) as features
        FROM subscription_plans sp
        LEFT JOIN plan_features pf ON pf.plan_id = sp.id
        WHERE sp.id = $1
        GROUP BY sp.id`,
        [planId]
      );

      if (planResult.rows.length === 0) {
        throw new Error('套餐不存在');
      }

      const plan = planResult.rows[0];
      const features = plan.features || [];

      // 3. 计算过期时间
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + (plan.duration_days || 30));
      endDate.setHours(23, 59, 59, 999);

      // 4. 创建加量包订阅记录（标记为年度套餐额外购买）
      const subscriptionResult = await client.query(
        `INSERT INTO user_subscriptions (
          user_id, plan_id, plan_type, status, start_date, end_date, source_type
        ) VALUES ($1, $2, 'booster', 'active', $3, $4, 'annual_addon')
        RETURNING *`,
        [userId, planId, startDate, endDate]
      );

      const subscription = subscriptionResult.rows[0];

      // 5. 为每个功能创建加量包配额记录
      for (const feature of features) {
        if (feature.featureValue > 0) {
          await client.query(
            `INSERT INTO user_booster_quotas (
              user_id, booster_subscription_id, feature_code, 
              quota_limit, quota_used, status, expires_at, source_type
            ) VALUES ($1, $2, $3, $4, 0, 'active', $5, 'annual_addon')`,
            [userId, subscription.id, feature.featureCode, feature.featureValue, endDate]
          );
        }
      }

      // 6. 记录使用记录（审计）
      await client.query(
        `INSERT INTO usage_records (
          user_id, feature_code, amount, resource_type, resource_id, metadata, source
        ) VALUES ($1, 'annual_addon_activation', 1, 'annual_addon', $2, $3, 'booster')`,
        [userId, subscription.id, JSON.stringify({
          planId,
          planName: plan.plan_name,
          orderId,
          protectedSubscriptionId: protectedSub.subscriptionId,
          protectedPlanName: protectedSub.planName,
          features: features.filter((f: any) => f.featureValue > 0).map((f: any) => ({
            featureCode: f.featureCode,
            quotaLimit: f.featureValue
          }))
        })]
      );

      await client.query('COMMIT');

      // 7. 推送通知
      try {
        const wsService = getWebSocketService();
        wsService.broadcast(userId, 'annual_addon_activated', {
          subscriptionId: subscription.id,
          planName: plan.plan_name,
          protectedPlanName: protectedSub.planName,
          expiresAt: endDate,
          message: `您的年度会员（${protectedSub.planName}）权益不受影响，${plan.plan_name} 的配额已叠加到您的账户`
        });
      } catch (error) {
        console.error('推送年度套餐额外购买通知失败:', error);
      }

      console.log(`[BoosterPackService] ✅ 年度套餐用户 ${userId} 额外购买 ${plan.plan_name} 已转换为加量包`);

      return {
        id: subscription.id,
        userId: subscription.user_id,
        planId: subscription.plan_id,
        planType: 'booster',
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        createdAt: subscription.created_at
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('年度套餐额外购买转换失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const boosterPackService = new BoosterPackService();
