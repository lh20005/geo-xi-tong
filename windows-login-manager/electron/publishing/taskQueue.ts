/**
 * 任务队列管理器 (重构版)
 * 
 * 核心职责：管理任务调度，提供统一的任务执行入口
 * 设计原则：
 * 1. 简化调度 - 不再使用轮询，改为事件驱动
 * 2. 统一入口 - 所有任务执行都通过此模块
 * 3. 状态同步 - 与渲染进程保持状态同步
 */

import { BrowserWindow } from 'electron';
import { publishingExecutor } from './executor';
import { batchExecutor } from './batchExecutor';
import { apiClient } from '../api/client';
import { storageManager } from '../storage/manager';
import { LocalTask, QueueStatusEvent } from './types';

export class TaskQueue {
  private mainWindow: BrowserWindow | null = null;
  private isRunning = false;
  private checkTimer: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 30000; // 30秒检查一次待处理批次

  /**
   * 设置主窗口
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
    batchExecutor.setMainWindow(window);
    publishingExecutor.setMainWindow(window);
  }

  /**
   * 发送状态到渲染进程
   */
  private sendStatus(): void {
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
      console.log('⚠️ 任务队列已在运行');
      return;
    }

    this.isRunning = true;
    console.log('✅ 任务队列已启动');
    this.sendStatus();

    // 启动定期检查（用于自动执行待处理批次）
    this.startPeriodicCheck();
  }

  /**
   * 停止队列
   */
  stop(): void {
    this.isRunning = false;
    this.stopPeriodicCheck();
    console.log('⏹️ 任务队列已停止');
    this.sendStatus();
  }

  /**
   * 启动定期检查
   */
  private startPeriodicCheck(): void {
    if (this.checkTimer) return;

    // 立即执行一次
    this.checkPendingBatches();

    // 定期检查
    this.checkTimer = setInterval(() => {
      this.checkPendingBatches();
    }, this.CHECK_INTERVAL);
  }

  /**
   * 停止定期检查
   */
  private stopPeriodicCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * 检查并执行待处理批次
   */
  private async checkPendingBatches(): Promise<void> {
    // 检查是否已登录
    const isAuth = await this.isAuthenticated();
    if (!isAuth) return;

    // 如果已有批次在执行，跳过
    if (batchExecutor.isExecuting()) return;

    try {
      // 获取待处理任务
      const response = await apiClient.get('/api/publishing/tasks', {
        params: { status: 'pending', pageSize: 100 }
      });

      if (!response.data?.success || !response.data?.data?.tasks) return;

      const tasks = response.data.data.tasks as LocalTask[];
      if (tasks.length === 0) return;

      // 找出有 batch_id 的任务，按批次分组
      const batchMap = new Map<string, { createdAt: Date; count: number }>();
      
      for (const task of tasks) {
        if (task.batch_id) {
          if (!batchMap.has(task.batch_id)) {
            batchMap.set(task.batch_id, {
              createdAt: new Date(task.created_at || Date.now()),
              count: 0
            });
          }
          batchMap.get(task.batch_id)!.count++;
        }
      }

      if (batchMap.size === 0) return;

      // 按创建时间排序，执行最早的批次
      const sortedBatches = Array.from(batchMap.entries())
        .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());

      const [batchId, info] = sortedBatches[0];
      console.log(`🚀 自动执行批次 ${batchId}（${info.count} 个任务）`);

      // 执行批次（不等待完成）
      batchExecutor.executeBatch(batchId).catch(err => {
        console.error(`批次 ${batchId} 执行失败:`, err);
      });

      this.sendStatus();
    } catch (error: any) {
      console.error('检查待处理批次失败:', error.message);
    }
  }

  /**
   * 检查是否已登录
   */
  private async isAuthenticated(): Promise<boolean> {
    try {
      const tokens = await storageManager.getTokens();
      return !!(tokens?.authToken);
    } catch {
      return false;
    }
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
   * 手动执行单个任务
   */
  async executeTask(taskId: number): Promise<{ success: boolean; error?: string }> {
    if (!this.isRunning) {
      console.log('⚠️ 任务队列未启动，先启动队列');
      this.start();
    }

    console.log(`📝 手动执行任务 #${taskId}`);
    return publishingExecutor.executeTask(taskId);
  }

  /**
   * 手动执行批次
   */
  async executeBatch(batchId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isRunning) {
      console.log('⚠️ 任务队列未启动，先启动队列');
      this.start();
    }

    console.log(`📦 手动执行批次 ${batchId}`);
    return batchExecutor.executeBatch(batchId);
  }

  /**
   * 停止任务
   */
  async stopTask(taskId: number): Promise<{ success: boolean }> {
    console.log(`🛑 停止任务 #${taskId}`);
    await publishingExecutor.stopTask(taskId);
    return { success: true };
  }

  /**
   * 停止批次
   */
  async stopBatch(batchId: string): Promise<{ cancelledCount: number; terminatedCount: number }> {
    console.log(`🛑 停止批次 ${batchId}`);
    return batchExecutor.stopBatch(batchId);
  }

  /**
   * 强制清理执行状态
   */
  forceCleanup(): void {
    console.log('🧹 强制清理任务队列状态...');
    batchExecutor.forceCleanup();
    this.sendStatus();
    console.log('✅ 任务队列状态已清理');
  }

  /**
   * 获取执行状态（调试用）
   */
  getExecutionState(): {
    isRunning: boolean;
    isExecutorBusy: boolean;
    batchState: ReturnType<typeof batchExecutor.getExecutionState>;
  } {
    return {
      isRunning: this.isRunning,
      isExecutorBusy: publishingExecutor.isExecuting(),
      batchState: batchExecutor.getExecutionState()
    };
  }
}

// 导出单例
export const taskQueue = new TaskQueue();