import { pool } from '../db/database';
import { redisClient } from '../db/redis';

/**
 * 通知服务
 * Requirements: 5.1, 5.2, 5.3, 5.4
 * 
 * 提供邮件通知、批量通知、安全警报和批处理功能
 */

export interface Notification {
  type: 'email' | 'webhook' | 'websocket';
  recipients: string[];
  subject: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface NotificationResult {
  success: boolean;
  failedRecipients?: string[];
  error?: string;
  retryCount?: number;
}

export interface ConfigChange {
  configKey: string;
  oldValue: any;
  newValue: any;
  changedBy: number;
  ipAddress: string;
  timestamp: Date;
}

export class NotificationService {
  private static instance: NotificationService;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 1000;
  private static readonly BATCH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly BATCH_KEY_PREFIX = 'config-changes:batch:';

  private batchTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    // 启动时清理可能残留的批处理数据
    this.cleanupBatchData().catch(error => {
      console.error('[Notification] Error cleaning up batch data:', error);
    });
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * 发送通知
   * Requirement 5.1, 5.2
   */
  async sendNotification(notification: Notification): Promise<NotificationResult> {
    let lastError: Error | null = null;
    let retryCount = 0;

    // 重试逻辑
    while (retryCount <= NotificationService.MAX_RETRIES) {
      try {
        await this.sendNotificationInternal(notification);

        console.log(
          `[Notification] Successfully sent ${notification.type} notification to ${notification.recipients.length} recipients`
        );

        return {
          success: true,
          retryCount
        };
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        // 记录失败
        console.error(
          `[Notification] Failed to send notification (attempt ${retryCount}/${NotificationService.MAX_RETRIES + 1}):`,
          error
        );

        // 记录到审计日志
        await this.logNotificationFailure(notification, error as Error, retryCount);

        // 如果还有重试机会，等待后重试
        if (retryCount <= NotificationService.MAX_RETRIES) {
          await this.delay(NotificationService.RETRY_DELAY_MS * retryCount);
        }
      }
    }

    // 所有重试都失败
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      retryCount
    };
  }

  /**
   * 批量通知
   * Requirement 5.1
   */
  async batchNotify(notifications: Notification[]): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const notification of notifications) {
      const result = await this.sendNotification(notification);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(
      `[Notification] Batch notification complete: ${successCount}/${notifications.length} successful`
    );

    return results;
  }

  /**
   * 发送安全警报
   * Requirement 5.1, 5.2
   */
  async sendSecurityAlert(alertType: string, details: Record<string, any>): Promise<void> {
    try {
      // 获取所有管理员
      const adminsResult = await pool.query(
        `SELECT id, username, email FROM users WHERE role = 'admin'`
      );

      const admins = adminsResult.rows;

      if (admins.length === 0) {
        console.warn('[Notification] No administrators found to send security alert');
        return;
      }

      // 构建通知内容
      const subject = `安全警报: ${alertType}`;
      const content = this.formatSecurityAlert(alertType, details);

      const notification: Notification = {
        type: 'email',
        recipients: admins.map(admin => admin.email).filter(email => email),
        subject,
        content,
        priority: 'critical'
      };

      // 发送通知
      const result = await this.sendNotification(notification);

      if (result.success) {
        console.log(`[Notification] Security alert sent to ${admins.length} administrators`);
      } else {
        console.error(`[Notification] Failed to send security alert: ${result.error}`);
      }
    } catch (error) {
      console.error('[Notification] Error sending security alert:', error);
      throw error;
    }
  }

  /**
   * 发送配置变更通知（带批处理）
   * Requirement 5.1, 5.2, 5.4
   * 
   * 5分钟内的配置变更会被合并为一个通知
   */
  async sendConfigChangeNotification(
    configKey: string,
    oldValue: any,
    newValue: any,
    changedBy: number,
    ipAddress: string
  ): Promise<void> {
    try {
      const change: ConfigChange = {
        configKey,
        oldValue,
        newValue,
        changedBy,
        ipAddress,
        timestamp: new Date()
      };

      // 检查Redis是否可用
      if (!redisClient.isReady) {
        console.warn('[Notification] Redis not available, sending immediate notification');
        await this.sendImmediateConfigChangeNotification(change);
        return;
      }

      // 添加到批处理队列
      await this.addToBatch(change);

      // 如果没有活动的批处理定时器，启动一个
      const batchKey = this.getBatchKey();
      if (!this.batchTimers.has(batchKey)) {
        const timer = setTimeout(async () => {
          await this.processBatch(batchKey);
          this.batchTimers.delete(batchKey);
        }, NotificationService.BATCH_WINDOW_MS);

        this.batchTimers.set(batchKey, timer);
        console.log(
          `[Notification] Started batch timer for config changes (${NotificationService.BATCH_WINDOW_MS / 1000}s window)`
        );
      }
    } catch (error) {
      console.error('[Notification] Error sending config change notification:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 添加配置变更到批处理队列
   * Requirement 5.4
   */
  private async addToBatch(change: ConfigChange): Promise<void> {
    const batchKey = this.getBatchKey();
    const changeData = JSON.stringify(change);

    try {
      // 检查Redis是否可用
      if (!redisClient.isReady) {
        console.warn('[Notification] Redis not available, sending immediate notification');
        await this.sendImmediateConfigChangeNotification(change);
        return;
      }

      // 使用Redis列表存储批处理的变更
      await redisClient.rPush(batchKey, changeData);
      
      // 设置过期时间（10分钟，确保不会永久残留）
      await redisClient.expire(batchKey, 600);

      console.log(`[Notification] Added config change to batch: ${change.configKey}`);
    } catch (error) {
      console.error('[Notification] Error adding to batch:', error);
      // 如果Redis失败，立即发送单个通知
      await this.sendImmediateConfigChangeNotification(change);
    }
  }

  /**
   * 处理批处理队列
   * Requirement 5.4
   */
  private async processBatch(batchKey: string): Promise<void> {
    try {
      // 获取所有待处理的变更
      const changesData = await redisClient.lRange(batchKey, 0, -1);

      if (changesData.length === 0) {
        console.log('[Notification] No config changes to process in batch');
        return;
      }

      const changes: ConfigChange[] = changesData.map(data => JSON.parse(data));

      console.log(`[Notification] Processing batch of ${changes.length} config changes`);

      // 获取所有管理员
      const adminsResult = await pool.query(
        `SELECT id, username, email FROM users WHERE role = 'admin'`
      );

      const admins = adminsResult.rows;

      if (admins.length === 0) {
        console.warn('[Notification] No administrators found to send batch notification');
        await redisClient.del(batchKey);
        return;
      }

      // 构建批量通知内容
      const subject = `配置变更汇总 (${changes.length}项变更)`;
      const content = this.formatBatchConfigChanges(changes);

      const notification: Notification = {
        type: 'email',
        recipients: admins.map(admin => admin.email).filter(email => email),
        subject,
        content,
        priority: 'medium'
      };

      // 发送通知
      const result = await this.sendNotification(notification);

      if (result.success) {
        console.log(
          `[Notification] Batch config change notification sent to ${admins.length} administrators`
        );
      } else {
        console.error(`[Notification] Failed to send batch notification: ${result.error}`);
      }

      // 清理批处理数据
      await redisClient.del(batchKey);
    } catch (error) {
      console.error('[Notification] Error processing batch:', error);
      // 尝试清理
      try {
        await redisClient.del(batchKey);
      } catch (cleanupError) {
        console.error('[Notification] Error cleaning up batch:', cleanupError);
      }
    }
  }

  /**
   * 立即发送单个配置变更通知（不批处理）
   * Requirement 5.1, 5.2
   */
  private async sendImmediateConfigChangeNotification(change: ConfigChange): Promise<void> {
    try {
      // 获取所有管理员
      const adminsResult = await pool.query(
        `SELECT id, username, email FROM users WHERE role = 'admin'`
      );

      const admins = adminsResult.rows;

      if (admins.length === 0) {
        console.warn('[Notification] No administrators found to send config change notification');
        return;
      }

      // 获取变更者信息
      const changerResult = await pool.query(
        `SELECT username FROM users WHERE id = $1`,
        [change.changedBy]
      );
      const changerUsername = changerResult.rows[0]?.username || 'Unknown';

      // 构建通知内容
      const subject = `配置变更通知: ${change.configKey}`;
      const content = `
配置项: ${change.configKey}
旧值: ${JSON.stringify(change.oldValue)}
新值: ${JSON.stringify(change.newValue)}
变更人: ${changerUsername} (ID: ${change.changedBy})
IP地址: ${change.ipAddress}
时间: ${change.timestamp.toISOString()}
      `.trim();

      const notification: Notification = {
        type: 'email',
        recipients: admins.map(admin => admin.email).filter(email => email),
        subject,
        content,
        priority: 'medium'
      };

      // 发送通知
      const result = await this.sendNotification(notification);

      if (result.success) {
        console.log(
          `[Notification] Config change notification sent to ${admins.length} administrators`
        );
      } else {
        console.error(`[Notification] Failed to send config change notification: ${result.error}`);
      }
    } catch (error) {
      console.error('[Notification] Error sending immediate config change notification:', error);
    }
  }

  /**
   * 格式化批量配置变更内容
   * Requirement 5.4
   */
  private formatBatchConfigChanges(changes: ConfigChange[]): string {
    const changesList = changes.map((change, index) => {
      return `
${index + 1}. 配置项: ${change.configKey}
   旧值: ${JSON.stringify(change.oldValue)}
   新值: ${JSON.stringify(change.newValue)}
   变更人: ID ${change.changedBy}
   IP地址: ${change.ipAddress}
   时间: ${change.timestamp.toISOString()}
      `.trim();
    }).join('\n\n');

    return `
在过去5分钟内，系统配置发生了以下变更：

${changesList}

总计: ${changes.length}项变更

请检查这些变更是否符合预期。
    `.trim();
  }

  /**
   * 获取批处理键
   */
  private getBatchKey(): string {
    // 使用5分钟窗口的时间戳作为键的一部分
    const windowTimestamp = Math.floor(Date.now() / NotificationService.BATCH_WINDOW_MS);
    return `${NotificationService.BATCH_KEY_PREFIX}${windowTimestamp}`;
  }

  /**
   * 清理批处理数据
   */
  private async cleanupBatchData(): Promise<void> {
    try {
      const pattern = `${NotificationService.BATCH_KEY_PREFIX}*`;
      const keys = await redisClient.keys(pattern);

      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`[Notification] Cleaned up ${keys.length} batch data keys`);
      }
    } catch (error) {
      console.error('[Notification] Error cleaning up batch data:', error);
    }
  }

  /**
   * 强制处理所有待处理的批次（用于关闭时）
   */
  async flushAllBatches(): Promise<void> {
    try {
      // 清除所有定时器
      for (const [batchKey, timer] of this.batchTimers.entries()) {
        clearTimeout(timer);
        await this.processBatch(batchKey);
      }
      this.batchTimers.clear();

      console.log('[Notification] All batches flushed');
    } catch (error) {
      console.error('[Notification] Error flushing batches:', error);
    }
  }

  /**
   * 内部发送通知实现
   */
  private async sendNotificationInternal(notification: Notification): Promise<void> {
    // 实际实现应该根据type调用不同的发送方法
    // 这里仅作演示，实际应该集成邮件服务（如nodemailer）

    switch (notification.type) {
      case 'email':
        await this.sendEmail(notification);
        break;
      case 'webhook':
        await this.sendWebhook(notification);
        break;
      case 'websocket':
        await this.sendWebSocket(notification);
        break;
      default:
        throw new Error(`Unsupported notification type: ${notification.type}`);
    }
  }

  /**
   * 发送邮件
   */
  private async sendEmail(notification: Notification): Promise<void> {
    // 实际实现应该使用nodemailer或其他邮件服务
    // 这里仅作演示
    console.log(`[Notification] Would send email to: ${notification.recipients.join(', ')}`);
    console.log(`[Notification] Subject: ${notification.subject}`);
    console.log(`[Notification] Content: ${notification.content.substring(0, 100)}...`);

    // 模拟发送延迟
    await this.delay(100);

    // 模拟成功
    // 在实际实现中，这里应该调用邮件服务API
  }

  /**
   * 发送Webhook
   */
  private async sendWebhook(notification: Notification): Promise<void> {
    // 实际实现应该发送HTTP POST请求到webhook URL
    console.log(`[Notification] Would send webhook notification`);
    await this.delay(100);
  }

  /**
   * 发送WebSocket消息
   */
  private async sendWebSocket(notification: Notification): Promise<void> {
    // 实际实现应该通过WebSocket连接发送消息
    console.log(`[Notification] Would send websocket notification`);
    await this.delay(100);
  }

  /**
   * 记录通知失败
   * Requirement 5.3
   */
  private async logNotificationFailure(
    notification: Notification,
    error: Error,
    retryCount: number
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO audit_logs 
         (admin_id, action, target_type, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          0, // 系统操作
          'NOTIFICATION_FAILED',
          'system',
          JSON.stringify({
            type: notification.type,
            recipientCount: notification.recipients.length,
            subject: notification.subject,
            priority: notification.priority,
            error: error.message,
            retryCount
          }),
          '127.0.0.1'
        ]
      );
    } catch (logError) {
      console.error('[Notification] Error logging notification failure:', logError);
      // 不抛出错误
    }
  }

  /**
   * 格式化安全警报内容
   */
  private formatSecurityAlert(alertType: string, details: Record<string, any>): string {
    return `
安全警报类型: ${alertType}

详细信息:
${Object.entries(details)
  .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
  .join('\n')}

时间: ${new Date().toISOString()}

请立即检查系统安全状况。
    `.trim();
  }

  /**
   * 延迟辅助函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例
export const notificationService = NotificationService.getInstance();
