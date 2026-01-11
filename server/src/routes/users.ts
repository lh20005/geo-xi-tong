import express from 'express';
import { authenticate } from '../middleware/adminAuth';
import { userService } from '../services/UserService';
import { getWebSocketService } from '../services/WebSocketService';

const router = express.Router();

// 所有用户路由都需要认证
router.use(authenticate);

/**
 * 获取当前用户资料
 * GET /api/users/profile
 */
router.get('/profile', async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const profile = await userService.getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 转换字段名为驼峰命名，并确保日期格式正确
    res.json({
      success: true,
      data: {
        id: profile.id,
        username: profile.username,
        email: profile.email || null,
        emailVerified: profile.email_verified || false,
        invitationCode: profile.invitation_code,
        invitedByCode: profile.invited_by_code,
        role: profile.role,
        isTempPassword: profile.is_temp_password,
        createdAt: profile.created_at ? profile.created_at.toISOString() : null,
        updatedAt: profile.updated_at ? profile.updated_at.toISOString() : null,
        lastLoginAt: profile.last_login_at ? profile.last_login_at.toISOString() : null,
        invitedUsers: profile.invitedUsers
      }
    });
  } catch (error: any) {
    console.error('[User] 获取资料失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取资料失败'
    });
  }
});

/**
 * 修改密码
 * PUT /api/users/password
 */
router.put('/password', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { currentPassword, newPassword, refreshToken } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '当前密码和新密码不能为空'
      });
    }

    await userService.changePassword(userId, currentPassword, newPassword, refreshToken);

    // 广播密码修改事件
    try {
      const wsService = getWebSocketService();
      wsService.broadcast(userId, 'user:password-changed', {
        userId,
        isTemporary: false,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[User] WebSocket 广播失败:', error);
    }

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error: any) {
    console.error('[User] 修改密码失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '修改密码失败'
    });
  }
});

/**
 * 修改临时密码
 * POST /api/users/change-temporary-password
 * 用于首次登录时修改管理员重置的临时密码
 */
router.post('/change-temporary-password', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { currentPassword, newPassword, refreshToken } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '当前密码和新密码不能为空'
      });
    }

    // 验证用户确实使用临时密码
    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    if (!user.is_temp_password) {
      return res.status(400).json({
        success: false,
        message: '您没有使用临时密码，请使用普通密码修改功能'
      });
    }

    // 使用相同的changePassword方法，它会清除is_temp_password标记
    await userService.changePassword(userId, currentPassword, newPassword, refreshToken);

    // 广播密码修改事件
    try {
      const wsService = getWebSocketService();
      wsService.broadcast(userId, 'user:password-changed', {
        userId,
        isTemporary: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[User] WebSocket 广播失败:', error);
    }

    res.json({
      success: true,
      message: '临时密码修改成功，您现在可以正常使用系统'
    });
  } catch (error: any) {
    console.error('[User] 修改临时密码失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '修改临时密码失败'
    });
  }
});

export default router;
