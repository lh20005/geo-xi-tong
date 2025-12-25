import { pool } from '../db/database';

/**
 * 安全监控服务
 * Requirements: 16.1, 16.2, 16.3, 16.5
 * 
 * 提供安全事件记录、查询、指标统计和报告生成功能
 */

export interface SecurityEvent {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  userId?: number;
  ipAddress?: string;
}

export interface SecurityMetrics {
  failedLogins: number;
  blockedIPs: number;
  suspiciousActivities: number;
  activeAnomalies: number;
  lastIncident: Date | null;
}

export interface SecurityEventFilter {
  severity?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: number;
  limit?: number;
  offset?: number;
}

export class SecurityMonitorService {
  private static instance: SecurityMonitorService;

  private constructor() {}

  public static getInstance(): SecurityMonitorService {
    if (!SecurityMonitorService.instance) {
      SecurityMonitorService.instance = new SecurityMonitorService();
    }
    return SecurityMonitorService.instance;
  }

  /**
   * 记录安全事件
   * Requirement 16.1, 16.2
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO security_events 
         (event_type, severity, user_id, ip_address, message, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          event.type,
          event.severity,
          event.userId || null,
          event.ipAddress || null,
          event.message,
          JSON.stringify(event.details),
          event.timestamp
        ]
      );

      // 如果是关键事件，立即发送告警
      if (event.severity === 'critical') {
        await this.sendImmediateAlert(event);
      }

      console.log(`[SecurityMonitor] Logged ${event.severity} event: ${event.type}`);
    } catch (error) {
      console.error('[SecurityMonitor] Error logging security event:', error);
      throw error;
    }
  }

  /**
   * 获取安全指标
   * Requirement 16.4
   */
  async getSecurityMetrics(timeRange: number = 24 * 60 * 60 * 1000): Promise<SecurityMetrics> {
    try {
      const startTime = new Date(Date.now() - timeRange);

      // 查询失败登录次数
      const failedLoginsResult = await pool.query(
        `SELECT COUNT(*) as count
         FROM audit_logs
         WHERE action = 'LOGIN_FAILED'
           AND created_at > $1`,
        [startTime]
      );

      // 查询可疑活动次数
      const suspiciousResult = await pool.query(
        `SELECT COUNT(*) as count
         FROM security_events
         WHERE severity IN ('warning', 'critical')
           AND created_at > $1`,
        [startTime]
      );

      // 查询活跃异常数量
      const anomaliesResult = await pool.query(
        `SELECT COUNT(*) as count
         FROM security_events
         WHERE event_type IN ('suspicious_login', 'high_frequency', 'privilege_escalation')
           AND severity IN ('high', 'critical')
           AND created_at > $1`,
        [startTime]
      );

      // 查询最后一次严重事件
      const lastIncidentResult = await pool.query(
        `SELECT created_at
         FROM security_events
         WHERE severity = 'critical'
         ORDER BY created_at DESC
         LIMIT 1`
      );

      // 查询被封禁的IP数量（从审计日志中统计）
      const blockedIPsResult = await pool.query(
        `SELECT COUNT(DISTINCT ip_address) as count
         FROM audit_logs
         WHERE action = 'IP_BLOCKED'
           AND created_at > $1`,
        [startTime]
      );

      return {
        failedLogins: parseInt(failedLoginsResult.rows[0]?.count || '0'),
        blockedIPs: parseInt(blockedIPsResult.rows[0]?.count || '0'),
        suspiciousActivities: parseInt(suspiciousResult.rows[0]?.count || '0'),
        activeAnomalies: parseInt(anomaliesResult.rows[0]?.count || '0'),
        lastIncident: lastIncidentResult.rows[0]?.created_at || null
      };
    } catch (error) {
      console.error('[SecurityMonitor] Error getting security metrics:', error);
      throw error;
    }
  }

  /**
   * 获取安全事件列表
   * Requirement 16.1
   */
  async getSecurityEvents(filters: SecurityEventFilter = {}): Promise<{
    events: any[];
    total: number;
  }> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // 构建查询条件
      if (filters.severity) {
        conditions.push(`severity = $${paramIndex++}`);
        params.push(filters.severity);
      }

      if (filters.type) {
        conditions.push(`event_type = $${paramIndex++}`);
        params.push(filters.type);
      }

      if (filters.userId) {
        conditions.push(`user_id = $${paramIndex++}`);
        params.push(filters.userId);
      }

      if (filters.startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(filters.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 查询总数
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM security_events ${whereClause}`,
        params
      );

      const total = parseInt(countResult.rows[0].total);

      // 查询事件列表
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const eventsResult = await pool.query(
        `SELECT 
           id,
           event_type,
           severity,
           user_id,
           ip_address,
           message,
           details,
           created_at
         FROM security_events
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limit, offset]
      );

      return {
        events: eventsResult.rows,
        total
      };
    } catch (error) {
      console.error('[SecurityMonitor] Error getting security events:', error);
      throw error;
    }
  }

  /**
   * 生成安全报告
   * Requirement 16.5
   */
  async generateSecurityReport(period: 'daily' | 'weekly' | 'monthly'): Promise<string> {
    try {
      // 计算时间范围
      const now = new Date();
      let startDate: Date;
      let periodName: string;

      switch (period) {
        case 'daily':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          periodName = '每日';
          break;
        case 'weekly':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          periodName = '每周';
          break;
        case 'monthly':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          periodName = '每月';
          break;
      }

      // 获取指标
      const metrics = await this.getSecurityMetrics(now.getTime() - startDate.getTime());

      // 获取关键事件
      const criticalEvents = await this.getSecurityEvents({
        severity: 'critical',
        startDate,
        endDate: now,
        limit: 10
      });

      const warningEvents = await this.getSecurityEvents({
        severity: 'warning',
        startDate,
        endDate: now,
        limit: 20
      });

      // 生成报告
      const report = `
========================================
${periodName}安全报告
生成时间: ${now.toISOString()}
报告周期: ${startDate.toISOString()} - ${now.toISOString()}
========================================

## 安全指标概览

- 失败登录次数: ${metrics.failedLogins}
- 被封禁IP数量: ${metrics.blockedIPs}
- 可疑活动次数: ${metrics.suspiciousActivities}
- 活跃异常数量: ${metrics.activeAnomalies}
- 最后严重事件: ${metrics.lastIncident ? new Date(metrics.lastIncident).toISOString() : '无'}

## 关键安全事件 (${criticalEvents.total}个)

${criticalEvents.events.map((event, index) => `
${index + 1}. [${event.severity.toUpperCase()}] ${event.event_type}
   时间: ${new Date(event.created_at).toISOString()}
   用户ID: ${event.user_id || 'N/A'}
   IP地址: ${event.ip_address || 'N/A'}
   消息: ${event.message}
`).join('\n')}

## 警告事件 (${warningEvents.total}个)

${warningEvents.events.slice(0, 5).map((event, index) => `
${index + 1}. [${event.severity.toUpperCase()}] ${event.event_type}
   时间: ${new Date(event.created_at).toISOString()}
   消息: ${event.message}
`).join('\n')}

${warningEvents.total > 5 ? `\n... 还有 ${warningEvents.total - 5} 个警告事件\n` : ''}

## 建议

${this.generateRecommendations(metrics, criticalEvents.total, warningEvents.total)}

========================================
报告结束
========================================
      `.trim();

      return report;
    } catch (error) {
      console.error('[SecurityMonitor] Error generating security report:', error);
      throw error;
    }
  }

  /**
   * 导出安全日志
   * Requirement 16.5
   */
  async exportSecurityLogs(
    filters: SecurityEventFilter,
    format: 'json' | 'csv'
  ): Promise<string> {
    try {
      const { events } = await this.getSecurityEvents({
        ...filters,
        limit: 10000 // 导出时获取更多记录
      });

      if (format === 'json') {
        return JSON.stringify(events, null, 2);
      } else {
        // CSV格式
        const headers = ['ID', 'Type', 'Severity', 'User ID', 'IP Address', 'Message', 'Created At'];
        const rows = events.map(event => [
          event.id,
          event.event_type,
          event.severity,
          event.user_id || '',
          event.ip_address || '',
          event.message.replace(/"/g, '""'), // 转义双引号
          new Date(event.created_at).toISOString()
        ]);

        const csv = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return csv;
      }
    } catch (error) {
      console.error('[SecurityMonitor] Error exporting security logs:', error);
      throw error;
    }
  }

  /**
   * 发送即时告警
   * Requirement 16.3
   */
  private async sendImmediateAlert(event: SecurityEvent): Promise<void> {
    try {
      // 获取所有管理员
      const adminsResult = await pool.query(
        `SELECT id, username, email FROM users WHERE role = 'admin'`
      );

      const admins = adminsResult.rows;

      console.log(`[SecurityMonitor] CRITICAL ALERT: ${event.type}`);
      console.log(`[SecurityMonitor] Message: ${event.message}`);
      console.log(`[SecurityMonitor] Details:`, event.details);
      console.log(`[SecurityMonitor] Notifying ${admins.length} administrators`);

      // 实际实现应该发送邮件、短信或推送通知
      // 这里仅记录日志
      for (const admin of admins) {
        console.log(`[SecurityMonitor] Would notify admin: ${admin.username} (${admin.email})`);
      }

      // 记录告警发送
      await pool.query(
        `INSERT INTO audit_logs 
         (admin_id, action, target_type, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          null, // 系统操作
          'SECURITY_ALERT_SENT',
          'system',
          JSON.stringify({
            eventType: event.type,
            severity: event.severity,
            recipientCount: admins.length
          }),
          '127.0.0.1'
        ]
      );
    } catch (error) {
      console.error('[SecurityMonitor] Error sending immediate alert:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 生成安全建议
   */
  private generateRecommendations(
    metrics: SecurityMetrics,
    criticalCount: number,
    warningCount: number
  ): string {
    const recommendations: string[] = [];

    if (metrics.failedLogins > 100) {
      recommendations.push('- 失败登录次数较高，建议检查是否存在暴力破解攻击');
    }

    if (metrics.blockedIPs > 10) {
      recommendations.push('- 被封禁IP数量较多，建议审查IP白名单策略');
    }

    if (criticalCount > 0) {
      recommendations.push('- 存在关键安全事件，请立即处理并调查根本原因');
    }

    if (warningCount > 50) {
      recommendations.push('- 警告事件数量较多，建议加强安全监控和日志审查');
    }

    if (metrics.activeAnomalies > 5) {
      recommendations.push('- 活跃异常数量较高，建议检查用户行为模式');
    }

    if (recommendations.length === 0) {
      recommendations.push('- 系统安全状况良好，继续保持监控');
    }

    return recommendations.join('\n');
  }
}

// 导出单例
export const securityMonitorService = SecurityMonitorService.getInstance();
