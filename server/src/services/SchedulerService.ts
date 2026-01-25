import * as cron from 'node-cron';
import { orderService } from './OrderService';
import { subscriptionService } from './SubscriptionService';
import { pool } from '../db/database';
import { commissionService } from './CommissionService';
import { profitSharingService } from './ProfitSharingService';
import { agentService } from './AgentService';
import { monitoringService } from './MonitoringService';

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

    // 4. 佣金结算任务（每天凌晨2点执行 T+1 结算）
    this.scheduleCommissionSettlementTask();

    // 5. 分账结果查询任务（每小时执行）
    this.scheduleProfitSharingQueryTask();

    // 6. 代理商异常检测任务（每6小时执行）
    this.scheduleAgentAnomalyDetectionTask();

    // 7. 佣金结算异常监控任务（每30分钟执行）
    this.scheduleCommissionAnomalyCheckTask();

    // 8. 服务事件清理任务（每天凌晨4点执行）
    this.scheduleServiceEventCleanupTask();

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
      const taskName = '订单超时关闭任务';
      await monitoringService.recordTaskStart(taskName);
      
      try {
        console.log('[定时任务] 开始执行订单超时关闭任务...');
        const closedCount = await orderService.closeExpiredOrders();
        if (closedCount > 0) {
          console.log(`[定时任务] 已关闭 ${closedCount} 个超时订单`);
          await monitoringService.recordTaskComplete(taskName, `关闭 ${closedCount} 个超时订单`);
        } else {
          await monitoringService.recordTaskComplete(taskName, '无超时订单');
        }
      } catch (error: any) {
        console.error('[定时任务] 订单超时关闭任务失败:', error);
        await monitoringService.recordTaskError(taskName, error);
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
      const taskName = '配额重置任务';
      await monitoringService.recordTaskStart(taskName);
      
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
          await monitoringService.recordTaskComplete(taskName, '无需重置');
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
        
        await monitoringService.recordTaskComplete(taskName, `重置 ${resetCount} 个用户`);
      } catch (error: any) {
        console.error('[定时任务] 基于订阅周期的配额检查失败:', error);
        await monitoringService.recordTaskError(taskName, error);
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
      const taskName = '订阅到期检查任务';
      await monitoringService.recordTaskStart(taskName);
      
      try {
        console.log('[定时任务] 开始执行订阅到期检查任务...');
        
        // 查找7天内到期的订阅（排除永久有效的订阅，即 duration_days >= 36500）
        const expiringSubscriptions = await pool.query(`
          SELECT 
            us.id,
            us.user_id,
            us.end_date,
            sp.plan_name,
            sp.duration_days,
            u.username,
            u.email
          FROM user_subscriptions us
          JOIN subscription_plans sp ON us.plan_id = sp.id
          JOIN users u ON us.user_id = u.id
          WHERE us.status = 'active'
          AND us.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
          AND us.auto_renew = false
          AND sp.duration_days < 36500
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

        // 自动降级已到期的订阅（排除永久有效的订阅）
        const expiredResult = await pool.query(`
          UPDATE user_subscriptions us
          SET status = 'expired', updated_at = CURRENT_TIMESTAMP
          FROM subscription_plans sp
          WHERE us.plan_id = sp.id
          AND us.status = 'active'
          AND us.end_date < CURRENT_DATE
          AND sp.duration_days < 36500
          RETURNING us.id, us.user_id
        `);

        if (expiredResult.rowCount && expiredResult.rowCount > 0) {
          console.log(`[定时任务] 已自动降级 ${expiredResult.rowCount} 个到期订阅`);
        }
        
        await monitoringService.recordTaskComplete(taskName, `即将到期 ${expiringSubscriptions.rows.length} 个，已降级 ${expiredResult.rowCount || 0} 个`);
      } catch (error: any) {
        console.error('[定时任务] 订阅到期检查任务失败:', error);
        await monitoringService.recordTaskError(taskName, error);
      }
    });

    this.tasks.push(task);
    console.log('✅ 订阅到期检查任务已安排（每天09:00执行）');
  }

  /**
   * 佣金结算任务（T+1）
   * 每天凌晨2点执行，处理前一天的待结算佣金
   */
  private scheduleCommissionSettlementTask() {
    const task = cron.schedule('0 2 * * *', async () => {
      const taskName = '佣金结算任务';
      await monitoringService.recordTaskStart(taskName);
      
      try {
        console.log('[定时任务] 开始执行佣金结算任务...');
        
        // 获取待结算的佣金（结算日期 <= 今天）
        const pendingCommissions = await commissionService.getPendingCommissions();
        
        if (pendingCommissions.length === 0) {
          console.log('[定时任务] 没有待结算的佣金');
          await monitoringService.recordTaskComplete(taskName, '没有待结算佣金');
          return;
        }

        console.log(`[定时任务] 发现 ${pendingCommissions.length} 笔待结算佣金`);
        monitoringService.recordCommissionSettlementStart(pendingCommissions.length);

        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;

        for (const commission of pendingCommissions) {
          try {
            // 获取代理商信息
            const agent = await agentService.getAgentById(commission.agentId);
            if (!agent || !agent.wechatOpenid || !agent.receiverAdded) {
              console.log(`[定时任务] 佣金 ${commission.id} 跳过：代理商未绑定微信或未添加为接收方`);
              skippedCount++;
              continue;
            }

            if (agent.status !== 'active') {
              console.log(`[定时任务] 佣金 ${commission.id} 跳过：代理商已暂停`);
              skippedCount++;
              continue;
            }

            // 获取订单的微信支付交易号
            const orderResult = await pool.query(
              'SELECT transaction_id, amount FROM orders WHERE id = $1',
              [commission.orderId]
            );
            
            const transactionId = orderResult.rows[0]?.transaction_id;
            const orderAmount = orderResult.rows[0]?.amount;
            if (!transactionId) {
              console.log(`[定时任务] 佣金 ${commission.id} 跳过：订单无交易号`);
              await commissionService.updateCommissionStatus(commission.id, 'cancelled', '订单无微信交易号');
              await monitoringService.recordProfitSharingError(commission.id, '订单无微信交易号', {
                orderId: commission.orderId
              });
              failCount++;
              continue;
            }

            // 检查分账限额
            const amountInFen = Math.round(commission.commissionAmount * 100);
            const orderAmountInFen = Math.round(orderAmount * 100);
            const limitCheck = await profitSharingService.checkProfitSharingLimits(amountInFen, orderAmountInFen);
            if (!limitCheck.allowed) {
              console.log(`[定时任务] 佣金 ${commission.id} 跳过：${limitCheck.reason}`);
              // 不取消，等待下次结算
              skippedCount++;
              continue;
            }

            // 执行分账
            const result = await profitSharingService.requestProfitSharing(
              transactionId,
              agent.wechatOpenid,
              amountInFen,
              '代理商佣金',
              commission.id
            );

            if (result.success) {
              // 分账请求成功，等待查询结果
              console.log(`[定时任务] 佣金 ${commission.id} 分账请求成功: ${result.outOrderNo}`);
              successCount++;
            } else {
              // 分账请求失败
              await commissionService.updateCommissionStatus(commission.id, 'cancelled', result.message);
              await monitoringService.recordProfitSharingError(commission.id, result.message || '分账请求失败', {
                transactionId,
                outOrderNo: result.outOrderNo
              });
              console.log(`[定时任务] 佣金 ${commission.id} 分账请求失败: ${result.message}`);
              failCount++;
            }
          } catch (error: any) {
            console.error(`[定时任务] 处理佣金 ${commission.id} 失败:`, error);
            await commissionService.updateCommissionStatus(commission.id, 'cancelled', error.message);
            await monitoringService.recordProfitSharingError(commission.id, error.message, {
              stack: error.stack
            });
            failCount++;
          }
        }

        console.log(`[定时任务] 佣金结算完成: 成功 ${successCount}, 失败 ${failCount}, 跳过 ${skippedCount}`);
        await monitoringService.recordCommissionSettlementComplete(successCount, failCount, skippedCount);
        await monitoringService.recordTaskComplete(taskName, `成功 ${successCount}, 失败 ${failCount}, 跳过 ${skippedCount}`);
      } catch (error: any) {
        console.error('[定时任务] 佣金结算任务失败:', error);
        await monitoringService.recordTaskError(taskName, error);
      }
    });

    this.tasks.push(task);
    console.log('✅ 佣金结算任务已安排（每天02:00执行）');
  }

  /**
   * 分账结果查询任务
   * 每小时执行，查询处理中的分账单状态
   */
  private scheduleProfitSharingQueryTask() {
    const task = cron.schedule('30 * * * *', async () => {
      const taskName = '分账结果查询任务';
      await monitoringService.recordTaskStart(taskName);
      
      try {
        console.log('[定时任务] 开始查询分账结果...');
        
        // 先标记超时的记录为失败
        const timeoutCount = await profitSharingService.markTimeoutRecordsAsFailed();
        if (timeoutCount > 0) {
          console.log(`[定时任务] 已标记 ${timeoutCount} 条超时分账记录为失败`);
        }
        
        // 获取处理中的分账记录
        const pendingRecords = await profitSharingService.getPendingProfitSharingRecords();
        
        if (pendingRecords.length === 0) {
          console.log('[定时任务] 没有待查询的分账记录');
          await monitoringService.recordTaskComplete(taskName, '无待查询记录');
          return;
        }

        console.log(`[定时任务] 发现 ${pendingRecords.length} 条待查询分账记录`);

        let successCount = 0;
        let failCount = 0;
        let processingCount = 0;

        for (const record of pendingRecords) {
          try {
            const result = await profitSharingService.queryProfitSharing(
              record.outOrderNo,
              record.transactionId
            );

            if (result.status === 'success') {
              // 分账成功，更新佣金状态
              await profitSharingService.updateProfitSharingRecord(
                record.outOrderNo,
                'success',
                result.wechatOrderId
              );
              await commissionService.updateCommissionStatus(record.commissionId, 'settled');
              console.log(`[定时任务] 分账 ${record.outOrderNo} 成功`);
              successCount++;
            } else if (result.status === 'failed') {
              // 分账失败
              await profitSharingService.updateProfitSharingRecord(
                record.outOrderNo,
                'failed',
                undefined,
                result.failReason
              );
              await commissionService.updateCommissionStatus(record.commissionId, 'cancelled', result.failReason);
              console.log(`[定时任务] 分账 ${record.outOrderNo} 失败: ${result.failReason}`);
              failCount++;
            } else {
              // processing 状态，增加重试次数
              await profitSharingService.incrementRetryCount(record.outOrderNo);
              console.log(`[定时任务] 分账 ${record.outOrderNo} 仍在处理中 (重试 ${record.retryCount + 1})`);
              processingCount++;
            }
          } catch (error: any) {
            console.error(`[定时任务] 查询分账 ${record.outOrderNo} 失败:`, error);
            // 查询出错也增加重试次数
            await profitSharingService.incrementRetryCount(record.outOrderNo);
          }
        }

        console.log('[定时任务] 分账结果查询完成');
        await monitoringService.recordTaskComplete(taskName, `成功 ${successCount}, 失败 ${failCount}, 处理中 ${processingCount}`);
      } catch (error: any) {
        console.error('[定时任务] 分账结果查询任务失败:', error);
        await monitoringService.recordTaskError(taskName, error);
      }
    });

    this.tasks.push(task);
    console.log('✅ 分账结果查询任务已安排（每小时30分执行）');
  }

  /**
   * 代理商异常检测任务
   * 每6小时执行，检测异常分账行为并自动暂停
   */
  private scheduleAgentAnomalyDetectionTask() {
    const task = cron.schedule('0 */6 * * *', async () => {
      const taskName = '代理商异常检测任务';
      await monitoringService.recordTaskStart(taskName);
      
      try {
        console.log('[定时任务] 开始执行代理商异常检测...');
        
        const suspendedCount = await agentService.suspendAnomalousAgents();
        
        if (suspendedCount > 0) {
          console.log(`[定时任务] 已自动暂停 ${suspendedCount} 个异常代理商`);
        } else {
          console.log('[定时任务] 未发现异常代理商');
        }
        
        await monitoringService.recordTaskComplete(taskName, `暂停 ${suspendedCount} 个异常代理商`);
      } catch (error: any) {
        console.error('[定时任务] 代理商异常检测任务失败:', error);
        await monitoringService.recordTaskError(taskName, error);
      }
    });

    this.tasks.push(task);
    console.log('✅ 代理商异常检测任务已安排（每6小时执行）');
  }

  /**
   * 佣金结算异常监控任务
   * 每30分钟执行，检查是否有异常情况需要告警
   */
  private scheduleCommissionAnomalyCheckTask() {
    const task = cron.schedule('*/30 * * * *', async () => {
      const taskName = '佣金结算异常监控任务';
      await monitoringService.recordTaskStart(taskName);
      
      try {
        const result = await monitoringService.checkCommissionAnomalies();
        
        if (result.hasAnomalies) {
          console.warn('[监控] 检测到佣金结算异常:');
          result.anomalies.forEach(anomaly => {
            console.warn(`  - ${anomaly}`);
          });
          await monitoringService.recordTaskComplete(taskName, `发现 ${result.anomalies.length} 个异常`);
        } else {
          await monitoringService.recordTaskComplete(taskName, '无异常');
        }
      } catch (error: any) {
        console.error('[监控] 佣金异常检查失败:', error);
        await monitoringService.recordTaskError(taskName, error);
      }
    });

    this.tasks.push(task);
    console.log('✅ 佣金结算异常监控任务已安排（每30分钟执行）');
  }

  /**
   * 服务事件清理任务
   * 每天凌晨4点执行，清理超过30天的服务事件记录
   */
  private scheduleServiceEventCleanupTask() {
    const task = cron.schedule('0 4 * * *', async () => {
      const taskName = '服务事件清理任务';
      await monitoringService.recordTaskStart(taskName);
      
      try {
        console.log('[定时任务] 开始清理过期服务事件...');
        
        const result = await pool.query('SELECT cleanup_old_service_events()');
        const deletedCount = result.rows[0]?.cleanup_old_service_events || 0;
        
        if (deletedCount > 0) {
          console.log(`[定时任务] 已清理 ${deletedCount} 条过期服务事件`);
        }
        
        await monitoringService.recordTaskComplete(taskName, `清理 ${deletedCount} 条记录`);
      } catch (error: any) {
        console.error('[定时任务] 服务事件清理失败:', error);
        await monitoringService.recordTaskError(taskName, error);
      }
    });

    this.tasks.push(task);
    console.log('✅ 服务事件清理任务已安排（每天04:00执行）');
  }
}

export const schedulerService = new SchedulerService();
