import { pool } from '../db/database';

/**
 * 异常检测服务
 * Requirements: 10.1, 10.2, 10.4
 */

export interface AnomalyEvent {
  type: 'suspicious_login' | 'high_frequency' | 'unusual_location' | 'privilege_escalation';
  userId: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  detectedAt: Date;
}

export class AnomalyDetectionService {
  // 高频操作阈值：5分钟内50次操作
  private static readonly HIGH_FREQUENCY_THRESHOLD = 50;
  private static readonly HIGH_FREQUENCY_WINDOW = 5 * 60 * 1000; // 5 minutes in ms

  // 用户操作计数器（内存存储，生产环境应使用Redis）
  private operationCounts: Map<number, { count: number; windowStart: number }> = new Map();

  /**
   * 检测登录异常（新IP）
   * Requirement 10.1
   */
  async detectLoginAnomaly(
    userId: number,
    ipAddress: string,
    userAgent: string
  ): Promise<AnomalyEvent | null> {
    try {
      // 查询用户历史登录IP
      const result = await pool.query(
        `SELECT DISTINCT ip_address 
         FROM audit_logs 
         WHERE admin_id = $1 
           AND action = 'LOGIN' 
           AND created_at > NOW() - INTERVAL '30 days'`,
        [userId]
      );

      const knownIPs = result.rows.map(row => row.ip_address);

      // 如果是新IP，记录异常
      if (!knownIPs.includes(ipAddress)) {
        return {
          type: 'suspicious_login',
          userId,
          severity: 'medium',
          details: {
            ipAddress,
            userAgent,
            knownIPs: knownIPs.length,
            message: 'Login from new IP address'
          },
          detectedAt: new Date()
        };
      }

      return null;
    } catch (error) {
      console.error('[AnomalyDetection] Error detecting login anomaly:', error);
      return null;
    }
  }

  /**
   * 检测操作频率异常
   * Requirement 10.2
   */
  async detectHighFrequency(
    userId: number,
    timeWindow: number = AnomalyDetectionService.HIGH_FREQUENCY_WINDOW
  ): Promise<AnomalyEvent | null> {
    const now = Date.now();
    const userOps = this.operationCounts.get(userId);

    if (!userOps) {
      // 首次操作，初始化计数器
      this.operationCounts.set(userId, { count: 1, windowStart: now });
      return null;
    }

    // 检查是否在时间窗口内
    if (now - userOps.windowStart > timeWindow) {
      // 超出时间窗口，重置计数器
      this.operationCounts.set(userId, { count: 1, windowStart: now });
      return null;
    }

    // 增加计数
    userOps.count++;

    // 检查是否超过阈值
    if (userOps.count > AnomalyDetectionService.HIGH_FREQUENCY_THRESHOLD) {
      return {
        type: 'high_frequency',
        userId,
        severity: 'high',
        details: {
          operationCount: userOps.count,
          timeWindow: timeWindow / 1000, // seconds
          threshold: AnomalyDetectionService.HIGH_FREQUENCY_THRESHOLD,
          message: `User performed ${userOps.count} operations in ${timeWindow / 60000} minutes`
        },
        detectedAt: new Date()
      };
    }

    return null;
  }

  /**
   * 检测权限滥用
   * Requirement 10.2
   */
  async detectPrivilegeAbuse(
    userId: number,
    action: string
  ): Promise<AnomalyEvent | null> {
    try {
      // 查询最近的权限变更
      const result = await pool.query(
        `SELECT COUNT(*) as count
         FROM audit_logs
         WHERE admin_id = $1
           AND action IN ('GRANT_PERMISSION', 'REVOKE_PERMISSION', 'CHANGE_ROLE')
           AND created_at > NOW() - INTERVAL '1 hour'`,
        [userId]
      );

      const recentPrivilegeChanges = parseInt(result.rows[0].count);

      // 如果1小时内有超过5次权限变更，标记为可疑
      if (recentPrivilegeChanges > 5) {
        return {
          type: 'privilege_escalation',
          userId,
          severity: 'critical',
          details: {
            action,
            recentChanges: recentPrivilegeChanges,
            message: 'Unusual number of privilege changes detected'
          },
          detectedAt: new Date()
        };
      }

      return null;
    } catch (error) {
      console.error('[AnomalyDetection] Error detecting privilege abuse:', error);
      return null;
    }
  }

  /**
   * 处理异常事件
   * Requirement 10.4
   */
  async handleAnomaly(event: AnomalyEvent): Promise<void> {
    try {
      // 记录到安全事件表
      await pool.query(
        `INSERT INTO security_events (event_type, severity, user_id, message, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          event.type,
          event.severity,
          event.userId,
          event.details.message || 'Anomaly detected',
          JSON.stringify(event.details),
          event.detectedAt
        ]
      );

      // 如果是严重事件，发送告警
      if (event.severity === 'critical' || event.severity === 'high') {
        await this.sendAlert(event);
      }

      // 根据事件类型采取行动
      if (event.type === 'privilege_escalation' && event.severity === 'critical') {
        // 锁定账户
        await this.lockAccount(event.userId, 'Suspicious privilege escalation detected');
      }

      console.log(`[AnomalyDetection] Handled ${event.type} anomaly for user ${event.userId}`);
    } catch (error) {
      console.error('[AnomalyDetection] Error handling anomaly:', error);
      throw error;
    }
  }

  /**
   * 发送告警
   */
  private async sendAlert(event: AnomalyEvent): Promise<void> {
    // 实际实现应该发送邮件或其他通知
    console.log(`[ALERT] ${event.severity.toUpperCase()}: ${event.type} detected for user ${event.userId}`);
    console.log(`[ALERT] Details:`, event.details);
  }

  /**
   * 锁定账户
   */
  private async lockAccount(userId: number, reason: string): Promise<void> {
    try {
      // 注意：实际的users表可能没有is_locked字段，这里仅作演示
      // 生产环境应该使用实际的锁定机制
      console.log(`[AnomalyDetection] Would lock account ${userId}: ${reason}`);

      // 记录审计日志
      await pool.query(
        `INSERT INTO audit_logs (admin_id, action, target_type, target_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          0, // 系统操作
          'LOCK_ACCOUNT',
          'user',
          userId,
          JSON.stringify({ reason, automated: true }),
          '127.0.0.1'
        ]
      );

      console.log(`[AnomalyDetection] Logged lock attempt for account ${userId}`);
    } catch (error) {
      console.error('[AnomalyDetection] Error locking account:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 重置操作计数器（用于测试）
   */
  resetOperationCounts(): void {
    this.operationCounts.clear();
  }

  /**
   * 记录操作（用于频率检测）
   */
  recordOperation(userId: number): void {
    const now = Date.now();
    const userOps = this.operationCounts.get(userId);

    if (!userOps || now - userOps.windowStart > AnomalyDetectionService.HIGH_FREQUENCY_WINDOW) {
      this.operationCounts.set(userId, { count: 1, windowStart: now });
    } else {
      userOps.count++;
    }
  }
}

// 导出单例
export const anomalyDetectionService = new AnomalyDetectionService();
