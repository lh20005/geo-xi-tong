import { pool } from '../db/database';
import { getWebSocketService } from './WebSocketService';
import { QuotaInitializationService } from './QuotaInitializationService';

/**
 * 订阅到期处理服务
 * 负责处理订阅到期，将用户退回到免费版
 */
export class SubscriptionExpirationService {
  private static instance: SubscriptionExpirationService;
  private intervalId: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): SubscriptionExpirationService {
    if (!SubscriptionExpirationService.instance) {
      SubscriptionExpirationService.instance = new SubscriptionExpirationService();
    }
    return SubscriptionExpirationService.instance;
  }

  /**
   * 启动定时任务（每小时检查一次）
   */
  start(): void {
    if (this.intervalId) {
      console.log('[SubscriptionExpiration] 定时任务已在运行');
      return;
    }

    console.log('[SubscriptionExpiration] 启动订阅到期检查定时任务');
    
    // 立即执行一次
    this.checkExpiredSubscriptions();
    
    // 每小时执行一次
    this.intervalId = setInterval(() => {
      this.checkExpiredSubscriptions();
    }, 60 * 60 * 1000); // 1小时
  }

  /**
   * 停止定时任务
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SubscriptionExpiration] 定时任务已停止');
    }
  }

  /**
   * 检查并处理过期订阅
   */
  async checkExpiredSubscriptions(): Promise<void> {
    const client = await pool.connect();
    
    try {
      console.log('[SubscriptionExpiration] 开始检查过期订阅...');
      
      // 查找所有刚过期的订阅（状态仍为 active 但已过期）
      // 注意：只处理基础订阅，加量包订阅由 BoosterExpirationService 单独处理
      const expiredResult = await client.query(`
        SELECT 
          us.id as subscription_id,
          us.user_id,
          u.username,
          u.email,
          sp.plan_name,
          us.end_date
        FROM user_subscriptions us
        JOIN users u ON u.id = us.user_id
        JOIN subscription_plans sp ON sp.id = us.plan_id
        WHERE us.status = 'active'
          AND COALESCE(us.plan_type, 'base') = 'base'
          AND us.end_date <= CURRENT_TIMESTAMP
          AND us.end_date > CURRENT_TIMESTAMP - INTERVAL '1 day'
      `);

      if (expiredResult.rows.length === 0) {
        console.log('[SubscriptionExpiration] 没有需要处理的过期订阅');
        return;
      }

      console.log(`[SubscriptionExpiration] 发现 ${expiredResult.rows.length} 个过期订阅`);

      for (const subscription of expiredResult.rows) {
        await this.handleExpiredSubscription(client, subscription);
      }

      console.log('[SubscriptionExpiration] 过期订阅处理完成');
    } catch (error) {
      console.error('[SubscriptionExpiration] 处理过期订阅失败:', error);
    } finally {
      client.release();
    }
  }

  /**
   * 处理单个过期订阅（退回到免费版）
   */
  private async handleExpiredSubscription(client: any, subscription: any): Promise<void> {
    const { subscription_id, user_id, username, plan_name, end_date } = subscription;
    
    try {
      await client.query('BEGIN');

      console.log(`[SubscriptionExpiration] 处理用户 ${username} (ID: ${user_id}) 的过期订阅`);

      // 1. 更新订阅状态为已过期
      await client.query(
        `UPDATE user_subscriptions 
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [subscription_id]
      );

      // 2. 获取免费版套餐ID和有效期配置
      const freePlanResult = await client.query(
        `SELECT id, duration_days FROM subscription_plans WHERE plan_code = 'free' LIMIT 1`
      );

      if (freePlanResult.rows.length === 0) {
        throw new Error('未找到免费版套餐');
      }

      const freePlanId = freePlanResult.rows[0].id;
      const durationDays = freePlanResult.rows[0].duration_days || 36500; // 默认100年（永久）

      // 3. 创建免费版订阅（根据商品配置的有效期）
      const newSubResult = await client.query(
        `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date, quota_reset_anchor, quota_cycle_type)
         VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + $3 * INTERVAL '1 day', CURRENT_TIMESTAMP, 'monthly')
         RETURNING id`,
        [user_id, freePlanId, durationDays]
      );

      console.log(`   - 已创建免费版订阅 (ID: ${newSubResult.rows[0].id})`);

      // 4. 使用统一服务处理配额变更（清除旧配额、初始化新配额、更新存储配额）
      await QuotaInitializationService.handlePlanChange(user_id, freePlanId, client);

      console.log(`   - 已初始化免费版配额`);

      // 5. 记录到期事件
      await client.query(
        `INSERT INTO subscription_adjustments 
         (user_id, subscription_id, adjustment_type, reason, admin_id)
         VALUES ($1, $2, 'expired', '订阅到期自动退回到免费版', NULL)`,
        [user_id, subscription_id]
      );

      await client.query('COMMIT');

      // 6. 发送 WebSocket 通知
      try {
        const wsService = getWebSocketService();
        wsService.sendToUser(user_id, 'subscription:expired', {
          plan_name,
          end_date,
          message: `您的 ${plan_name} 订阅已到期，已自动退回到免费版。升级套餐以解锁更多功能。`
        });
      } catch (error) {
        console.error(`   - WebSocket 通知发送失败:`, error);
      }

      console.log(`   ✅ 用户 ${username} 已退回到免费版`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`   ❌ 处理用户 ${username} 的过期订阅失败:`, error);
      throw error;
    }
  }

  /**
   * 手动处理所有过期订阅（用于管理员操作）
   */
  async handleAllExpiredSubscriptions(): Promise<number> {
    const client = await pool.connect();
    
    try {
      console.log('[SubscriptionExpiration] 手动处理所有过期订阅...');
      
      const result = await client.query('SELECT handle_expired_subscriptions() as count');
      const count = result.rows[0].count;
      
      console.log(`[SubscriptionExpiration] 处理了 ${count} 个过期订阅`);
      return count;
    } catch (error) {
      console.error('[SubscriptionExpiration] 手动处理失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取即将到期的订阅（7天内）
   * 注意：只返回基础订阅，加量包订阅由 BoosterExpirationService 单独处理
   */
  async getExpiringSubscriptions(days: number = 7): Promise<any[]> {
    const result = await pool.query(
      `SELECT 
        us.id as subscription_id,
        us.user_id,
        u.username,
        u.email,
        sp.plan_name,
        sp.plan_code,
        us.end_date,
        EXTRACT(DAY FROM us.end_date - CURRENT_TIMESTAMP) as days_remaining
      FROM user_subscriptions us
      JOIN users u ON u.id = us.user_id
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE us.status = 'active'
        AND COALESCE(us.plan_type, 'base') = 'base'
        AND us.end_date > CURRENT_TIMESTAMP
        AND us.end_date <= CURRENT_TIMESTAMP + $1 * INTERVAL '1 day'
      ORDER BY us.end_date ASC`,
      [days]
    );

    return result.rows;
  }

  /**
   * 发送到期提醒通知
   */
  async sendExpirationReminders(): Promise<void> {
    try {
      console.log('[SubscriptionExpiration] 发送到期提醒...');
      
      // 获取7天内即将到期的订阅
      const expiringSubscriptions = await this.getExpiringSubscriptions(7);
      
      if (expiringSubscriptions.length === 0) {
        console.log('[SubscriptionExpiration] 没有即将到期的订阅');
        return;
      }

      console.log(`[SubscriptionExpiration] 发现 ${expiringSubscriptions.length} 个即将到期的订阅`);

      const wsService = getWebSocketService();

      for (const subscription of expiringSubscriptions) {
        const daysRemaining = Math.ceil(subscription.days_remaining);
        
        // 只在特定天数发送提醒（7天、3天、1天）
        if ([7, 3, 1].includes(daysRemaining)) {
          try {
            wsService.sendToUser(subscription.user_id, 'subscription:expiring_soon', {
              plan_name: subscription.plan_name,
              end_date: subscription.end_date,
              days_remaining: daysRemaining,
              message: `您的 ${subscription.plan_name} 订阅将在 ${daysRemaining} 天后到期，到期后将自动退回到免费版。请及时续费以继续享受完整功能。`
            });
            
            console.log(`   - 已向用户 ${subscription.username} 发送 ${daysRemaining} 天到期提醒`);
          } catch (error) {
            console.error(`   - 向用户 ${subscription.username} 发送提醒失败:`, error);
          }
        }
      }

      console.log('[SubscriptionExpiration] 到期提醒发送完成');
    } catch (error) {
      console.error('[SubscriptionExpiration] 发送到期提醒失败:', error);
    }
  }
}

// 导出单例实例
export const subscriptionExpirationService = SubscriptionExpirationService.getInstance();
