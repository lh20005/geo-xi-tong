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

    // 2. 每日配额重置任务（每天00:00执行）
    this.scheduleDailyQuotaResetTask();

    // 3. 每月配额重置任务（每月1日00:00执行）
    this.scheduleMonthlyQuotaResetTask();

    // 4. 订阅到期检查任务（每天执行）
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
   * 每日配额重置任务
   * 每天00:00执行，重置 articles_per_day 和 publish_per_day
   */
  private scheduleDailyQuotaResetTask() {
    const task = cron.schedule('0 0 * * *', async () => {
      try {
        console.log('[定时任务] 开始执行每日配额重置任务...');
        
        // 重置每日配额
        const result = await pool.query(`
          DELETE FROM user_usage 
          WHERE feature_code IN ('articles_per_day', 'publish_per_day')
          AND period_start < CURRENT_DATE
        `);

        console.log(`[定时任务] 已重置 ${result.rowCount} 条每日配额记录`);
      } catch (error) {
        console.error('[定时任务] 每日配额重置任务失败:', error);
      }
    });

    this.tasks.push(task);
    console.log('✅ 每日配额重置任务已安排（每天00:00执行）');
  }

  /**
   * 每月配额重置任务
   * 每月1日00:00执行，重置 keyword_distillation
   */
  private scheduleMonthlyQuotaResetTask() {
    const task = cron.schedule('0 0 1 * *', async () => {
      try {
        console.log('[定时任务] 开始执行每月配额重置任务...');
        
        // 重置每月配额
        const result = await pool.query(`
          DELETE FROM user_usage 
          WHERE feature_code = 'keyword_distillation'
          AND period_start < DATE_TRUNC('month', CURRENT_DATE)
        `);

        console.log(`[定时任务] 已重置 ${result.rowCount} 条每月配额记录`);
      } catch (error) {
        console.error('[定时任务] 每月配额重置任务失败:', error);
      }
    });

    this.tasks.push(task);
    console.log('✅ 每月配额重置任务已安排（每月1日00:00执行）');
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
