import express from 'express';
import { paymentService } from '../services/PaymentService';
import { orderService } from '../services/OrderService';
import { subscriptionService } from '../services/SubscriptionService';
import { boosterPackService } from '../services/BoosterPackService';
import { authenticate } from '../middleware/adminAuth';

const router = express.Router();

/**
 * 检查用户是否可以购买加量包
 * GET /api/orders/can-purchase-booster
 */
router.get('/can-purchase-booster', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const result = await boosterPackService.canPurchaseBooster(userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('检查加量包购买资格失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '检查加量包购买资格失败'
    });
  }
});

/**
 * 创建订单（支持购买、升级和加量包）
 * POST /api/orders
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { plan_id, order_type } = req.body;

    if (!plan_id) {
      return res.status(400).json({
        success: false,
        message: '缺少套餐ID'
      });
    }

    const { pool } = await import('../db/database');
    
    // 获取套餐信息
    const planResult = await pool.query(
      'SELECT plan_type, price FROM subscription_plans WHERE id = $1',
      [plan_id]
    );
    
    if (planResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '套餐不存在'
      });
    }
    
    const planType = planResult.rows[0].plan_type || 'base';
    
    // 如果是加量包，检查购买资格
    if (planType === 'booster') {
      const canPurchase = await boosterPackService.canPurchaseBooster(userId);
      if (!canPurchase.canPurchase) {
        return res.status(400).json({
          success: false,
          message: canPurchase.message || '无法购买加量包',
          reason: canPurchase.reason
        });
      }
    }

    // 如果是升级订单，先检查是否可以升级
    if (order_type === 'upgrade') {
      const subscription = await subscriptionService.getUserActiveSubscription(userId);
      if (!subscription) {
        return res.status(400).json({
          success: false,
          message: '当前没有激活的订阅，无法升级'
        });
      }
      
      // 检查是否是升级到更高价格的套餐
      const currentPlan = await pool.query(
        'SELECT price FROM subscription_plans WHERE id = $1',
        [subscription.plan_id]
      );
      const newPlan = planResult.rows[0];
      
      if (newPlan.price <= currentPlan.rows[0].price) {
        return res.status(400).json({
          success: false,
          message: '只能升级到更高价格的套餐'
        });
      }
    }

    // 确定订单类型
    const finalOrderType = planType === 'booster' ? 'booster' : (order_type || 'purchase');

    // 检查套餐价格，如果是免费套餐则直接开通
    const planPrice = parseFloat(planResult.rows[0].price);
    
    if (planPrice === 0) {
      // 免费套餐：直接创建订单并开通
      const order = await orderService.createOrder(userId, plan_id, finalOrderType as 'purchase' | 'upgrade');
      
      // 直接标记为已支付并开通订阅
      await orderService.updateOrderStatus(order.order_no, 'paid');
      
      // 开通订阅
      const { QuotaInitializationService } = await import('../services/QuotaInitializationService');
      
      // 将用户现有的 active 订阅标记为已替换
      await pool.query(
        `UPDATE user_subscriptions 
         SET status = 'replaced', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );
      
      // 获取套餐的 duration_days
      const durationResult = await pool.query(
        'SELECT duration_days, billing_cycle FROM subscription_plans WHERE id = $1',
        [plan_id]
      );
      let durationDays = 30;
      if (durationResult.rows.length > 0) {
        const { duration_days, billing_cycle } = durationResult.rows[0];
        if (duration_days && duration_days > 0) {
          durationDays = duration_days;
        } else if (billing_cycle === 'yearly') {
          durationDays = 365;
        } else if (billing_cycle === 'quarterly') {
          durationDays = 90;
        }
      }
      
      // 创建订阅
      const subscriptionStartDate = new Date();
      await pool.query(
        `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
         VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, (CURRENT_TIMESTAMP + INTERVAL '1 day' * $3)::timestamp + TIME '23:59:59')`,
        [userId, plan_id, durationDays]
      );
      
      // 初始化配额（先清除旧记录，再初始化新配额）
      await QuotaInitializationService.clearUserQuotas(userId);
      await QuotaInitializationService.initializeUserQuotas(userId, plan_id, { 
        resetUsage: true,
        subscriptionStartDate  // 传入订阅开始日期
      });
      await QuotaInitializationService.updateStorageQuota(userId, plan_id);
      
      return res.json({
        success: true,
        data: {
          order_no: order.order_no,
          amount: 0,
          plan_name: '体验版',
          status: 'paid',
          is_free: true
        },
        message: '免费套餐开通成功'
      });
    }

    // 创建微信支付订单（包含二维码链接）
    const result = await paymentService.createWeChatPayOrder(userId, plan_id, finalOrderType);

    res.json({
      success: true,
      data: result,
      message: '订单创建成功，请扫码支付'
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
 * 获取订单详情
 * GET /api/orders/:orderNo
 */
router.get('/:orderNo', authenticate, async (req, res) => {
  try {
    const { orderNo } = req.params;
    const userId = (req as any).user.userId;

    // 获取订单
    const order = await orderService.getOrderByNo(orderNo, userId);
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

    res.json({
      success: true,
      data: order
    });
  } catch (error: any) {
    console.error('获取订单详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取订单详情失败'
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
    const order = await orderService.getOrderByNo(orderNo, userId);
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
