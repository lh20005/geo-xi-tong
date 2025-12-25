import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/database';
import { authService } from '../services/AuthService';
import { tokenService } from '../services/TokenService';
import { sessionService } from '../services/SessionService';
import { passwordService } from '../services/PasswordService';
import { loginRateLimit, registrationRateLimit } from '../middleware/rateLimit';

const router = express.Router();

// JWT密钥（应该从环境变量读取）
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

/**
 * 注册
 * POST /api/auth/register
 */
router.post('/register', registrationRateLimit, async (req, res) => {
  try {
    const { username, password, invitationCode } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    // 检查速率限制（注册限制：每小时3次）
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    
    // 注册用户
    const user = await authService.registerUser(username, password, invitationCode);
    
    // 生成令牌
    const accessToken = tokenService.generateAccessToken(user.id, user.username, user.role);
    const refreshToken = tokenService.generateRefreshToken(user.id);
    
    // 创建会话（包含IP和user agent）
    const userAgent = req.headers['user-agent'] || 'unknown';
    await sessionService.createSession(user.id, refreshToken, ipAddress, userAgent);

    console.log(`[Auth] 用户注册成功: ${username}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          invitationCode: user.invitation_code,
          role: user.role,
          createdAt: user.created_at
        },
        token: accessToken,
        refreshToken,
        expiresIn: 3600
      }
    });
  } catch (error: any) {
    console.error('[Auth] 注册失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '注册失败'
    });
  }
});

/**
 * 登录
 * POST /api/auth/login
 */
router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    // 先获取用户ID用于账户锁定检查
    const userCheck = await authService.getUserByUsername(username);
    
    if (userCheck) {
      // 检查账户是否被锁定
      const lockStatus = passwordService.isAccountLocked(userCheck.id);
      if (lockStatus.locked) {
        const minutesLeft = Math.ceil((lockStatus.unlockAt!.getTime() - Date.now()) / 60000);
        return res.status(403).json({
          success: false,
          message: `账户已被锁定，请在${minutesLeft}分钟后重试`
        });
      }
    }

    // 验证用户
    const user = await authService.validateUser(username, password);
    
    if (!user) {
      // 记录失败的登录尝试
      if (userCheck) {
        passwordService.recordLoginAttempt(userCheck.id, false);
      }
      
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 记录成功的登录尝试并重置失败计数
    passwordService.recordLoginAttempt(user.id, true);
    passwordService.resetLoginAttempts(user.id);

    // 生成令牌
    const accessToken = tokenService.generateAccessToken(user.id, user.username, user.role);
    const refreshToken = tokenService.generateRefreshToken(user.id);
    
    // 创建会话（包含IP和user agent）
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    await sessionService.createSession(user.id, refreshToken, ipAddress, userAgent);

    console.log(`[Auth] 用户登录成功: ${username}`);

    // 检查是否使用临时密码
    if (user.is_temp_password) {
      console.log(`[Auth] 用户使用临时密码登录: ${username}`);
      return res.json({
        success: true,
        requirePasswordChange: true,
        message: '您正在使用临时密码，请立即修改密码',
        data: {
          token: accessToken,
          refreshToken,
          expiresIn: 3600,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            invitationCode: user.invitation_code,
            isTempPassword: true
          }
        }
      });
    }

    res.json({
      success: true,
      data: {
        token: accessToken,
        refreshToken: refreshToken,
        expiresIn: 3600, // 1小时（秒）
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          invitationCode: user.invitation_code,
          isTempPassword: user.is_temp_password
        }
      }
    });
  } catch (error) {
    console.error('[Auth] 登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败'
    });
  }
});

/**
 * 刷新令牌
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: '刷新令牌不能为空'
      });
    }

    // 验证刷新令牌
    let decoded: any;
    try {
      decoded = tokenService.verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: '刷新令牌无效或已过期'
      });
    }
    
    // 验证会话（同时更新last_used_at）
    const isValid = await sessionService.validateSession(refreshToken);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: '刷新令牌已失效'
      });
    }
    
    // 获取用户信息
    const user = await authService.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 生成新的访问令牌
    const accessToken = tokenService.generateAccessToken(decoded.userId, user.username, user.role);

    res.json({
      success: true,
      data: {
        token: accessToken,
        expiresIn: 3600
      }
    });
  } catch (error) {
    console.error('刷新令牌失败:', error);
    res.status(500).json({
      success: false,
      message: '刷新令牌失败'
    });
  }
});

/**
 * 登出
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // 撤销会话
    if (refreshToken) {
      await sessionService.revokeSession(refreshToken);
    }

    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('登出失败:', error);
    res.status(500).json({
      success: false,
      message: '登出失败'
    });
  }
});

/**
 * 验证令牌
 * GET /api/auth/verify
 */
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供令牌'
      });
    }

    // 验证令牌
    try {
      const decoded = tokenService.verifyAccessToken(token);
      res.json({
        success: true,
        data: decoded
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: '令牌无效或已过期'
      });
    }
  } catch (error) {
    console.error('验证令牌失败:', error);
    res.status(500).json({
      success: false,
      message: '验证令牌失败'
    });
  }
});

export default router;
