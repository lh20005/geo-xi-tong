import express from 'express';
import { quotaService } from '../services/QuotaService';
import { getCurrentTenantId, requireTenantContext } from '../middleware/tenantContext';

const router = express.Router();

/**
 * 配额管理路由
 */

/**
 * 获取当前用户的配额使用情况
 * GET /api/quota
 */
router.get('/', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const summary = await quotaService.getQuotaSummary(userId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('获取配额信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配额信息失败'
    });
  }
});

/**
 * 检查特定资源的配额
 * GET /api/quota/check/:resourceType
 */
router.get('/check/:resourceType', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const resourceType = req.params.resourceType as any;
    const count = parseInt(req.query.count as string) || 1;

    const result = await quotaService.checkQuota(userId, resourceType, count);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('检查配额失败:', error);
    res.status(500).json({
      success: false,
      message: '检查配额失败'
    });
  }
});

/**
 * 获取用户当前套餐信息
 * GET /api/quota/plan
 */
router.get('/plan', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const plan = await quotaService.getUserPlan(userId);
    const quotas = await quotaService.getUserQuotas(userId);

    res.json({
      success: true,
      data: {
        plan,
        quotas
      }
    });
  } catch (error) {
    console.error('获取套餐信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取套餐信息失败'
    });
  }
});

export default router;
