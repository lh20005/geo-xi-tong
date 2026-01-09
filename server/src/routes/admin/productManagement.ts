import express from 'express';
import { productManagementService } from '../../services/ProductManagementService';
import { authenticate, requireAdmin } from '../../middleware/adminAuth';
import { pool } from '../../db/database';

const router = express.Router();

// 所有路由都需要管理员权限
router.use(authenticate);
router.use(requireAdmin);

/**
 * 获取所有套餐（包括未激活的）
 * GET /api/admin/products/plans
 * Query params:
 *   - include_inactive: 是否包括未激活的套餐
 *   - plan_type: 套餐类型筛选 (base | booster)
 */
router.get('/plans', async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const planType = req.query.plan_type as 'base' | 'booster' | undefined;
    
    // 验证 plan_type 参数
    if (planType && !['base', 'booster'].includes(planType)) {
      return res.status(400).json({
        success: false,
        message: '无效的套餐类型，必须是 base 或 booster'
      });
    }
    
    const plans = await productManagementService.getAllPlans(includeInactive, planType);
    
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
 * 获取单个套餐详情
 * GET /api/admin/products/plans/:id
 */
router.get('/plans/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    
    if (isNaN(planId)) {
      return res.status(400).json({
        success: false,
        message: '无效的套餐ID'
      });
    }
    
    const plan = await productManagementService.getPlanById(planId);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: '套餐不存在'
      });
    }
    
    res.json({
      success: true,
      data: plan
    });
  } catch (error: any) {
    console.error('获取套餐详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取套餐详情失败'
    });
  }
});

/**
 * 创建新套餐
 * POST /api/admin/products/plans
 */
router.post('/plans', async (req, res) => {
  try {
    const adminId = (req as any).user.userId;
    const planData = req.body;
    
    // 验证必填字段
    if (!planData.planCode || !planData.planName || planData.price === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段'
      });
    }
    
    const plan = await productManagementService.createPlan(planData, adminId);
    
    res.json({
      success: true,
      message: '套餐创建成功',
      data: plan
    });
  } catch (error: any) {
    console.error('创建套餐失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '创建套餐失败'
    });
  }
});

/**
 * 更新套餐
 * PUT /api/admin/products/plans/:id
 */
router.put('/plans/:id', async (req, res) => {
  try {
    console.log('[ProductManagement] 更新套餐请求:', {
      planId: req.params.id,
      body: req.body,
      user: (req as any).user
    });
    
    const planId = parseInt(req.params.id);
    const adminId = (req as any).user.userId;
    const updates = req.body;
    
    if (isNaN(planId)) {
      return res.status(400).json({
        success: false,
        message: '无效的套餐ID'
      });
    }
    
    const plan = await productManagementService.updatePlan(planId, updates, adminId);
    
    res.json({
      success: true,
      message: '套餐更新成功',
      data: plan
    });
  } catch (error: any) {
    console.error('[ProductManagement] 更新套餐失败:', error);
    console.error('[ProductManagement] 错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || '更新套餐失败'
    });
  }
});

/**
 * 删除套餐
 * DELETE /api/admin/products/plans/:id
 */
router.delete('/plans/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    const adminId = (req as any).user.userId;
    
    if (isNaN(planId)) {
      return res.status(400).json({
        success: false,
        message: '无效的套餐ID'
      });
    }
    
    await productManagementService.deletePlan(planId, adminId);
    
    res.json({
      success: true,
      message: '套餐删除成功'
    });
  } catch (error: any) {
    console.error('删除套餐失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除套餐失败'
    });
  }
});

/**
 * 获取配置变更历史
 * GET /api/admin/products/history
 */
router.get('/history', async (req, res) => {
  try {
    const planId = req.query.plan_id ? parseInt(req.query.plan_id as string) : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    
    const result = await productManagementService.getConfigHistory(planId, page, pageSize);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('获取配置历史失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取配置历史失败'
    });
  }
});

export default router;


/**
 * 获取加量包统计信息
 * GET /api/admin/products/booster-stats
 */
router.get('/booster-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sp.id as plan_id,
        sp.plan_name,
        sp.plan_code,
        sp.price,
        COUNT(DISTINCT us.id) as total_sold,
        COUNT(DISTINCT CASE WHEN us.status = 'active' AND us.end_date > CURRENT_TIMESTAMP THEN us.id END) as active_count,
        COALESCE(SUM(CASE WHEN us.status = 'active' THEN sp.price ELSE 0 END), 0) as active_revenue,
        COALESCE(SUM(sp.price), 0) as total_revenue
      FROM subscription_plans sp
      LEFT JOIN user_subscriptions us ON us.plan_id = sp.id AND us.plan_type = 'booster'
      WHERE sp.plan_type = 'booster' AND sp.is_active = TRUE
      GROUP BY sp.id
      ORDER BY sp.display_order ASC
    `);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        planId: row.plan_id,
        planName: row.plan_name,
        planCode: row.plan_code,
        price: parseFloat(row.price),
        totalSold: parseInt(row.total_sold),
        activeCount: parseInt(row.active_count),
        activeRevenue: parseFloat(row.active_revenue),
        totalRevenue: parseFloat(row.total_revenue)
      }))
    });
  } catch (error: any) {
    console.error('获取加量包统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取加量包统计失败'
    });
  }
});
