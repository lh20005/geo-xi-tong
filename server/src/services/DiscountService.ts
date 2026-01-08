import { pool } from '../db/database';

/**
 * 折扣资格检查结果
 */
export interface DiscountEligibility {
  eligible: boolean;
  reason?: 'not_invited_by_agent' | 'not_first_purchase' | 'discount_already_used';
  invitedByAgent: boolean;
  isFirstPurchase: boolean;
  discountUsed: boolean;
}

/**
 * 套餐折扣信息
 */
export interface PlanDiscountInfo {
  planId: number;
  planName: string;
  planCode: string;
  originalPrice: number;
  discountRate: number;
  discountedPrice: number;
  hasDiscount: boolean;
}

/**
 * 订单折扣信息
 */
export interface OrderDiscountInfo {
  originalPrice: number;
  discountRate: number;
  finalPrice: number;
  isAgentDiscount: boolean;
  savedAmount: number;
}

/**
 * 折扣服务
 * 负责代理商折扣资格检查、价格计算和状态管理
 */
export class DiscountService {
  /**
   * 检查用户是否有资格享受代理商折扣
   * 条件：
   * 1. 用户通过代理商邀请码注册（invited_by_agent 不为空）
   * 2. 用户首次购买（无成功支付的订单）
   * 3. 用户未使用过首次购买折扣
   * 
   * @param userId 用户ID
   * @returns 折扣资格信息
   */
  async checkDiscountEligibility(userId: number): Promise<DiscountEligibility> {
    try {
      // 查询用户信息
      const userResult = await pool.query(
        `SELECT 
          invited_by_agent,
          first_purchase_discount_used
        FROM users 
        WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return {
          eligible: false,
          reason: 'not_invited_by_agent',
          invitedByAgent: false,
          isFirstPurchase: true,
          discountUsed: false
        };
      }

      const user = userResult.rows[0];
      const invitedByAgent = user.invited_by_agent !== null;
      const discountUsed = user.first_purchase_discount_used === true;

      // 如果不是被代理商邀请的用户
      if (!invitedByAgent) {
        return {
          eligible: false,
          reason: 'not_invited_by_agent',
          invitedByAgent: false,
          isFirstPurchase: true,
          discountUsed: false
        };
      }

      // 如果已经使用过首次购买折扣
      if (discountUsed) {
        return {
          eligible: false,
          reason: 'discount_already_used',
          invitedByAgent: true,
          isFirstPurchase: false,
          discountUsed: true
        };
      }

      // 检查是否有成功支付的订单
      const orderResult = await pool.query(
        `SELECT COUNT(*) as count 
        FROM orders 
        WHERE user_id = $1 AND status = 'paid'`,
        [userId]
      );

      const hasPaidOrders = parseInt(orderResult.rows[0].count) > 0;

      if (hasPaidOrders) {
        return {
          eligible: false,
          reason: 'not_first_purchase',
          invitedByAgent: true,
          isFirstPurchase: false,
          discountUsed: false
        };
      }

      // 符合所有条件
      return {
        eligible: true,
        invitedByAgent: true,
        isFirstPurchase: true,
        discountUsed: false
      };
    } catch (error) {
      console.error('[DiscountService] 检查折扣资格失败:', error);
      throw error;
    }
  }

  /**
   * 计算折扣价格
   * 公式：折扣价 = 原价 × (折扣比例 / 100)
   * 结果四舍五入到分（两位小数），最小值为 0.01
   * 
   * @param originalPrice 原价
   * @param discountRate 折扣比例（1-100）
   * @returns 折扣价
   */
  calculateDiscountedPrice(originalPrice: number, discountRate: number): number {
    // 验证折扣比例
    if (discountRate < 1 || discountRate > 100) {
      throw new Error('折扣比例必须在 1-100 之间');
    }

    // 如果是 100，直接返回原价
    if (discountRate === 100) {
      return originalPrice;
    }

    // 计算折扣价：原价 × (折扣比例 / 100)
    const discountedPrice = originalPrice * (discountRate / 100);
    
    // 四舍五入到分（两位小数）
    const roundedPrice = Math.round(discountedPrice * 100) / 100;
    
    // 确保最小值为 0.01
    return Math.max(0.01, roundedPrice);
  }

  /**
   * 验证折扣比例是否有效
   * 
   * @param discountRate 折扣比例
   * @returns 验证结果
   */
  validateDiscountRate(discountRate: number): { valid: boolean; message?: string } {
    if (!Number.isInteger(discountRate)) {
      return { valid: false, message: '折扣比例必须是整数' };
    }
    if (discountRate < 1) {
      return { valid: false, message: '折扣比例不能小于 1' };
    }
    if (discountRate > 100) {
      return { valid: false, message: '折扣比例不能大于 100' };
    }
    return { valid: true };
  }

  /**
   * 获取用户的折扣价格信息
   * 用于落地页展示所有套餐的折扣价格
   * 
   * @param userId 用户ID
   * @param planIds 套餐ID列表（可选，不传则返回所有激活套餐）
   * @returns 套餐折扣信息列表
   */
  async getUserDiscountPrices(userId: number, planIds?: number[]): Promise<PlanDiscountInfo[]> {
    try {
      // 检查用户折扣资格
      const eligibility = await this.checkDiscountEligibility(userId);

      // 构建查询
      let query = `
        SELECT 
          id as "planId",
          plan_name as "planName",
          plan_code as "planCode",
          price as "originalPrice",
          COALESCE(agent_discount_rate, 100) as "discountRate"
        FROM subscription_plans
        WHERE is_active = TRUE
      `;
      const params: any[] = [];

      if (planIds && planIds.length > 0) {
        query += ` AND id = ANY($1)`;
        params.push(planIds);
      }

      query += ` ORDER BY display_order ASC, id ASC`;

      const result = await pool.query(query, params);

      return result.rows.map(row => {
        const originalPrice = parseFloat(row.originalPrice);
        const discountRate = parseInt(row.discountRate);
        
        // 只有符合资格的用户才能享受折扣
        const effectiveDiscountRate = eligibility.eligible ? discountRate : 100;
        const discountedPrice = this.calculateDiscountedPrice(originalPrice, effectiveDiscountRate);
        const hasDiscount = eligibility.eligible && discountRate < 100;

        return {
          planId: row.planId,
          planName: row.planName,
          planCode: row.planCode,
          originalPrice,
          discountRate: effectiveDiscountRate,
          discountedPrice,
          hasDiscount
        };
      });
    } catch (error) {
      console.error('[DiscountService] 获取用户折扣价格失败:', error);
      throw error;
    }
  }

  /**
   * 标记用户已使用首次购买折扣
   * 在支付成功后调用
   * 
   * @param userId 用户ID
   */
  async markFirstPurchaseDiscountUsed(userId: number): Promise<void> {
    try {
      await pool.query(
        `UPDATE users 
        SET first_purchase_discount_used = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [userId]
      );
      console.log(`[DiscountService] 用户 ${userId} 已标记使用首次购买折扣`);
    } catch (error) {
      console.error('[DiscountService] 标记首次购买折扣失败:', error);
      throw error;
    }
  }

  /**
   * 获取套餐的折扣比例
   * 
   * @param planId 套餐ID
   * @returns 折扣比例（1-100），如果套餐不存在或未设置则返回 100
   */
  async getPlanDiscountRate(planId: number): Promise<number> {
    try {
      const result = await pool.query(
        `SELECT COALESCE(agent_discount_rate, 100) as discount_rate
        FROM subscription_plans
        WHERE id = $1`,
        [planId]
      );

      if (result.rows.length === 0) {
        return 100; // 套餐不存在，返回无折扣
      }

      return parseInt(result.rows[0].discount_rate);
    } catch (error) {
      console.error('[DiscountService] 获取套餐折扣比例失败:', error);
      throw error;
    }
  }

  /**
   * 计算订单折扣信息
   * 用于创建订单时获取完整的折扣信息
   * 
   * @param userId 用户ID
   * @param planId 套餐ID
   * @param originalPrice 原价
   * @returns 订单折扣信息
   */
  async calculateOrderDiscount(
    userId: number,
    planId: number,
    originalPrice: number
  ): Promise<OrderDiscountInfo> {
    try {
      // 检查用户折扣资格
      const eligibility = await this.checkDiscountEligibility(userId);

      if (!eligibility.eligible) {
        // 无折扣资格
        return {
          originalPrice,
          discountRate: 100,
          finalPrice: originalPrice,
          isAgentDiscount: false,
          savedAmount: 0
        };
      }

      // 获取套餐折扣比例
      const discountRate = await this.getPlanDiscountRate(planId);

      if (discountRate >= 100) {
        // 套餐无折扣
        return {
          originalPrice,
          discountRate: 100,
          finalPrice: originalPrice,
          isAgentDiscount: false,
          savedAmount: 0
        };
      }

      // 计算折扣价
      const finalPrice = this.calculateDiscountedPrice(originalPrice, discountRate);
      const savedAmount = Math.round((originalPrice - finalPrice) * 100) / 100;

      return {
        originalPrice,
        discountRate,
        finalPrice,
        isAgentDiscount: true,
        savedAmount
      };
    } catch (error) {
      console.error('[DiscountService] 计算订单折扣失败:', error);
      throw error;
    }
  }

  /**
   * 获取代理商折扣统计
   * 
   * @param startDate 开始日期（可选）
   * @param endDate 结束日期（可选）
   * @returns 统计信息
   */
  async getDiscountStatistics(startDate?: Date, endDate?: Date): Promise<{
    totalDiscountOrders: number;
    totalDiscountAmount: number;
    totalSavedAmount: number;
  }> {
    try {
      let query = `
        SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(original_price - amount), 0) as total_saved
        FROM orders
        WHERE is_agent_discount = TRUE AND status = 'paid'
      `;
      const params: any[] = [];

      if (startDate) {
        params.push(startDate);
        query += ` AND created_at >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND created_at <= $${params.length}`;
      }

      const result = await pool.query(query, params);
      const row = result.rows[0];

      return {
        totalDiscountOrders: parseInt(row.total_orders),
        totalDiscountAmount: parseFloat(row.total_amount),
        totalSavedAmount: parseFloat(row.total_saved)
      };
    } catch (error) {
      console.error('[DiscountService] 获取折扣统计失败:', error);
      throw error;
    }
  }
}

export const discountService = new DiscountService();
