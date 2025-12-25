import { Request, Response, NextFunction } from 'express';
import { rateLimitService, RateLimitConfig } from '../services/RateLimitService';
import { auditLogService } from '../services/AuditLogService';

/**
 * 限流中间件
 * 使用滑动窗口算法限制请求频率
 */

/**
 * 创建频率限制中间件
 * @param keyGenerator 生成限制键的函数
 * @param config 频率限制配置
 * @param errorMessage 错误消息
 */
export function createRateLimitMiddleware(
  keyGenerator: (req: Request) => string,
  config: RateLimitConfig,
  errorMessage: string = '请求过于频繁,请稍后再试'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      
      // 检查是否超过限制
      const result = await rateLimitService.checkLimit(key, config);
      
      if (!result.allowed) {
        console.log(`[RateLimit] 请求被限流: key=${key}`);
        
        // 记录到审计日志
        try {
          const userId = (req as any).user?.userId;
          const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
          
          if (userId) {
            await auditLogService.logAction(
              userId,
              'rate_limit_exceeded',
              'system',
              null,
              {
                path: req.path,
                method: req.method,
                key,
                retryAfter: result.retryAfter
              },
              ipAddress,
              req.headers['user-agent'] || null
            );
          }
        } catch (auditError) {
          console.error('[RateLimit] 记录审计日志失败:', auditError);
        }
        
        return res.status(429).json({
          success: false,
          message: errorMessage,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: result.retryAfter
        });
      }
      
      // 记录请求
      await rateLimitService.recordRequest(key);
      
      next();
    } catch (error: any) {
      console.error('[RateLimit] 限流检查失败:', error);
      // 如果限流检查失败,允许请求继续(fail open)
      next();
    }
  };
}

/**
 * 登录限流中间件
 * 限制：每个IP+用户名组合在5分钟内最多5次登录尝试
 * 这样可以防止暴力破解单个账号，同时不影响同一IP下的其他用户
 */
export const loginRateLimit = createRateLimitMiddleware(
  (req: Request) => {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const username = req.body?.username || 'unknown';
    return `login:${ipAddress}:${username}`;
  },
  {
    windowMs: 5 * 60 * 1000,   // 5分钟
    maxRequests: 5              // 最多5次
  },
  '登录尝试次数过多,请5分钟后再试'
);

/**
 * 注册限流中间件
 * 限制：每个IP地址每小时最多3次注册
 */
export const registrationRateLimit = createRateLimitMiddleware(
  (req: Request) => {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    return `registration:${ipAddress}`;
  },
  {
    windowMs: 60 * 60 * 1000,  // 1小时
    maxRequests: 3              // 最多3次
  },
  '注册尝试次数过多,请1小时后再试'
);

/**
 * 管理员操作限流中间件
 * 限制：每个管理员每分钟最多50次操作
 */
export const adminOperationRateLimit = createRateLimitMiddleware(
  (req: Request) => {
    const userId = (req as any).user?.userId || 'unknown';
    return `admin:${userId}`;
  },
  {
    windowMs: 60 * 1000,       // 1分钟
    maxRequests: 50            // 最多50次
  },
  '操作过于频繁,请稍后再试'
);

/**
 * API通用限流中间件
 * 限制：每个IP每分钟最多100次请求
 */
export const apiRateLimit = createRateLimitMiddleware(
  (req: Request) => {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    return `api:${ipAddress}`;
  },
  {
    windowMs: 60 * 1000,       // 1分钟
    maxRequests: 100           // 最多100次
  },
  'API请求过于频繁,请稍后再试'
);

