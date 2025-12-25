import { pool } from '../db/database';
import crypto from 'crypto';

interface Session {
  userId: number;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
}

export class SessionService {
  private static instance: SessionService;
  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Start cleanup timer
    this.startCleanupTimer();
  }

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Create a new session with IP and user agent tracking
   */
  async createSession(
    userId: number,
    refreshToken: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      // Calculate expiration (7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Check concurrent session limit before creating
      await this.enforceConcurrentSessionLimit(userId, 5);

      await pool.query(
        `INSERT INTO refresh_tokens (user_id, token, ip_address, user_agent, last_used_at, expires_at) 
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)`,
        [userId, refreshToken, ipAddress, userAgent, expiresAt]
      );

      console.log(`[Session] Session created: userId=${userId}, ip=${ipAddress}`);
    } catch (error) {
      console.error('[Session] Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Validate that a session exists and is active
   */
  async validateSession(token: string): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT * FROM refresh_tokens 
         WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [token]
      );

      if (result.rows.length > 0) {
        // Update last_used_at
        await pool.query(
          'UPDATE refresh_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token = $1',
          [token]
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Session] Failed to validate session:', error);
      return false;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: number): Promise<Session[]> {
    try {
      const result = await pool.query(
        `SELECT user_id as "userId", token as "refreshToken", ip_address as "ipAddress", 
                user_agent as "userAgent", created_at as "createdAt", 
                last_used_at as "lastUsedAt", expires_at as "expiresAt"
         FROM refresh_tokens 
         WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
         ORDER BY last_used_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('[Session] Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(token: string): Promise<void> {
    try {
      await pool.query(
        'DELETE FROM refresh_tokens WHERE token = $1',
        [token]
      );

      console.log('[Session] Session revoked');
    } catch (error) {
      console.error('[Session] Failed to revoke session:', error);
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user except the current one
   */
  async revokeAllSessionsExcept(userId: number, currentToken: string): Promise<number> {
    try {
      const result = await pool.query(
        'DELETE FROM refresh_tokens WHERE user_id = $1 AND token != $2',
        [userId, currentToken]
      );

      const count = result.rowCount || 0;
      console.log(`[Session] Revoked ${count} sessions for userId=${userId}`);
      return count;
    } catch (error) {
      console.error('[Session] Failed to revoke sessions:', error);
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllSessions(userId: number): Promise<number> {
    try {
      const result = await pool.query(
        'DELETE FROM refresh_tokens WHERE user_id = $1',
        [userId]
      );

      const count = result.rowCount || 0;
      console.log(`[Session] Revoked all ${count} sessions for userId=${userId}`);
      return count;
    } catch (error) {
      console.error('[Session] Failed to revoke all sessions:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await pool.query(
        'DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP'
      );

      const count = result.rowCount || 0;
      if (count > 0) {
        console.log(`[Session] Cleaned up ${count} expired sessions`);
      }
      return count;
    } catch (error) {
      console.error('[Session] Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Enforce concurrent session limit for a user
   * If user has >= maxSessions, remove the oldest session
   */
  async enforceConcurrentSessionLimit(userId: number, maxSessions: number): Promise<void> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM refresh_tokens 
         WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [userId]
      );

      const currentCount = parseInt(result.rows[0].count);

      if (currentCount >= maxSessions) {
        // Remove oldest session(s) to make room
        await pool.query(
          `DELETE FROM refresh_tokens 
           WHERE id IN (
             SELECT id FROM refresh_tokens 
             WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
             ORDER BY last_used_at ASC 
             LIMIT 1
           )`,
          [userId]
        );

        console.log(`[Session] Removed oldest session for userId=${userId} (limit: ${maxSessions})`);
      }
    } catch (error) {
      console.error('[Session] Failed to enforce session limit:', error);
      throw error;
    }
  }

  /**
   * Start automatic cleanup timer (runs every hour)
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000); // 1 hour
    // 使用 unref() 防止阻止进程退出
    this.cleanupTimer.unref();
  }

  /**
   * Stop cleanup timer (for testing)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

export const sessionService = SessionService.getInstance();
