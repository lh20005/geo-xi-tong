import { pool } from '../db/database';
import { auditLogService } from './AuditLogService';

interface Permission {
  id: number;
  name: string;
  description: string;
  category: string;
  created_at: Date;
}

interface UserPermission {
  id: number;
  user_id: number;
  permission_id: number;
  granted_by: number | null;
  granted_at: Date;
  permission_name?: string;
  permission_description?: string;
}

export class PermissionService {
  private static instance: PermissionService;

  private constructor() {}

  public static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  /**
   * 检查用户是否拥有指定权限
   * Requirements: 15.2
   */
  async hasPermission(userId: number, permissionName: string): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count 
         FROM user_permissions up
         JOIN permissions p ON up.permission_id = p.id
         WHERE up.user_id = $1 AND p.name = $2`,
        [userId, permissionName]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('[Permission] 检查权限失败:', error);
      return false;
    }
  }

  /**
   * 授予用户权限
   * Requirements: 15.4
   */
  async grantPermission(
    userId: number,
    permissionName: string,
    grantedBy: number
  ): Promise<void> {
    try {
      // 获取权限ID
      const permResult = await pool.query(
        'SELECT id FROM permissions WHERE name = $1',
        [permissionName]
      );

      if (permResult.rows.length === 0) {
        throw new Error(`权限不存在: ${permissionName}`);
      }

      const permissionId = permResult.rows[0].id;

      // 检查是否已经拥有该权限
      const existing = await pool.query(
        'SELECT id FROM user_permissions WHERE user_id = $1 AND permission_id = $2',
        [userId, permissionId]
      );

      if (existing.rows.length > 0) {
        console.log(`[Permission] 用户已拥有权限: userId=${userId}, permission=${permissionName}`);
        return;
      }

      // 授予权限
      await pool.query(
        `INSERT INTO user_permissions (user_id, permission_id, granted_by) 
         VALUES ($1, $2, $3)`,
        [userId, permissionId, grantedBy]
      );

      // 记录审计日志
      await auditLogService.logAction(
        grantedBy,
        'GRANT_PERMISSION',
        'user',
        userId.toString(),
        {
          permission: permissionName,
          grantee: userId
        },
        'system',
        'PermissionService'
      );

      console.log(`[Permission] 权限已授予: userId=${userId}, permission=${permissionName}, grantedBy=${grantedBy}`);
    } catch (error) {
      console.error('[Permission] 授予权限失败:', error);
      throw error;
    }
  }

  /**
   * 撤销用户权限
   * Requirements: 15.4
   */
  async revokePermission(
    userId: number,
    permissionName: string,
    revokedBy: number
  ): Promise<void> {
    try {
      // 获取权限ID
      const permResult = await pool.query(
        'SELECT id FROM permissions WHERE name = $1',
        [permissionName]
      );

      if (permResult.rows.length === 0) {
        throw new Error(`权限不存在: ${permissionName}`);
      }

      const permissionId = permResult.rows[0].id;

      // 撤销权限
      const result = await pool.query(
        'DELETE FROM user_permissions WHERE user_id = $1 AND permission_id = $2',
        [userId, permissionId]
      );

      if (result.rowCount === 0) {
        console.log(`[Permission] 用户未拥有该权限: userId=${userId}, permission=${permissionName}`);
        return;
      }

      // 记录审计日志
      await auditLogService.logAction(
        revokedBy,
        'REVOKE_PERMISSION',
        'user',
        userId.toString(),
        {
          permission: permissionName,
          revokee: userId
        },
        'system',
        'PermissionService'
      );

      console.log(`[Permission] 权限已撤销: userId=${userId}, permission=${permissionName}, revokedBy=${revokedBy}`);
    } catch (error) {
      console.error('[Permission] 撤销权限失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有权限
   * Requirements: 15.1
   */
  async getUserPermissions(userId: number): Promise<UserPermission[]> {
    try {
      const result = await pool.query(
        `SELECT 
          up.id,
          up.user_id,
          up.permission_id,
          up.granted_by,
          up.granted_at,
          p.name as permission_name,
          p.description as permission_description
         FROM user_permissions up
         JOIN permissions p ON up.permission_id = p.id
         WHERE up.user_id = $1
         ORDER BY p.category, p.name`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('[Permission] 获取用户权限失败:', error);
      return [];
    }
  }

  /**
   * 获取所有可用权限
   * Requirements: 15.3
   */
  async getAllPermissions(): Promise<Permission[]> {
    try {
      const result = await pool.query(
        `SELECT id, name, description, category, created_at 
         FROM permissions 
         ORDER BY category, name`
      );

      return result.rows;
    } catch (error) {
      console.error('[Permission] 获取所有权限失败:', error);
      return [];
    }
  }

  /**
   * 批量授予权限
   */
  async grantPermissions(
    userId: number,
    permissionNames: string[],
    grantedBy: number
  ): Promise<void> {
    for (const permissionName of permissionNames) {
      await this.grantPermission(userId, permissionName, grantedBy);
    }
  }

  /**
   * 批量撤销权限
   */
  async revokePermissions(
    userId: number,
    permissionNames: string[],
    revokedBy: number
  ): Promise<void> {
    for (const permissionName of permissionNames) {
      await this.revokePermission(userId, permissionName, revokedBy);
    }
  }

  /**
   * 检查用户是否拥有任一权限
   */
  async hasAnyPermission(userId: number, permissionNames: string[]): Promise<boolean> {
    for (const permissionName of permissionNames) {
      if (await this.hasPermission(userId, permissionName)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查用户是否拥有所有权限
   */
  async hasAllPermissions(userId: number, permissionNames: string[]): Promise<boolean> {
    for (const permissionName of permissionNames) {
      if (!(await this.hasPermission(userId, permissionName))) {
        return false;
      }
    }
    return true;
  }
}

export const permissionService = PermissionService.getInstance();
