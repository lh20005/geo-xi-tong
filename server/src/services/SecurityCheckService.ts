import { pool } from '../db/database';
import { notificationService } from './NotificationService';

/**
 * 定期安全检查服务
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
 */

export interface SecurityCheckResult {
  checkType: string;
  status: 'passed' | 'warning' | 'critical';
  issuesFound: number;
  details: any[];
  timestamp: Date;
}

export interface SecurityReport {
  reportId: string;
  generatedAt: Date;
  checks: SecurityCheckResult[];
  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    critical: number;
  };
}

export class SecurityCheckService {
  private static instance: SecurityCheckService;

  private constructor() {}

  public static getInstance(): SecurityCheckService {
    if (!SecurityCheckService.instance) {
      SecurityCheckService.instance = new SecurityCheckService();
    }
    return SecurityCheckService.instance;
  }

  /**
   * 运行所有安全检查
   * Requirement 19.1, 19.2
   */
  async runAllChecks(): Promise<SecurityReport> {
    console.log('[SecurityCheck] 开始运行安全检查...');

    const checks: SecurityCheckResult[] = [];

    // 运行各项检查
    checks.push(await this.checkExpiredSessions());
    checks.push(await this.checkOldTempPasswords());
    checks.push(await this.checkDormantAdmins());
    checks.push(await this.checkDatabaseIntegrity());

    // 生成报告
    const report: SecurityReport = {
      reportId: `SEC-${Date.now()}`,
      generatedAt: new Date(),
      checks,
      summary: {
        totalChecks: checks.length,
        passed: checks.filter(c => c.status === 'passed').length,
        warnings: checks.filter(c => c.status === 'warning').length,
        critical: checks.filter(c => c.status === 'critical').length
      }
    };

    // 如果有问题，发送通知
    if (report.summary.warnings > 0 || report.summary.critical > 0) {
      await this.notifyAdmins(report);
    }

    console.log('[SecurityCheck] 安全检查完成:', report.summary);

    return report;
  }

  /**
   * 检查过期会话
   * Requirement 19.1
   */
  async checkExpiredSessions(): Promise<SecurityCheckResult> {
    try {
      // 查找过期但未清理的refresh tokens
      const result = await pool.query(
        `SELECT COUNT(*) as count, 
                array_agg(user_id) as user_ids
         FROM refresh_tokens 
         WHERE expires_at < NOW()`
      );

      const count = parseInt(result.rows[0].count);
      const userIds = result.rows[0].user_ids || [];

      // 清理过期会话
      if (count > 0) {
        await pool.query(
          `DELETE FROM refresh_tokens WHERE expires_at < NOW()`
        );
      }

      return {
        checkType: 'expired_sessions',
        status: count > 10 ? 'warning' : 'passed',
        issuesFound: count,
        details: count > 0 ? [{ message: `清理了 ${count} 个过期会话`, userIds }] : [],
        timestamp: new Date()
      };
    } catch (error) {
      console.error('[SecurityCheck] 检查过期会话失败:', error);
      return {
        checkType: 'expired_sessions',
        status: 'critical',
        issuesFound: 0,
        details: [{ error: (error as Error).message }],
        timestamp: new Date()
      };
    }
  }

  /**
   * 检查旧临时密码
   * Requirement 19.3
   */
  async checkOldTempPasswords(): Promise<SecurityCheckResult> {
    try {
      // 查找临时密码超过7天的账户
      const result = await pool.query(
        `SELECT id, username, email, created_at
         FROM users 
         WHERE is_temp_password = true 
         AND created_at < NOW() - INTERVAL '7 days'`
      );

      const count = result.rows.length;
      const users = result.rows.map(row => ({
        id: row.id,
        username: row.username,
        email: row.email,
        daysOld: Math.floor((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24))
      }));

      return {
        checkType: 'old_temp_passwords',
        status: count > 0 ? 'warning' : 'passed',
        issuesFound: count,
        details: users.map(u => ({
          message: `用户 ${u.username} 的临时密码已过期 ${u.daysOld} 天`,
          userId: u.id,
          username: u.username,
          email: u.email,
          daysOld: u.daysOld
        })),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('[SecurityCheck] 检查旧临时密码失败:', error);
      return {
        checkType: 'old_temp_passwords',
        status: 'critical',
        issuesFound: 0,
        details: [{ error: (error as Error).message }],
        timestamp: new Date()
      };
    }
  }

  /**
   * 检查休眠管理员账户
   * Requirement 19.4
   */
  async checkDormantAdmins(): Promise<SecurityCheckResult> {
    try {
      // 查找90天未登录的管理员账户
      const result = await pool.query(
        `SELECT u.id, u.username, u.email, u.last_login_at
         FROM users u
         WHERE u.role = 'admin'
         AND (u.last_login_at IS NULL OR u.last_login_at < NOW() - INTERVAL '90 days')`
      );

      const count = result.rows.length;
      const admins = result.rows.map(row => ({
        id: row.id,
        username: row.username,
        email: row.email,
        lastLogin: row.last_login_at,
        daysInactive: row.last_login_at 
          ? Math.floor((Date.now() - new Date(row.last_login_at).getTime()) / (1000 * 60 * 60 * 24))
          : null
      }));

      return {
        checkType: 'dormant_admins',
        status: count > 0 ? 'warning' : 'passed',
        issuesFound: count,
        details: admins.map(a => ({
          message: a.lastLogin 
            ? `管理员 ${a.username} 已 ${a.daysInactive} 天未登录`
            : `管理员 ${a.username} 从未登录`,
          userId: a.id,
          username: a.username,
          email: a.email,
          lastLogin: a.lastLogin,
          daysInactive: a.daysInactive
        })),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('[SecurityCheck] 检查休眠管理员失败:', error);
      return {
        checkType: 'dormant_admins',
        status: 'critical',
        issuesFound: 0,
        details: [{ error: (error as Error).message }],
        timestamp: new Date()
      };
    }
  }

  /**
   * 检查数据库完整性
   * Requirement 19.5
   */
  async checkDatabaseIntegrity(): Promise<SecurityCheckResult> {
    try {
      const issues: any[] = [];

      // 检查关键表是否存在
      const requiredTables = [
        'users', 'refresh_tokens', 'audit_logs', 'security_events',
        'config_history', 'permissions', 'user_permissions', 'security_config'
      ];

      for (const tableName of requiredTables) {
        const result = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`,
          [tableName]
        );

        if (!result.rows[0].exists) {
          issues.push({
            type: 'missing_table',
            message: `关键表 ${tableName} 不存在`,
            severity: 'critical'
          });
        }
      }

      // 检查用户表完整性
      const userCheck = await pool.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins
         FROM users`
      );

      const totalUsers = parseInt(userCheck.rows[0].total);
      const adminCount = parseInt(userCheck.rows[0].admins);

      if (adminCount === 0) {
        issues.push({
          type: 'no_admins',
          message: '系统中没有管理员账户',
          severity: 'critical'
        });
      }

      // 检查审计日志表大小
      const auditLogCheck = await pool.query(
        `SELECT pg_total_relation_size('audit_logs') as size`
      );

      const auditLogSize = parseInt(auditLogCheck.rows[0].size);
      const auditLogSizeMB = auditLogSize / (1024 * 1024);

      if (auditLogSizeMB > 1000) {
        issues.push({
          type: 'large_audit_log',
          message: `审计日志表过大: ${auditLogSizeMB.toFixed(2)} MB`,
          severity: 'warning'
        });
      }

      return {
        checkType: 'database_integrity',
        status: issues.some(i => i.severity === 'critical') ? 'critical' 
              : issues.length > 0 ? 'warning' 
              : 'passed',
        issuesFound: issues.length,
        details: issues,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('[SecurityCheck] 检查数据库完整性失败:', error);
      return {
        checkType: 'database_integrity',
        status: 'critical',
        issuesFound: 0,
        details: [{ error: (error as Error).message }],
        timestamp: new Date()
      };
    }
  }

  /**
   * 通知管理员
   * Requirement 19.2
   */
  private async notifyAdmins(report: SecurityReport): Promise<void> {
    try {
      // 获取所有管理员
      const result = await pool.query(
        `SELECT id, email, username FROM users WHERE role = 'admin'`
      );

      const admins = result.rows;

      // 构建通知内容
      const criticalIssues = report.checks.filter(c => c.status === 'critical');
      const warnings = report.checks.filter(c => c.status === 'warning');

      let message = `安全检查报告 (${report.reportId})\n\n`;
      message += `检查时间: ${report.generatedAt.toLocaleString('zh-CN')}\n\n`;
      message += `总结:\n`;
      message += `- 总检查项: ${report.summary.totalChecks}\n`;
      message += `- 通过: ${report.summary.passed}\n`;
      message += `- 警告: ${report.summary.warnings}\n`;
      message += `- 严重: ${report.summary.critical}\n\n`;

      if (criticalIssues.length > 0) {
        message += `严重问题:\n`;
        criticalIssues.forEach(issue => {
          message += `- ${issue.checkType}: ${issue.issuesFound} 个问题\n`;
          issue.details.forEach(detail => {
            message += `  * ${detail.message || JSON.stringify(detail)}\n`;
          });
        });
        message += `\n`;
      }

      if (warnings.length > 0) {
        message += `警告:\n`;
        warnings.forEach(warning => {
          message += `- ${warning.checkType}: ${warning.issuesFound} 个问题\n`;
          warning.details.slice(0, 3).forEach(detail => {
            message += `  * ${detail.message || JSON.stringify(detail)}\n`;
          });
          if (warning.details.length > 3) {
            message += `  * ... 还有 ${warning.details.length - 3} 个问题\n`;
          }
        });
      }

      // 发送通知给所有管理员
      const adminEmails = admins.map(a => a.email).filter(e => e);
      
      if (adminEmails.length > 0) {
        await notificationService.sendNotification({
          type: 'email',
          recipients: adminEmails,
          subject: `安全检查报告 - ${report.summary.critical > 0 ? '发现严重问题' : '发现警告'}`,
          content: message,
          priority: report.summary.critical > 0 ? 'critical' : 'high'
        });

        console.log(`[SecurityCheck] 已通知 ${adminEmails.length} 位管理员`);
      } else {
        console.warn('[SecurityCheck] 没有管理员邮箱，无法发送通知');
      }
    } catch (error) {
      console.error('[SecurityCheck] 通知管理员失败:', error);
    }
  }

  /**
   * 生成安全报告（用于手动查看）
   */
  async generateReport(): Promise<SecurityReport> {
    return await this.runAllChecks();
  }
}

// 导出单例
export const securityCheckService = SecurityCheckService.getInstance();
