import { pool } from '../db/database';
import { FeatureCode } from '../config/features';
import { getWebSocketService } from './WebSocketService';

/**
 * 使用量追踪服务
 * 负责记录和查询用户功能使用量
 */
export class UsageTrackingService {
  /**
   * 记录功能使用
   * @param userId 用户ID
   * @param featureCode 功能代码
   * @param resourceType 资源类型（article, publish, distillation, platform_account）
   * @param resourceId 资源ID
   * @param amount 使用量（默认1）
   * @param metadata 额外信息
   */
  async recordUsage(
    userId: number,
    featureCode: FeatureCode,
    resourceType?: string,
    resourceId?: number,
    amount: number = 1,
    metadata?: any
  ): Promise<void> {
    try {
      // 使用数据库函数记录使用量
      // 显式类型转换避免 PostgreSQL 无法推断参数类型
      await pool.query(
        `SELECT record_feature_usage($1::INTEGER, $2::VARCHAR, $3::VARCHAR, $4::INTEGER, $5::INTEGER, $6::JSONB)`,
        [
          userId,
          featureCode,
          resourceType || null,
          resourceId || null,
          amount,
          metadata ? JSON.stringify(metadata) : null
        ]
      );

      // 推送配额更新通知
      await this.notifyQuotaUpdate(userId, featureCode);
    } catch (error) {
      console.error('记录使用量失败:', error);
      throw error;
    }
  }

  /**
   * 检查用户配额
   * @param userId 用户ID
   * @param featureCode 功能代码
   * @returns 配额信息
   */
  async checkQuota(userId: number, featureCode: FeatureCode): Promise<{
    hasQuota: boolean;
    currentUsage: number;
    quotaLimit: number;
    remaining: number;
    percentage: number;
  }> {
    try {
      const result = await pool.query(
        `SELECT * FROM check_user_quota($1, $2)`,
        [userId, featureCode]
      );

      if (result.rows.length === 0) {
        return {
          hasQuota: false,
          currentUsage: 0,
          quotaLimit: 0,
          remaining: 0,
          percentage: 0
        };
      }

      const row = result.rows[0];
      return {
        hasQuota: row.has_quota,
        currentUsage: row.current_usage,
        quotaLimit: row.quota_limit,
        remaining: row.remaining,
        percentage: parseFloat(row.percentage)
      };
    } catch (error) {
      console.error('检查配额失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户使用记录
   * @param userId 用户ID
   * @param featureCode 功能代码（可选）
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 使用记录列表
   */
  async getUserUsageRecords(
    userId: number,
    featureCode?: FeatureCode,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    records: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const offset = (page - 1) * pageSize;
      
      let query = `
        SELECT 
          ur.*,
          CASE 
            WHEN ur.feature_code = 'articles_per_month' THEN '每月生成文章数'
            WHEN ur.feature_code = 'publish_per_month' THEN '每月发布文章数'
            WHEN ur.feature_code = 'platform_accounts' THEN '平台账号数'
            WHEN ur.feature_code = 'keyword_distillation' THEN '关键词蒸馏数'
            ELSE ur.feature_code
          END as feature_name
        FROM usage_records ur
        WHERE ur.user_id = $1
      `;
      
      const params: any[] = [userId];
      
      if (featureCode) {
        query += ` AND ur.feature_code = $2`;
        params.push(featureCode);
      }
      
      // 获取总数
      const countQuery = query.replace('SELECT ur.*,', 'SELECT COUNT(*) as total,').replace(/CASE.*END as feature_name/, '1');
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0]?.total || '0');
      
      // 获取分页数据
      query += ` ORDER BY ur.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(pageSize, offset);
      
      const result = await pool.query(query, params);
      
      return {
        records: result.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error('获取使用记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户配额概览
   * @param userId 用户ID
   * @returns 配额概览
   */
  async getUserQuotaOverview(userId: number): Promise<any[]> {
    try {
      // 直接查询，不使用视图
      const result = await pool.query(
        `WITH latest_subscription AS (
          SELECT DISTINCT ON (user_id)
            id, user_id, plan_id, custom_quotas, start_date, end_date
          FROM user_subscriptions
          WHERE status = 'active' AND user_id = $1
          ORDER BY user_id, end_date DESC
        )
        SELECT 
          pf.feature_code,
          pf.feature_name,
          COALESCE(
            (us.custom_quotas->>pf.feature_code)::INTEGER,
            pf.feature_value
          ) AS quota_limit,
          COALESCE(uu.usage_count, 0) AS current_usage,
          CASE 
            WHEN COALESCE((us.custom_quotas->>pf.feature_code)::INTEGER, pf.feature_value) = -1 THEN -1
            ELSE GREATEST(0, COALESCE((us.custom_quotas->>pf.feature_code)::INTEGER, pf.feature_value) - COALESCE(uu.usage_count, 0))
          END AS remaining,
          CASE 
            WHEN COALESCE((us.custom_quotas->>pf.feature_code)::INTEGER, pf.feature_value) = -1 THEN 0
            WHEN COALESCE((us.custom_quotas->>pf.feature_code)::INTEGER, pf.feature_value) > 0 THEN 
              ROUND((COALESCE(uu.usage_count, 0)::NUMERIC / COALESCE((us.custom_quotas->>pf.feature_code)::INTEGER, pf.feature_value)::NUMERIC) * 100, 2)
            ELSE 0
          END AS usage_percentage,
          uu.period_start,
          uu.period_end,
          us.end_date AS subscription_end_date,
          sp.plan_name,
          sp.plan_code
        FROM latest_subscription us
        JOIN subscription_plans sp ON sp.id = us.plan_id
        JOIN plan_features pf ON pf.plan_id = sp.id
        LEFT JOIN LATERAL (
          SELECT usage_count, period_start, period_end
          FROM user_usage
          WHERE user_id = $1 
            AND feature_code = pf.feature_code
            AND period_start::date <= CURRENT_DATE
            AND period_end::date >= CURRENT_DATE
          ORDER BY period_start DESC
          LIMIT 1
        ) uu ON true
        ORDER BY pf.feature_code`,
        [userId]
      );
      
      return result.rows.map(row => ({
        featureCode: row.feature_code,
        featureName: row.feature_name,
        quotaLimit: row.quota_limit,
        currentUsage: row.current_usage,
        remaining: row.remaining,
        usagePercentage: parseFloat(row.usage_percentage || '0'),
        periodStart: row.period_start,
        periodEnd: row.period_end,
        subscriptionEndDate: row.subscription_end_date,
        planName: row.plan_name,
        planCode: row.plan_code
      }));
    } catch (error) {
      console.error('获取配额概览失败:', error);
      throw error;
    }
  }

  /**
   * 获取使用统计（按时间范围）
   * @param userId 用户ID
   * @param featureCode 功能代码
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 统计数据
   */
  async getUsageStatistics(
    userId: number,
    featureCode: FeatureCode,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalUsage: number;
    dailyUsage: Array<{ date: string; count: number }>;
  }> {
    try {
      // 获取总使用量
      const totalResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM usage_records
         WHERE user_id = $1 
           AND feature_code = $2
           AND created_at BETWEEN $3 AND $4`,
        [userId, featureCode, startDate, endDate]
      );
      
      // 获取每日使用量
      const dailyResult = await pool.query(
        `SELECT 
           DATE(created_at) as date,
           SUM(amount) as count
         FROM usage_records
         WHERE user_id = $1 
           AND feature_code = $2
           AND created_at BETWEEN $3 AND $4
         GROUP BY DATE(created_at)
         ORDER BY date`,
        [userId, featureCode, startDate, endDate]
      );
      
      return {
        totalUsage: parseInt(totalResult.rows[0]?.total || '0'),
        dailyUsage: dailyResult.rows.map(row => ({
          date: row.date,
          count: parseInt(row.count)
        }))
      };
    } catch (error) {
      console.error('获取使用统计失败:', error);
      throw error;
    }
  }

  /**
   * 推送配额更新通知
   * @param userId 用户ID
   * @param featureCode 功能代码
   */
  private async notifyQuotaUpdate(userId: number, featureCode: FeatureCode): Promise<void> {
    try {
      const wsService = getWebSocketService();
      const overview = await this.getUserQuotaOverview(userId);
      
      wsService.broadcast(userId, 'quota_updated', {
        featureCode,
        overview
      });
    } catch (error) {
      console.error('推送配额更新通知失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 批量检查配额
   * @param userId 用户ID
   * @param featureCodes 功能代码列表
   * @returns 配额信息映射
   */
  async batchCheckQuota(
    userId: number,
    featureCodes: FeatureCode[]
  ): Promise<Map<FeatureCode, {
    hasQuota: boolean;
    currentUsage: number;
    quotaLimit: number;
    remaining: number;
    percentage: number;
  }>> {
    const result = new Map();
    
    for (const featureCode of featureCodes) {
      const quota = await this.checkQuota(userId, featureCode);
      result.set(featureCode, quota);
    }
    
    return result;
  }

  /**
   * 重置用户配额（用于测试或管理员操作）
   * @param userId 用户ID
   * @param featureCode 功能代码
   */
  async resetUserQuota(userId: number, featureCode: FeatureCode): Promise<void> {
    try {
      await pool.query(
        `DELETE FROM user_usage 
         WHERE user_id = $1 AND feature_code = $2`,
        [userId, featureCode]
      );
      
      await pool.query(
        `DELETE FROM usage_records 
         WHERE user_id = $1 AND feature_code = $2`,
        [userId, featureCode]
      );
      
      // 推送更新通知
      await this.notifyQuotaUpdate(userId, featureCode);
    } catch (error) {
      console.error('重置配额失败:', error);
      throw error;
    }
  }
}

export const usageTrackingService = new UsageTrackingService();
