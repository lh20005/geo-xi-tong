import express from 'express';
import { userSubscriptionManagementService } from '../../services/UserSubscriptionManagementService';
import { authenticate, requireAdmin } from '../../middleware/adminAuth';

const router = express.Router();

// 所有路由都需要管理员权限
router.use(authenticate);
router.use(requireAdmin);

/**
 * 获取用户订阅详情
 * GET /api/admin/user-subscriptions/:userId
 */
router.get('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户ID',
      });
    }

    const detail = await userSubscriptionManagementService.getUserSubscriptionDetail(userId);

    if (!detail) {
      return res.status(404).json({
        success: false,
        message: '用户没有活跃的订阅',
      });
    }

    res.json({
      success: true,
      data: detail,
    });
  } catch (error: any) {
    console.error('[UserSubscriptions] 获取订阅详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取订阅详情失败',
    });
  }
});

/**
 * 升级套餐
 * POST /api/admin/user-subscriptions/:userId/upgrade
 */
router.post('/:userId/upgrade', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { newPlanId, reason } = req.body;
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    if (isNaN(userId) || !newPlanId || !reason) {
      return res.status(400).json({
        success: false,
        message: '缺少必填参数',
      });
    }

    await userSubscriptionManagementService.upgradePlan(
      userId,
      newPlanId,
      adminId,
      reason,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: '套餐升级成功',
    });
  } catch (error: any) {
    console.error('[UserSubscriptions] 升级套餐失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '升级套餐失败',
    });
  }
});

/**
 * 延期订阅
 * POST /api/admin/user-subscriptions/:userId/extend
 */
router.post('/:userId/extend', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { daysToAdd, reason } = req.body;
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    if (isNaN(userId) || !daysToAdd || !reason) {
      return res.status(400).json({
        success: false,
        message: '缺少必填参数',
      });
    }

    if (daysToAdd <= 0 || daysToAdd > 3650) {
      return res.status(400).json({
        success: false,
        message: '延期天数必须在 1-3650 之间',
      });
    }

    await userSubscriptionManagementService.extendSubscription(
      userId,
      daysToAdd,
      adminId,
      reason,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: '订阅延期成功',
    });
  } catch (error: any) {
    console.error('[UserSubscriptions] 延期订阅失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '延期订阅失败',
    });
  }
});

/**
 * 调整配额
 * POST /api/admin/user-subscriptions/:userId/adjust-quota
 */
router.post('/:userId/adjust-quota', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { featureCode, newValue, isPermanent, reason } = req.body;
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    if (isNaN(userId) || !featureCode || newValue === undefined || !reason) {
      return res.status(400).json({
        success: false,
        message: '缺少必填参数',
      });
    }

    if (newValue < -1) {
      return res.status(400).json({
        success: false,
        message: '配额值必须大于等于 -1（-1 表示无限制）',
      });
    }

    await userSubscriptionManagementService.adjustQuota(
      userId,
      featureCode,
      newValue,
      isPermanent || false,
      adminId,
      reason,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: '配额调整成功',
    });
  } catch (error: any) {
    console.error('[UserSubscriptions] 调整配额失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '调整配额失败',
    });
  }
});

/**
 * 重置配额
 * POST /api/admin/user-subscriptions/:userId/reset-quota
 */
router.post('/:userId/reset-quota', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { featureCode, reason } = req.body;
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    if (isNaN(userId) || !featureCode || !reason) {
      return res.status(400).json({
        success: false,
        message: '缺少必填参数',
      });
    }

    await userSubscriptionManagementService.resetQuota(
      userId,
      featureCode,
      adminId,
      reason,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: '配额重置成功',
    });
  } catch (error: any) {
    console.error('[UserSubscriptions] 重置配额失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '重置配额失败',
    });
  }
});

/**
 * 暂停订阅
 * POST /api/admin/user-subscriptions/:userId/pause
 */
router.post('/:userId/pause', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { reason } = req.body;
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    if (isNaN(userId) || !reason) {
      return res.status(400).json({
        success: false,
        message: '缺少必填参数',
      });
    }

    await userSubscriptionManagementService.pauseSubscription(
      userId,
      adminId,
      reason,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: '订阅已暂停',
    });
  } catch (error: any) {
    console.error('[UserSubscriptions] 暂停订阅失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '暂停订阅失败',
    });
  }
});

/**
 * 恢复订阅
 * POST /api/admin/user-subscriptions/:userId/resume
 */
router.post('/:userId/resume', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { reason } = req.body;
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    if (isNaN(userId) || !reason) {
      return res.status(400).json({
        success: false,
        message: '缺少必填参数',
      });
    }

    await userSubscriptionManagementService.resumeSubscription(
      userId,
      adminId,
      reason,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: '订阅已恢复',
    });
  } catch (error: any) {
    console.error('[UserSubscriptions] 恢复订阅失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '恢复订阅失败',
    });
  }
});

/**
 * 取消订阅
 * POST /api/admin/user-subscriptions/:userId/cancel
 */
router.post('/:userId/cancel', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { immediate, reason } = req.body;
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    if (isNaN(userId) || !reason) {
      return res.status(400).json({
        success: false,
        message: '缺少必填参数',
      });
    }

    await userSubscriptionManagementService.cancelSubscription(
      userId,
      immediate || false,
      adminId,
      reason,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: '订阅已取消',
    });
  } catch (error: any) {
    console.error('[UserSubscriptions] 取消订阅失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '取消订阅失败',
    });
  }
});

/**
 * 赠送套餐
 * POST /api/admin/user-subscriptions/:userId/gift
 */
router.post('/:userId/gift', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { planId, durationDays, reason } = req.body;
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    if (isNaN(userId) || !planId || !durationDays || !reason) {
      return res.status(400).json({
        success: false,
        message: '缺少必填参数',
      });
    }

    if (durationDays <= 0 || durationDays > 3650) {
      return res.status(400).json({
        success: false,
        message: '赠送天数必须在 1-3650 之间',
      });
    }

    await userSubscriptionManagementService.giftSubscription(
      userId,
      planId,
      durationDays,
      adminId,
      reason,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: '套餐赠送成功',
    });
  } catch (error: any) {
    console.error('[UserSubscriptions] 赠送套餐失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '赠送套餐失败',
    });
  }
});

/**
 * 获取调整历史
 * GET /api/admin/user-subscriptions/:userId/history
 */
router.get('/:userId/history', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户ID',
      });
    }

    const result = await userSubscriptionManagementService.getAdjustmentHistory(
      userId,
      page,
      pageSize
    );

    res.json({
      success: true,
      data: result.history,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      },
    });
  } catch (error: any) {
    console.error('[UserSubscriptions] 获取调整历史失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取调整历史失败',
    });
  }
});

export default router;
