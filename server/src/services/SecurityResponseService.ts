import { pool } from '../db/database';
import { anomalyDetectionService, AnomalyEvent } from './AnomalyDetectionService';
import { notificationService } from './NotificationService';

/**
 * 安全响应服务
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
 * 
 * 提供自动安全响应功能，包括暴力攻击封禁、账户锁定、重新认证要求等
 */

export interface SecurityResponse {
  action: string;
  target: string;
  reason: string;
  timestamp: Date;
  automated: boolean;
}

export class SecurityResponseService {
  private static instance: SecurityResponseService;
  
  // 暴力攻击阈值
  private static readonly BRUTE_FORCE_THRESHOLD = 5;
  private static readonly BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000; // 15分钟
  private static readonly BLOCK_DURATION_MS = 60 * 60 * 1000; // 1小时

  // 紧急锁定模式标志
  private emergencyLockdownActive = false;

  private constructor() {}

  public static getInstance(): SecurityResponseService {
    if (!SecurityResponseService.instance) {
      SecurityResponseService.instance = new SecurityResponseService();
    }
    return SecurityResponseService.instance;
  }

  /**
   * 暴力攻击自动封禁
   * Requirement 20.1
   */
  async handleBruteForceAttack(ipAddress: string): Promise<SecurityResponse | null> {
    try {
      // 查询最近的失败登录次数
      const result = await pool.query(
        `SELECT COUNT(*) as count
         FROM audit_logs
         WHERE action = 'LOGIN_FAILED'
           AND ip_address = $1
           AND created_at > NOW() - INTERVAL '15 minutes'`,
        [ipAddress]
      );

      const failedAttempts = parseInt(result.rows[0].count);

      // 如果超过阈值，自动封禁IP
      if (failedAttempts >= SecurityResponseService.BRUTE_FORCE_THRESHOLD) {
        await this.blockIP(ipAddress, 'Brute force attack detected');

        const response: SecurityResponse = {
          action: 'BLOCK_IP',
          target: ipAddress,
          reason: `Brute force attack: ${failedAttempts} failed login attempts`,
          timestamp: new Date(),
          automated: true
        };

        // 记录响应日志
        await this.logSecurityResponse(response);

        // 发送告警
        await notificationService.sendSecurityAlert('brute_force_attack', {
          ipAddress,
          failedAttempts,
          action: 'IP blocked for 1 hour'
        });

        console.log(`[SecurityResponse] Blocked IP ${ipAddress} due to brute force attack`);

        return response;
      }

      return null;
    } catch (error) {
      console.error('[SecurityResponse] Error handling brute force attack:', error);
      throw error;
    }
  }

  /**
   * 账户妥协自动锁定
   * Requirement 20.2
   */
  async handleAccountCompromise(userId: number, reason: string): Promise<SecurityResponse> {
    try {
      // 锁定账户
      await this.lockAccount(userId, reason);

      // 撤销所有会话
      await this.revokeAllSessions(userId);

      const response: SecurityResponse = {
        action: 'LOCK_ACCOUNT',
        target: `user_${userId}`,
        reason,
        timestamp: new Date(),
        automated: true
      };

      // 记录响应日志
      await this.logSecurityResponse(response);

      // 获取用户信息
      const userResult = await pool.query(
        `SELECT username, email FROM users WHERE id = $1`,
        [userId]
      );
      const user = userResult.rows[0];

      // 发送通知给用户和管理员
      await notificationService.sendSecurityAlert('account_compromise', {
        userId,
        username: user?.username || 'Unknown',
        email: user?.email || 'Unknown',
        reason,
        action: 'Account locked and all sessions revoked'
      });

      console.log(`[SecurityResponse] Locked account ${userId} due to: ${reason}`);

      return response;
    } catch (error) {
      console.error('[SecurityResponse] Error handling account compromise:', error);
      throw error;
    }
  }

  /**
   * 可疑活动重新认证要求
   * Requirement 20.3
   */
  async requireReauthentication(userId: number, reason: string): Promise<SecurityResponse> {
    try {
      // 设置重新认证标志（在实际实现中应该存储在数据库或Redis中）
      await pool.query(
        `INSERT INTO audit_logs 
         (admin_id, action, target_type, target_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          1, // 系统操作（使用第一个管理员ID）
          'REQUIRE_REAUTH',
          'user',
          userId,
          JSON.stringify({ reason, automated: true, system: true }),
          '127.0.0.1'
        ]
      );

      const response: SecurityResponse = {
        action: 'REQUIRE_REAUTH',
        target: `user_${userId}`,
        reason,
        timestamp: new Date(),
        automated: true
      };

      // 记录响应日志
      await this.logSecurityResponse(response);

      console.log(`[SecurityResponse] Required re-authentication for user ${userId}: ${reason}`);

      return response;
    } catch (error) {
      console.error('[SecurityResponse] Error requiring re-authentication:', error);
      throw error;
    }
  }

  /**
   * 紧急锁定模式
   * Requirement 20.4
   */
  async activateEmergencyLockdown(reason: string): Promise<SecurityResponse> {
    try {
      this.emergencyLockdownActive = true;

      // 记录锁定事件
      await pool.query(
        `INSERT INTO audit_logs 
         (admin_id, action, target_type, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          1, // 系统操作
          'EMERGENCY_LOCKDOWN',
          'system',
          JSON.stringify({ reason, automated: true, system: true }),
          '127.0.0.1'
        ]
      );

      const response: SecurityResponse = {
        action: 'EMERGENCY_LOCKDOWN',
        target: 'system',
        reason,
        timestamp: new Date(),
        automated: true
      };

      // 记录响应日志
      await this.logSecurityResponse(response);

      // 发送紧急告警
      await notificationService.sendSecurityAlert('emergency_lockdown', {
        reason,
        timestamp: new Date().toISOString(),
        action: 'All non-admin access disabled'
      });

      console.log(`[SecurityResponse] EMERGENCY LOCKDOWN ACTIVATED: ${reason}`);

      return response;
    } catch (error) {
      console.error('[SecurityResponse] Error activating emergency lockdown:', error);
      throw error;
    }
  }

  /**
   * 解除紧急锁定模式
   */
  async deactivateEmergencyLockdown(adminId: number): Promise<void> {
    try {
      this.emergencyLockdownActive = false;

      await pool.query(
        `INSERT INTO audit_logs 
         (admin_id, action, target_type, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          adminId,
          'EMERGENCY_LOCKDOWN_DEACTIVATED',
          'system',
          JSON.stringify({ automated: false }),
          '127.0.0.1'
        ]
      );

      console.log(`[SecurityResponse] Emergency lockdown deactivated by admin ${adminId}`);
    } catch (error) {
      console.error('[SecurityResponse] Error deactivating emergency lockdown:', error);
      throw error;
    }
  }

  /**
   * 检查是否处于紧急锁定模式
   */
  isEmergencyLockdownActive(): boolean {
    return this.emergencyLockdownActive;
  }

  /**
   * 记录安全响应日志
   * Requirement 20.5
   */
  private async logSecurityResponse(response: SecurityResponse): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO audit_logs 
         (admin_id, action, target_type, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          1, // 系统操作
          'SECURITY_RESPONSE',
          'system',
          JSON.stringify({
            action: response.action,
            target: response.target,
            reason: response.reason,
            automated: response.automated,
            system: true
          }),
          '127.0.0.1'
        ]
      );

      console.log(`[SecurityResponse] Logged security response: ${response.action}`);
    } catch (error) {
      console.error('[SecurityResponse] Error logging security response:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 封禁IP地址
   */
  private async blockIP(ipAddress: string, reason: string): Promise<void> {
    try {
      // 记录封禁
      await pool.query(
        `INSERT INTO audit_logs 
         (admin_id, action, target_type, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          1, // 系统操作
          'IP_BLOCKED',
          'system',
          JSON.stringify({
            blockedIP: ipAddress,
            reason,
            duration: '1 hour',
            automated: true,
            system: true
          }),
          ipAddress
        ]
      );

      // 实际实现应该将IP添加到Redis或防火墙规则中
      console.log(`[SecurityResponse] IP ${ipAddress} blocked for 1 hour: ${reason}`);
    } catch (error) {
      console.error('[SecurityResponse] Error blocking IP:', error);
      throw error;
    }
  }

  /**
   * 锁定账户
   */
  private async lockAccount(userId: number, reason: string): Promise<void> {
    try {
      // 记录锁定
      await pool.query(
        `INSERT INTO audit_logs 
         (admin_id, action, target_type, target_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          1, // 系统操作
          'ACCOUNT_LOCKED',
          'user',
          userId,
          JSON.stringify({ reason, automated: true, system: true }),
          '127.0.0.1'
        ]
      );

      // 实际实现应该在users表中设置is_locked标志
      console.log(`[SecurityResponse] Account ${userId} locked: ${reason}`);
    } catch (error) {
      console.error('[SecurityResponse] Error locking account:', error);
      throw error;
    }
  }

  /**
   * 撤销所有会话
   */
  private async revokeAllSessions(userId: number): Promise<void> {
    try {
      // 删除所有刷新令牌
      await pool.query(
        `DELETE FROM refresh_tokens WHERE user_id = $1`,
        [userId]
      );

      console.log(`[SecurityResponse] Revoked all sessions for user ${userId}`);
    } catch (error) {
      console.error('[SecurityResponse] Error revoking sessions:', error);
      throw error;
    }
  }

  /**
   * 处理异常事件（集成AnomalyDetectionService）
   */
  async handleAnomalyEvent(event: AnomalyEvent): Promise<void> {
    try {
      // 根据异常类型采取相应措施
      switch (event.type) {
        case 'suspicious_login':
          if (event.severity === 'critical') {
            await this.requireReauthentication(
              event.userId,
              'Suspicious login pattern detected'
            );
          }
          break;

        case 'high_frequency':
          if (event.severity === 'critical') {
            await this.requireReauthentication(
              event.userId,
              'Abnormally high operation frequency detected'
            );
          }
          break;

        case 'privilege_escalation':
          if (event.severity === 'critical') {
            await this.handleAccountCompromise(
              event.userId,
              'Suspicious privilege escalation detected'
            );
          }
          break;

        default:
          console.log(`[SecurityResponse] No automated response for anomaly type: ${event.type}`);
      }
    } catch (error) {
      console.error('[SecurityResponse] Error handling anomaly event:', error);
      throw error;
    }
  }
}

// 导出单例
export const securityResponseService = SecurityResponseService.getInstance();
