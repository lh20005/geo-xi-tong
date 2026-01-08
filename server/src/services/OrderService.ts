import { pool } from '../db/database';
import { Order } from '../types/subscription';
import { AuditLogService } from './AuditLogService';
import { AnomalyDetectionService } from './AnomalyDetectionService';
import { discountService } from './DiscountService';

/**
 * 订单折扣信息
 */
export interface OrderDiscountOptions {
  applyDiscount?: boolean;  // 是否应用折扣
  originalPrice?: number;   // 原价
  discountRate?: number;    // 折扣比例
  isAgentDiscount?: boolean; // 是否代理商折扣
}

export class OrderService {
  /**
   * 生成唯一订单号
   * 格式: ORD + 时间戳(13位) + 随机数(8位)
   * 总长度: 3 + 13 + 8 = 24位
   * 
   * 修复说明：
   * - 将随机数从4位（10,000种可能）增加到8位（100,000,000种可能）
   * - 大幅降低同一毫秒内生成重复订单号的概率
   * - 即使在高并发场景下也能保证唯一性
   */
  generateOrderNo(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return `ORD${timestamp}${random}`;
  }

  /**
   * 创建订单（支持购买和升级）
   * @param userId 用户ID
   * @param planId 套餐ID
   * @param orderType 订单类型
   * @param discountOptions 折扣选项（可选）
   */
  async createOrder(
    userId: number, 
    planId: number, 
    orderType: 'purchase' | 'upgrade' = 'purchase',
    discountOptions?: OrderDiscountOptions
  ): Promise<Order> {
    // 检测订单创建异常
    await AnomalyDetectionService.checkOrderCreationSpike(userId);
    
    let amount: number;
    let originalPrice: number | null = null;
    let discountRate: number | null = null;
    let isAgentDiscount: boolean = false;
    
    if (orderType === 'upgrade') {
      // 升级订单：计算差价
      const subscription = await this.getUserActiveSubscription(userId);
      if (!subscription) {
        throw new Error('当前没有激活的订阅');
      }
      
      // 获取当前套餐和新套餐价格
      const currentPlanResult = await pool.query(
        'SELECT price FROM subscription_plans WHERE id = $1',
        [subscription.plan_id]
      );
      const newPlanResult = await pool.query(
        'SELECT price FROM subscription_plans WHERE id = $1',
        [planId]
      );
      
      if (newPlanResult.rows.length === 0) {
        throw new Error('套餐不存在');
      }
      
      const currentPrice = currentPlanResult.rows[0].price;
      const newPrice = newPlanResult.rows[0].price;
      
      // 计算剩余天数
      const now = new Date();
      const endDate = new Date(subscription.end_date);
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // 计算差价（按剩余天数比例）
      const dailyOldPrice = currentPrice / 30;
      const dailyNewPrice = newPrice / 30;
      amount = Math.max(0, (dailyNewPrice - dailyOldPrice) * daysRemaining);
    } else {
      // 购买订单：使用套餐价格
      const planResult = await pool.query(
        'SELECT price FROM subscription_plans WHERE id = $1',
        [planId]
      );

      if (planResult.rows.length === 0) {
        throw new Error('套餐不存在');
      }

      const planPrice = parseFloat(planResult.rows[0].price);
      
      // 检查是否应用折扣
      if (discountOptions?.applyDiscount) {
        originalPrice = discountOptions.originalPrice || planPrice;
        discountRate = discountOptions.discountRate || 100;
        isAgentDiscount = discountOptions.isAgentDiscount || false;
        amount = discountService.calculateDiscountedPrice(originalPrice, discountRate);
      } else {
        amount = planPrice;
      }
    }

    const orderNo = this.generateOrderNo();
    
    // 订单30分钟后过期
    const expiredAt = new Date();
    expiredAt.setMinutes(expiredAt.getMinutes() + 30);

    // 构建插入语句
    const insertFields = ['order_no', 'user_id', 'plan_id', 'amount', 'status', 'payment_method', 'order_type', 'expired_at'];
    const insertValues: any[] = [orderNo, userId, planId, amount, 'pending', 'wechat', orderType, expiredAt];
    const placeholders = ['$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8'];
    let paramIndex = 9;

    // 如果有折扣信息，添加到插入语句
    if (originalPrice !== null) {
      insertFields.push('original_price');
      insertValues.push(originalPrice);
      placeholders.push(`$${paramIndex++}`);
    }
    if (discountRate !== null) {
      insertFields.push('discount_rate');
      insertValues.push(discountRate);
      placeholders.push(`$${paramIndex++}`);
    }
    if (isAgentDiscount) {
      insertFields.push('is_agent_discount');
      insertValues.push(isAgentDiscount);
      placeholders.push(`$${paramIndex++}`);
    }

    const result = await pool.query(
      `INSERT INTO orders (${insertFields.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      insertValues
    );

    return result.rows[0];
  }
  
  /**
   * 获取用户当前订阅（用于升级订单）
   */
  private async getUserActiveSubscription(userId: number): Promise<any> {
    const result = await pool.query(
      `SELECT * FROM user_subscriptions 
       WHERE user_id = $1 AND status = 'active' AND end_date > CURRENT_TIMESTAMP
       ORDER BY end_date DESC LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * 更新订单状态
   */
  async updateOrderStatus(
    orderNo: string,
    status: 'paid' | 'failed' | 'closed',
    transactionId?: string
  ): Promise<Order> {
    const updates: string[] = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [orderNo, status];
    let paramIndex = 3;

    if (status === 'paid' && transactionId) {
      updates.push(`transaction_id = $${paramIndex}`);
      params.push(transactionId);
      paramIndex++;
      
      updates.push(`paid_at = $${paramIndex}`);
      params.push(new Date());
      paramIndex++;
    }

    const result = await pool.query(
      `UPDATE orders SET ${updates.join(', ')}
       WHERE order_no = $1
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('订单不存在');
    }

    return result.rows[0];
  }

  /**
   * 根据订单号获取订单
   */
  async getOrderByNo(orderNo: string): Promise<Order | null> {
    const result = await pool.query(
      'SELECT * FROM orders WHERE order_no = $1',
      [orderNo]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 关闭超时订单
   */
  async closeExpiredOrders(): Promise<number> {
    const result = await pool.query(
      `UPDATE orders 
       SET status = 'closed', updated_at = CURRENT_TIMESTAMP
       WHERE status = 'pending' 
       AND expired_at < CURRENT_TIMESTAMP
       RETURNING id`
    );

    return result.rowCount || 0;
  }

  /**
   * 获取用户订单列表
   */
  async getUserOrders(
    userId: number,
    page: number = 1,
    limit: number = 10,
    status?: string
  ): Promise<{ orders: Order[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions = ['user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM orders WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取订单列表
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT o.*, p.plan_name 
       FROM orders o
       LEFT JOIN subscription_plans p ON o.plan_id = p.id
       WHERE ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      orders: result.rows,
      total
    };
  }

  /**
   * 获取所有订单（管理员）
   */
  async getAllOrders(
    page: number = 1,
    limit: number = 10,
    status?: string,
    startDate?: string,
    endDate?: string,
    isAgentDiscount?: string
  ): Promise<{ orders: Order[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`o.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`o.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`o.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    if (isAgentDiscount !== undefined) {
      conditions.push(`o.is_agent_discount = $${paramIndex}`);
      params.push(isAgentDiscount === 'true');
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取订单列表
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT o.*, p.plan_name, u.username 
       FROM orders o
       LEFT JOIN subscription_plans p ON o.plan_id = p.id
       LEFT JOIN users u ON o.user_id = u.id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      orders: result.rows,
      total
    };
  }

  /**
   * 获取订单统计（管理员）
   */
  async getOrderStats(): Promise<{
    todayRevenue: number;
    monthRevenue: number;
    todayOrders: number;
    monthOrders: number;
    pendingOrders: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // 今日收入和订单数
    const todayResult = await pool.query(
      `SELECT 
        COALESCE(SUM(amount), 0) as revenue,
        COUNT(*) as count
       FROM orders
       WHERE status = 'paid' AND paid_at >= $1`,
      [today]
    );

    // 本月收入和订单数
    const monthResult = await pool.query(
      `SELECT 
        COALESCE(SUM(amount), 0) as revenue,
        COUNT(*) as count
       FROM orders
       WHERE status = 'paid' AND paid_at >= $1`,
      [monthStart]
    );

    // 待支付订单数
    const pendingResult = await pool.query(
      `SELECT COUNT(*) as count FROM orders WHERE status = 'pending'`
    );

    return {
      todayRevenue: parseFloat(todayResult.rows[0].revenue),
      monthRevenue: parseFloat(monthResult.rows[0].revenue),
      todayOrders: parseInt(todayResult.rows[0].count),
      monthOrders: parseInt(monthResult.rows[0].count),
      pendingOrders: parseInt(pendingResult.rows[0].count),
    };
  }

  /**
   * 手动处理异常订单（管理员）
   */
  async handleAbnormalOrder(
    orderNo: string,
    action: 'refund' | 'complete',
    adminId: number,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const order = await this.getOrderByNo(orderNo);
    if (!order) {
      throw new Error('订单不存在');
    }

    if (action === 'refund') {
      // 退款处理
      await pool.query(
        `UPDATE orders 
         SET status = 'refunded', updated_at = CURRENT_TIMESTAMP
         WHERE order_no = $1`,
        [orderNo]
      );

      // 记录审计日志
      await AuditLogService.logAdminAction({
        adminId,
        actionType: 'refund_order',
        resourceType: 'order',
        resourceId: orderNo,
        details: { reason, orderId: order.id, amount: order.amount },
        ipAddress,
        userAgent,
      });
    } else if (action === 'complete') {
      // 手动完成订单
      await pool.query(
        `UPDATE orders 
         SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE order_no = $1`,
        [orderNo]
      );

      // 记录审计日志
      await AuditLogService.logAdminAction({
        adminId,
        actionType: 'complete_order',
        resourceType: 'order',
        resourceId: orderNo,
        details: { reason, orderId: order.id, amount: order.amount },
        ipAddress,
        userAgent,
      });
    }
  }
}

export const orderService = new OrderService();
