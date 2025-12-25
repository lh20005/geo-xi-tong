import fc from 'fast-check';
import { pool } from '../../db/database';
import { sessionService } from '../SessionService';
import { tokenService } from '../TokenService';
import { authService } from '../AuthService';

describe('SessionService', () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create a test user
    const user = await authService.createUser('sessiontest', 'password123', undefined, 'user');
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM users WHERE username = $1', ['sessiontest']);
    sessionService.stopCleanupTimer();
  });

  afterEach(async () => {
    // Clean up sessions after each test
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [testUserId]);
  });

  /**
   * Feature: system-security-foundation
   * Property 16: 双令牌生成
   * For any successful login, the system should generate both an access token 
   * (1 hour expiry) and a refresh token (7 days expiry).
   * Validates: Requirements 7.1
   */
  describe('Property 16: Dual token generation', () => {
    test('should create session with both tokens on login', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            ipAddress: fc.tuple(
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 })
            ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
            userAgent: fc.string({ minLength: 5, maxLength: 100 })
          }),
          async ({ ipAddress, userAgent }) => {
            // Generate tokens
            const accessToken = tokenService.generateAccessToken(testUserId, 'sessiontest', 'user');
            const refreshToken = tokenService.generateRefreshToken(testUserId);

            // Create session
            await sessionService.createSession(testUserId, refreshToken, ipAddress, userAgent);

            // Verify session exists
            const isValid = await sessionService.validateSession(refreshToken);
            expect(isValid).toBe(true);

            // Verify access token is valid
            const decoded = tokenService.verifyAccessToken(accessToken);
            expect(decoded.userId).toBe(testUserId);

            // Cleanup
            await sessionService.revokeSession(refreshToken);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Feature: system-security-foundation
   * Property 17: 密码变更使会话失效
   * For any password change (user-initiated or admin reset), all existing 
   * refresh tokens for that user should be invalidated, except the current 
   * session token for user-initiated changes.
   * Validates: Requirements 7.2, 7.3
   */
  describe('Property 17: Password change invalidates sessions', () => {
    test('should invalidate all sessions except current on password change', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          async (sessionCount) => {
            // Create multiple sessions
            const tokens: string[] = [];
            for (let i = 0; i < sessionCount; i++) {
              const token = tokenService.generateRefreshToken(testUserId);
              await sessionService.createSession(
                testUserId,
                token,
                `192.168.1.${i}`,
                `UserAgent${i}`
              );
              tokens.push(token);
            }

            // Keep first token as "current"
            const currentToken = tokens[0];

            // Revoke all except current
            const revokedCount = await sessionService.revokeAllSessionsExcept(testUserId, currentToken);

            // Verify count
            expect(revokedCount).toBe(sessionCount - 1);

            // Verify current token still valid
            const currentValid = await sessionService.validateSession(currentToken);
            expect(currentValid).toBe(true);

            // Verify other tokens invalid
            for (let i = 1; i < tokens.length; i++) {
              const valid = await sessionService.validateSession(tokens[i]);
              expect(valid).toBe(false);
            }

            // Cleanup
            await sessionService.revokeSession(currentToken);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should invalidate all sessions on admin password reset', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (sessionCount) => {
            // Create multiple sessions
            const tokens: string[] = [];
            for (let i = 0; i < sessionCount; i++) {
              const token = tokenService.generateRefreshToken(testUserId);
              await sessionService.createSession(
                testUserId,
                token,
                `192.168.1.${i}`,
                `UserAgent${i}`
              );
              tokens.push(token);
            }

            // Revoke all sessions (admin reset scenario)
            const revokedCount = await sessionService.revokeAllSessions(testUserId);

            // Verify count
            expect(revokedCount).toBe(sessionCount);

            // Verify all tokens invalid
            for (const token of tokens) {
              const valid = await sessionService.validateSession(token);
              expect(valid).toBe(false);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Feature: system-security-foundation
   * Property 18: 刷新令牌数据库验证
   * For any refresh token usage, the token should be validated against 
   * the database before issuing a new access token.
   * Validates: Requirements 7.4
   */
  describe('Property 18: Refresh token database validation', () => {
    test('should validate refresh token against database', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          async (shouldExist) => {
            const token = tokenService.generateRefreshToken(testUserId);

            if (shouldExist) {
              // Create session in database
              await sessionService.createSession(testUserId, token, '192.168.1.1', 'TestAgent');
            }

            // Validate
            const isValid = await sessionService.validateSession(token);

            // Property: token is valid only if it exists in database
            expect(isValid).toBe(shouldExist);

            // Cleanup
            if (shouldExist) {
              await sessionService.revokeSession(token);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should update last_used_at on validation', async () => {
      const token = tokenService.generateRefreshToken(testUserId);
      await sessionService.createSession(testUserId, token, '192.168.1.1', 'TestAgent');

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get initial last_used_at
      const result1 = await pool.query(
        'SELECT last_used_at FROM refresh_tokens WHERE token = $1',
        [token]
      );
      const initialTime = result1.rows[0].last_used_at;

      // Wait a bit more
      await new Promise(resolve => setTimeout(resolve, 100));

      // Validate (should update last_used_at)
      await sessionService.validateSession(token);

      // Get updated last_used_at
      const result2 = await pool.query(
        'SELECT last_used_at FROM refresh_tokens WHERE token = $1',
        [token]
      );
      const updatedTime = result2.rows[0].last_used_at;

      // Property: last_used_at should be updated
      expect(new Date(updatedTime).getTime()).toBeGreaterThan(new Date(initialTime).getTime());

      // Cleanup
      await sessionService.revokeSession(token);
    });
  });

  /**
   * Feature: system-security-foundation
   * Property 19: 登出令牌清理
   * For any logout operation, the refresh token should be deleted from 
   * the database and subsequent attempts to use it should fail.
   * Validates: Requirements 7.5
   */
  describe('Property 19: Logout token cleanup', () => {
    test('should delete token on logout and reject subsequent use', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 50 }),
          async (userAgent) => {
            const token = tokenService.generateRefreshToken(testUserId);
            await sessionService.createSession(testUserId, token, '192.168.1.1', userAgent);

            // Verify token is valid before logout
            const validBefore = await sessionService.validateSession(token);
            expect(validBefore).toBe(true);

            // Logout (revoke session)
            await sessionService.revokeSession(token);

            // Property: token should be invalid after logout
            const validAfter = await sessionService.validateSession(token);
            expect(validAfter).toBe(false);

            // Verify token doesn't exist in database
            const result = await pool.query(
              'SELECT * FROM refresh_tokens WHERE token = $1',
              [token]
            );
            expect(result.rows.length).toBe(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Feature: system-security-foundation
   * Property 20: 并发会话限制
   * For any user, the number of active refresh tokens should not exceed 
   * the configured maximum (5 sessions).
   * Validates: Requirements 7.6
   */
  describe('Property 20: Concurrent session limit', () => {
    test('should enforce maximum concurrent sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maxSessions: fc.constant(5),
            attemptedSessions: fc.integer({ min: 1, max: 10 })
          }),
          async ({ maxSessions, attemptedSessions }) => {
            // Create sessions up to or beyond the limit
            for (let i = 0; i < attemptedSessions; i++) {
              const token = tokenService.generateRefreshToken(testUserId);
              await sessionService.createSession(
                testUserId,
                token,
                `192.168.1.${i % 256}`,
                `UserAgent${i}`
              );
            }

            // Get active sessions
            const sessions = await sessionService.getUserSessions(testUserId);

            // Property: active sessions should not exceed max
            expect(sessions.length).toBeLessThanOrEqual(maxSessions);

            // If we attempted more than max, we should have exactly max
            if (attemptedSessions > maxSessions) {
              expect(sessions.length).toBe(maxSessions);
            } else {
              expect(sessions.length).toBe(attemptedSessions);
            }

            // Cleanup
            await sessionService.revokeAllSessions(testUserId);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should remove oldest session when limit exceeded', async () => {
      const maxSessions = 5;
      const tokens: string[] = [];

      // Create max sessions
      for (let i = 0; i < maxSessions; i++) {
        const token = tokenService.generateRefreshToken(testUserId);
        await sessionService.createSession(testUserId, token, `192.168.1.${i}`, `Agent${i}`);
        tokens.push(token);
        // Small delay to ensure different last_used_at times
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Create one more session (should remove oldest)
      const newToken = tokenService.generateRefreshToken(testUserId);
      await sessionService.createSession(testUserId, newToken, '192.168.1.100', 'NewAgent');

      // Get active sessions
      const sessions = await sessionService.getUserSessions(testUserId);

      // Property: should have exactly maxSessions
      expect(sessions.length).toBe(maxSessions);

      // Property: oldest token should be invalid
      const oldestValid = await sessionService.validateSession(tokens[0]);
      expect(oldestValid).toBe(false);

      // Property: new token should be valid
      const newValid = await sessionService.validateSession(newToken);
      expect(newValid).toBe(true);

      // Cleanup
      await sessionService.revokeAllSessions(testUserId);
    });
  });

  // Unit tests
  describe('Unit Tests', () => {
    test('should create session with IP and user agent', async () => {
      const token = tokenService.generateRefreshToken(testUserId);
      const ipAddress = '192.168.1.100';
      const userAgent = 'Mozilla/5.0';

      await sessionService.createSession(testUserId, token, ipAddress, userAgent);

      const result = await pool.query(
        'SELECT * FROM refresh_tokens WHERE token = $1',
        [token]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].ip_address).toBe(ipAddress);
      expect(result.rows[0].user_agent).toBe(userAgent);

      await sessionService.revokeSession(token);
    });

    test('should get all user sessions', async () => {
      const sessionCount = 3;
      const tokens: string[] = [];

      for (let i = 0; i < sessionCount; i++) {
        const token = tokenService.generateRefreshToken(testUserId);
        await sessionService.createSession(testUserId, token, `192.168.1.${i}`, `Agent${i}`);
        tokens.push(token);
      }

      const sessions = await sessionService.getUserSessions(testUserId);

      expect(sessions.length).toBe(sessionCount);
      expect(sessions[0]).toHaveProperty('userId');
      expect(sessions[0]).toHaveProperty('ipAddress');
      expect(sessions[0]).toHaveProperty('userAgent');

      await sessionService.revokeAllSessions(testUserId);
    });

    test('should cleanup expired sessions', async () => {
      // Create an expired session by directly inserting
      const token = tokenService.generateRefreshToken(testUserId);
      await pool.query(
        `INSERT INTO refresh_tokens (user_id, token, ip_address, user_agent, expires_at) 
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP - INTERVAL '1 day')`,
        [testUserId, token, '192.168.1.1', 'TestAgent']
      );

      // Run cleanup
      const cleanedCount = await sessionService.cleanupExpiredSessions();

      expect(cleanedCount).toBeGreaterThanOrEqual(1);

      // Verify token is gone
      const result = await pool.query(
        'SELECT * FROM refresh_tokens WHERE token = $1',
        [token]
      );
      expect(result.rows.length).toBe(0);
    });

    test('should return empty array for user with no sessions', async () => {
      const sessions = await sessionService.getUserSessions(testUserId);
      expect(sessions).toEqual([]);
    });

    test('should handle concurrent session creation', async () => {
      const promises = [];
      for (let i = 0; i < 3; i++) {
        const token = tokenService.generateRefreshToken(testUserId);
        promises.push(
          sessionService.createSession(testUserId, token, `192.168.1.${i}`, `Agent${i}`)
        );
      }

      await Promise.all(promises);

      const sessions = await sessionService.getUserSessions(testUserId);
      expect(sessions.length).toBe(3);

      await sessionService.revokeAllSessions(testUserId);
    });
  });
});
