import { Request, Response, NextFunction } from 'express';
import { csrfService } from '../services/CSRFService';
import cookieParser from 'cookie-parser';

/**
 * CSRF保护中间件
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

// Cookie配置
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const SESSION_COOKIE_NAME = 'sessionId';

/**
 * 生成CSRF令牌并设置cookie
 * Requirement 13.1
 */
export const generateCSRFToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 获取或生成session ID
    let sessionId = req.cookies?.[SESSION_COOKIE_NAME];
    
    if (!sessionId) {
      // 如果没有session，从认证用户获取或生成临时ID
      sessionId = (req as any).user?.userId?.toString() || 
                  `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 设置session cookie (Requirement 13.5: SameSite=Strict)
      res.cookie(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000 // 1 hour
      });
    }

    // 生成CSRF令牌
    const csrfToken = await csrfService.generateToken(sessionId);

    // 设置CSRF cookie (Requirement 13.5: SameSite=Strict)
    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false, // 需要JavaScript可读以便发送到header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });

    // 也可以在响应中返回令牌
    (req as any).csrfToken = csrfToken;

    next();
  } catch (error) {
    console.error('[CSRF] Error generating token:', error);
    next(error);
  }
};

/**
 * 验证CSRF令牌
 * Requirements: 13.2, 13.3, 13.4
 */
export const validateCSRFToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 跳过GET, HEAD, OPTIONS请求
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // 获取session ID
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME] || 
                     (req as any).user?.userId?.toString();

    if (!sessionId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_NO_SESSION',
          message: 'No session found'
        }
      });
    }

    // 从header或body获取CSRF令牌
    const csrfToken = req.headers['x-csrf-token'] as string ||
                     req.headers['x-xsrf-token'] as string ||
                     req.body?._csrf;

    if (!csrfToken) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_MISSING',
          message: 'CSRF token is missing'
        }
      });
    }

    // 验证令牌
    const isValid = await csrfService.validateToken(csrfToken, sessionId);

    if (!isValid) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'Invalid CSRF token'
        }
      });
    }

    next();
  } catch (error) {
    console.error('[CSRF] Error validating token:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_ERROR',
        message: 'Error validating CSRF token'
      }
    });
  }
};

/**
 * 验证并消费CSRF令牌（一次性使用）
 * Requirement 13.4
 */
export const validateAndConsumeCSRFToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 跳过GET, HEAD, OPTIONS请求
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // 获取session ID
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME] || 
                     (req as any).user?.userId?.toString();

    if (!sessionId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_NO_SESSION',
          message: 'No session found'
        }
      });
    }

    // 从header或body获取CSRF令牌
    const csrfToken = req.headers['x-csrf-token'] as string ||
                     req.headers['x-xsrf-token'] as string ||
                     req.body?._csrf;

    if (!csrfToken) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_MISSING',
          message: 'CSRF token is missing'
        }
      });
    }

    // 验证并消费令牌
    const isValid = await csrfService.validateAndConsumeToken(csrfToken, sessionId);

    if (!isValid) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'Invalid or already used CSRF token'
        }
      });
    }

    // 生成新令牌供下次使用
    const newToken = await csrfService.generateToken(sessionId);
    res.cookie(CSRF_COOKIE_NAME, newToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000
    });

    next();
  } catch (error) {
    console.error('[CSRF] Error validating and consuming token:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_ERROR',
        message: 'Error validating CSRF token'
      }
    });
  }
};

/**
 * 获取CSRF令牌的路由处理器
 */
export const getCSRFToken = async (req: Request, res: Response) => {
  const csrfToken = (req as any).csrfToken || req.cookies?.[CSRF_COOKIE_NAME];
  
  res.json({
    success: true,
    data: {
      csrfToken
    }
  });
};
