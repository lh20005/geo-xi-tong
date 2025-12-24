import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authService } from '../services/AuthService';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JwtPayload {
  userId: number;
  username: string;
  role?: string;
}

/**
 * 认证中间件 - 验证 JWT token
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    // 验证令牌
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    
    // 将用户信息附加到请求对象
    (req as any).user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '令牌无效或已过期'
    });
  }
}

/**
 * 管理员权限中间件 - 检查用户是否为管理员
 * 必须在 authenticate 中间件之后使用
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      });
    }

    // 从数据库获取最新的用户信息（确保角色是最新的）
    const dbUser = await authService.getUserById(user.userId);
    
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '需要管理员权限'
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '权限验证失败'
    });
  }
}
