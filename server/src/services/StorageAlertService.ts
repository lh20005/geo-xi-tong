import { pool } from '../db/database';
import { storageService } from './StorageService';
import { getWebSocketService } from './WebSocketService';

export interface StorageAlert {
  id: number;
  userId: number;
  alertType: 'warning' | 'critical' | 'depleted';
  thresholdPercentage: number;
  currentUsageBytes: number;
  quotaBytes: number;
  isSent: boolean;
  createdAt: Date;
}

/**
 * 警报阈值
 */
const ALERT_THRESHOLDS = {
  warning: 80,   // 80% 使用
  critical: 95,  // 95% 使用
  depleted: 100  // 100% 使用
};

/**
 * 存储警报服务
 * 负责监控存储使用并发送警报
 */
export class StorageAlertService {
  private static instance: StorageAlertService;

  private constructor() {}

  public static getInstance(): StorageAlertService {
    if (!StorageAlertService.instance) {
      StorageAlertService.instance = new StorageAlertService();
    }
    return StorageAlertService.instance;
  }

  /**
   * 检查并创建警报
   */
  async checkAndCreateAlerts(userId: number): Promise<StorageAlert[]> {
    try {
      const usage = await storageService.getUserStorageUsage(userId);
      const alerts: StorageAlert[] = [];

      // 无限配额不需要警报
      if (usage.storageQuotaBytes === -1) {
        return alerts;
      }

      const usagePercentage = usage.usagePercentage;

      // 检查各个阈值
      if (usagePercentage >= ALERT_THRESHOLDS.depleted) {
        const alert = await this.createAlertIfNotExists(
          userId,
          'depleted',
          ALERT_THRESHOLDS.depleted,
          usage.totalStorageBytes,
          usage.storageQuotaBytes + usage.purchasedStorageBytes
        );
        if (alert) alerts.push(alert);
      } else if (usagePercentage >= ALERT_THRESHOLDS.critical) {
        const alert = await this.createAlertIfNotExists(
          userId,
          'critical',
          ALERT_THRESHOLDS.critical,
          usage.totalStorageBytes,
          usage.storageQuotaBytes + usage.purchasedStorageBytes
        );
        if (alert) alerts.push(alert);
      } else if (usagePercentage >= ALERT_THRESHOLDS.warning) {
        const alert = await this.createAlertIfNotExists(
          userId,
          'warning',
          ALERT_THRESHOLDS.warning,
          usage.totalStorageBytes,
          usage.storageQuotaBytes + usage.purchasedStorageBytes
        );
        if (alert) alerts.push(alert);
      }

      // 发送新创建的警报
      for (const alert of alerts) {
        await this.sendStorageAlert(userId, alert);
      }

      return alerts;
    } catch (error) {
      console.error('[StorageAlertService] 检查警报失败:', error);
      throw error;
    }
  }

  /**
   * 创建警报（如果不存在）
   */
  private async createAlertIfNotExists(
    userId: number,
    alertType: 'warning' | 'critical' | 'depleted',
    thresholdPercentage: number,
    currentUsageBytes: number,
    quotaBytes: number
  ): Promise<StorageAlert | null> {
    try {
      // 检查是否已存在相同类型的未发送警报
      const existingResult = await pool.query(
        `SELECT id, user_id as "userId", alert_type as "alertType",
                threshold_percentage as "thresholdPercentage",
                current_usage_bytes as "currentUsageBytes",
                quota_bytes as "quotaBytes",
                is_sent as "isSent",
                created_at as "createdAt"
         FROM quota_alerts
         WHERE user_id = $1 
           AND alert_type = $2 
           AND feature_type = 'storage_space'
           AND created_at > NOW() - INTERVAL '24 hours'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, alertType]
      );

      // 如果已存在最近的警报，不创建新的
      if (existingResult.rows.length > 0) {
        return null;
      }

      // 创建新警报
      const result = await pool.query(
        `INSERT INTO quota_alerts (
          user_id, feature_type, alert_type, 
          threshold_percentage, current_usage, quota_limit,
          current_usage_bytes, quota_bytes
        ) VALUES ($1, 'storage_space', $2, $3, $4, $5, $6, $7)
        RETURNING id, user_id as "userId", alert_type as "alertType",
                  threshold_percentage as "thresholdPercentage",
                  current_usage_bytes as "currentUsageBytes",
                  quota_bytes as "quotaBytes",
                  is_sent as "isSent",
                  created_at as "createdAt"`,
        [
          userId,
          alertType,
          thresholdPercentage,
          currentUsageBytes,
          quotaBytes,
          currentUsageBytes,
          quotaBytes
        ]
      );

      console.log(`[StorageAlertService] 创建警报: 用户=${userId}, 类型=${alertType}, 阈值=${thresholdPercentage}%`);
      return result.rows[0];
    } catch (error) {
      console.error('[StorageAlertService] 创建警报失败:', error);
      throw error;
    }
  }

  /**
   * 通过 WebSocket 发送存储警报
   */
  async sendStorageAlert(userId: number, alert: StorageAlert): Promise<void> {
    try {
      const wsService = getWebSocketService();
      
      // 构建警报消息
      let message = '';
      switch (alert.alertType) {
        case 'warning':
          message = `您的存储空间已使用 ${alert.thresholdPercentage}%，请注意清理或升级套餐。`;
          break;
        case 'critical':
          message = `警告：您的存储空间已使用 ${alert.thresholdPercentage}%，即将耗尽！`;
          break;
        case 'depleted':
          message = `您的存储空间已用完，无法上传新内容。请立即升级套餐或清理空间。`;
          break;
      }

      // 发送 WebSocket 通知
      wsService.broadcast(userId, 'storage_alert', {
        alert,
        message
      });

      // 标记为已发送
      await this.markAlertSent(alert.id);

      console.log(`[StorageAlertService] 发送警报: 用户=${userId}, 类型=${alert.alertType}`);
    } catch (error) {
      console.error('[StorageAlertService] 发送警报失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 获取待处理的警报
   */
  async getPendingAlerts(userId: number): Promise<StorageAlert[]> {
    try {
      const result = await pool.query(
        `SELECT id, user_id as "userId", alert_type as "alertType",
                threshold_percentage as "thresholdPercentage",
                current_usage_bytes as "currentUsageBytes",
                quota_bytes as "quotaBytes",
                is_sent as "isSent",
                created_at as "createdAt"
         FROM quota_alerts
         WHERE user_id = $1 
           AND feature_type = 'storage_space'
           AND is_sent = false
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('[StorageAlertService] 获取待处理警报失败:', error);
      throw error;
    }
  }

  /**
   * 标记警报为已发送
   */
  async markAlertSent(alertId: number): Promise<void> {
    try {
      await pool.query(
        `UPDATE quota_alerts 
         SET is_sent = true, sent_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [alertId]
      );
    } catch (error) {
      console.error('[StorageAlertService] 标记警报失败:', error);
      throw error;
    }
  }
}

export const storageAlertService = StorageAlertService.getInstance();
