import { Request, Response, NextFunction } from 'express';
import { confirmationTokenService } from '../services/ConfirmationTokenService';

/**
 * 敏感操作二次确认中间件
 * Requirement 4.6
 * 
 * 用于需要二次确认的敏感操作
 */

export interface ConfirmationRequest extends Request {
  confirmationToken?: string;
  confirmationData?: Record<string, any>;
}

/**
 * 要求确认令牌的中间件
 * 
 * 使用方式：
 * 1. 客户端首先调用 /api/confirm/initiate 获取确认令牌
 * 2. 客户端在请求头中包含 X-Confirmation-Token
 * 3. 中间件验证令牌并允许操作继续
 */
export function requireConfirmation(action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!user || !user.userId) {
        return res.status(401).json({
          success: false,
          message: '未认证'
        });
      }

      // 从请求头获取确认令牌
      const token = req.headers['x-confirmation-token'] as string;

      if (!token) {
        return res.status(403).json({
          success: false,
          message: '需要确认令牌',
          code: 'CONFIRMATION_REQUIRED',
          action,
          hint: '请先调用确认令牌生成接口'
        });
      }

      // 验证并消费令牌
      const result = await confirmationTokenService.validateAndConsumeToken(
        token,
        user.userId
      );

      if (!result.valid) {
        return res.status(403).json({
          success: false,
          message: '确认令牌无效或已过期',
          code: 'INVALID_CONFIRMATION_TOKEN'
        });
      }

      // 验证操作类型是否匹配
      if (result.action !== action) {
        return res.status(403).json({
          success: false,
          message: '确认令牌操作类型不匹配',
          code: 'ACTION_MISMATCH',
          expected: action,
          received: result.action
        });
      }

      // 将确认数据附加到请求对象
      (req as ConfirmationRequest).confirmationToken = token;
      (req as ConfirmationRequest).confirmationData = result.data;

      next();
    } catch (error) {
      console.error('[RequireConfirmation] Error:', error);
      return res.status(500).json({
        success: false,
        message: '确认验证失败'
      });
    }
  };
}

/**
 * 生成确认令牌的路由处理器
 */
export async function initiateConfirmation(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    
    if (!user || !user.userId) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      });
    }

    const { action, data } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        message: '缺少操作类型'
      });
    }

    // 生成确认令牌
    const token = await confirmationTokenService.generateToken(
      user.userId,
      action,
      data || {}
    );

    return res.json({
      success: true,
      data: {
        token,
        action,
        expiresIn: 300 // 5分钟
      },
      message: '确认令牌已生成，请在5分钟内使用'
    });
  } catch (error) {
    console.error('[InitiateConfirmation] Error:', error);
    return res.status(500).json({
      success: false,
      message: '生成确认令牌失败'
    });
  }
}

/**
 * 验证确认令牌（不消费）
 */
export async function verifyConfirmation(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    
    if (!user || !user.userId) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      });
    }

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: '缺少确认令牌'
      });
    }

    // 验证令牌（不消费）
    const result = await confirmationTokenService.validateToken(
      token,
      user.userId
    );

    if (!result.valid) {
      return res.json({
        success: false,
        valid: false,
        message: '令牌无效或已过期'
      });
    }

    return res.json({
      success: true,
      valid: true,
      action: result.action,
      data: result.data
    });
  } catch (error) {
    console.error('[VerifyConfirmation] Error:', error);
    return res.status(500).json({
      success: false,
      message: '验证确认令牌失败'
    });
  }
}
