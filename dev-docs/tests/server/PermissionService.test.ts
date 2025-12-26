import fc from 'fast-check';
import { pool } from '../../db/database';
import { permissionService } from '../PermissionService';
import { authService } from '../AuthService';

describe('PermissionService', () => {
  let testAdminId: number;
  let testUserId: number;

  beforeAll(async () => {
    // Create test users
    const admin = await authService.createUser('permadmin', 'Admin123!', undefined, 'admin');
    const user = await authService.createUser('permuser', 'User123!', undefined, 'user');
    testAdminId = admin.id;
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM user_permissions WHERE user_id IN ($1, $2)', [testAdminId, testUserId]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testAdminId, testUserId]);
  });

  afterEach(async () => {
    // Clean up permissions after each test
    await pool.query('DELETE FROM user_permissions WHERE user_id = $1', [testUserId]);
  });

  /**
   * Feature: system-security-foundation
   * Property 48: 权限检查执行
   * For any user and permission, the system should correctly determine if the user has that permission.
   * Validates: Requirements 15.1, 15.2
   */
  describe('Property 48: Permission check execution', () => {
    test('should correctly check if user has permission', async () => {
      // Grant a permission
      await permissionService.grantPermission(testUserId, 'view_users', testAdminId);

      // Check permission
      const hasPermission = await permissionService.hasPermission(testUserId, 'view_users');
      expect(hasPermission).toBe(true);

      // Check non-existent permission
      const hasOtherPermission = await permissionService.hasPermission(testUserId, 'delete_users');
      expect(hasOtherPermission).toBe(false);
    });

    test('should return false for non-existent permission', async () => {
      const hasPermission = await permissionService.hasPermission(testUserId, 'non_existent_permission');
      expect(hasPermission).toBe(false);
    });
  });

  /**
   * Feature: system-security-foundation
   * Property 49: 权限授予和撤销
   * For any user and permission, granting then revoking should result in the user not having the permission.
   * Validates: Requirements 15.4
   */
  describe('Property 49: Permission grant and revoke', () => {
    test('should grant and revoke permissions correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('view_users', 'edit_users', 'delete_users', 'view_config', 'edit_config'),
          async (permissionName) => {
            // Grant permission
            await permissionService.grantPermission(testUserId, permissionName, testAdminId);
            
            // Verify granted
            let hasPermission = await permissionService.hasPermission(testUserId, permissionName);
            expect(hasPermission).toBe(true);

            // Revoke permission
            await permissionService.revokePermission(testUserId, permissionName, testAdminId);
            
            // Verify revoked
            hasPermission = await permissionService.hasPermission(testUserId, permissionName);
            expect(hasPermission).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should handle duplicate grants gracefully', async () => {
      await permissionService.grantPermission(testUserId, 'view_users', testAdminId);
      await permissionService.grantPermission(testUserId, 'view_users', testAdminId);

      const hasPermission = await permissionService.hasPermission(testUserId, 'view_users');
      expect(hasPermission).toBe(true);
    });

    test('should handle revoking non-existent permission gracefully', async () => {
      await expect(
        permissionService.revokePermission(testUserId, 'view_users', testAdminId)
      ).resolves.not.toThrow();
    });
  });

  /**
   * Feature: system-security-foundation
   * Property 50: 权限变更审计
   * For any permission grant or revoke, an audit log entry should be created.
   * Validates: Requirements 15.5
   */
  describe('Property 50: Permission change audit', () => {
    test('should log permission grants', async () => {
      await permissionService.grantPermission(testUserId, 'view_users', testAdminId);

      const logs = await pool.query(
        `SELECT * FROM audit_logs 
         WHERE admin_id = $1 AND action = 'GRANT_PERMISSION' 
         ORDER BY created_at DESC LIMIT 1`,
        [testAdminId]
      );

      expect(logs.rows.length).toBe(1);
      expect(logs.rows[0].target_id).toBe(testUserId);
    });

    test('should log permission revokes', async () => {
      await permissionService.grantPermission(testUserId, 'view_users', testAdminId);
      await permissionService.revokePermission(testUserId, 'view_users', testAdminId);

      const logs = await pool.query(
        `SELECT * FROM audit_logs 
         WHERE admin_id = $1 AND action = 'REVOKE_PERMISSION' 
         ORDER BY created_at DESC LIMIT 1`,
        [testAdminId]
      );

      expect(logs.rows.length).toBe(1);
      expect(logs.rows[0].target_id).toBe(testUserId);
    });
  });

  // Unit tests
  describe('Unit Tests', () => {
    test('should get all user permissions', async () => {
      await permissionService.grantPermission(testUserId, 'view_users', testAdminId);
      await permissionService.grantPermission(testUserId, 'edit_users', testAdminId);

      const permissions = await permissionService.getUserPermissions(testUserId);
      expect(permissions.length).toBe(2);
      expect(permissions.some(p => p.permission_name === 'view_users')).toBe(true);
      expect(permissions.some(p => p.permission_name === 'edit_users')).toBe(true);
    });

    test('should get all available permissions', async () => {
      const permissions = await permissionService.getAllPermissions();
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.name === 'view_users')).toBe(true);
    });

    test('should grant multiple permissions', async () => {
      await permissionService.grantPermissions(
        testUserId,
        ['view_users', 'edit_users', 'delete_users'],
        testAdminId
      );

      const hasView = await permissionService.hasPermission(testUserId, 'view_users');
      const hasEdit = await permissionService.hasPermission(testUserId, 'edit_users');
      const hasDelete = await permissionService.hasPermission(testUserId, 'delete_users');

      expect(hasView).toBe(true);
      expect(hasEdit).toBe(true);
      expect(hasDelete).toBe(true);
    });

    test('should check if user has any permission', async () => {
      await permissionService.grantPermission(testUserId, 'view_users', testAdminId);

      const hasAny = await permissionService.hasAnyPermission(
        testUserId,
        ['view_users', 'edit_users', 'delete_users']
      );

      expect(hasAny).toBe(true);
    });

    test('should check if user has all permissions', async () => {
      await permissionService.grantPermissions(
        testUserId,
        ['view_users', 'edit_users'],
        testAdminId
      );

      const hasAll = await permissionService.hasAllPermissions(
        testUserId,
        ['view_users', 'edit_users']
      );

      expect(hasAll).toBe(true);

      const hasAllIncludingMissing = await permissionService.hasAllPermissions(
        testUserId,
        ['view_users', 'edit_users', 'delete_users']
      );

      expect(hasAllIncludingMissing).toBe(false);
    });
  });
});
