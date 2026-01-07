import express from 'express';
import { authenticate, requireAdmin } from '../middleware/adminAuth';
import { userService } from '../services/UserService';
import { getWebSocketService } from '../services/WebSocketService';
import { createRateLimitMiddleware } from '../middleware/rateLimit';
import { requireConfirmation } from '../middleware/requireConfirmation';
import productsRouter from './admin/products';
import ordersRouter from './admin/orders';
import auditLogsRouter from './admin/audit-logs';
import plansRouter from './admin/plans';

const router = express.Router();

// 所有管理员路由都需要认证和管理员权限
router.use(authenticate);
router.use(requireAdmin);

// 商品管理路由
router.use('/products', productsRouter);

// 订单管理路由
router.use('/orders', ordersRouter);

// 审计日志路由
router.use('/audit-logs', auditLogsRouter);

// 套餐管理路由
router.use('/plans', plansRouter);

// 用户管理操作限流: 每小时10次
const userManagementRateLimit = createRateLimitMiddleware(
  (req) => {
    const userId = (req as any).user?.userId || 'unknown';
    return `user-management:${userId}`;
  },
  {
    windowMs: 60 * 60 * 1000,  // 1小时
    maxRequests: 10             // 最多10次
  },
  '用户管理操作过于频繁,请1小时后再试'
);

/**
 * 转换数据库字段名（蛇形）为前端字段名（驼峰）
 */
function convertUserFields(user: any, isOnline?: boolean) {
  return {
    id: user.id,
    username: user.username,
    invitationCode: user.invitation_code,
    invitedByCode: user.invited_by_code,
    role: user.role,
    isTempPassword: user.is_temp_password,
    createdAt: user.created_at ? (user.created_at instanceof Date ? user.created_at.toISOString() : user.created_at) : null,
    updatedAt: user.updated_at ? (user.updated_at instanceof Date ? user.updated_at.toISOString() : user.updated_at) : null,
    lastLoginAt: user.last_login_at ? (user.last_login_at instanceof Date ? user.last_login_at.toISOString() : user.last_login_at) : null,
    invitedCount: user.invitedCount,
    invitedUsers: user.invitedUsers,
    subscriptionPlanName: user.subscriptionPlanName,
    isOnline: isOnline ?? false
  };
}

/**
 * 获取用户列表（分页和搜索）
 * GET /api/admin/users
 */
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = req.query.search as string;
    const subscriptionPlan = req.query.subscriptionPlan as string;
    const onlineStatus = req.query.onlineStatus as 'online' | 'offline' | undefined;

    // 获取在线用户ID列表
    let onlineUserIds: number[] = [];
    try {
      const wsService = getWebSocketService();
      onlineUserIds = wsService.getOnlineUserIds();
    } catch (error) {
      console.error('[Admin] 获取在线用户列表失败:', error);
    }

    // 传递在线状态筛选参数给 UserService
    const result = await userService.getUsers(
      page, 
      pageSize, 
      search, 
      subscriptionPlan,
      onlineUserIds,
      onlineStatus
    );

    // 转换字段名并添加在线状态
    const convertedUsers = result.users.map(user => 
      convertUserFields(user, onlineUserIds.includes(user.id))
    );

    res.json({
      success: true,
      data: {
        users: convertedUsers,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        onlineCount: onlineUserIds.length
      }
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

    // 转换字段名
    const convertedUser = convertUserFields(user);

    res.json({
      success: true,
      data: convertedUser
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
 * 需要确认令牌（角色变更时）
 */
router.put('/users/:id', userManagementRateLimit, requireConfirmation('update-user'), async (req, res) => {
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

    // 转换字段名
    const convertedUser = convertUserFields(updatedUser);

    // 广播用户更新事件
    try {
      const wsService = getWebSocketService();
      wsService.broadcast(userId, 'user:updated', {
        user: convertedUser,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Admin] WebSocket 广播失败:', error);
    }

    res.json({
      success: true,
      data: convertedUser,
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
 * 需要确认令牌
 */
router.post('/users/:id/reset-password', userManagementRateLimit, requireConfirmation('reset-password'), async (req, res) => {
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
 * 需要确认令牌
 */
router.delete('/users/:id', userManagementRateLimit, requireConfirmation('delete-user'), async (req, res) => {
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
