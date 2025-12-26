import { Request, Response, NextFunction } from 'express';

// 🔒 安全的错误消息映射
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  'ValidationError': '请求参数错误',
  'UnauthorizedError': '未授权访问',
  'ForbiddenError': '无权访问',
  'NotFoundError': '资源不存在',
  'ConflictError': '资源冲突',
  'DatabaseError': '数据操作失败',
  'NetworkError': '网络请求失败'
};

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 🔒 详细日志只记录到服务器，不返回给客户端
  console.error('[Error]', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: (req as any).user?.id,
    timestamp: new Date().toISOString()
  });
  
  const statusCode = (err as any).statusCode || 500;
  
  if (process.env.NODE_ENV === 'production') {
    // 🔒 生产环境：只返回安全的错误消息
    const safeMessage = SAFE_ERROR_MESSAGES[err.name] || '服务器内部错误';
    
    res.status(statusCode).json({
      success: false,
      message: safeMessage
      // 不返回 stack、file、line 等信息
    });
  } else {
    // 开发环境：返回详细信息方便调试
    res.status(statusCode).json({
      success: false,
      message: err.message,
      stack: err.stack,
      name: err.name
    });
  }
}
