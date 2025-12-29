import { Request, Response, NextFunction } from 'express';

/**
 * 租户上下文中间件
 * 将当前用户ID注入到请求对象中，用于数据隔离
 */

// 扩展Express Request类型
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: string;
    }
  }
}

/**
 * 设置租户上下文
 * 从JWT token中提取用户ID并注入到请求对象
 * 必须在 authenticate 中间件之后使用
 */
export function setTenantContext(req: Request, res: Response, next: NextFunction) {
  // 从JWT中间件获取用户信息（由 authenticate 中间件设置）
  const user = (req as any).user;
  
  if (user) {
    req.userId = user.userId;
    req.userRole = user.role;
  }
  
  next();
}

/**
 * 要求租户上下文
 * 确保请求必须包含用户ID
 */
export function requireTenantContext(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: '未授权访问'
    });
  }
  
  next();
}

/**
 * 获取当前租户ID（用户ID）
 */
export function getCurrentTenantId(req: Request): number {
  if (!req.userId) {
    throw new Error('租户上下文未设置');
  }
  return req.userId;
}

/**
 * 检查是否是管理员
 */
export function isAdmin(req: Request): boolean {
  return req.userRole === 'admin';
}
