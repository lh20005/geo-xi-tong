import { Request, Response, NextFunction } from 'express';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { auditLogService } from '../services/AuditLogService';

const ajv = new Ajv();
addFormats(ajv);

/**
 * API请求日志中间件
 * Requirements: 17.4
 */
export const apiRequestLogger = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const user = (req as any).user;

  // 记录响应
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    
    // 异步记录API请求日志
    if (user && user.userId) {
      auditLogService.logAction(
        user.userId,
        'API_REQUEST',
        'system',
        null,
        {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          ip: req.ip || req.connection.remoteAddress
        },
        req.ip || req.connection.remoteAddress || 'unknown',
        req.headers['user-agent'] || 'unknown'
      ).catch(err => console.error('[API] 记录API请求失败:', err));
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * API负载验证中间件
 * Requirements: 17.5
 */
export const validatePayload = (schema: object) => {
  const validate = ajv.compile(schema);

  return (req: Request, res: Response, next: NextFunction) => {
    const valid = validate(req.body);

    if (!valid) {
      console.log('[API] 负载验证失败:', validate.errors);
      return res.status(400).json({
        success: false,
        message: '请求数据格式错误',
        errors: validate.errors
      });
    }

    next();
  };
};

/**
 * API认证要求中间件
 * Requirements: 17.1
 */
export const requireApiAuth = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user || !user.userId) {
    return res.status(401).json({
      success: false,
      message: 'API端点需要认证'
    });
  }

  next();
};

/**
 * 常用的JSON Schema定义
 */
export const commonSchemas = {
  // 用户创建
  createUser: {
    type: 'object',
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 20 },
      password: { type: 'string', minLength: 8 },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['admin', 'user'] }
    },
    required: ['username', 'password'],
    additionalProperties: false
  },

  // 用户更新
  updateUser: {
    type: 'object',
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 20 },
      role: { type: 'string', enum: ['admin', 'user'] }
    },
    additionalProperties: false
  },

  // 密码修改
  changePassword: {
    type: 'object',
    properties: {
      currentPassword: { type: 'string' },
      newPassword: { type: 'string', minLength: 8 },
      refreshToken: { type: 'string' }
    },
    required: ['currentPassword', 'newPassword'],
    additionalProperties: false
  },

  // 权限授予
  grantPermission: {
    type: 'object',
    properties: {
      userId: { type: 'number' },
      permissions: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1
      }
    },
    required: ['userId', 'permissions'],
    additionalProperties: false
  }
};
