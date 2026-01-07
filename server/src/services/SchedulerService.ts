import * as cron from 'node-cron';
import { orderService } from './OrderService';
import { subscriptionService } from './SubscriptionService';
import { pool } from '../db/database';

/**
 * 定时任务调度服务
 */
export class SchedulerService {
  private tasks: cron.ScheduledTask[] = [];

  /**
   * 启动所有定时任务
   */
  start() {
    console.log('🕐 启动定时任务调度器...');

    // 1. 订单超时关闭任务（每5分钟执行）
    this.scheduleOrderTimeoutTask();

    // 2. 基于订阅周期的配额重置任务（每小时检查一次）
    this.scheduleSubscriptionBasedQuotaResetTask();

    // 3. 订阅到期检查任务（每天执行）
    this.scheduleSubscriptionExpiryCheckTask();

    console.log('✅ 定时任务调度器已启动');
  }

  /**
   * 停止所有定时任务
   */
  stop() {
    console.log('🛑 停止定时任务调度器...');
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    console.log('✅ 定时任务调度器已停止');
  }

  /**
   * 订单超时关闭任务
   * 每5分钟执行一次，关闭创建超过30分钟的 pending 订单
   */
  private scheduleOrderTimeoutTask() {
    const task = cron.schedule('*/5 * * * *', async () => {
      try {
        console.log('[定时任务] 开始执行订单超时关闭任务...');
        const closedCount = await orderService.closeExpiredOrders();
        if (closedCount > 0) {
          console.log(`[定时任务] 已关闭 ${closedCount} 个超时订单`);
        }
      } catch (error) {
        console.error('[定时任务] 订单超时关闭任务失败:', error);
      }
    });

    this.tasks.push(task);
    console.log('✅ 订单超时关闭任务已安排（每5分钟执行）');
  }

  /**
   * 基于订阅周期的配额重置任务
   * 每小时检查一次，为需要重置配额的用户创建新周期记录
   * 配额重置基于用户的订阅开始时间（quota_reset_anchor），而非固定日历周期
   */
  private scheduleSubscriptionBasedQuotaResetTask() {
    const task = cron.schedule('0 * * * *', async () => {
      try {
        console.log('[定时任务] 开始执行基于订阅周期的配额检查...');
        
        // 查找所有需要进入新配额周期的用户
        // 条件：当前时间已超过用户的当前配额周期结束时间
        const usersNeedingReset = await pool.query(`
          WITH user_periods AS (
            SELECT 
              us.user_id,
              us.quota_reset_anchor,
              us.quota_cycle_type,
              us.end_date as subscription_end,
              (SELECT period_end FROM get_user_quota_period(us.user_id, 'articles_per_month') LIMIT 1) as current_period_end
            FROM user_subscriptions us
            WHERE us.status = 'active'
              AND us.end_date > CURRENT_TIMESTAMP
          )
          SELECT user_id, quota_reset_anchor, quota_cycle_type, subscription_end, current_period_end
          FROM user_periods
          WHERE current_period_end IS NOT NULL
            AND current_period_end < CURRENT_TIMESTAMP
        `);

        if (usersNeedingReset.rows.length === 0) {
          console.log('[定时任务] 没有用户需要配额重置');
          return;
        }

        console.log(`[定时任务] 发现 ${usersNeedingReset.rows.length} 个用户需要进入新配额周期`);

        let resetCount = 0;
        for (const user of usersNeedingReset.rows) {
          try {
            // 获取用户的新配额周期
            const newPeriod = await pool.query(
              `SELECT period_start, period_end FROM get_user_quota_period($1, 'articles_per_month') LIMIT 1`,
              [user.user_id]
            );

            if (newPeriod.rows.length > 0) {
              const { period_start, period_end } = newPeriod.rows[0];
              
              // 为用户的所有月度配额功能创建新周期记录（使用量从0开始）
              // 注意：不删除旧记录，而是创建新周期记录，旧记录用于历史统计
              const monthlyFeatures = ['articles_per_month', 'publish_per_month', 'keyword_distillation'];
              
              for (const featureCode of monthlyFeatures) {
                await pool.query(`
                  INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end, last_reset_at)
                  VALUES ($1, $2, 0, $3, $4, CURRENT_TIMESTAMP)
                  ON CONFLICT (user_id, feature_code, period_start) DO NOTHING
                `, [user.user_id, featureCode, period_start, period_end]);
              }
              
              resetCount++;
              console.log(`[定时任务] 用户 ${user.user_id} 已进入新配额周期: ${period_start} - ${period_end}`);
            }
          } catch (userError) {
            console.error(`[定时任务] 处理用户 ${user.user_id} 配额重置失败:`, userError);
          }
        }

        console.log(`[定时任务] 配额周期检查完成，${resetCount} 个用户已进入新周期`);

        // 清理超过3个周期的旧配额记录（保留历史数据但不无限增长）
        const cleanupResult = await pool.query(`
          WITH ranked_periods AS (
            SELECT 
              id,
              user_id,
              feature_code,
              period_start,
              ROW_NUMBER() OVER (PARTITION BY user_id, feature_code ORDER BY period_start DESC) as rn
            FROM user_usage
          )
          DELETE FROM user_usage
          WHERE id IN (
            SELECT id FROM ranked_periods WHERE rn > 3
          )
        `);

        if (cleanupResult.rowCount && cleanupResult.rowCount > 0) {
          console.log(`[定时任务] 已清理 ${cleanupResult.rowCount} 条过期配额记录`);
        }
      } catch (error) {
        console.error('[定时任务] 基于订阅周期的配额检查失败:', error);
      }
    });

    this.tasks.push(task);
    console.log('✅ 基于订阅周期的配额重置任务已安排（每小时检查一次）');
  }

  /**
   * 订阅到期检查任务
   * 每天执行，检查即将到期的订阅（7天内）并发送提醒
   */
  private scheduleSubscriptionExpiryCheckTask() {
    const task = cron.schedule('0 9 * * *', async () => {
      try {
        console.log('[定时任务] 开始执行订阅到期检查任务...');
        
        // 查找7天内到期的订阅
        const expiringSubscriptions = await pool.query(`
          SELECT 
            us.id,
            us.user_id,
            us.end_date,
            sp.plan_name,
            u.username,
            u.email
          FROM user_subscriptions us
          JOIN subscription_plans sp ON us.plan_id = sp.id
          JOIN users u ON us.user_id = u.id
          WHERE us.status = 'active'
          AND us.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
          AND us.auto_renew = false
        `);

        console.log(`[定时任务] 发现 ${expiringSubscriptions.rows.length} 个即将到期的订阅`);

        // 发送续费提醒
        for (const sub of expiringSubscriptions.rows) {
          const daysLeft = Math.ceil(
            (new Date(sub.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );
          
          console.log(`[定时任务] 提醒用户 ${sub.username}：${sub.plan_name} 还有 ${daysLeft} 天到期`);
          
          // TODO: 发送邮件通知
          // TODO: 发送站内消息
          // TODO: WebSocket 推送通知
        }

        // 自动降级已到期的订阅
        const expiredResult = await pool.query(`
          UPDATE user_subscriptions 
          SET status = 'expired', updated_at = CURRENT_TIMESTAMP
          WHERE status = 'active'
          AND end_date < CURRENT_DATE
          RETURNING id, user_id
        `);

        if (expiredResult.rowCount && expiredResult.rowCount > 0) {
          console.log(`[定时任务] 已自动降级 ${expiredResult.rowCount} 个到期订阅`);
        }
      } catch (error) {
        console.error('[定时任务] 订阅到期检查任务失败:', error);
      }
    });

    this.tasks.push(task);
    console.log('✅ 订阅到期检查任务已安排（每天09:00执行）');
  }
}

export const schedulerService = new SchedulerService();
