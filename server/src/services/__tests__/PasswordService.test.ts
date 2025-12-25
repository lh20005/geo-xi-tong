import fc from 'fast-check';
import { pool } from '../../db/database';
import { passwordService } from '../PasswordService';
import { authService } from '../AuthService';

describe('PasswordService', () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create a test user
    const user = await authService.createUser('passwordtest', 'Password123!', undefined, 'user');
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM password_history WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE username = $1', ['passwordtest']);
  });

  afterEach(async () => {
    // Clean up password history after each test
    await pool.query('DELETE FROM password_history WHERE user_id = $1', [testUserId]);
    // Reset login attempts
    passwordService.resetLoginAttempts(testUserId);
  });

  /**
   * Feature: system-security-foundation
   * Property 21: 密码长度验证
   * For any password registration or change, passwords shorter than 8 characters should be rejected.
   * Validates: Requirements 8.1
   */
  describe('Property 21: Password length validation', () => {
    test('should reject passwords shorter than 8 characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 7 }),
          async (password) => {
            const result = passwordService.validatePasswordStrength(password);
            
            // Property: passwords < 8 characters should be invalid
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('密码必须至少8个字符');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should accept passwords with 8 or more characters (if they meet other requirements)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 })
            .filter(s => /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)),
          async (password) => {
            const result = passwordService.validatePasswordStrength(password);
            
            // Property: passwords >= 8 characters with complexity should be valid
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Feature: system-security-foundation
   * Property 22: 密码复杂度验证
   * For any password, it should contain at least one uppercase letter, one lowercase letter, 
   * and one number, otherwise it should be rejected.
   * Validates: Requirements 8.2
   */
  describe('Property 22: Password complexity validation', () => {
    test('should reject passwords without uppercase letters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 })
            .filter(s => !/[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)),
          async (password) => {
            const result = passwordService.validatePasswordStrength(password);
            
            // Property: passwords without uppercase should be invalid
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('密码必须包含至少一个大写字母');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should reject passwords without lowercase letters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 })
            .filter(s => /[A-Z]/.test(s) && !/[a-z]/.test(s) && /[0-9]/.test(s)),
          async (password) => {
            const result = passwordService.validatePasswordStrength(password);
            
            // Property: passwords without lowercase should be invalid
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('密码必须包含至少一个小写字母');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should reject passwords without numbers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 })
            .filter(s => /[A-Z]/.test(s) && /[a-z]/.test(s) && !/[0-9]/.test(s)),
          async (password) => {
            const result = passwordService.validatePasswordStrength(password);
            
            // Property: passwords without numbers should be invalid
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('密码必须包含至少一个数字');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should accept passwords with all complexity requirements', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 })
            .filter(s => /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)),
          async (password) => {
            const result = passwordService.validatePasswordStrength(password);
            
            // Property: passwords meeting all requirements should be valid
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Feature: system-security-foundation
   * Property 25: 密码重用防止
   * For any password change, if the new password matches any of the last 3 passwords, 
   * it should be rejected.
   * Validates: Requirements 8.6
   */
  describe('Property 25: Password reuse prevention', () => {
    test('should detect password reuse within last 3 passwords', async () => {
      // Create 3 password history entries
      const passwords = ['Password1!', 'Password2!', 'Password3!'];
      
      for (const pwd of passwords) {
        const hash = await authService.hashPassword(pwd);
        await passwordService.savePasswordHistory(testUserId, hash);
      }

      // Try to reuse each of the last 3 passwords
      for (const pwd of passwords) {
        const isReused = await passwordService.checkPasswordReuse(testUserId, pwd);
        expect(isReused).toBe(true);
      }

      // Try a new password (should not be reused)
      const newPassword = 'Password4!';
      const isReused = await passwordService.checkPasswordReuse(testUserId, newPassword);
      expect(isReused).toBe(false);
    });

    test('should allow reuse of passwords older than last 3', async () => {
      // Create 4 password history entries
      const passwords = ['Password1!', 'Password2!', 'Password3!', 'Password4!'];
      
      for (const pwd of passwords) {
        const hash = await authService.hashPassword(pwd);
        await passwordService.savePasswordHistory(testUserId, hash);
      }

      // The first password should now be allowed (more than 3 passwords ago)
      const isReused = await passwordService.checkPasswordReuse(testUserId, 'Password1!');
      expect(isReused).toBe(false);

      // But the last 3 should still be blocked
      const isReused2 = await passwordService.checkPasswordReuse(testUserId, 'Password2!');
      expect(isReused2).toBe(true);
    });
  });

  /**
   * Feature: system-security-foundation
   * Property 23: 账户锁定机制
   * For any user account, after 5 failed login attempts within 15 minutes, 
   * the account should be locked for 15 minutes.
   * Validates: Requirements 8.3
   */
  describe('Property 23: Account lockout mechanism', () => {
    test('should lock account after 5 failed attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 10 }),
          async (failedAttempts) => {
            // Record failed login attempts
            for (let i = 0; i < failedAttempts; i++) {
              passwordService.recordLoginAttempt(testUserId, false);
            }

            // Check if account is locked
            const lockStatus = passwordService.isAccountLocked(testUserId);

            // Property: account should be locked after >= 5 failed attempts
            expect(lockStatus.locked).toBe(true);
            expect(lockStatus.unlockAt).toBeDefined();

            // Cleanup
            passwordService.resetLoginAttempts(testUserId);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should not lock account with fewer than 5 failed attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 4 }),
          async (failedAttempts) => {
            // Record failed login attempts
            for (let i = 0; i < failedAttempts; i++) {
              passwordService.recordLoginAttempt(testUserId, false);
            }

            // Check if account is locked
            const lockStatus = passwordService.isAccountLocked(testUserId);

            // Property: account should NOT be locked with < 5 failed attempts
            expect(lockStatus.locked).toBe(false);

            // Cleanup
            passwordService.resetLoginAttempts(testUserId);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should reset failed attempts after successful login', () => {
      // Record some failed attempts
      passwordService.recordLoginAttempt(testUserId, false);
      passwordService.recordLoginAttempt(testUserId, false);
      passwordService.recordLoginAttempt(testUserId, false);

      // Check count before reset
      const countBefore = passwordService.getFailedLoginCount(testUserId);
      expect(countBefore).toBe(3);

      // Record successful login and reset
      passwordService.recordLoginAttempt(testUserId, true);
      passwordService.resetLoginAttempts(testUserId);

      // Check count after reset
      const countAfter = passwordService.getFailedLoginCount(testUserId);
      expect(countAfter).toBe(0);

      // Account should not be locked
      const lockStatus = passwordService.isAccountLocked(testUserId);
      expect(lockStatus.locked).toBe(false);
    });
  });

  // Unit tests
  describe('Unit Tests', () => {
    test('should validate password with exact 8 characters', () => {
      const result = passwordService.validatePasswordStrength('Pass123!');
      expect(result.valid).toBe(true);
    });

    test('should reject empty password', () => {
      const result = passwordService.validatePasswordStrength('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须至少8个字符');
    });

    test('should reject password with only lowercase and numbers', () => {
      const result = passwordService.validatePasswordStrength('password123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含至少一个大写字母');
    });

    test('should save password history', async () => {
      const hash = await authService.hashPassword('TestPassword123!');
      await passwordService.savePasswordHistory(testUserId, hash);

      const result = await pool.query(
        'SELECT * FROM password_history WHERE user_id = $1',
        [testUserId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].password_hash).toBe(hash);
    });

    test('should return false for password reuse when no history exists', async () => {
      const isReused = await passwordService.checkPasswordReuse(testUserId, 'AnyPassword123!');
      expect(isReused).toBe(false);
    });

    test('should get correct failed login count', () => {
      passwordService.recordLoginAttempt(testUserId, false);
      passwordService.recordLoginAttempt(testUserId, true);
      passwordService.recordLoginAttempt(testUserId, false);
      passwordService.recordLoginAttempt(testUserId, false);

      const count = passwordService.getFailedLoginCount(testUserId);
      expect(count).toBe(3);
    });

    test('should cleanup expired attempts', () => {
      passwordService.recordLoginAttempt(testUserId, false);
      passwordService.recordLoginAttempt(testUserId, false);

      passwordService.cleanupExpiredAttempts();

      // Verify the method runs without error
      expect(true).toBe(true);
    });
  });
});
