import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/database';
import { authService } from '../services/AuthService';
import { tokenService } from '../services/TokenService';
import { sessionService } from '../services/SessionService';
import { passwordService } from '../services/PasswordService';
import { emailService } from '../services/EmailService';
import { loginRateLimit, registrationRateLimit, createRateLimitMiddleware } from '../middleware/rateLimit';
import { Request } from 'express';

// 密码重置验证码发送限流（每分钟1次）
const passwordResetRateLimit = createRateLimitMiddleware(
  (req: Request) => {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    return `password_reset:${ipAddress}`;
  },
  {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 1
  },
  '请求过于频繁，请稍后再试'
);

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

/**
 * 发送密码重置验证码
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', passwordResetRateLimit, async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: '用户名和邮箱不能为空'
      });
    }

    // 检查邮件服务是否可用
    if (!emailService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: '邮件服务暂不可用，请联系管理员'
      });
    }

    // 验证用户名和邮箱是否匹配
    const user = await authService.getUserByUsername(username);
    
    if (!user) {
      // 为了安全，不透露用户是否存在
      return res.json({
        success: true,
        message: '如果用户名和邮箱匹配，验证码将发送到您的邮箱'
      });
    }

    // 检查邮箱是否匹配
    if (!user.email || user.email.toLowerCase() !== email.toLowerCase()) {
      // 为了安全，不透露具体错误
      return res.json({
        success: true,
        message: '如果用户名和邮箱匹配，验证码将发送到您的邮箱'
      });
    }

    // 创建验证码
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const code = await emailService.createVerificationCode(
      email.toLowerCase(),
      'reset_password',
      user.id,
      ipAddress
    );

    if (!code) {
      return res.status(500).json({
        success: false,
        message: '验证码生成失败，请重试'
      });
    }

    // 发送邮件
    const sent = await emailService.sendPasswordResetCode(email, code);
    
    if (!sent) {
      return res.status(500).json({
        success: false,
        message: '邮件发送失败，请重试'
      });
    }

    console.log(`[Auth] 密码重置验证码已发送: ${username} -> ${email}`);

    res.json({
      success: true,
      message: '验证码已发送到您的邮箱，请查收'
    });
  } catch (error) {
    console.error('[Auth] 发送密码重置验证码失败:', error);
    res.status(500).json({
      success: false,
      message: '发送验证码失败，请重试'
    });
  }
});

/**
 * 验证重置密码验证码
 * POST /api/auth/verify-reset-code
 */
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: '邮箱和验证码不能为空'
      });
    }

    const result = await emailService.verifyCode(
      email.toLowerCase(),
      code,
      'reset_password'
    );

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    // 生成一个临时的重置令牌（用于下一步重置密码）
    const resetToken = jwt.sign(
      { userId: result.userId, email: email.toLowerCase(), type: 'password_reset' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      message: '验证成功',
      data: {
        resetToken
      }
    });
  } catch (error) {
    console.error('[Auth] 验证重置密码验证码失败:', error);
    res.status(500).json({
      success: false,
      message: '验证失败，请重试'
    });
  }
});

/**
 * 重置密码
 * POST /api/auth/reset-password
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '重置令牌和新密码不能为空'
      });
    }

    // 验证重置令牌
    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'your-secret-key');
      if (decoded.type !== 'password_reset') {
        throw new Error('Invalid token type');
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: '重置令牌无效或已过期，请重新获取验证码'
      });
    }

    // 验证密码强度
    const validation = passwordService.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join('; ')
      });
    }

    // 获取用户
    const user = await authService.getUserById(decoded.userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查密码历史（不能使用最近使用过的密码）
    const isReused = await passwordService.checkPasswordReuse(decoded.userId, newPassword);
    if (isReused) {
      return res.status(400).json({
        success: false,
        message: '不能使用最近使用过的密码'
      });
    }

    // 更新密码
    const passwordHash = await authService.hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash = $1, is_temp_password = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, decoded.userId]
    );

    // 保存密码历史
    await passwordService.savePasswordHistory(decoded.userId, passwordHash);

    // 撤销所有会话（强制重新登录）
    await sessionService.revokeAllSessions(decoded.userId);

    console.log(`[Auth] 用户密码重置成功: ${user.username}`);

    res.json({
      success: true,
      message: '密码重置成功，请使用新密码登录'
    });
  } catch (error) {
    console.error('[Auth] 重置密码失败:', error);
    res.status(500).json({
      success: false,
      message: '重置密码失败，请重试'
    });
  }
});

/**
 * 绑定邮箱 - 发送验证码
 * POST /api/auth/bind-email/send-code
 */
router.post('/bind-email/send-code', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未登录'
      });
    }

    let decoded: any;
    try {
      decoded = tokenService.verifyAccessToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: '登录已过期'
      });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: '邮箱不能为空'
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '邮箱格式不正确'
      });
    }

    // 检查邮箱是否已被其他用户使用
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email.toLowerCase(), decoded.userId]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该邮箱已被其他用户绑定'
      });
    }

    // 检查邮件服务是否可用
    if (!emailService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: '邮件服务暂不可用'
      });
    }

    // 创建验证码
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const code = await emailService.createVerificationCode(
      email.toLowerCase(),
      'verify_email',
      decoded.userId,
      ipAddress
    );

    if (!code) {
      return res.status(500).json({
        success: false,
        message: '验证码生成失败'
      });
    }

    // 发送邮件
    const sent = await emailService.sendEmailVerificationCode(email, code);
    if (!sent) {
      return res.status(500).json({
        success: false,
        message: '邮件发送失败'
      });
    }

    res.json({
      success: true,
      message: '验证码已发送'
    });
  } catch (error) {
    console.error('[Auth] 发送邮箱验证码失败:', error);
    res.status(500).json({
      success: false,
      message: '发送失败，请重试'
    });
  }
});

/**
 * 绑定邮箱 - 验证并绑定
 * POST /api/auth/bind-email/verify
 */
router.post('/bind-email/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未登录'
      });
    }

    let decoded: any;
    try {
      decoded = tokenService.verifyAccessToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: '登录已过期'
      });
    }

    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: '邮箱和验证码不能为空'
      });
    }

    // 验证验证码
    const result = await emailService.verifyCode(
      email.toLowerCase(),
      code,
      'verify_email'
    );

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    // 绑定邮箱
    await pool.query(
      'UPDATE users SET email = $1, email_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [email.toLowerCase(), decoded.userId]
    );

    console.log(`[Auth] 用户绑定邮箱成功: userId=${decoded.userId}, email=${email}`);

    res.json({
      success: true,
      message: '邮箱绑定成功'
    });
  } catch (error) {
    console.error('[Auth] 绑定邮箱失败:', error);
    res.status(500).json({
      success: false,
      message: '绑定失败，请重试'
    });
  }
});

/**
 * 检查邮件服务状态
 * GET /api/auth/email-service-status
 */
router.get('/email-service-status', (req, res) => {
  res.json({
    success: true,
    data: {
      available: emailService.isAvailable()
    }
  });
});

export default router;
