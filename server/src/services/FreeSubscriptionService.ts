import { pool } from '../db/database';
import { subscriptionService } from './SubscriptionService';

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
      
      // 4. 初始化用户配额
      await this.initializeFreeQuotas(client, userId, freePlan.id);
      
      // 5. 初始化存储空间
      await this.initializeStorage(client, userId, freePlan.id);
      
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
          
          // 清除旧的配额记录
          await client.query('DELETE FROM user_usage WHERE user_id = $1', [user.id]);
          
          // 初始化配额
          await this.initializeFreeQuotas(client, user.id, freePlan.id);
          
          // 初始化存储空间
          await this.initializeStorage(client, user.id, freePlan.id);
          
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
  
  /**
   * 初始化免费版配额
   */
  private async initializeFreeQuotas(client: any, userId: number, planId: number): Promise<void> {
    console.log(`[FreeSubscription] 初始化用户 ${userId} 的配额...`);
    
    // 获取套餐的所有功能配额
    const featuresResult = await client.query(
      `SELECT feature_code, feature_name, feature_value, feature_unit
       FROM plan_features
       WHERE plan_id = $1`,
      [planId]
    );
    
    if (featuresResult.rows.length === 0) {
      console.log(`[FreeSubscription] ⚠️ 套餐 ${planId} 没有配置功能，跳过配额初始化`);
      return;
    }
    
    const now = new Date();
    let initializedCount = 0;
    
    for (const feature of featuresResult.rows) {
      // 确定周期
      let periodStart: Date;
      let periodEnd: Date;
      
      if (feature.feature_code.includes('_per_month')) {
        // 每月重置
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else if (feature.feature_code === 'keyword_distillation') {
        // 每月重置
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else {
        // 永不重置（如平台账号数）
        periodStart = new Date(2000, 0, 1);
        periodEnd = new Date(2099, 11, 31);
      }
      
      // 插入初始配额记录
      await client.query(
        `INSERT INTO user_usage (
          user_id, feature_code, usage_count, period_start, period_end, last_reset_at
        ) VALUES ($1, $2, 0, $3, $4, $5)
        ON CONFLICT (user_id, feature_code, period_start) 
        DO UPDATE SET 
          usage_count = 0,
          last_reset_at = $5,
          updated_at = CURRENT_TIMESTAMP`,
        [userId, feature.feature_code, periodStart, periodEnd, periodStart]
      );
      
      initializedCount++;
    }
    
    console.log(`[FreeSubscription] ✅ 成功初始化 ${initializedCount} 项配额记录`);
  }
  
  /**
   * 初始化存储空间
   */
  private async initializeStorage(client: any, userId: number, planId: number): Promise<void> {
    console.log(`[FreeSubscription] 初始化用户 ${userId} 的存储空间...`);
    
    // 从数据库获取存储空间配额（而不是硬编码）
    const storageFeatureResult = await client.query(
      `SELECT feature_value FROM plan_features 
       WHERE plan_id = $1 AND feature_code = 'storage_space'`,
      [planId]
    );
    
    let storageQuotaBytes: number;
    
    if (storageFeatureResult.rows.length > 0) {
      // 配额单位是 MB，需要转换为字节
      const storageMB = storageFeatureResult.rows[0].feature_value;
      storageQuotaBytes = storageMB * 1024 * 1024;
      console.log(`[FreeSubscription] 从数据库读取存储配额: ${storageMB} MB (${storageQuotaBytes} bytes)`);
    } else {
      // 如果没有配置，使用默认值 10MB
      storageQuotaBytes = 10 * 1024 * 1024;
      console.log(`[FreeSubscription] ⚠️ 未找到存储配额配置，使用默认值: 10 MB`);
    }
    
    // 检查是否已有存储记录
    const existingStorageResult = await client.query(
      `SELECT id FROM user_storage_usage WHERE user_id = $1`,
      [userId]
    );
    
    if (existingStorageResult.rows.length > 0) {
      // 更新存储配额（使用 last_updated_at 而不是 updated_at）
      await client.query(
        `UPDATE user_storage_usage 
         SET storage_quota_bytes = $1, last_updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [storageQuotaBytes, userId]
      );
      console.log(`[FreeSubscription] ✅ 更新存储配额为 ${storageQuotaBytes} bytes`);
    } else {
      // 创建存储记录
      await client.query(
        `INSERT INTO user_storage_usage (
          user_id, 
          image_storage_bytes,
          document_storage_bytes,
          article_storage_bytes,
          storage_quota_bytes,
          purchased_storage_bytes
        ) VALUES ($1, 0, 0, 0, $2, 0)`,
        [userId, storageQuotaBytes]
      );
      console.log(`[FreeSubscription] ✅ 创建存储记录，配额 ${storageQuotaBytes} bytes (${storageQuotaBytes / (1024 * 1024)} MB)`);
    }
  }
}

export const freeSubscriptionService = new FreeSubscriptionService();
