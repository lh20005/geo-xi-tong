import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('错误:', err);
  
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
