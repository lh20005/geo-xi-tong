import { taskService } from '../services/TaskService';
import { publishingExecutor } from './PublishingExecutor';
import { batchExecutor } from './BatchExecutor';
import { apiClient } from '../api/client';

/**
 * 任务调度器
 * 负责检查和执行定时任务（包括批次任务）
 * 
 * 改造说明：从服务器迁移到 Windows 端
 * - 使用本地 SQLite 替代 PostgreSQL
 * - 添加离线分析数据上报功能
 */
export class TaskScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private analyticsIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkInterval = 10000; // 每10秒检查一次
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

    // 定期检查任务
    this.intervalId = setInterval(() => {
      this.checkAndExecuteTasks();
    }, this.checkInterval);

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
    if (this.analyticsIntervalId) {
      clearInterval(this.analyticsIntervalId);
      this.analyticsIntervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ 任务调度器已停止');
  }

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
