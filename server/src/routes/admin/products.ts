import express from 'express';
import { authenticate, requireAdmin } from '../../middleware/adminAuth';
import { subscriptionService } from '../../services/SubscriptionService';
import { productService } from '../../services/ProductService';

const router = express.Router();

// 所有路由都需要管理员权限
router.use(authenticate, requireAdmin);

/**
 * 获取所有套餐（管理员视图）
 * GET /api/admin/products
 */
router.get('/', async (req, res) => {
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
 * 更新套餐配置
 * PUT /api/admin/products/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    
    const { price, features, is_active, confirmationToken } = req.body;

    // 验证输入
    if (price !== undefined && (price < 0 || isNaN(price))) {
      return res.status(400).json({
        success: false,
        message: '价格不能为负数'
      });
    }

    if (features) {
      for (const feature of features) {
        if (feature.feature_value < -1 || isNaN(feature.feature_value)) {
          return res.status(400).json({
            success: false,
            message: '配额值无效'
          });
        }
      }
    }

    // 检查价格变动是否超过20%
    if (price !== undefined) {
      const currentPlan = await pool.query(
        'SELECT price FROM subscription_plans WHERE id = $1',
        [planId]
      );

      if (currentPlan.rows.length > 0) {
        const oldPrice = parseFloat(currentPlan.rows[0].price);
        const priceChange = Math.abs((price - oldPrice) / oldPrice);

        if (priceChange > 0.2 && !confirmationToken) {
          return res.json({
            success: false,
            requiresConfirmation: true,
            message: '价格变动超过20%，需要二次确认',
            data: {
              old_price: oldPrice,
              new_price: price,
              change_percentage: (priceChange * 100).toFixed(2)
            }
          });
        }
      }
    }

    // 更新套餐
    const updatedPlan = await productService.updatePlan(
      planId,
      { price, features, is_active },
      adminId,
      ipAddress,
      userAgent
    );

    // 发送通知
    await productService.notifyConfigChange({
      planId,
      planName: updatedPlan.plan_name,
      changeType: price !== undefined ? 'price' : 'feature',
      changedBy: (req as any).user.username
    });

    res.json({
      success: true,
      message: '套餐配置已更新',
      data: updatedPlan
    });
  } catch (error: any) {
    console.error('更新套餐配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '更新套餐配置失败'
    });
  }
});

/**
 * 获取配置历史
 * GET /api/admin/products/:id/history
 */
router.get('/:id/history', async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await productService.getConfigHistory(planId, limit);

    res.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    console.error('获取配置历史失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取配置历史失败'
    });
  }
});

/**
 * 回滚配置
 * POST /api/admin/products/:id/rollback
 */
router.post('/:id/rollback', async (req, res) => {
  try {
    const { historyId, confirmationToken } = req.body;
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    if (!historyId) {
      return res.status(400).json({
        success: false,
        message: '缺少历史记录ID'
      });
    }

    if (!confirmationToken) {
      return res.json({
        success: false,
        requiresConfirmation: true,
        message: '回滚操作需要二次确认'
      });
    }

    await productService.rollbackConfig(historyId, adminId, ipAddress, userAgent);

    res.json({
      success: true,
      message: '配置已回滚'
    });
  } catch (error: any) {
    console.error('回滚配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '回滚配置失败'
    });
  }
});

// 需要导入 pool
import { pool } from '../../db/database';

export default router;
