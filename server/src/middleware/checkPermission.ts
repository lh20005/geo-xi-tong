import { Request, Response, NextFunction } from 'express';
import { permissionService } from '../services/PermissionService';

/**
 * 权限检查中间件
 * 验证用户是否拥有指定权限
 * Requirements: 15.2
 */
export const checkPermission = (requiredPermission: string | string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user || !user.userId) {
        return res.status(401).json({
          success: false,
          message: '未认证'
        });
      }

      const userId = user.userId;
      const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

      // 检查用户是否拥有任一所需权限
      const hasPermission = await permissionService.hasAnyPermission(userId, permissions);

      if (!hasPermission) {
        console.log(`[Permission] 权限不足: userId=${userId}, required=${permissions.join(',')}`);
        return res.status(403).json({
          success: false,
          message: '权限不足',
          requiredPermissions: permissions
        });
      }

      // 权限验证通过,继续处理请求
      next();
    } catch (error) {
      console.error('[Permission] 权限检查失败:', error);
      res.status(500).json({
        success: false,
        message: '权限检查失败'
      });
    }
  };
};

/**
 * 要求所有权限的中间件
 */
export const checkAllPermissions = (requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user || !user.userId) {
        return res.status(401).json({
          success: false,
          message: '未认证'
        });
      }

      const userId = user.userId;

      // 检查用户是否拥有所有所需权限
      const hasAllPermissions = await permissionService.hasAllPermissions(userId, requiredPermissions);

      if (!hasAllPermissions) {
        console.log(`[Permission] 权限不足: userId=${userId}, required all of ${requiredPermissions.join(',')}`);
        return res.status(403).json({
          success: false,
          message: '权限不足',
          requiredPermissions
        });
      }

      // 权限验证通过,继续处理请求
      next();
    } catch (error) {
      console.error('[Permission] 权限检查失败:', error);
      res.status(500).json({
        success: false,
        message: '权限检查失败'
      });
    }
  };
};
