/**
 * 加量包过期服务
 * 负责定时检查和处理过期的加量包配额
 */

import { pool } from '../db/database';
import { getWebSocketService } from './WebSocketService';

export interface ExpirationCheckResult {
  expiredCount: number;
  warningsSent: number;
}

export class BoosterExpirationService {
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * 启动定时过期检查
   * @param intervalMs 检查间隔（毫秒），默认1小时
   */
  startPeriodicCheck(intervalMs: number = 60 * 60 * 1000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // 立即执行一次
    this.runExpirationCheck().catch(err => {
      console.error('加量包过期检查失败:', err);
    });

    // 设置定时任务
    this.checkInterval = setInterval(() => {
      this.runExpirationCheck().catch(err => {
        console.error('加量包过期检查失败:', err);
      });
    }, intervalMs);

    console.log(`[BoosterExpirationService] 已启动定时过期检查，间隔: ${intervalMs}ms`);
  }

  /**
   * 停止定时过期检查
   */
  stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[BoosterExpirationService] 已停止定时过期检查');
    }
  }

  /**
   * 执行过期检查
   * @returns 检查结果
   */
  async runExpirationCheck(): Promise<ExpirationCheckResult> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. 更新过期的加量包配额状态
      const expiredResult = await client.query(
        `SELECT expire_booster_quotas() as expired_count`
      );
      const expiredCount = expiredResult.rows[0]?.expired_count || 0;

      if (expiredCount > 0) {
        console.log(`[BoosterExpirationService] 已过期 ${expiredCount} 个加量包配额`);
      }

      // 2. 发送即将过期警告（3天内过期）
      const warningsSent = await this.sendExpirationWarnings(client);

      await client.query('COMMIT');

      return { expiredCount, warningsSent };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 发送即将过期警告
   * @param client 数据库客户端
   * @returns 发送的警告数量
   */
  private async sendExpirationWarnings(client: any): Promise<number> {
    // 查找3天内即将过期的加量包（每个用户每个功能只发一次）
    const warningsResult = await client.query(
      `SELECT DISTINCT ON (ubq.user_id, ubq.feature_code)
        ubq.user_id,
        ubq.feature_code,
        ubq.expires_at,
        sp.plan_name
      FROM user_booster_quotas ubq
      JOIN user_subscriptions us ON us.id = ubq.booster_subscription_id
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE ubq.status = 'active'
        AND ubq.expires_at > CURRENT_TIMESTAMP
        AND ubq.expires_at <= CURRENT_TIMESTAMP + INTERVAL '3 days'
        AND NOT EXISTS (
          SELECT 1 FROM quota_alerts qa
          WHERE qa.user_id = ubq.user_id
            AND qa.feature_code = ubq.feature_code
            AND qa.alert_type = 'booster_expiring'
            AND qa.created_at >= CURRENT_TIMESTAMP - INTERVAL '1 day'
        )
      ORDER BY ubq.user_id, ubq.feature_code, ubq.expires_at ASC`
    );

    let warningsSent = 0;

    for (const row of warningsResult.rows) {
      try {
        // 记录警告
        await client.query(
          `INSERT INTO quota_alerts (
            user_id, feature_code, alert_type, threshold_percentage,
            current_usage, quota_limit, is_sent, metadata
          ) VALUES ($1, $2, 'booster_expiring', 0, 0, 0, FALSE, $3)`,
          [row.user_id, row.feature_code, JSON.stringify({
            expiresAt: row.expires_at,
            planName: row.plan_name
          })]
        );

        // 推送通知
        try {
          const wsService = getWebSocketService();
          wsService.broadcast(row.user_id, 'booster_expiring', {
            featureCode: row.feature_code,
            expiresAt: row.expires_at,
            planName: row.plan_name,
            daysRemaining: Math.ceil(
              (new Date(row.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
          });
        } catch (wsError) {
          console.error('推送加量包过期警告失败:', wsError);
        }

        warningsSent++;
      } catch (error) {
        console.error(`发送过期警告失败 (user: ${row.user_id}, feature: ${row.feature_code}):`, error);
      }
    }

    if (warningsSent > 0) {
      console.log(`[BoosterExpirationService] 已发送 ${warningsSent} 个过期警告`);
    }

    return warningsSent;
  }

  /**
   * 手动过期指定的加量包配额
   * @param quotaId 配额ID
   * @returns 是否成功
   */
  async expireQuota(quotaId: number): Promise<boolean> {
    const result = await pool.query(
      `UPDATE user_booster_quotas
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'active'
       RETURNING user_id, feature_code`,
      [quotaId]
    );

    if (result.rows.length > 0) {
      const { user_id, feature_code } = result.rows[0];
      
      // 推送通知
      try {
        const wsService = getWebSocketService();
        wsService.broadcast(user_id, 'booster_expired', {
          quotaId,
          featureCode: feature_code
        });
      } catch (error) {
        console.error('推送加量包过期通知失败:', error);
      }

      return true;
    }

    return false;
  }

  /**
   * 获取即将过期的加量包列表
   * @param userId 用户ID
   * @param daysAhead 提前天数（默认7天）
   * @returns 即将过期的加量包列表
   */
  async getExpiringBoosters(
    userId: number,
    daysAhead: number = 7
  ): Promise<Array<{
    id: number;
    featureCode: string;
    featureName: string;
    quotaLimit: number;
    quotaUsed: number;
    remaining: number;
    expiresAt: Date;
    daysRemaining: number;
    planName: string;
  }>> {
    const result = await pool.query(
      `SELECT 
        ubq.id,
        ubq.feature_code as "featureCode",
        COALESCE(pf.feature_name, ubq.feature_code) as "featureName",
        ubq.quota_limit as "quotaLimit",
        ubq.quota_used as "quotaUsed",
        (ubq.quota_limit - ubq.quota_used) as remaining,
        ubq.expires_at as "expiresAt",
        CEIL(EXTRACT(EPOCH FROM (ubq.expires_at - CURRENT_TIMESTAMP)) / 86400) as "daysRemaining",
        sp.plan_name as "planName"
      FROM user_booster_quotas ubq
      JOIN user_subscriptions us ON us.id = ubq.booster_subscription_id
      JOIN subscription_plans sp ON sp.id = us.plan_id
      LEFT JOIN plan_features pf ON pf.plan_id = us.plan_id AND pf.feature_code = ubq.feature_code
      WHERE ubq.user_id = $1
        AND ubq.status = 'active'
        AND ubq.expires_at > CURRENT_TIMESTAMP
        AND ubq.expires_at <= CURRENT_TIMESTAMP + INTERVAL '1 day' * $2
      ORDER BY ubq.expires_at ASC`,
      [userId, daysAhead]
    );

    return result.rows;
  }
}

export const boosterExpirationService = new BoosterExpirationService();
