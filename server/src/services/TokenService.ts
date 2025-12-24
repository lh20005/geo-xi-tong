import { pool } from '../db/database';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

interface RefreshToken {
  id: number;
  user_id: number;
  token: string;
  created_at: Date;
  expires_at: Date;
}

export class TokenService {
  private static instance: TokenService;

  private constructor() {}

  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  /**
   * 生成访问令牌
   */
  generateAccessToken(userId: number, username: string, role: string = 'user'): string {
    return jwt.sign(
      { userId, username, role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * 生成刷新令牌
   */
  generateRefreshToken(userId: number): string {
    return jwt.sign(
      { userId },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
  }

  /**
   * 验证访问令牌
   */
  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('令牌无效或已过期');
    }
  }

  /**
   * 验证刷新令牌
   */
  verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (error) {
      throw new Error('刷新令牌无效或已过期');
    }
  }

  /**
   * 保存刷新令牌到数据库
   */
  async saveRefreshToken(userId: number, token: string): Promise<void> {
    try {
      // 计算过期时间（7天后）
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await pool.query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at) 
         VALUES ($1, $2, $3)`,
        [userId, token, expiresAt]
      );

      console.log(`[Token] 刷新令牌已保存: userId=${userId}`);
    } catch (error) {
      console.error('[Token] 保存刷新令牌失败:', error);
      throw error;
    }
  }

  /**
   * 验证刷新令牌是否存在于数据库
   */
  async isRefreshTokenValid(token: string): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT * FROM refresh_tokens 
         WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [token]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('[Token] 验证刷新令牌失败:', error);
      return false;
    }
  }

  /**
   * 删除特定的刷新令牌
   */
  async deleteRefreshToken(token: string): Promise<void> {
    try {
      await pool.query(
        'DELETE FROM refresh_tokens WHERE token = $1',
        [token]
      );

      console.log('[Token] 刷新令牌已删除');
    } catch (error) {
      console.error('[Token] 删除刷新令牌失败:', error);
      throw error;
    }
  }

  /**
   * 使某个用户的所有令牌失效
   * 用于密码修改、用户删除等场景
   */
  async invalidateUserTokens(userId: number): Promise<void> {
    try {
      const result = await pool.query(
        'DELETE FROM refresh_tokens WHERE user_id = $1',
        [userId]
      );

      console.log(`[Token] 用户所有令牌已失效: userId=${userId}, 删除了 ${result.rowCount} 个令牌`);
    } catch (error) {
      console.error('[Token] 使用户令牌失效失败:', error);
      throw error;
    }
  }

  /**
   * 使某个用户的所有令牌失效，除了当前令牌
   * 用于密码修改时保持当前会话
   */
  async invalidateUserTokensExcept(userId: number, currentToken: string): Promise<void> {
    try {
      const result = await pool.query(
        'DELETE FROM refresh_tokens WHERE user_id = $1 AND token != $2',
        [userId, currentToken]
      );

      console.log(`[Token] 用户其他令牌已失效: userId=${userId}, 删除了 ${result.rowCount} 个令牌`);
    } catch (error) {
      console.error('[Token] 使用户其他令牌失效失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期的刷新令牌
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await pool.query(
        'DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP'
      );

      console.log(`[Token] 清理过期令牌: 删除了 ${result.rowCount} 个令牌`);
    } catch (error) {
      console.error('[Token] 清理过期令牌失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有活跃令牌数量
   */
  async getUserActiveTokenCount(userId: number): Promise<number> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM refresh_tokens 
         WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [userId]
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('[Token] 获取用户活跃令牌数量失败:', error);
      return 0;
    }
  }
}

export const tokenService = TokenService.getInstance();
