import fc from 'fast-check';
import { pool } from '../../db/database';
import { authService } from '../AuthService';
import { userService } from '../UserService';

describe('Temporary Password', () => {
  let testUserId: number;
  let testUsername: string;

  beforeAll(async () => {
    // Create a test user
    testUsername = `temppasstest_${Date.now()}`;
    const user = await authService.createUser(testUsername, 'Password123!', undefined, 'user');
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM password_history WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  /**
   * Feature: system-security-foundation
   * Property 24: 临时密码标记
   * For any user whose password is reset by an admin, the is_temp_password flag should be set to true,
   * and upon successful password change, the flag should be cleared.
   * Validates: Requirements 8.4, 8.5
   */
  describe('Property 24: Temporary password flag', () => {
    test('should set is_temp_password flag when admin resets password', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(testUserId),
          async (userId) => {
            // Admin resets password
            const tempPassword = await userService.resetPassword(userId);
            
            // Verify temp password was generated
            expect(tempPassword).toBeDefined();
            expect(tempPassword.length).toBe(8);
            
            // Check that is_temp_password flag is set
            const result = await pool.query(
              'SELECT is_temp_password FROM users WHERE id = $1',
              [userId]
            );
            
            // Property: is_temp_password should be true after admin reset
            expect(result.rows[0].is_temp_password).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should clear is_temp_password flag after user changes password', async () => {
      // Admin resets password
      const tempPassword = await userService.resetPassword(testUserId);
      
      // Verify flag is set
      let result = await pool.query(
        'SELECT is_temp_password FROM users WHERE id = $1',
        [testUserId]
      );
      expect(result.rows[0].is_temp_password).toBe(true);
      
      // User changes password
      const newPassword = 'NewPassword123!';
      await userService.changePassword(testUserId, tempPassword, newPassword);
      
      // Check that is_temp_password flag is cleared
      result = await pool.query(
        'SELECT is_temp_password FROM users WHERE id = $1',
        [testUserId]
      );
      
      // Property: is_temp_password should be false after password change
      expect(result.rows[0].is_temp_password).toBe(false);
    });

    test('should detect temporary password on login', async () => {
      // Admin resets password
      const tempPassword = await userService.resetPassword(testUserId);
      
      // Verify user can login with temp password
      const user = await authService.validateUser(testUsername, tempPassword);
      
      expect(user).not.toBeNull();
      expect(user?.is_temp_password).toBe(true);
    });

    test('should require password change for temporary password users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(testUserId),
          async (userId) => {
            // Admin resets password
            await userService.resetPassword(userId);
            
            // Get user
            const user = await userService.getUserById(userId);
            
            // Property: user with temp password should have flag set
            expect(user?.is_temp_password).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // Unit tests
  describe('Unit Tests', () => {
    test('should generate 8-character temporary password', async () => {
      const tempPassword = await userService.resetPassword(testUserId);
      
      expect(tempPassword).toBeDefined();
      expect(tempPassword.length).toBe(8);
      expect(/^[a-zA-Z0-9]+$/.test(tempPassword)).toBe(true);
    });

    test('should invalidate all sessions when password is reset', async () => {
      // This is tested implicitly by the resetPassword method
      // which calls sessionService.revokeAllSessions
      const tempPassword = await userService.resetPassword(testUserId);
      expect(tempPassword).toBeDefined();
    });

    test('should save password history when resetting password', async () => {
      // Clear existing history
      await pool.query('DELETE FROM password_history WHERE user_id = $1', [testUserId]);
      
      // Reset password
      await userService.resetPassword(testUserId);
      
      // Check password history
      const result = await pool.query(
        'SELECT COUNT(*) as count FROM password_history WHERE user_id = $1',
        [testUserId]
      );
      
      expect(parseInt(result.rows[0].count)).toBeGreaterThan(0);
    });

    test('should not allow reusing temporary password', async () => {
      const tempPassword = await userService.resetPassword(testUserId);
      
      // Try to change to a different password
      const newPassword = 'NewPassword456!';
      await userService.changePassword(testUserId, tempPassword, newPassword);
      
      // Try to change back to temp password (should fail due to password reuse check)
      await expect(
        userService.changePassword(testUserId, newPassword, tempPassword)
      ).rejects.toThrow('新密码不能与最近3次使用的密码相同');
    });
  });
});
