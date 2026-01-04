import { pool } from '../db/database';
import { FeatureCode } from '../config/features';
import { getWebSocketService } from './WebSocketService';

export interface QuotaAlert {
  id: number;
  userId: number;
  featureCode: FeatureCode;
  alertType: 'warning' | 'critical' | 'depleted';
  thresholdPercentage: number;
  currentUsage: number;
  quotaLimit: number;
  isSent: boolean;
  sentAt?: Date;
  createdAt: Date;
}

/**
 * 配额预警服务
 * 负责配额预警的创建、查询和通知
 */
export class QuotaAlertService {
  /**
   * 获取用户未读预警
   * @param userId 用户ID
   * @returns 未读预警列表
   */
  async getUnsentAlerts(userId: number): Promise<QuotaAlert[]> {
    try {
      const result = await pool.query(
        `SELECT 
          qa.*,
          CASE 
            WHEN qa.feature_code = 'articles_per_month' THEN '每月生成文章数'
            WHEN qa.feature_code = 'publish_per_month' THEN '每月发布文章数'
            WHEN qa.feature_code = 'platform_accounts' THEN '平台账号数'
            WHEN qa.feature_code = 'keyword_distillation' THEN '关键词蒸馏数'
            ELSE qa.feature_code
          END as feature_name
         FROM quota_alerts qa
         WHERE qa.user_id = $1 AND qa.is_sent = FALSE
         ORDER BY qa.created_at DESC`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('获取未读预警失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户所有预警（分页）
   * @param userId 用户ID
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 预警列表
   */
  async getUserAlerts(
    userId: number,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    alerts: QuotaAlert[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const offset = (page - 1) * pageSize;
      
      // 获取总数
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM quota_alerts WHERE user_id = $1`,
        [userId]
      );
      const total = parseInt(countResult.rows[0]?.total || '0');
      
      // 获取分页数据
      const result = await pool.query(
        `SELECT 
          qa.*,
          CASE 
            WHEN qa.feature_code = 'articles_per_month' THEN '每月生成文章数'
            WHEN qa.feature_code = 'publish_per_month' THEN '每月发布文章数'
            WHEN qa.feature_code = 'platform_accounts' THEN '平台账号数'
            WHEN qa.feature_code = 'keyword_distillation' THEN '关键词蒸馏数'
            ELSE qa.feature_code
          END as feature_name
         FROM quota_alerts qa
         WHERE qa.user_id = $1
         ORDER BY qa.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset]
      );
      
      return {
        alerts: result.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error('获取预警列表失败:', error);
      throw error;
    }
  }

  /**
   * 标记预警为已发送
   * @param alertId 预警ID
   */
  async markAsSent(alertId: number): Promise<void> {
    try {
      await pool.query(
        `UPDATE quota_alerts 
         SET is_sent = TRUE, sent_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [alertId]
      );
    } catch (error) {
      console.error('标记预警失败:', error);
      throw error;
    }
  }

  /**
   * 批量标记预警为已发送
   * @param alertIds 预警ID列表
   */
  async batchMarkAsSent(alertIds: number[]): Promise<void> {
    try {
      await pool.query(
        `UPDATE quota_alerts 
         SET is_sent = TRUE, sent_at = CURRENT_TIMESTAMP
         WHERE id = ANY($1)`,
        [alertIds]
      );
    } catch (error) {
      console.error('批量标记预警失败:', error);
      throw error;
    }
  }

  /**
   * 发送预警通知
   * @param userId 用户ID
   */
  async sendAlertNotifications(userId: number): Promise<void> {
    try {
      const alerts = await this.getUnsentAlerts(userId);
      
      if (alerts.length === 0) {
        return;
      }
      
      // 通过 WebSocket 推送预警
      const wsService = getWebSocketService();
      
      for (const alert of alerts) {
        const message = this.formatAlertMessage(alert);
        
        wsService.broadcast(userId, 'quota_alert', {
          alertId: alert.id,
          featureCode: alert.featureCode,
          featureName: (alert as any).feature_name,
          alertType: alert.alertType,
          message,
          currentUsage: alert.currentUsage,
          quotaLimit: alert.quotaLimit,
          thresholdPercentage: alert.thresholdPercentage
        });
        
        // 标记为已发送
        await this.markAsSent(alert.id);
      }
    } catch (error) {
      console.error('发送预警通知失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 格式化预警消息
   * @param alert 预警对象
   * @returns 格式化的消息
   */
  private formatAlertMessage(alert: any): string {
    const featureName = alert.feature_name || alert.feature_code;
    const percentage = alert.threshold_percentage;
    const remaining = alert.quota_limit - alert.current_usage;
    
    switch (alert.alert_type) {
      case 'warning':
        return `您的"${featureName}"配额已使用 ${percentage}%，剩余 ${remaining} 次，请注意合理使用。`;
      case 'critical':
        return `⚠️ 您的"${featureName}"配额已使用 ${percentage}%，即将用完，剩余 ${remaining} 次！`;
      case 'depleted':
        if (alert.quota_limit === -1) {
          return `您的"${featureName}"配额无限制，可以继续使用。`;
        }
        return `🔴 您的"${featureName}"配额已用完！请升级套餐或等待配额重置。`;
      default:
        return `您的"${featureName}"配额使用情况需要关注。`;
    }
  }

  /**
   * 获取预警统计
   * @param userId 用户ID
   * @returns 预警统计
   */
  async getAlertStatistics(userId: number): Promise<{
    totalAlerts: number;
    unsentAlerts: number;
    alertsByType: {
      warning: number;
      critical: number;
      depleted: number;
    };
    alertsByFeature: Array<{
      featureCode: string;
      count: number;
    }>;
  }> {
    try {
      // 总预警数
      const totalResult = await pool.query(
        `SELECT COUNT(*) as total FROM quota_alerts WHERE user_id = $1`,
        [userId]
      );
      
      // 未发送预警数
      const unsentResult = await pool.query(
        `SELECT COUNT(*) as unsent FROM quota_alerts WHERE user_id = $1 AND is_sent = FALSE`,
        [userId]
      );
      
      // 按类型统计
      const byTypeResult = await pool.query(
        `SELECT 
           alert_type,
           COUNT(*) as count
         FROM quota_alerts
         WHERE user_id = $1
         GROUP BY alert_type`,
        [userId]
      );
      
      // 按功能统计
      const byFeatureResult = await pool.query(
        `SELECT 
           feature_code,
           COUNT(*) as count
         FROM quota_alerts
         WHERE user_id = $1
         GROUP BY feature_code
         ORDER BY count DESC`,
        [userId]
      );
      
      const alertsByType = {
        warning: 0,
        critical: 0,
        depleted: 0
      };
      
      byTypeResult.rows.forEach(row => {
        alertsByType[row.alert_type as keyof typeof alertsByType] = parseInt(row.count);
      });
      
      return {
        totalAlerts: parseInt(totalResult.rows[0]?.total || '0'),
        unsentAlerts: parseInt(unsentResult.rows[0]?.unsent || '0'),
        alertsByType,
        alertsByFeature: byFeatureResult.rows.map(row => ({
          featureCode: row.feature_code,
          count: parseInt(row.count)
        }))
      };
    } catch (error) {
      console.error('获取预警统计失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期预警（定时任务）
   * 删除超过30天的已发送预警
   */
  async cleanupOldAlerts(): Promise<number> {
    try {
      const result = await pool.query(
        `DELETE FROM quota_alerts
         WHERE is_sent = TRUE 
           AND sent_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
         RETURNING id`
      );
      
      const deletedCount = result.rowCount || 0;
      
      if (deletedCount > 0) {
        console.log(`清理了 ${deletedCount} 条过期预警记录`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error('清理过期预警失败:', error);
      throw error;
    }
  }

  /**
   * 手动创建预警（用于测试或管理员操作）
   * @param userId 用户ID
   * @param featureCode 功能代码
   * @param alertType 预警类型
   * @param currentUsage 当前使用量
   * @param quotaLimit 配额限制
   */
  async createManualAlert(
    userId: number,
    featureCode: FeatureCode,
    alertType: 'warning' | 'critical' | 'depleted',
    currentUsage: number,
    quotaLimit: number
  ): Promise<QuotaAlert> {
    try {
      const thresholdMap = {
        warning: 80,
        critical: 95,
        depleted: 100
      };
      
      const result = await pool.query(
        `INSERT INTO quota_alerts (
          user_id, feature_code, alert_type, threshold_percentage,
          current_usage, quota_limit, is_sent
        ) VALUES ($1, $2, $3, $4, $5, $6, FALSE)
        RETURNING *`,
        [
          userId,
          featureCode,
          alertType,
          thresholdMap[alertType],
          currentUsage,
          quotaLimit
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('创建手动预警失败:', error);
      throw error;
    }
  }
}

export const quotaAlertService = new QuotaAlertService();
