import express from 'express';
import { orderService } from '../../services/OrderService';
import { authenticate, requireAdmin } from '../../middleware/adminAuth';

const router = express.Router();

/**
 * 获取所有订单（管理员）
 * GET /api/admin/orders
 */
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await orderService.getAllOrders(page, limit, status, startDate, endDate);

    res.json({
      success: true,
      data: result.orders,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error: any) {
    console.error('获取订单列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单列表失败',
      error: error.message,
    });
  }
});

/**
 * 获取订单详情（管理员）
 * GET /api/admin/orders/:orderNo
 */
router.get('/:orderNo', authenticate, requireAdmin, async (req, res) => {
  try {
    const { orderNo } = req.params;
    const order = await orderService.getOrderByNo(orderNo);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    console.error('获取订单详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单详情失败',
      error: error.message,
    });
  }
});

/**
 * 手动处理异常订单（管理员）
 * PUT /api/admin/orders/:orderNo
 */
router.put('/:orderNo', authenticate, requireAdmin, async (req, res) => {
  try {
    const { orderNo } = req.params;
    const { action, reason } = req.body;
    const adminId = (req as any).user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    if (!action || !['refund', 'complete'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: '无效的操作类型',
      });
    }

    await orderService.handleAbnormalOrder(orderNo, action, adminId, reason, ipAddress, userAgent);

    res.json({
      success: true,
      message: action === 'refund' ? '退款成功' : '订单已完成',
    });
  } catch (error: any) {
    console.error('处理订单失败:', error);
    res.status(500).json({
      success: false,
      message: '处理订单失败',
      error: error.message,
    });
  }
});

/**
 * 获取订单统计（管理员）
 * GET /api/admin/orders/stats
 */
router.get('/stats/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const stats = await orderService.getOrderStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('获取订单统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单统计失败',
      error: error.message,
    });
  }
});

export default router;
