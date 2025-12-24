import { Request, Response, NextFunction } from 'express';
import { rateLimitService } from '../services/RateLimitService';

/**
 * 限流中间件
 * 用于限制登录和注册尝试次数
 */

/**
 * 登录限流中间件
 * 限制：每个 IP 地址在 15 分钟内最多 5 次失败尝试
 */
export const loginRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }

    // 检查限流
    const isAllowed = await rateLimitService.checkRateLimit(username, ipAddress);

    if (!isAllowed) {
      console.log(`[RateLimit] 登录尝试被限流: ${username} from ${ipAddress}`);
      return res.status(429).json({
        success: false,
        message: '登录尝试次数过多，请 15 分钟后再试',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    // 继续处理请求
    next();
  } catch (error: any) {
    console.error('[RateLimit] 限流检查失败:', error);
    // 如果限流检查失败，允许请求继续（fail open）
    next();
  }
};

/**
 * 注册限流中间件
 * 限制：每个 IP 地址每小时最多 3 次注册
 */
export const registrationRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    // 检查注册限流（使用特殊的用户名标识注册请求）
    const registrationKey = `registration_${ipAddress}`;
    const isAllowed = await rateLimitService.checkRegistrationRateLimit(ipAddress);

    if (!isAllowed) {
      console.log(`[RateLimit] 注册尝试被限流: ${ipAddress}`);
      return res.status(429).json({
        success: false,
        message: '注册尝试次数过多，请 1 小时后再试',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    // 继续处理请求
    next();
  } catch (error: any) {
    console.error('[RateLimit] 注册限流检查失败:', error);
    // 如果限流检查失败，允许请求继续（fail open）
    next();
  }
};

/**
 * 记录登录尝试结果
 * 应该在登录路由处理后调用
 */
export const recordLoginAttempt = async (
  username: string,
  ipAddress: string,
  success: boolean
) => {
  try {
    await rateLimitService.recordLoginAttempt(username, ipAddress, success);
  } catch (error: any) {
    console.error('[RateLimit] 记录登录尝试失败:', error);
  }
};
