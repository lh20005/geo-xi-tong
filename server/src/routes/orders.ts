import express from 'express';
import { paymentService } from '../services/PaymentService';
import { orderService } from '../services/OrderService';
import { authenticate } from '../middleware/adminAuth';

const router = express.Router();

/**
 * 创建订单
 * POST /api/orders
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({
        success: false,
        message: '缺少套餐ID'
      });
    }

    // 创建微信支付订单
    const result = await paymentService.createWeChatPayOrder(userId, plan_id);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('创建订单失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '创建订单失败'
    });
  }
});

/**
 * 查询订单状态
 * GET /api/orders/:orderNo/status
 */
router.get('/:orderNo/status', authenticate, async (req, res) => {
  try {
    const { orderNo } = req.params;
    const userId = (req as any).user.userId;

    // 获取订单
    const order = await orderService.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    // 验证订单所有权
    if (order.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '无权访问此订单'
      });
    }

    // 查询支付状态
    const status = await paymentService.queryOrderStatus(orderNo);

    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    console.error('查询订单状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '查询订单状态失败'
    });
  }
});

/**
 * 获取用户订单列表
 * GET /api/orders
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    const result = await orderService.getUserOrders(userId, page, limit, status);

    res.json({
      success: true,
      data: {
        orders: result.orders,
        pagination: {
          page,
          limit,
          total: result.total,
          total_pages: Math.ceil(result.total / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('获取订单列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取订单列表失败'
    });
  }
});

export default router;
