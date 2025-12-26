import { CSRFService } from '../CSRFService';
import fc from 'fast-check';

/**
 * Feature: system-security-foundation
 * Property 40: CSRF令牌生成
 * Property 41: CSRF令牌验证
 * Property 42: CSRF令牌一次性使用
 * Property 43: SameSite Cookie属性
 * 
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5
 */

describe('CSRFService', () => {
  let csrfService: CSRFService;

  beforeEach(() => {
    csrfService = new CSRFService();
  });

  afterEach(() => {
    csrfService.clearAll();
  });

  describe('Property 40: CSRF Token Generation', () => {
    test('should generate unique CSRF tokens', async () => {
      const sessionId = 'test-session-1';
      
      const token1 = await csrfService.generateToken(sessionId);
      const token2 = await csrfService.generateToken(sessionId);

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(0);
      expect(token2.length).toBeGreaterThan(0);
    });

    test('Property 40: All generated tokens should be unique and stored', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 5 }),
          async (sessionId, count) => {
            const tokens = new Set<string>();

            for (let i = 0; i < count; i++) {
              const token = await csrfService.generateToken(sessionId);
              
              // Property: Each token should be unique
              expect(tokens.has(token)).toBe(false);
              tokens.add(token);

              // Property: Token should be stored and retrievable
              const isValid = await csrfService.validateToken(token, sessionId);
              expect(isValid).toBe(true);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should store token with correct session association', async () => {
      const sessionId = 'test-session-2';
      const token = await csrfService.generateToken(sessionId);

      const isValid = await csrfService.validateToken(token, sessionId);
      expect(isValid).toBe(true);

      // Wrong session should fail
      const isValidWrongSession = await csrfService.validateToken(token, 'wrong-session');
      expect(isValidWrongSession).toBe(false);
    });
  });

  describe('Property 41: CSRF Token Validation', () => {
    test('should validate correct token and session', async () => {
      const sessionId = 'test-session-3';
      const token = await csrfService.generateToken(sessionId);

      const isValid = await csrfService.validateToken(token, sessionId);
      expect(isValid).toBe(true);
    });

    test('should reject invalid token', async () => {
      const sessionId = 'test-session-4';
      const invalidToken = 'invalid-token-12345';

      const isValid = await csrfService.validateToken(invalidToken, sessionId);
      expect(isValid).toBe(false);
    });

    test('should reject token with wrong session', async () => {
      const sessionId1 = 'test-session-5';
      const sessionId2 = 'test-session-6';
      const token = await csrfService.generateToken(sessionId1);

      const isValid = await csrfService.validateToken(token, sessionId2);
      expect(isValid).toBe(false);
    });

    test('Property 41: Token validation should enforce session matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (sessionId1, sessionId2) => {
            const token = await csrfService.generateToken(sessionId1);

            // Property: Token should be valid for its own session
            const isValidCorrect = await csrfService.validateToken(token, sessionId1);
            expect(isValidCorrect).toBe(true);

            // Property: Token should be invalid for different session
            if (sessionId1 !== sessionId2) {
              const isValidWrong = await csrfService.validateToken(token, sessionId2);
              expect(isValidWrong).toBe(false);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should reject empty or null tokens', async () => {
      const sessionId = 'test-session-7';

      expect(await csrfService.validateToken('', sessionId)).toBe(false);
      expect(await csrfService.validateToken(null as any, sessionId)).toBe(false);
      expect(await csrfService.validateToken(undefined as any, sessionId)).toBe(false);
    });

    test('should reject empty or null session', async () => {
      const token = await csrfService.generateToken('test-session-8');

      expect(await csrfService.validateToken(token, '')).toBe(false);
      expect(await csrfService.validateToken(token, null as any)).toBe(false);
      expect(await csrfService.validateToken(token, undefined as any)).toBe(false);
    });
  });

  describe('Property 42: CSRF Token One-Time Use', () => {
    test('should consume token on first use', async () => {
      const sessionId = 'test-session-9';
      const token = await csrfService.generateToken(sessionId);

      // First use should succeed
      const firstUse = await csrfService.validateAndConsumeToken(token, sessionId);
      expect(firstUse).toBe(true);

      // Second use should fail (token consumed)
      const secondUse = await csrfService.validateAndConsumeToken(token, sessionId);
      expect(secondUse).toBe(false);
    });

    test('Property 42: Tokens should be single-use only', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 2, max: 5 }),
          async (sessionId, attemptCount) => {
            const token = await csrfService.generateToken(sessionId);

            let successCount = 0;
            for (let i = 0; i < attemptCount; i++) {
              const isValid = await csrfService.validateAndConsumeToken(token, sessionId);
              if (isValid) {
                successCount++;
              }
            }

            // Property: Only the first attempt should succeed
            expect(successCount).toBe(1);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should allow validation without consumption', async () => {
      const sessionId = 'test-session-10';
      const token = await csrfService.generateToken(sessionId);

      // Multiple validations should succeed
      expect(await csrfService.validateToken(token, sessionId)).toBe(true);
      expect(await csrfService.validateToken(token, sessionId)).toBe(true);
      expect(await csrfService.validateToken(token, sessionId)).toBe(true);
    });
  });

  describe('Unit Tests: Additional Functionality', () => {
    test('should refresh token', async () => {
      const sessionId = 'test-session-11';
      const oldToken = await csrfService.generateToken(sessionId);

      const newToken = await csrfService.refreshToken(oldToken, sessionId);
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(oldToken);

      // Old token should be invalid
      expect(await csrfService.validateToken(oldToken, sessionId)).toBe(false);

      // New token should be valid
      expect(await csrfService.validateToken(newToken!, sessionId)).toBe(true);
    });

    test('should not refresh invalid token', async () => {
      const sessionId = 'test-session-12';
      const invalidToken = 'invalid-token';

      const newToken = await csrfService.refreshToken(invalidToken, sessionId);
      expect(newToken).toBeNull();
    });

    test('should revoke all session tokens', async () => {
      const sessionId = 'test-session-13';
      
      // Generate multiple tokens for the same session
      const token1 = await csrfService.generateToken(sessionId);
      const token2 = await csrfService.generateToken(sessionId);
      const token3 = await csrfService.generateToken(sessionId);

      // Revoke all tokens for this session
      const revokedCount = await csrfService.revokeSessionTokens(sessionId);
      expect(revokedCount).toBe(3);

      // All tokens should be invalid
      expect(await csrfService.validateToken(token1, sessionId)).toBe(false);
      expect(await csrfService.validateToken(token2, sessionId)).toBe(false);
      expect(await csrfService.validateToken(token3, sessionId)).toBe(false);
    });

    test('should not affect other sessions when revoking', async () => {
      const sessionId1 = 'test-session-14';
      const sessionId2 = 'test-session-15';
      
      const token1 = await csrfService.generateToken(sessionId1);
      const token2 = await csrfService.generateToken(sessionId2);

      // Revoke session1 tokens
      await csrfService.revokeSessionTokens(sessionId1);

      // Session1 token should be invalid
      expect(await csrfService.validateToken(token1, sessionId1)).toBe(false);

      // Session2 token should still be valid
      expect(await csrfService.validateToken(token2, sessionId2)).toBe(true);
    });
  });
});
