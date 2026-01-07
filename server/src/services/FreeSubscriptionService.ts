import { pool } from '../db/database';
import { subscriptionService } from './SubscriptionService';
import { QuotaInitializationService } from './QuotaInitializationService';

/**
 * 免费版订阅服务
 * 负责为新用户和现有无订阅用户开通免费版订阅
 */
export class FreeSubscriptionService {
  /**
   * 为新注册用户自动开通免费版订阅
   * @param userId 用户ID
   * @returns 订阅信息
   */
  async activateFreeSubscriptionForNewUser(userId: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log(`[FreeSubscription] 开始为新用户 ${userId} 开通免费版订阅...`);
      
      // 1. 获取免费版套餐
      const planResult = await client.query(
        `SELECT id, plan_code, plan_name FROM subscription_plans WHERE plan_code = 'free' AND is_active = true`
      );
      
      if (planResult.rows.length === 0) {
        throw new Error('免费版套餐不存在或未激活');
      }
      
      const freePlan = planResult.rows[0];
      console.log(`[FreeSubscription] 找到免费版套餐: ${freePlan.plan_name} (ID: ${freePlan.id})`);
      
      // 2. 检查用户是否已有订阅
      const existingSubResult = await client.query(
        `SELECT id FROM user_subscriptions WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );
      
      if (existingSubResult.rows.length > 0) {
        console.log(`[FreeSubscription] 用户 ${userId} 已有活跃订阅，跳过`);
        await client.query('ROLLBACK');
        return;
      }
      
      // 3. 创建订阅（免费版默认1年有效期）
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // 1年有效期
      
      const subscriptionResult = await client.query(
        `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date, is_gift, gift_reason)
         VALUES ($1, $2, 'active', $3, $4, true, '新用户注册赠送')
         RETURNING id`,
        [userId, freePlan.id, startDate, endDate]
      );
      
      const subscriptionId = subscriptionResult.rows[0].id;
      console.log(`[FreeSubscription] ✅ 订阅创建成功 (ID: ${subscriptionId})`);
      
      // 4. 使用统一的配额初始化服务
      await QuotaInitializationService.initializeUserQuotas(userId, freePlan.id, {
        resetUsage: true,
        client
      });
      
      // 5. 初始化存储空间
      await QuotaInitializationService.updateStorageQuota(userId, freePlan.id, client);
      
      await client.query('COMMIT');
      
      console.log(`[FreeSubscription] ✅ 用户 ${userId} 免费版订阅开通完成`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[FreeSubscription] ❌ 为用户 ${userId} 开通免费版失败:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * 为现有无订阅用户重置为免费版配额
   * @returns 处理的用户数量
   */
  async resetExistingUsersToFree(): Promise<{ total: number; success: number; failed: number }> {
    const client = await pool.connect();
    
    try {
      console.log('[FreeSubscription] 开始为现有无订阅用户重置免费版配额...');
      
      // 1. 获取免费版套餐
      const planResult = await client.query(
        `SELECT id, plan_code, plan_name FROM subscription_plans WHERE plan_code = 'free' AND is_active = true`
      );
      
      if (planResult.rows.length === 0) {
        throw new Error('免费版套餐不存在或未激活');
      }
      
      const freePlan = planResult.rows[0];
      console.log(`[FreeSubscription] 找到免费版套餐: ${freePlan.plan_name} (ID: ${freePlan.id})`);
      
      // 2. 查找所有没有活跃订阅的用户
      const usersResult = await client.query(`
        SELECT u.id, u.username
        FROM users u
        WHERE NOT EXISTS (
          SELECT 1 FROM user_subscriptions us
          WHERE us.user_id = u.id 
            AND us.status = 'active'
            AND us.end_date > CURRENT_TIMESTAMP
        )
        ORDER BY u.id
      `);
      
      const users = usersResult.rows;
      console.log(`[FreeSubscription] 找到 ${users.length} 个无订阅用户`);
      
      if (users.length === 0) {
        console.log('[FreeSubscription] 没有需要处理的用户');
        return { total: 0, success: 0, failed: 0 };
      }
      
      // 3. 为每个用户开通免费版订阅
      let successCount = 0;
      let failedCount = 0;
      
      for (const user of users) {
        try {
          await client.query('BEGIN');
          
          console.log(`[FreeSubscription] 处理用户: ${user.username} (ID: ${user.id})`);
          
          // 创建订阅
          const startDate = new Date();
          const endDate = new Date();
          endDate.setFullYear(endDate.getFullYear() + 1); // 1年有效期
          
          const subscriptionResult = await client.query(
            `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date, is_gift, gift_reason)
             VALUES ($1, $2, 'active', $3, $4, true, '系统批量赠送免费版')
             RETURNING id`,
            [user.id, freePlan.id, startDate, endDate]
          );
          
          const subscriptionId = subscriptionResult.rows[0].id;
          
          // 使用统一的配额初始化服务（套餐变更，重置配额）
          await QuotaInitializationService.handlePlanChange(user.id, freePlan.id, client);
          
          await client.query('COMMIT');
          
          successCount++;
          console.log(`[FreeSubscription] ✅ 用户 ${user.username} 处理成功 (订阅ID: ${subscriptionId})`);
        } catch (error) {
          await client.query('ROLLBACK');
          failedCount++;
          console.error(`[FreeSubscription] ❌ 用户 ${user.username} 处理失败:`, error);
        }
      }
      
      console.log(`[FreeSubscription] ✅ 批量处理完成: 总计 ${users.length}, 成功 ${successCount}, 失败 ${failedCount}`);
      
      return {
        total: users.length,
        success: successCount,
        failed: failedCount
      };
    } catch (error) {
      console.error('[FreeSubscription] ❌ 批量重置失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const freeSubscriptionService = new FreeSubscriptionService();
