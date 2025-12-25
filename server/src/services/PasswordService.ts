import { pool } from '../db/database';
import { authService } from './AuthService';

interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

interface LoginAttempt {
  userId: number;
  timestamp: Date;
  success: boolean;
}

export class PasswordService {
  private static instance: PasswordService;
  private loginAttempts: Map<number, LoginAttempt[]> = new Map();

  private constructor() {}

  public static getInstance(): PasswordService {
    if (!PasswordService.instance) {
      PasswordService.instance = new PasswordService();
    }
    return PasswordService.instance;
  }

  /**
   * 验证密码强度
   * Requirements: 8.1 (长度>=8), 8.2 (复杂度: 大写+小写+数字)
   */
  validatePasswordStrength(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // 检查长度 (最少8个字符)
    if (!password || password.length < 8) {
      errors.push('密码必须至少8个字符');
    }

    // 检查是否包含大写字母
    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含至少一个大写字母');
    }

    // 检查是否包含小写字母
    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含至少一个小写字母');
    }

    // 检查是否包含数字
    if (!/[0-9]/.test(password)) {
      errors.push('密码必须包含至少一个数字');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 检查密码是否被重用 (最近3次)
   * Requirements: 8.6
   */
  async checkPasswordReuse(userId: number, newPassword: string): Promise<boolean> {
    try {
      // 获取最近3次密码历史
      const result = await pool.query(
        `SELECT password_hash FROM password_history 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 3`,
        [userId]
      );

      // 检查新密码是否与历史密码匹配
      for (const row of result.rows) {
        const matches = await authService.verifyPassword(newPassword, row.password_hash);
        if (matches) {
          return true; // 密码被重用
        }
      }

      return false; // 密码未被重用
    } catch (error) {
      console.error('[Password] 检查密码重用失败:', error);
      return false;
    }
  }

  /**
   * 保存密码到历史记录
   */
  async savePasswordHistory(userId: number, passwordHash: string): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO password_history (user_id, password_hash) 
         VALUES ($1, $2)`,
        [userId, passwordHash]
      );

      console.log(`[Password] 密码历史已保存: userId=${userId}`);
    } catch (error) {
      console.error('[Password] 保存密码历史失败:', error);
      throw error;
    }
  }

  /**
   * 记录登录尝试
   */
  recordLoginAttempt(userId: number, success: boolean): void {
    const attempts = this.loginAttempts.get(userId) || [];
    attempts.push({
      userId,
      timestamp: new Date(),
      success
    });

    // 只保留最近15分钟的记录
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentAttempts = attempts.filter(a => a.timestamp > fifteenMinutesAgo);
    
    this.loginAttempts.set(userId, recentAttempts);
  }

  /**
   * 检查账户是否被锁定
   * Requirements: 8.3 (5次失败/15分钟 -> 锁定15分钟)
   */
  isAccountLocked(userId: number): { locked: boolean; unlockAt?: Date } {
    const attempts = this.loginAttempts.get(userId) || [];
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    // 获取最近15分钟内的失败尝试
    const recentFailedAttempts = attempts.filter(
      a => !a.success && a.timestamp > fifteenMinutesAgo
    );

    // 如果失败次数 >= 5次,账户被锁定
    if (recentFailedAttempts.length >= 5) {
      // 找到第5次失败的时间,锁定到该时间后15分钟
      const fifthFailure = recentFailedAttempts[4];
      const unlockAt = new Date(fifthFailure.timestamp.getTime() + 15 * 60 * 1000);
      
      // 如果还在锁定期内
      if (new Date() < unlockAt) {
        return { locked: true, unlockAt };
      }
    }

    return { locked: false };
  }

  /**
   * 重置登录尝试记录 (用于成功登录后)
   */
  resetLoginAttempts(userId: number): void {
    this.loginAttempts.delete(userId);
  }

  /**
   * 获取失败登录次数
   */
  getFailedLoginCount(userId: number): number {
    const attempts = this.loginAttempts.get(userId) || [];
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    return attempts.filter(
      a => !a.success && a.timestamp > fifteenMinutesAgo
    ).length;
  }

  /**
   * 清理过期的登录尝试记录
   */
  cleanupExpiredAttempts(): void {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    for (const [userId, attempts] of this.loginAttempts.entries()) {
      const recentAttempts = attempts.filter(a => a.timestamp > fifteenMinutesAgo);
      
      if (recentAttempts.length === 0) {
        this.loginAttempts.delete(userId);
      } else {
        this.loginAttempts.set(userId, recentAttempts);
      }
    }
  }
}

export const passwordService = PasswordService.getInstance();
