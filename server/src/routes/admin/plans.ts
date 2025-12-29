import express from 'express';
import { productService } from '../../services/ProductService';
import { subscriptionService } from '../../services/SubscriptionService';

const router = express.Router();

/**
 * 更新套餐配置
 * PUT /api/admin/plans/:planId
 */
router.put('/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const { price, features, is_active } = req.body;
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // 验证价格变动幅度
    if (price !== undefined) {
      const currentPlan = await subscriptionService.getPlanById(parseInt(planId));
      if (currentPlan) {
        const priceChange = Math.abs((price - currentPlan.price) / currentPlan.price);
        if (priceChange > 0.2) {
          // 价格变动超过20%，需要确认
          return res.json({
            success: false,
            needConfirm: true,
            message: `价格变动超过20%（${(priceChange * 100).toFixed(1)}%），请确认是否继续`,
            data: {
              oldPrice: currentPlan.price,
              newPrice: price,
              changePercent: (priceChange * 100).toFixed(1)
            }
          });
        }
      }
    }

    const updatedPlan = await productService.updatePlan(
      parseInt(planId),
      { price, features, is_active },
      adminId,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      data: updatedPlan,
      message: '套餐更新成功'
    });
  } catch (error: any) {
    console.error('更新套餐失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '更新套餐失败'
    });
  }
});

/**
 * 获取套餐配置历史
 * GET /api/admin/plans/:planId/history
 */
router.get('/:planId/history', async (req, res) => {
  try {
    const { planId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await productService.getConfigHistory(parseInt(planId), limit);

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
 * POST /api/admin/plans/rollback/:historyId
 */
router.post('/rollback/:historyId', async (req, res) => {
  try {
    const { historyId } = req.params;
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    await productService.rollbackConfig(
      parseInt(historyId),
      adminId,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: '配置回滚成功'
    });
  } catch (error: any) {
    console.error('回滚配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '回滚配置失败'
    });
  }
});

export default router;
