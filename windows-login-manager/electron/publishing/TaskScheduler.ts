import { taskService } from '../services/TaskService';
import { publishingExecutor } from './PublishingExecutor';
import { batchExecutor } from './BatchExecutor';
import { apiClient } from '../api/client';
import { storageManager } from '../storage/manager';

/**
 * 任务调度器
 * 负责检查和执行定时任务（包括批次任务和远程服务器任务）
 * 
 * 改造说明：从服务器迁移到 Windows 端
 * - 使用本地 SQLite 替代 PostgreSQL
 * - 添加离线分析数据上报功能
 * - 接管服务器端定时任务调度
 */
export class TaskScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private analyticsIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkInterval = 10000; // 每10秒检查一次本地任务
  private remoteTaskCheckInterval = 60000; // 每60秒检查一次远程任务
  private remoteTaskIntervalId: NodeJS.Timeout | null = null;
  private analyticsInterval = 60000; // 每分钟上报一次分析数据
  private executingTasks: Set<string> = new Set();
  private currentUserId: number | null = null;

  /**
   * 设置当前用户ID
   */
  setUserId(userId: number): void {
    this.currentUserId = userId;
  }

  /**
   * 启动调度器
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ 任务调度器已在运行');
      return;
    }

    this.isRunning = true;
    console.log('✅ 任务调度器已启动（检查间隔: 10秒）');

    // 立即执行一次检查
    this.checkAndExecuteTasks();
    this.checkAndExecuteRemoteTasks();

    // 定期检查本地任务
    this.intervalId = setInterval(() => {
      this.checkAndExecuteTasks();
    }, this.checkInterval);

    // 定期检查远程任务
    this.remoteTaskIntervalId = setInterval(() => {
      this.checkAndExecuteRemoteTasks();
    }, this.remoteTaskCheckInterval);

    // 定期上报离线分析数据
    this.analyticsIntervalId = setInterval(() => {
      this.flushPendingAnalytics();
    }, this.analyticsInterval);
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.remoteTaskIntervalId) {
      clearInterval(this.remoteTaskIntervalId);
      this.remoteTaskIntervalId = null;
    }
    if (this.analyticsIntervalId) {
      clearInterval(this.analyticsIntervalId);
      this.analyticsIntervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ 任务调度器已停止');
  }

  /**
   * 检查并执行远程服务器任务
   * 迁移自服务器 SchedulerService.ts
   */
  private async checkAndExecuteRemoteTasks(): Promise<void> {
    try {
      // 1. 订单超时关闭任务 (每5分钟)
      await this.executeIntervalTask('order-timeout', 5 * 60 * 1000, '/admin/tasks/order-timeout');

      // 2. 配额预留清理任务 (每分钟)
      await this.executeIntervalTask('quota-reservation-cleanup', 60 * 1000, '/admin/tasks/quota-reservation-cleanup');

      // 3. 分账结果查询任务 (每小时)
      await this.executeIntervalTask('profit-sharing-query', 60 * 60 * 1000, '/admin/tasks/profit-sharing-query');

      // 4. 代理商异常检测任务 (每6小时)
      await this.executeIntervalTask('agent-anomaly-detection', 6 * 60 * 60 * 1000, '/admin/tasks/agent-anomaly-detection');

      // 5. 基于订阅周期的配额重置任务 (每小时)
      await this.executeIntervalTask('quota-reset', 60 * 60 * 1000, '/admin/tasks/quota-reset');

      // 6. 订阅到期检查任务 (每日 00:00)
      await this.executeDailyTask('subscription-expiry', 0, 0, '/admin/tasks/subscription-expiry');

      // 7. 佣金结算任务 (每日 02:00)
      await this.executeDailyTask('commission-settlement', 2, 0, '/admin/tasks/commission-settlement');

      // 8. 同步快照过期清理任务 (每日 03:00)
      await this.executeDailyTask('sync-snapshot-cleanup', 3, 0, '/admin/tasks/sync-snapshot-cleanup');

    } catch (error) {
      console.error('❌ 检查远程任务失败:', error);
    }
  }

  /**
   * 执行间隔性任务
   */
  private async executeIntervalTask(taskName: string, intervalMs: number, endpoint: string): Promise<void> {
    const lastRunTime = storageManager.getTaskLastRunTime(taskName);
    const now = Date.now();

    if (now - lastRunTime >= intervalMs) {
      console.log(`🚀 触发远程任务: ${taskName}`);
      try {
        await apiClient.post(endpoint);
        storageManager.setTaskLastRunTime(taskName, now);
        console.log(`✅ 远程任务执行成功: ${taskName}`);
      } catch (error) {
        console.error(`❌ 远程任务执行失败: ${taskName}`, error);
      }
    }
  }

  /**
   * 执行每日定时任务
   */
  private async executeDailyTask(taskName: string, hour: number, minute: number, endpoint: string): Promise<void> {
    const lastRunTime = storageManager.getTaskLastRunTime(taskName);
    const now = new Date();
    const lastRunDate = new Date(lastRunTime);

    // 检查是否已经是今天
    const isSameDay = now.getFullYear() === lastRunDate.getFullYear() &&
                      now.getMonth() === lastRunDate.getMonth() &&
                      now.getDate() === lastRunDate.getDate();

    // 如果今天已经运行过，跳过
    if (isSameDay) {
      return;
    }

    // 检查是否到达指定时间
    const targetTime = new Date(now);
    targetTime.setHours(hour, minute, 0, 0);

    if (now.getTime() >= targetTime.getTime()) {
      console.log(`🚀 触发远程每日任务: ${taskName}`);
      try {
        await apiClient.post(endpoint);
        storageManager.setTaskLastRunTime(taskName, now.getTime());
        console.log(`✅ 远程每日任务执行成功: ${taskName}`);
      } catch (error) {
        console.error(`❌ 远程每日任务执行失败: ${taskName}`, error);
      }
    }
  }

  /**
   * 上报离线分析数据
   */

  /**
   * 检查并执行到期任务
   */
  private async checkAndExecuteTasks(): Promise<void> {
    if (!this.currentUserId) {
      return;
    }

    try {
      // 1. 检测超时任务
      await this.detectTimeoutTasks();

      // 2. 检查批次任务
      await this.checkAndExecuteBatches();

      // 3. 检查普通定时任务（没有 batch_id 的任务）
      const tasks = taskService.findPendingTasks(this.currentUserId);

      for (const task of tasks) {
        // 跳过批次任务
        if (task.batch_id) {
          continue;
        }

        // 检查是否到达执行时间
        if (task.scheduled_at) {
          const scheduledTime = new Date(task.scheduled_at).getTime();
          if (scheduledTime > Date.now()) {
            continue; // 还没到执行时间
          }
        }

        // 避免重复执行
        if (this.executingTasks.has(task.id)) {
          continue;
        }

        this.executingTasks.add(task.id);
        
        const taskType = task.retry_count > 0 ? '重试' : '新';
        console.log(`▶️ 开始执行${taskType}任务 ${task.id}`);

        // 异步执行任务
        publishingExecutor.executeTask(task.id)
          .finally(() => {
            this.executingTasks.delete(task.id);
          });
      }
    } catch (error) {
      console.error('❌ 检查定时任务失败:', error);
    }
  }

  /**
   * 检查并执行批次任务
   */
  private async checkAndExecuteBatches(): Promise<void> {
    if (!this.currentUserId) return;

    // 如果已经有批次在执行，不启动新的批次
    if (batchExecutor.getExecutingBatches().length > 0) {
      return;
    }

    try {
      // 查找有 pending 任务的批次
      const pendingTasks = taskService.findPendingTasks(this.currentUserId);
      const batchIds = new Set<string>();
      
      for (const task of pendingTasks) {
        if (task.batch_id) {
          batchIds.add(task.batch_id);
        }
      }

      if (batchIds.size > 0) {
        // 只执行第一个批次
        const batchId = Array.from(batchIds)[0];
        console.log(`🚀 开始执行队列中的第一个批次: ${batchId}`);
        
        // 异步执行批次
        batchExecutor.executeBatch(batchId).catch(error => {
          console.error(`批次 ${batchId} 执行失败:`, error);
        });
      }
    } catch (error) {
      console.error('❌ 检查批次失败:', error);
    }
  }

  /**
   * 检测超时任务
   */
  private async detectTimeoutTasks(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const pendingTasks = taskService.findPendingTasks(this.currentUserId);
      const now = Date.now();

      for (const task of pendingTasks) {
        if (task.status !== 'running' || !task.started_at) {
          continue;
        }

        const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
        const timeout = config?.timeout_minutes || 15;
        
        const startedAt = new Date(task.started_at).getTime();
        const elapsedMinutes = (now - startedAt) / 1000 / 60;

        if (elapsedMinutes > timeout) {
          console.log(`⏱️ 检测到超时任务 ${task.id}，已运行 ${elapsedMinutes.toFixed(1)} 分钟`);
          await this.handleTimeoutTask(task.id, task);
        }
      }
    } catch (error) {
      console.error('❌ 检测超时任务失败:', error);
    }
  }

  /**
   * 处理超时任务
   */
  private async handleTimeoutTask(taskId: string, task: any): Promise<void> {
    try {
      taskService.addLog(taskId, 'warn', '任务执行超时，调度器检测到并标记为超时');
      taskService.incrementRetryCount(taskId);

      const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
      const maxRetries = config?.max_retries || 3;
      const nextRetryCount = (task.retry_count || 0) + 1;

      if (nextRetryCount < maxRetries) {
        taskService.updateStatus(taskId, 'pending', `执行超时，将自动重试 (${nextRetryCount}/${maxRetries})`);
        console.log(`🔄 超时任务 ${taskId} 将在下次调度时重试`);
      } else {
        taskService.updateStatus(taskId, 'timeout', '重试次数已用完');
        console.log(`❌ 超时任务 ${taskId} 重试次数已用完，标记为timeout`);
      }
    } catch (error) {
      console.error(`❌ 处理超时任务 ${taskId} 失败:`, error);
    }
  }

  /**
   * 上报离线分析数据
   */
  private async flushPendingAnalytics(): Promise<void> {
    try {
      const pendingReports = taskService.getPendingAnalytics(50);
      
      if (pendingReports.length === 0) {
        return;
      }

      console.log(`📊 上报 ${pendingReports.length} 条离线分析数据...`);

      const reports = pendingReports.map(r => JSON.parse(r.report_data));
      const result = await apiClient.reportPublishBatch(reports);

      if (result.success) {
        // 删除已上报的数据
        const ids = pendingReports.map(r => r.id);
        taskService.deletePendingAnalytics(ids);
        console.log(`✅ 成功上报 ${ids.length} 条分析数据`);
      } else {
        // 增加重试次数
        for (const report of pendingReports) {
          taskService.incrementPendingAnalyticsRetry(report.id);
        }
        console.log(`⚠️ 分析数据上报失败，将在下次重试`);
      }
    } catch (error) {
      console.error('❌ 上报分析数据失败:', error);
    }
  }

  /**
   * 设置检查间隔
   */
  setCheckInterval(milliseconds: number): void {
    this.checkInterval = milliseconds;
    
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * 手动触发任务执行
   */
  async executeTaskNow(taskId: string): Promise<void> {
    if (this.executingTasks.has(taskId)) {
      console.log(`⚠️ 任务 ${taskId} 正在执行中`);
      return;
    }

    this.executingTasks.add(taskId);
    
    try {
      await publishingExecutor.executeTask(taskId);
    } finally {
      this.executingTasks.delete(taskId);
    }
  }

  /**
   * 手动触发批次执行
   */
  async executeBatchNow(batchId: string): Promise<void> {
    await batchExecutor.executeBatch(batchId);
  }

  /**
   * 停止批次
   */
  async stopBatch(batchId: string): Promise<{ cancelledCount: number }> {
    return batchExecutor.stopBatch(batchId);
  }

  /**
   * 删除批次
   */
  async deleteBatch(batchId: string): Promise<{ deletedCount: number }> {
    return batchExecutor.deleteBatch(batchId);
  }
}

export const taskScheduler = new TaskScheduler();
