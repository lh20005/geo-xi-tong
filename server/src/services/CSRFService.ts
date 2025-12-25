import crypto from 'crypto';

/**
 * CSRF保护服务
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 * 
 * 注意：在生产环境中应使用Redis存储，这里为了测试使用内存存储
 */
export class CSRFService {
  private static readonly TOKEN_LENGTH = 32;
  private static readonly TOKEN_EXPIRY = 3600000; // 1 hour in milliseconds
  private static readonly TOKEN_PREFIX = 'csrf:';

  // 内存存储（生产环境应使用Redis）
  private tokenStore: Map<string, { sessionId: string; expiresAt: number }> = new Map();

  /**
   * 生成CSRF令牌
   * Requirement 13.1
   */
  async generateToken(sessionId: string): Promise<string> {
    // 生成随机令牌
    const token = crypto.randomBytes(CSRFService.TOKEN_LENGTH).toString('hex');
    
    // 存储令牌
    const expiresAt = Date.now() + CSRFService.TOKEN_EXPIRY;
    this.tokenStore.set(token, { sessionId, expiresAt });
    
    // 清理过期令牌
    this.cleanupExpiredTokens();
    
    return token;
  }

  /**
   * 验证CSRF令牌
   * Requirement 13.2, 13.3
   */
  async validateToken(token: string, sessionId: string): Promise<boolean> {
    if (!token || !sessionId) {
      return false;
    }

    const stored = this.tokenStore.get(token);

    if (!stored) {
      return false;
    }

    // 检查是否过期
    if (Date.now() > stored.expiresAt) {
      this.tokenStore.delete(token);
      return false;
    }

    // 检查session是否匹配
    if (stored.sessionId !== sessionId) {
      return false;
    }

    return true;
  }

  /**
   * 验证并消费令牌（一次性使用）
   * Requirement 13.4
   */
  async validateAndConsumeToken(token: string, sessionId: string): Promise<boolean> {
    if (!token || !sessionId) {
      return false;
    }

    const stored = this.tokenStore.get(token);

    if (!stored) {
      return false;
    }

    // 检查是否过期
    if (Date.now() > stored.expiresAt) {
      this.tokenStore.delete(token);
      return false;
    }

    // 检查session是否匹配
    if (stored.sessionId !== sessionId) {
      return false;
    }

    // 删除令牌，确保一次性使用
    this.tokenStore.delete(token);

    return true;
  }

  /**
   * 刷新令牌（为同一session生成新令牌）
   */
  async refreshToken(oldToken: string, sessionId: string): Promise<string | null> {
    const isValid = await this.validateToken(oldToken, sessionId);
    
    if (!isValid) {
      return null;
    }

    // 删除旧令牌
    this.tokenStore.delete(oldToken);

    // 生成新令牌
    return this.generateToken(sessionId);
  }

  /**
   * 清理过期令牌
   */
  async cleanupExpiredTokens(): Promise<number> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [token, data] of this.tokenStore.entries()) {
      if (now > data.expiresAt) {
        this.tokenStore.delete(token);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * 撤销session的所有令牌
   */
  async revokeSessionTokens(sessionId: string): Promise<number> {
    let revokedCount = 0;

    for (const [token, data] of this.tokenStore.entries()) {
      if (data.sessionId === sessionId) {
        this.tokenStore.delete(token);
        revokedCount++;
      }
    }

    return revokedCount;
  }

  /**
   * 清空所有令牌（仅用于测试）
   */
  clearAll(): void {
    this.tokenStore.clear();
  }
}

// 导出单例
export const csrfService = new CSRFService();
