import crypto from 'crypto';

/**
 * 确认令牌服务
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * 
 * 用于敏感操作的二次确认
 */

export interface ConfirmationToken {
  token: string;
  userId: number;
  action: string;
  data: Record<string, any>;
  expiresAt: Date;
}

export class ConfirmationTokenService {
  private static readonly TOKEN_LENGTH = 32;
  private static readonly TOKEN_EXPIRY = 300000; // 5 minutes in milliseconds

  // 内存存储（生产环境应使用Redis）
  private tokenStore: Map<string, Omit<ConfirmationToken, 'token'>> = new Map();

  /**
   * 生成确认令牌
   * Requirements: 4.1, 4.2
   */
  async generateToken(
    userId: number,
    action: string,
    data: Record<string, any> = {}
  ): Promise<string> {
    // 生成随机令牌
    const token = crypto.randomBytes(ConfirmationTokenService.TOKEN_LENGTH).toString('hex');
    
    // 计算过期时间
    const expiresAt = new Date(Date.now() + ConfirmationTokenService.TOKEN_EXPIRY);

    // 存储令牌
    this.tokenStore.set(token, {
      userId,
      action,
      data,
      expiresAt
    });

    // 清理过期令牌
    this.cleanupExpiredTokens();

    return token;
  }

  /**
   * 验证并消费令牌
   * Requirements: 4.3, 4.4
   */
  async validateAndConsumeToken(
    token: string,
    userId: number
  ): Promise<{ valid: boolean; data?: Record<string, any>; action?: string }> {
    const stored = this.tokenStore.get(token);

    if (!stored) {
      return { valid: false };
    }

    // 检查是否过期
    if (Date.now() > stored.expiresAt.getTime()) {
      this.tokenStore.delete(token);
      return { valid: false };
    }

    // 检查用户ID是否匹配
    if (stored.userId !== userId) {
      return { valid: false };
    }

    // 删除令牌（一次性使用）
    this.tokenStore.delete(token);

    return {
      valid: true,
      data: stored.data,
      action: stored.action
    };
  }

  /**
   * 验证令牌（不消费）
   */
  async validateToken(
    token: string,
    userId: number
  ): Promise<{ valid: boolean; data?: Record<string, any>; action?: string }> {
    const stored = this.tokenStore.get(token);

    if (!stored) {
      return { valid: false };
    }

    // 检查是否过期
    if (Date.now() > stored.expiresAt.getTime()) {
      return { valid: false };
    }

    // 检查用户ID是否匹配
    if (stored.userId !== userId) {
      return { valid: false };
    }

    return {
      valid: true,
      data: stored.data,
      action: stored.action
    };
  }

  /**
   * 清理过期令牌
   * Requirement 4.4
   */
  async cleanupExpiredTokens(): Promise<number> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [token, data] of this.tokenStore.entries()) {
      if (now > data.expiresAt.getTime()) {
        this.tokenStore.delete(token);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * 撤销用户的所有令牌
   */
  async revokeUserTokens(userId: number): Promise<number> {
    let revokedCount = 0;

    for (const [token, data] of this.tokenStore.entries()) {
      if (data.userId === userId) {
        this.tokenStore.delete(token);
        revokedCount++;
      }
    }

    return revokedCount;
  }

  /**
   * 获取令牌信息（用于测试）
   */
  getTokenInfo(token: string): ConfirmationToken | null {
    const stored = this.tokenStore.get(token);
    if (!stored) {
      return null;
    }

    return {
      token,
      ...stored
    };
  }

  /**
   * 清空所有令牌（仅用于测试）
   */
  clearAll(): void {
    this.tokenStore.clear();
  }

  /**
   * 获取令牌数量（用于测试）
   */
  getTokenCount(): number {
    return this.tokenStore.size;
  }
}

// 导出单例
export const confirmationTokenService = new ConfirmationTokenService();
