import { Request, Response, NextFunction } from 'express';

/**
 * 响应清理中间件
 * 自动从所有 API 响应中移除敏感字段
 */

// 需要移除的敏感字段列表
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'passwordHash',
  'refresh_token',
  'refreshToken'
];

/**
 * 递归清理对象中的敏感字段
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    
    for (const key in obj) {
      // 跳过敏感字段
      if (SENSITIVE_FIELDS.includes(key)) {
        continue;
      }
      
      // 递归清理嵌套对象
      sanitized[key] = sanitizeObject(obj[key]);
    }
    
    return sanitized;
  }

  return obj;
}

/**
 * 响应清理中间件
 * 拦截 res.json() 调用并清理响应数据
 */
export const sanitizeResponse = (req: Request, res: Response, next: NextFunction) => {
  // 保存原始的 json 方法
  const originalJson = res.json.bind(res);

  // 重写 json 方法
  res.json = function(body: any) {
    // 清理响应体
    const sanitizedBody = sanitizeObject(body);
    
    // 调用原始的 json 方法
    return originalJson(sanitizedBody);
  };

  next();
};

/**
 * 清理用户对象
 * 专门用于清理用户对象的辅助函数
 */
export function sanitizeUser(user: any): any {
  if (!user) return user;

  const { password, password_hash, passwordHash, ...sanitized } = user;
  
  return sanitized;
}

/**
 * 清理用户数组
 */
export function sanitizeUsers(users: any[]): any[] {
  if (!Array.isArray(users)) return users;
  
  return users.map(user => sanitizeUser(user));
}
