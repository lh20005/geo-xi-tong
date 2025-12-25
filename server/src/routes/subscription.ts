import express from 'express';
import { subscriptionService } from '../services/SubscriptionService';
import { authenticate } from '../middleware/adminAuth';

const router = express.Router();

/**
 * 获取所有激活的套餐
 * GET /api/subscription/plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await subscriptionService.getAllActivePlans();

    res.json({
      success: true,
      data: plans
    });
  } catch (error: any) {
    console.error('获取套餐列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取套餐列表失败'
    });
  }
});

/**
 * 获取用户当前订阅
 * GET /api/subscription/current
 */
router.get('/current', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const subscription = await subscriptionService.getUserActiveSubscription(userId);

    if (!subscription) {
      return res.json({
        success: true,
        data: null,
        message: '暂无订阅'
      });
    }

    res.json({
      success: true,
      data: subscription
    });
  } catch (error: any) {
    console.error('获取订阅信息失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取订阅信息失败'
    });
  }
});

/**
 * 获取用户使用统计
 * GET /api/subscription/usage-stats
 */
router.get('/usage-stats', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const stats = await subscriptionService.getUserUsageStats(userId);

    res.json({
      success: true,
      data: {
        features: stats
      }
    });
  } catch (error: any) {
    console.error('获取使用统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取使用统计失败'
    });
  }
});

/**
 * 切换自动续费
 * PUT /api/subscription/auto-renew
 */
router.put('/auto-renew', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { auto_renew } = req.body;

    if (typeof auto_renew !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: '参数错误'
      });
    }

    // 获取用户当前订阅
    const subscription = await subscriptionService.getUserActiveSubscription(userId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: '暂无订阅'
      });
    }

    // 更新自动续费状态
    const { pool } = await import('../db/database');
    await pool.query(
      'UPDATE user_subscriptions SET auto_renew = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [auto_renew, subscription.id]
    );

    res.json({
      success: true,
      message: auto_renew ? '自动续费已开启' : '自动续费已关闭',
      data: {
        auto_renew
      }
    });
  } catch (error: any) {
    console.error('切换自动续费失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '切换自动续费失败'
    });
  }
});

/**
 * 升级套餐
 * POST /api/subscription/upgrade
 */
router.post('/upgrade', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({
        success: false,
        message: '缺少套餐ID'
      });
    }

    const result = await subscriptionService.upgradePlan(userId, plan_id);

    res.json({
      success: true,
      message: '升级订单已创建',
      data: result
    });
  } catch (error: any) {
    console.error('升级套餐失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '升级套餐失败'
    });
  }
});

export default router;
