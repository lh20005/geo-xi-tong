import express from 'express';
import { authenticate, requireAdmin } from '../middleware/adminAuth';
import { userService } from '../services/UserService';
import { getWebSocketService } from '../services/WebSocketService';

const router = express.Router();

// 所有管理员路由都需要认证和管理员权限
router.use(authenticate);
router.use(requireAdmin);

/**
 * 获取用户列表（分页和搜索）
 * GET /api/admin/users
 */
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = req.query.search as string;

    const result = await userService.getUsers(page, pageSize, search);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[Admin] 获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取用户列表失败'
    });
  }
});

/**
 * 获取用户详情
 * GET /api/admin/users/:id
 */
router.get('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户ID'
      });
    }

    const user = await userService.getUserProfile(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    console.error('[Admin] 获取用户详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取用户详情失败'
    });
  }
});

/**
 * 更新用户信息
 * PUT /api/admin/users/:id
 */
router.put('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, role } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户ID'
      });
    }

    const updatedUser = await userService.updateUser(userId, { username, role });

    // 广播用户更新事件
    try {
      const wsService = getWebSocketService();
      wsService.broadcast(userId, 'user:updated', {
        user: updatedUser,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Admin] WebSocket 广播失败:', error);
    }

    res.json({
      success: true,
      data: updatedUser,
      message: '用户信息更新成功'
    });
  } catch (error: any) {
    console.error('[Admin] 更新用户失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '更新用户失败'
    });
  }
});

/**
 * 重置用户密码
 * POST /api/admin/users/:id/reset-password
 */
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户ID'
      });
    }

    const temporaryPassword = await userService.resetPassword(userId);

    // 广播密码修改事件
    try {
      const wsService = getWebSocketService();
      wsService.broadcast(userId, 'user:password-changed', {
        userId,
        isTemporary: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Admin] WebSocket 广播失败:', error);
    }

    res.json({
      success: true,
      data: {
        temporaryPassword
      },
      message: '密码重置成功'
    });
  } catch (error: any) {
    console.error('[Admin] 重置密码失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '重置密码失败'
    });
  }
});

/**
 * 删除用户
 * DELETE /api/admin/users/:id
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户ID'
      });
    }

    await userService.deleteUser(userId);

    // 广播用户删除事件
    try {
      const wsService = getWebSocketService();
      wsService.broadcast(userId, 'user:deleted', {
        userId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Admin] WebSocket 广播失败:', error);
    }

    res.json({
      success: true,
      message: '用户删除成功'
    });
  } catch (error: any) {
    console.error('[Admin] 删除用户失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除用户失败'
    });
  }
});

export default router;
