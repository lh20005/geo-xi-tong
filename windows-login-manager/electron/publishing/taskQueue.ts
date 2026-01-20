/**
 * 任务队列
 * 本地发布模块 - 负责检查和执行定时任务（包括批次任务）
 */

import { BrowserWindow } from 'electron';
import { publishingExecutor } from './executor';
import { batchExecutor } from './batchExecutor';
import { apiClient } from '../api/client';
import { LocalTask, QueueStatusEvent } from './types';

/**
 * 任务队列
 * 负责检查和执行定时任务（包括批次任务）
 */
export class TaskQueue {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkInterval = 10000; // 每10秒检查一次
  private executingTasks: Set<number> = new Set();
  private mainWindow: BrowserWindow | null = null;

  /**
   * 设置主窗口（用于发送 IPC 消息）
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
    batchExecutor.setMainWindow(window);
  }

  /**
   * 发送队列状态到渲染进程
   */
  private sendQueueStatus(): void {
    const status: QueueStatusEvent = {
      isRunning: this.isRunning,
      executingBatches: batchExecutor.getExecutingBatches()
    };

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('publishing:queue-status', status);
    }
  }

  /**
   * 启动队列
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️  任务队列已在运行');
      return;
    }

    this.isRunning = true;
    console.log('✅ 任务队列已启动（检查间隔: 10秒）');
    this.sendQueueStatus();

    // 立即执行一次检查
    this.checkAndExecuteTasks();

    // 定期检查
    this.intervalId = setInterval(() => {
      this.checkAndExecuteTasks();
    }, this.checkInterval);
  }

  /**
   * 停止队列
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️  任务队列已停止');
    this.sendQueueStatus();
  }

  /**
   * 获取队列状态
   */
  getStatus(): QueueStatusEvent {
    return {
      isRunning: this.isRunning,
      executingBatches: batchExecutor.getExecutingBatches()
    };
  }

  /**
   * 检测并处理超时任务
   */
  private async detectTimeoutTasks(): Promise<void> {
    try {
      // 从服务器获取所有 running 状态的任务
      const response = await apiClient.get('/publishing/tasks', {
        params: { status: 'running' }
      });

      if (!response.data?.success || !response.data?.data?.tasks) {
        return;
      }

      const tasks = response.data.data.tasks as LocalTask[];
      const now = Date.now();

      for (const task of tasks) {
        if (!task.started_at) continue;

        // 获取超时配置（默认15分钟）
        const timeout = task.config?.timeout_minutes || 15;
        
        // 计算已运行时间
        const startedAt = new Date(task.started_at).getTime();
        const elapsedMinutes = (now - startedAt) / 1000 / 60;

        // 检查是否超时
        if (elapsedMinutes > timeout) {
          console.log(`⏱️  检测到超时任务 #${task.id}，已运行 ${elapsedMinutes.toFixed(1)} 分钟（超时限制: ${timeout} 分钟）`);
          await this.handleTimeoutTask(task.id);
        }
      }
    } catch (error) {
      console.error('❌ 检测超时任务失败:', error);
    }
  }

  /**
   * 处理超时任务
   */
  private async handleTimeoutTask(taskId: number): Promise<void> {
    try {
      // 记录日志
      await apiClient.post(`/publishing/tasks/${taskId}/logs`, {
        level: 'warning',
        message: '任务执行超时，调度器检测到并标记为超时'
      });

      // 增加重试次数
      await apiClient.post(`/publishing/tasks/${taskId}/increment-retry`);

      // 获取任务信息
      const response = await apiClient.get(`/publishing/tasks/${taskId}`);
      if (!response.data?.success || !response.data?.data) {
        console.error(`❌ 任务 #${taskId} 不存在`);
        return;
      }

      const task = response.data.data as LocalTask;
      const nextRetryCount = task.retry_count + 1;

      if (nextRetryCount < task.max_retries) {
        // 还可以重试，标记为pending
        await apiClient.put(`/publishing/tasks/${taskId}/status`, {
          status: 'pending',
          error_message: `执行超时，将自动重试 (${nextRetryCount}/${task.max_retries})`
        });
        console.log(`🔄 超时任务 #${taskId} 将在下次调度时重试 (${nextRetryCount}/${task.max_retries})`);
      } else {
        // 重试次数已用完，标记为timeout
        await apiClient.put(`/publishing/tasks/${taskId}/status`, {
          status: 'timeout',
          error_message: '重试次数已用完'
        });
        console.log(`❌ 超时任务 #${taskId} 重试次数已用完，标记为timeout`);
      }
    } catch (error) {
      console.error(`❌ 处理超时任务 #${taskId} 失败:`, error);
    }
  }

  /**
   * 检查并执行待处理的批次
   */
  private async checkAndExecuteBatches(): Promise<void> {
    try {
      // 如果已经有批次在执行，不启动新的批次
      if (batchExecutor.isExecuting()) {
        return;
      }
      
      // 从服务器获取待执行的批次
      const response = await apiClient.get('/publishing/tasks', {
        params: { status: 'pending' }
      });

      if (!response.data?.success || !response.data?.data?.tasks) {
        return;
      }

      const tasks = response.data.data.tasks as LocalTask[];
      
      // 找出所有有 batch_id 的任务，按批次分组
      const batchIds = new Set<string>();
      for (const task of tasks) {
        if (task.batch_id) {
          batchIds.add(task.batch_id);
        }
      }

      if (batchIds.size > 0) {
        // 只执行第一个批次（队列模式）
        const batchId = Array.from(batchIds)[0];
        
        console.log(`🚀 开始执行队列中的第一个批次: ${batchId}`);
        if (batchIds.size > 1) {
          console.log(`📋 剩余 ${batchIds.size - 1} 个批次在队列中等待`);
        }
        
        // 异步执行批次
        batchExecutor.executeBatch(batchId).catch(error => {
          console.error(`批次 ${batchId} 执行失败:`, error);
        });
        
        this.sendQueueStatus();
      }
    } catch (error) {
      console.error('❌ 检查批次失败:', error);
    }
  }

  /**
   * 检查并执行到期任务
   */
  private async checkAndExecuteTasks(): Promise<void> {
    try {
      // 0. 检测超时任务（最优先）
      await this.detectTimeoutTasks();

      // 1. 检查批次任务
      await this.checkAndExecuteBatches();

      // 2. 检查普通定时任务（没有 batch_id 的任务）
      const response = await apiClient.get('/publishing/tasks', {
        params: { status: 'pending' }
      });

      if (!response.data?.success || !response.data?.data?.tasks) {
        return;
      }

      const tasks = response.data.data.tasks as LocalTask[];
      
      // 过滤出非批次任务且已到执行时间的任务
      const now = new Date();
      const pendingTasks = tasks.filter(task => {
        // 跳过批次任务
        if (task.batch_id) return false;
        
        // 检查是否已到执行时间
        if (task.scheduled_at) {
          const scheduledTime = new Date(task.scheduled_at);
          return scheduledTime <= now;
        }
        
        // 没有定时时间的任务立即执行
        return true;
      });

      if (pendingTasks.length > 0) {
        // 统计重试任务和新任务
        const retryTasks = pendingTasks.filter(t => t.retry_count > 0);
        const newTasks = pendingTasks.filter(t => t.retry_count === 0);
        
        if (retryTasks.length > 0) {
          console.log(`🔄 发现 ${retryTasks.length} 个重试任务`);
        }
        if (newTasks.length > 0) {
          console.log(`📋 发现 ${newTasks.length} 个新任务`);
        }

        for (const task of pendingTasks) {
          // 避免重复执行
          if (this.executingTasks.has(task.id)) {
            continue;
          }

          this.executingTasks.add(task.id);
          
          const taskType = task.retry_count > 0 ? '重试' : '新';
          console.log(`▶️  开始执行${taskType}任务 #${task.id} (重试次数: ${task.retry_count}/${task.max_retries})`);

          // 异步执行任务，不阻塞其他任务
          publishingExecutor.executeTask(task.id)
            .finally(() => {
              this.executingTasks.delete(task.id);
            });
        }
      }
    } catch (error) {
      console.error('❌ 检查定时任务失败:', error);
    }
  }

  /**
   * 手动触发执行单个任务
   */
  async executeTask(taskId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // 检查任务是否已在执行
      if (this.executingTasks.has(taskId)) {
        return { success: false, error: '任务正在执行中' };
      }

      this.executingTasks.add(taskId);
      
      // 异步执行任务
      publishingExecutor.executeTask(taskId)
        .finally(() => {
          this.executingTasks.delete(taskId);
        });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 手动触发执行批次
   */
  async executeBatch(batchId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 检查是否有批次正在执行
      if (batchExecutor.isExecuting()) {
        const executing = batchExecutor.getExecutingBatches();
        return { 
          success: false, 
          error: `有批次正在执行中: ${executing.join(', ')}` 
        };
      }

      // 异步执行批次
      batchExecutor.executeBatch(batchId).catch(error => {
        console.error(`批次 ${batchId} 执行失败:`, error);
      });

      this.sendQueueStatus();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 停止任务
   */
  async stopTask(taskId: number): Promise<{ success: boolean }> {
    try {
      await publishingExecutor.stopTask(taskId);
      this.executingTasks.delete(taskId);
      return { success: true };
    } catch (error) {
      console.error(`停止任务失败:`, error);
      return { success: false };
    }
  }

  /**
   * 停止批次
   */
  async stopBatch(batchId: string): Promise<{ success: boolean }> {
    try {
      await batchExecutor.stopBatch(batchId);
      this.sendQueueStatus();
      return { success: true };
    } catch (error) {
      console.error(`停止批次失败:`, error);
      return { success: false };
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
}

// 导出单例
export const taskQueue = new TaskQueue();
