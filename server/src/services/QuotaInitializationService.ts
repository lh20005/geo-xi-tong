/**
 * 配额初始化服务
 * 统一管理所有配额初始化逻辑，确保一致性
 */

import { pool } from '../db/database';

export interface QuotaInitOptions {
  /** 是否重置使用量为 0（套餐变更时为 true，续费时为 false） */
  resetUsage?: boolean;
  /** 数据库客户端（用于事务） */
  client?: any;
}

export class QuotaInitializationService {
  /**
   * 初始化用户配额
   * @param userId 用户ID
   * @param planId 套餐ID
   * @param options 初始化选项
   */
  static async initializeUserQuotas(
    userId: number,
    planId: number,
    options: QuotaInitOptions = {}
  ): Promise<number> {
    const { resetUsage = true, client } = options;
    const db = client || pool;

    console.log(`[QuotaInit] 初始化用户 ${userId} 的配额 (planId: ${planId}, resetUsage: ${resetUsage})`);

    try {
      // 获取套餐的所有功能配额
      const featuresResult = await db.query(
        `SELECT feature_code, feature_name, feature_value, feature_unit
         FROM plan_features
         WHERE plan_id = $1`,
        [planId]
      );

      if (featuresResult.rows.length === 0) {
        console.log(`[QuotaInit] ⚠️ 套餐 ${planId} 没有配置功能，跳过配额初始化`);
        return 0;
      }

      const now = new Date();
      let initializedCount = 0;

      for (const feature of featuresResult.rows) {
        const { periodStart, periodEnd } = this.calculatePeriod(feature.feature_code, now);

        if (resetUsage) {
          // 套餐变更：重置使用量为 0
          await db.query(
            `INSERT INTO user_usage (
              user_id, feature_code, usage_count, period_start, period_end, last_reset_at
            ) VALUES ($1, $2, 0, $3, $4, $5)
            ON CONFLICT (user_id, feature_code, period_start) 
            DO UPDATE SET 
              usage_count = 0,
              last_reset_at = $5,
              updated_at = CURRENT_TIMESTAMP`,
            [userId, feature.feature_code, periodStart, periodEnd, periodStart]
          );
        } else {
          // 续费：保留现有使用量
          await db.query(
            `INSERT INTO user_usage (
              user_id, feature_code, usage_count, period_start, period_end, last_reset_at
            ) VALUES ($1, $2, 0, $3, $4, $5)
            ON CONFLICT (user_id, feature_code, period_start) DO NOTHING`,
            [userId, feature.feature_code, periodStart, periodEnd, periodStart]
          );
        }

        initializedCount++;
      }

      console.log(`[QuotaInit] ✅ 成功初始化 ${initializedCount} 项配额记录`);
      return initializedCount;
    } catch (error) {
      console.error('[QuotaInit] 初始化配额失败:', error);
      throw error;
    }
  }

  /**
   * 清除用户所有配额记录
   * @param userId 用户ID
   * @param client 数据库客户端（用于事务）
   */
  static async clearUserQuotas(userId: number, client?: any): Promise<number> {
    const db = client || pool;

    const result = await db.query(
      'DELETE FROM user_usage WHERE user_id = $1 RETURNING feature_code',
      [userId]
    );

    console.log(`[QuotaInit] 清除了用户 ${userId} 的 ${result.rows.length} 条配额记录`);
    return result.rows.length;
  }

  /**
   * 更新用户存储配额
   * @param userId 用户ID
   * @param planId 套餐ID
   * @param client 数据库客户端（用于事务）
   */
  static async updateStorageQuota(userId: number, planId: number, client?: any): Promise<void> {
    const db = client || pool;

    console.log(`[QuotaInit] 更新用户 ${userId} 的存储空间配额...`);

    // 从数据库获取存储空间配额
    const storageFeatureResult = await db.query(
      `SELECT feature_value FROM plan_features 
       WHERE plan_id = $1 AND feature_code = 'storage_space'`,
      [planId]
    );

    let storageQuotaBytes: number;

    if (storageFeatureResult.rows.length > 0) {
      const storageMB = storageFeatureResult.rows[0].feature_value;
      storageQuotaBytes = storageMB === -1 ? -1 : storageMB * 1024 * 1024;
    } else {
      // 默认 10MB
      storageQuotaBytes = 10 * 1024 * 1024;
      console.log(`[QuotaInit] ⚠️ 未找到存储配额配置，使用默认值: 10 MB`);
    }

    // 检查是否已有存储记录
    const existingResult = await db.query(
      `SELECT id FROM user_storage_usage WHERE user_id = $1`,
      [userId]
    );

    if (existingResult.rows.length > 0) {
      await db.query(
        `UPDATE user_storage_usage 
         SET storage_quota_bytes = $1, last_updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [storageQuotaBytes, userId]
      );
    } else {
      await db.query(
        `INSERT INTO user_storage_usage (
          user_id, image_storage_bytes, document_storage_bytes, article_storage_bytes,
          storage_quota_bytes, purchased_storage_bytes
        ) VALUES ($1, 0, 0, 0, $2, 0)`,
        [userId, storageQuotaBytes]
      );
    }

    const quotaDisplay = storageQuotaBytes === -1 ? '无限制' : `${storageQuotaBytes / (1024 * 1024)} MB`;
    console.log(`[QuotaInit] ✅ 存储配额已更新为 ${quotaDisplay}`);
  }

  /**
   * 完整的套餐变更配额处理
   * 包括：清除旧配额、初始化新配额、更新存储配额
   * @param userId 用户ID
   * @param newPlanId 新套餐ID
   * @param client 数据库客户端（用于事务）
   */
  static async handlePlanChange(userId: number, newPlanId: number, client?: any): Promise<void> {
    const db = client || pool;

    console.log(`[QuotaInit] 处理用户 ${userId} 的套餐变更 (newPlanId: ${newPlanId})`);

    // 1. 清除旧配额
    await this.clearUserQuotas(userId, db);

    // 2. 初始化新配额（重置使用量）
    await this.initializeUserQuotas(userId, newPlanId, { resetUsage: true, client: db });

    // 3. 更新存储配额
    await this.updateStorageQuota(userId, newPlanId, db);

    console.log(`[QuotaInit] ✅ 套餐变更配额处理完成`);
  }

  /**
   * 计算配额周期
   * @param featureCode 功能代码
   * @param now 当前时间
   */
  private static calculatePeriod(featureCode: string, now: Date): { periodStart: Date; periodEnd: Date } {
    let periodStart: Date;
    let periodEnd: Date;

    if (featureCode.includes('_per_day')) {
      // 每日重置
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (featureCode.includes('_per_month') || featureCode === 'keyword_distillation') {
      // 每月重置
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else {
      // 永不重置（如平台账号数、存储空间）
      periodStart = new Date(2000, 0, 1);
      periodEnd = new Date(2099, 11, 31);
    }

    return { periodStart, periodEnd };
  }
}
