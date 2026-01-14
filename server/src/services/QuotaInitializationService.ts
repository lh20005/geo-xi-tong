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
  /** 订阅开始日期（用于计算配额周期） */
  subscriptionStartDate?: Date;
}

export class QuotaInitializationService {
  /**
   * 不应在套餐变更时重置的功能代码
   * - platform_accounts: 平台账号数是实际资源，不应重置
   * - storage_space: 存储空间使用量在 user_storage_usage 表中，不在此处理
   */
  private static readonly PRESERVE_ON_PLAN_CHANGE = ['platform_accounts'];

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
    const { resetUsage = true, client, subscriptionStartDate } = options;
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

      // 获取订阅开始日期（优先使用传入的，否则查询数据库）
      let startDate = subscriptionStartDate;
      if (!startDate) {
        const subResult = await db.query(
          `SELECT start_date FROM user_subscriptions 
           WHERE user_id = $1 AND status = 'active' 
           ORDER BY created_at DESC LIMIT 1`,
          [userId]
        );
        if (subResult.rows.length > 0) {
          startDate = new Date(subResult.rows[0].start_date);
        } else {
          startDate = new Date(); // 兜底使用当前时间
        }
      }

      const now = new Date();
      let initializedCount = 0;

      for (const feature of featuresResult.rows) {
        const { periodStart, periodEnd } = this.calculatePeriod(feature.feature_code, now, startDate);
        
        // 判断是否应该保留使用量（平台账号数等不应重置）
        const shouldPreserve = this.PRESERVE_ON_PLAN_CHANGE.includes(feature.feature_code);

        if (resetUsage && !shouldPreserve) {
          // 套餐变更：重置使用量为 0（但保留 platform_accounts 等）
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
          // 续费或需要保留的配额：保留现有使用量
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

      console.log(`[QuotaInit] ✅ 成功初始化 ${initializedCount} 项配额记录 (周期起始: ${startDate.toISOString().split('T')[0]})`);
      return initializedCount;
    } catch (error) {
      console.error('[QuotaInit] 初始化配额失败:', error);
      throw error;
    }
  }

  /**
   * 清除用户配额记录（保留不应重置的配额）
   * @param userId 用户ID
   * @param client 数据库客户端（用于事务）
   * @param preserveFeatures 需要保留的功能代码列表（如平台账号数）
   */
  static async clearUserQuotas(
    userId: number, 
    client?: any,
    preserveFeatures: string[] = ['platform_accounts']
  ): Promise<number> {
    const db = client || pool;

    // 清除所有需要重置的配额记录（包括所有周期的记录）
    // 保留 platform_accounts 等不应重置的配额
    const result = await db.query(
      `DELETE FROM user_usage 
       WHERE user_id = $1 
       AND feature_code NOT IN (SELECT unnest($2::varchar[]))
       RETURNING feature_code, period_start`,
      [userId, preserveFeatures]
    );

    console.log(`[QuotaInit] 清除了用户 ${userId} 的 ${result.rows.length} 条配额记录（保留: ${preserveFeatures.join(', ')}）`);
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
      // 从免费版套餐获取默认存储配额
      const defaultQuotaResult = await db.query(
        `SELECT pf.feature_value FROM plan_features pf
         JOIN subscription_plans sp ON pf.plan_id = sp.id
         WHERE sp.plan_code = 'free' AND pf.feature_code = 'storage_space'`
      );
      
      if (defaultQuotaResult.rows.length > 0) {
        const defaultMB = defaultQuotaResult.rows[0].feature_value;
        storageQuotaBytes = defaultMB === -1 ? -1 : defaultMB * 1024 * 1024;
        console.log(`[QuotaInit] ⚠️ 套餐未配置存储配额，使用免费版默认值: ${defaultMB} MB`);
      } else {
        // 最后的兜底值，仅在数据库完全没有配置时使用
        storageQuotaBytes = 10 * 1024 * 1024;
        console.log(`[QuotaInit] ⚠️ 未找到任何存储配额配置，使用兜底值: 10 MB`);
      }
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
   * @param subscriptionStartDate 订阅开始日期（可选，不传则从数据库查询）
   */
  static async handlePlanChange(
    userId: number, 
    newPlanId: number, 
    client?: any,
    subscriptionStartDate?: Date
  ): Promise<void> {
    const db = client || pool;

    console.log(`[QuotaInit] 处理用户 ${userId} 的套餐变更 (newPlanId: ${newPlanId})`);

    // 1. 清除旧配额
    await this.clearUserQuotas(userId, db);

    // 2. 初始化新配额（重置使用量，传入订阅开始日期）
    await this.initializeUserQuotas(userId, newPlanId, { 
      resetUsage: true, 
      client: db,
      subscriptionStartDate 
    });

    // 3. 更新存储配额
    await this.updateStorageQuota(userId, newPlanId, db);

    console.log(`[QuotaInit] ✅ 套餐变更配额处理完成`);
  }

  /**
   * 计算配额周期（基于订阅开始日期）
   * @param featureCode 功能代码
   * @param now 当前时间
   * @param subscriptionStartDate 订阅开始日期
   */
  private static calculatePeriod(
    featureCode: string, 
    now: Date,
    subscriptionStartDate: Date
  ): { periodStart: Date; periodEnd: Date } {
    let periodStart: Date;
    let periodEnd: Date;

    if (featureCode.includes('_per_day')) {
      // 每日重置：基于订阅开始日期的每日周期
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (featureCode.includes('_per_month') || featureCode === 'keyword_distillation') {
      // 每月重置：基于订阅开始日期计算当前周期
      // 例如：订阅开始日期是1月14日，则周期为 1/14-2/13, 2/14-3/13, ...
      const startDay = subscriptionStartDate.getDate();
      const startTime = subscriptionStartDate.getTime();
      
      // 计算从订阅开始到现在经过了多少个完整月
      let monthsDiff = (now.getFullYear() - subscriptionStartDate.getFullYear()) * 12 
                     + (now.getMonth() - subscriptionStartDate.getMonth());
      
      // 如果当前日期在本月周期开始日之前，说明还在上个周期
      if (now.getDate() < startDay) {
        monthsDiff--;
      }
      
      // 确保不会计算到订阅开始之前
      if (monthsDiff < 0) {
        monthsDiff = 0;
      }
      
      // 计算当前周期的开始日期
      periodStart = new Date(subscriptionStartDate);
      periodStart.setMonth(subscriptionStartDate.getMonth() + monthsDiff);
      periodStart.setHours(0, 0, 0, 0);
      
      // 计算当前周期的结束日期（下个周期开始前一天）
      periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(periodEnd.getDate() - 1);
      periodEnd.setHours(23, 59, 59, 999);
      
    } else {
      // 永不重置（如平台账号数、存储空间）
      periodStart = new Date(2000, 0, 1);
      periodEnd = new Date(2099, 11, 31);
    }

    return { periodStart, periodEnd };
  }
}
