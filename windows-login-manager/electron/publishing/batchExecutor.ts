/**
 * 批次执行器 (重构版)
 * 
 * 核心职责：按顺序执行批次中的任务，支持任务间隔
 * 设计原则：
 * 1. 严格串行 - 使用 Mutex 确保同一时间只有一个批次执行
 * 2. 事件驱动 - 任务完成后触发下一个，而非轮询
 * 3. 可中断 - 支持随时停止批次
 */

import { BrowserWindow } from 'electron';
import { publishingExecutor } from './executor';
import { Mutex } from './mutex';
import { apiClient } from '../api/client';
import { LocalTask, BatchInfo } from './types';

// 批次执行互斥锁
const batchMutex = new Mutex();

export class BatchExecutor {
  private _mainWindow: BrowserWindow | null = null;
  private activeBatch: string | null = null;
  private stoppedBatches = new Set<string>();

  setMainWindow(window: BrowserWindow | null): void {
    this._mainWindow = window;
    publishingExecutor.setMainWindow(window);
  }

  /**
   * 执行批次
   */
  async executeBatch(batchId: string): Promise<{ success: boolean; error?: string }> {
    // 检查是否已在执行
    if (this.activeBatch === batchId) {
      return { success: false, error: '批次已在执行中' };
    }

    // 使用互斥锁确保串行
    return batchMutex.runExclusive(async () => {
      return this.doExecuteBatch(batchId);
    });
  }

  /**
   * 实际执行批次
   */
  private async doExecuteBatch(batchId: string): Promise<{ success: boolean; error?: string }> {
    if (this.stoppedBatches.has(batchId)) {
      console.log(`🛑 批次 ${batchId} 已被停止`);
      return { success: false, error: '批次已停止' };
    }

    this.activeBatch = batchId;
    this.stoppedBatches.delete(batchId);
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 开始执行批次 ${batchId}`);
    console.log(`   时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // 获取批次任务（会等待直到所有任务创建完成）
      const tasks = await this.fetchBatchTasks(batchId);
      
      if (tasks.length === 0) {
        console.log(`⚠️ 批次 ${batchId} 没有任务`);
        return { success: true };
      }

      console.log(`📋 批次共有 ${tasks.length} 个任务\n`);

      let lastCompletedAt: number | null = null;
      let lastIntervalMinutes = 0;

      // 串行执行每个任务
      for (let i = 0; i < tasks.length; i++) {
        // 检查停止信号
        if (this.stoppedBatches.has(batchId)) {
          console.log(`\n🛑 批次 ${batchId} 被用户停止`);
          break;
        }

        const task = tasks[i];
        
        // 获取最新状态
        const currentTask = await this.fetchTask(task.id);
        if (!currentTask) {
          console.log(`⏭️ 任务#${task.id} 不存在，跳过`);
          continue;
        }

        // 跳过非 pending 状态
        if (currentTask.status !== 'pending') {
          console.log(`⏭️ 任务#${task.id} 状态为 ${currentTask.status}，跳过`);
          
          if (currentTask.status === 'success' && currentTask.completed_at) {
            lastCompletedAt = new Date(currentTask.completed_at).getTime();
            lastIntervalMinutes = task.interval_minutes || 0;
          }
          continue;
        }

        // 等待间隔时间
        if (lastCompletedAt && lastIntervalMinutes > 0) {
          const waitMs = lastIntervalMinutes * 60 * 1000;
          const targetTime = lastCompletedAt + waitMs;
          const remainingMs = targetTime - Date.now();

          if (remainingMs > 0) {
            const remainingSec = Math.ceil(remainingMs / 1000);
            console.log(`\n⏳ 等待间隔 ${remainingSec} 秒...`);
            
            const stopped = await this.waitWithStopCheck(batchId, remainingSec);
            if (stopped) {
              console.log(`\n🛑 批次 ${batchId} 在等待期间被停止`);
              break;
            }
          }
        }

        // 执行任务
        console.log(`\n${'─'.repeat(50)}`);
        console.log(`📝 执行任务 ${i + 1}/${tasks.length}`);
        console.log(`   任务ID: #${task.id}`);
        console.log(`   文章: ${task.article_title}`);
        console.log(`   平台: ${task.platform_id}`);
        console.log(`${'─'.repeat(50)}`);

        const result = await publishingExecutor.executeTask(task.id);
        
        // 更新间隔信息
        if (result.success) {
          lastCompletedAt = Date.now();
          lastIntervalMinutes = task.interval_minutes || 0;
        } else {
          // 任务失败，需要等待重试完成
          const finalStatus = await this.waitForTaskCompletion(batchId, task.id, task.max_retries || 3);
          
          if (finalStatus === 'success') {
            // 重试成功
            lastCompletedAt = Date.now();
            lastIntervalMinutes = task.interval_minutes || 0;
          } else {
            // 最终失败，使用当前时间作为完成时间，保持间隔
            lastCompletedAt = Date.now();
            lastIntervalMinutes = task.interval_minutes || 0;
            console.log(`⚠️ 任务#${task.id} 最终失败，继续执行下一个任务`);
          }
        }
      }

      // 完成
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎉 批次 ${batchId} 执行完成`);
      console.log(`   总耗时: ${duration}秒`);
      console.log(`${'='.repeat(60)}\n`);

      await this.printSummary(batchId);
      return { success: true };

    } catch (error: any) {
      console.error(`❌ 批次 ${batchId} 执行失败:`, error.message);
      return { success: false, error: error.message };

    } finally {
      this.activeBatch = null;
    }
  }

  /**
   * 等待指定秒数，期间检查停止信号
   */
  private async waitWithStopCheck(batchId: string, seconds: number): Promise<boolean> {
    const endTime = Date.now() + seconds * 1000;
    
    while (Date.now() < endTime) {
      if (this.stoppedBatches.has(batchId)) {
        return true;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    
    return false;
  }

  /**
   * 等待任务完成（包括重试）
   * 返回任务的最终状态
   */
  private async waitForTaskCompletion(
    batchId: string, 
    taskId: number, 
    maxRetries: number
  ): Promise<string> {
    const maxWaitTime = 15 * 60 * 1000; // 最多等待15分钟
    const checkInterval = 5000; // 每5秒检查一次
    const startTime = Date.now();
    let lastRetryCount = -1;
    
    console.log(`⏳ 任务#${taskId} 首次执行失败，开始重试流程...`);
    
    while (Date.now() - startTime < maxWaitTime) {
      // 检查停止信号
      if (this.stoppedBatches.has(batchId)) {
        console.log(`🛑 批次 ${batchId} 已停止，不再等待任务重试`);
        return 'cancelled';
      }
      
      // 获取任务最新状态
      const task = await this.fetchTask(taskId);
      if (!task) {
        console.log(`⚠️ 任务#${taskId} 不存在`);
        return 'failed';
      }
      
      const currentRetryCount = task.retry_count || 0;
      
      // 检查任务状态
      if (task.status === 'success') {
        console.log(`✅ 任务#${taskId} 重试成功`);
        return 'success';
      }
      
      if (task.status === 'failed' || task.status === 'timeout' || task.status === 'cancelled') {
        console.log(`❌ 任务#${taskId} 最终状态: ${task.status}`);
        return task.status;
      }
      
      // 如果任务正在运行，等待它完成
      if (task.status === 'running') {
        console.log(`⏳ 任务#${taskId} 正在执行中...`);
        await new Promise(r => setTimeout(r, checkInterval));
        continue;
      }
      
      // 如果任务是 pending 状态，说明还在等待重试
      if (task.status === 'pending') {
        // 检查重试次数是否已用完
        if (currentRetryCount >= maxRetries) {
          console.log(`⚠️ 任务#${taskId} 重试次数已用完 (${currentRetryCount}/${maxRetries})，标记为失败`);
          // 更新状态为失败
          try {
            await apiClient.put(`/api/publishing/tasks/${taskId}/status`, {
              status: 'failed',
              error_message: '重试次数已用完'
            });
          } catch {}
          return 'failed';
        }
        
        // 避免重复执行同一次重试
        if (currentRetryCount === lastRetryCount) {
          console.log(`⏳ 任务#${taskId} 等待重试 (${currentRetryCount}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, checkInterval));
          continue;
        }
        
        lastRetryCount = currentRetryCount;
        console.log(`🔄 任务#${taskId} 开始第 ${currentRetryCount + 1} 次重试...`);
        
        // 重新执行任务
        const result = await publishingExecutor.executeTask(taskId);
        if (result.success) {
          return 'success';
        }
        // 执行失败，继续循环检查状态
      }
      
      await new Promise(r => setTimeout(r, checkInterval));
    }
    
    console.log(`⏰ 等待任务#${taskId} 超时`);
    return 'timeout';
  }

  /**
   * 获取批次任务列表
   * 会等待直到获取到所有任务（包括 batch_order=0 的任务），或超时
   */
  private async fetchBatchTasks(batchId: string): Promise<LocalTask[]> {
    const maxWaitTime = 30000; // 最多等待30秒
    const checkInterval = 1000; // 每秒检查一次
    const startTime = Date.now();
    let lastTaskCount = 0;
    let stableCount = 0; // 任务数量稳定的次数
    
    console.log(`📋 开始获取批次 ${batchId} 的任务列表...`);
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // 重要：设置 pageSize=1000 确保获取所有任务
        const response = await apiClient.get('/api/publishing/tasks', {
          params: { batch_id: batchId, pageSize: 1000 }
        });
        
        if (response.data?.success && response.data?.data?.tasks) {
          const tasks = response.data.data.tasks as LocalTask[];
          const currentCount = tasks.length;
          
          // 按 batch_order 排序
          const sortedTasks = tasks.sort((a, b) => (a.batch_order || 0) - (b.batch_order || 0));
          
          // 关键检查：必须有 batch_order=0 的任务
          const hasFirstTask = sortedTasks.length > 0 && sortedTasks[0].batch_order === 0;
          
          if (!hasFirstTask && currentCount > 0) {
            console.log(`⏳ 等待第一个任务(batch_order=0)创建... 当前最小顺序: ${sortedTasks[0]?.batch_order}`);
            await new Promise(r => setTimeout(r, checkInterval));
            continue;
          }
          
          // 如果任务数量与上次相同，增加稳定计数
          if (currentCount === lastTaskCount && currentCount > 0 && hasFirstTask) {
            stableCount++;
            // 任务数量连续3次稳定，认为所有任务已创建完成
            if (stableCount >= 3) {
              console.log(`📋 批次任务加载完成，共 ${currentCount} 个任务`);
              
              // 打印前几个任务的信息，用于调试
              console.log(`📋 任务顺序验证：`);
              for (let i = 0; i < Math.min(5, sortedTasks.length); i++) {
                const t = sortedTasks[i];
                console.log(`   ${i + 1}. 任务#${t.id} (顺序: ${t.batch_order}, 平台: ${t.platform_id}, 状态: ${t.status})`);
              }
              
              return sortedTasks;
            }
          } else {
            // 任务数量变化，重置稳定计数
            stableCount = 0;
            lastTaskCount = currentCount;
            if (currentCount > 0) {
              console.log(`⏳ 等待任务创建完成... 当前: ${currentCount} 个，第一个任务顺序: ${sortedTasks[0]?.batch_order}`);
            }
          }
        }
      } catch (error) {
        console.error('获取批次任务失败:', error);
      }
      
      await new Promise(r => setTimeout(r, checkInterval));
    }
    
    // 超时，返回当前获取到的任务
    console.warn(`⚠️ 等待任务创建超时，使用当前获取到的任务`);
    try {
      // 重要：设置 pageSize=1000 确保获取所有任务
      const response = await apiClient.get('/api/publishing/tasks', {
        params: { batch_id: batchId, pageSize: 1000 }
      });
      
      if (response.data?.success && response.data?.data?.tasks) {
        const tasks = response.data.data.tasks as LocalTask[];
        const sortedTasks = tasks.sort((a, b) => (a.batch_order || 0) - (b.batch_order || 0));
        
        // 即使超时，也要验证第一个任务
        if (sortedTasks.length > 0 && sortedTasks[0].batch_order !== 0) {
          console.error(`❌ 错误：批次缺少 batch_order=0 的任务，最小顺序为 ${sortedTasks[0].batch_order}`);
        }
        
        return sortedTasks;
      }
    } catch (error) {
      console.error('获取批次任务失败:', error);
    }
    
    return [];
  }

  /**
   * 获取单个任务
   */
  private async fetchTask(taskId: number): Promise<LocalTask | null> {
    try {
      const response = await apiClient.get(`/api/publishing/tasks/${taskId}`);
      if (response.data?.success && response.data?.data) {
        return response.data.data as LocalTask;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 打印批次统计
   */
  private async printSummary(batchId: string): Promise<void> {
    try {
      const response = await apiClient.get(`/api/publishing/batches/${batchId}`);
      if (response.data?.success && response.data?.data) {
        const stats = response.data.data as BatchInfo;
        console.log(`📊 批次统计:`);
        console.log(`   总任务: ${stats.total_tasks}`);
        console.log(`   成功: ${stats.success_tasks}`);
        console.log(`   失败: ${stats.failed_tasks}`);
        console.log(`   已取消: ${stats.cancelled_tasks}`);
        console.log(`   待处理: ${stats.pending_tasks}`);
      }
    } catch {}
  }

  /**
   * 停止批次
   */
  async stopBatch(batchId: string): Promise<{ cancelledCount: number; terminatedCount: number }> {
    console.log(`🛑 停止批次 ${batchId}...`);
    this.stoppedBatches.add(batchId);

    try {
      const response = await apiClient.post(`/api/publishing/batches/${batchId}/stop`);
      
      if (response.data?.success && response.data?.data) {
        const result = response.data.data;
        console.log(`✅ 已取消 ${result.cancelledCount} 个待处理任务`);
        console.log(`✅ 已终止 ${result.terminatedCount} 个运行中任务`);
        return result;
      }
      
      return { cancelledCount: 0, terminatedCount: 0 };
    } catch (error: any) {
      console.error('停止批次失败:', error.message);
      return { cancelledCount: 0, terminatedCount: 0 };
    }
  }

  /**
   * 获取当前执行的批次
   */
  getActiveBatch(): string | null {
    return this.activeBatch;
  }

  /**
   * 获取正在执行的批次列表
   */
  getExecutingBatches(): string[] {
    return this.activeBatch ? [this.activeBatch] : [];
  }

  /**
   * 检查是否有批次正在执行
   */
  isExecuting(): boolean {
    return this.activeBatch !== null || batchMutex.isLocked();
  }

  /**
   * 强制清理状态
   */
  forceCleanup(): void {
    console.log('🧹 清理批次执行状态...');
    this.activeBatch = null;
    this.stoppedBatches.clear();
    console.log('✅ 批次状态已清理');
  }

  /**
   * 获取执行状态
   */
  getExecutionState(): { 
    activeBatch: string | null; 
    stoppedBatches: string[]; 
    isLocked: boolean 
  } {
    return {
      activeBatch: this.activeBatch,
      stoppedBatches: Array.from(this.stoppedBatches),
      isLocked: batchMutex.isLocked()
    };
  }
}

export const batchExecutor = new BatchExecutor();
