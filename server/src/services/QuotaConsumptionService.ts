/**
 * 配额消耗服务
 * 负责配额消耗逻辑，实现优先级消耗和 FIFO 策略
 */

import { pool } from '../db/database';
import { FeatureCode } from '../config/features';
import { getWebSocketService } from './WebSocketService';

export interface QuotaCheckResult {
  hasQuota: boolean;
  baseQuota: {
    limit: number;
    used: number;
    remaining: number;
  };
  boosterQuota: {
    totalLimit: number;
    totalUsed: number;
    totalRemaining: number;
  };
  combinedRemaining: number;
}

export interface ConsumptionResult {
  success: boolean;
  consumedFrom: 'base' | 'booster' | null;
  boosterSubscriptionId?: number;
  baseQuotaRemaining: number;
  boosterQuotaRemaining: number;
  errorMessage?: string;
}

export interface CombinedQuotaOverview {
  featureCode: string;
  featureName: string;
  baseQuota: {
    limit: number;
    used: number;
    remaining: number;
    percentage: number;
    resetTime?: string;
  };
  boosterQuota: {
    totalLimit: number;
    totalUsed: number;
    totalRemaining: number;
    activePackCount: number;
    earliestExpiration?: string;
    isBeingConsumed: boolean;
    expirationWarning?: boolean;
    hasAnnualAddon?: boolean;  // 是否包含年度套餐额外购买的配额
  };
  combinedRemaining: number;
}

export class QuotaConsumptionService {
  /**
   * 检查用户是否有足够配额（基础 + 加量包）
   * @param userId 用户ID
   * @param featureCode 功能代码
   * @param amount 需要的配额数量
   * @returns 配额检查结果
   */
  async checkCombinedQuota(
    userId: number,
    featureCode: string,
    amount: number = 1
  ): Promise<QuotaCheckResult> {
    const result = await pool.query(
      `SELECT * FROM check_combined_quota($1, $2)`,
      [userId, featureCode]
    );

    if (result.rows.length === 0) {
      return {
        hasQuota: false,
        baseQuota: { limit: 0, used: 0, remaining: 0 },
        boosterQuota: { totalLimit: 0, totalUsed: 0, totalRemaining: 0 },
        combinedRemaining: 0
      };
    }

    const row = result.rows[0];
    const combinedRemaining = row.combined_remaining;

    return {
      hasQuota: combinedRemaining >= amount,
      baseQuota: {
        limit: row.base_limit,
        used: row.base_used,
        remaining: row.base_remaining
      },
      boosterQuota: {
        totalLimit: row.booster_total_limit,
        totalUsed: row.booster_total_used,
        totalRemaining: row.booster_remaining
      },
      combinedRemaining
    };
  }

  /**
   * 消耗配额（自动处理优先级：基础优先，然后FIFO消耗加量包）
   * @param userId 用户ID
   * @param featureCode 功能代码
   * @param amount 消耗数量
   * @param metadata 额外信息
   * @returns 消耗结果
   */
  async consumeQuota(
    userId: number,
    featureCode: string,
    amount: number = 1,
    metadata?: any
  ): Promise<ConsumptionResult> {
    const result = await pool.query(
      `SELECT * FROM consume_quota_with_booster($1, $2, $3)`,
      [userId, featureCode, amount]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        consumedFrom: null,
        baseQuotaRemaining: 0,
        boosterQuotaRemaining: 0,
        errorMessage: '配额检查失败'
      };
    }

    const row = result.rows[0];

    // 如果消耗成功且来自加量包，记录到 usage_records
    if (row.success && row.consumed_from === 'booster') {
      await pool.query(
        `INSERT INTO usage_records (
          user_id, feature_code, amount, resource_type, metadata, source, booster_subscription_id
        ) VALUES ($1, $2, $3, 'quota_consumption', $4, 'booster', $5)`,
        [userId, featureCode, amount, metadata ? JSON.stringify(metadata) : null, row.booster_subscription_id]
      );
    }

    // 推送配额更新通知
    if (row.success) {
      try {
        const wsService = getWebSocketService();
        const overview = await this.getCombinedQuotaOverview(userId);
        wsService.broadcast(userId, 'quota_updated', {
          featureCode,
          consumedFrom: row.consumed_from,
          amount,
          overview
        });
      } catch (error) {
        console.error('推送配额更新通知失败:', error);
      }
    }

    return {
      success: row.success,
      consumedFrom: row.consumed_from,
      boosterSubscriptionId: row.booster_subscription_id,
      baseQuotaRemaining: row.base_remaining,
      boosterQuotaRemaining: row.booster_remaining,
      errorMessage: row.error_message
    };
  }

  /**
   * 获取组合配额概览
   * @param userId 用户ID
   * @returns 所有功能的组合配额概览
   */
  async getCombinedQuotaOverview(userId: number): Promise<CombinedQuotaOverview[]> {
    // 获取用户订阅的所有功能
    const featuresResult = await pool.query(
      `SELECT DISTINCT 
        pf.feature_code,
        pf.feature_name
      FROM user_subscriptions us
      JOIN plan_features pf ON pf.plan_id = us.plan_id
      WHERE us.user_id = $1 
        AND us.status = 'active'
        AND COALESCE(us.plan_type, 'base') = 'base'
        AND us.end_date > CURRENT_TIMESTAMP`,
      [userId]
    );

    const overview: CombinedQuotaOverview[] = [];

    for (const feature of featuresResult.rows) {
      const featureCode = feature.feature_code;
      const featureName = feature.feature_name;

      // 获取组合配额信息
      const quotaResult = await pool.query(
        `SELECT * FROM check_combined_quota($1, $2)`,
        [userId, featureCode]
      );

      if (quotaResult.rows.length === 0) continue;

      const quota = quotaResult.rows[0];

      // 获取加量包详细信息
      const boosterResult = await pool.query(
        `SELECT 
          COUNT(*) as active_pack_count,
          MIN(expires_at) as earliest_expiration,
          BOOL_OR(COALESCE(source_type, 'booster') = 'annual_addon') as has_annual_addon
        FROM user_booster_quotas
        WHERE user_id = $1 
          AND feature_code = $2 
          AND status = 'active'
          AND expires_at > CURRENT_TIMESTAMP`,
        [userId, featureCode]
      );

      const boosterInfo = boosterResult.rows[0];
      const earliestExpiration = boosterInfo.earliest_expiration;
      const hasAnnualAddon = boosterInfo.has_annual_addon || false;
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // 计算基础配额百分比
      const basePercentage = quota.base_limit > 0 
        ? Math.min(100, (quota.base_used / quota.base_limit) * 100)
        : 0;

      // 判断是否正在消耗加量包（基础配额已耗尽）
      const isBeingConsumed = quota.base_remaining <= 0 && quota.booster_remaining > 0;

      // 判断是否有过期警告（7天内过期）
      const expirationWarning = earliestExpiration 
        ? new Date(earliestExpiration) <= sevenDaysFromNow
        : false;

      overview.push({
        featureCode,
        featureName,
        baseQuota: {
          limit: quota.base_limit,
          used: quota.base_used,
          remaining: quota.base_remaining,
          percentage: Math.round(basePercentage * 100) / 100
        },
        boosterQuota: {
          totalLimit: quota.booster_total_limit,
          totalUsed: quota.booster_total_used,
          totalRemaining: quota.booster_remaining,
          activePackCount: parseInt(boosterInfo.active_pack_count) || 0,
          earliestExpiration: earliestExpiration?.toISOString(),
          isBeingConsumed,
          expirationWarning,
          hasAnnualAddon  // 是否包含年度套餐额外购买的配额
        },
        combinedRemaining: quota.combined_remaining
      });
    }

    return overview;
  }

  /**
   * 获取单个功能的组合配额信息
   * @param userId 用户ID
   * @param featureCode 功能代码
   * @returns 组合配额信息
   */
  async getFeatureCombinedQuota(
    userId: number,
    featureCode: string
  ): Promise<CombinedQuotaOverview | null> {
    const overview = await this.getCombinedQuotaOverview(userId);
    return overview.find(o => o.featureCode === featureCode) || null;
  }
}

export const quotaConsumptionService = new QuotaConsumptionService();
