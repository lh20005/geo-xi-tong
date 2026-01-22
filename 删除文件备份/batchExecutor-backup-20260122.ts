/**
 * 批次执行器 - 备份于 2026-01-22
 * 本地发布模块 - 负责按顺序执行批次中的任务
 * 
 * 使用 Singleton Promise 模式确保：
 * 1. 同一批次不会被重复执行（多个调用返回同一个 Promise）
 * 2. 批次内的任务严格串行执行
 * 
 * 参考: https://www.jonmellman.com/posts/singleton-promises
 */

import { BrowserWindow } from 'electron';
import { publishingExecutor } from './executor';
import { apiClient } from '../api/client';
import { LocalTask, BatchInfo } from './types';
import { sleep } from './utils';

/**
 * 批次执行器
 * 负责按顺序执行批次中的任务，每个任务完成后等待指定间隔再执行下一个
 */
export class BatchExecutor {
  // 使用 Singleton Promise 模式：存储执行中的 Promise，而不是 Set
  // 这样多个调用会返回同一个 Promise，避免竞态条件
  private executionPromises: Map<string, Promise<void>> = new Map();
  private stoppedBatches: Set<string> = new Set();
  private mainWindow: BrowserWindow | null = null;
  private readonly LOCAL_CHECK_INTERVAL_MS = 1000; // 每1秒检查本地停止标记
  private readonly SERVER_CHECK_INTERVAL_MS = 30000; // 每30秒检查服务器状态

  /**
   * 设置主窗口（用于发送 IPC 消息）
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
    publishingExecutor.setMainWindow(window);
  }

  /**
   * 检查批次是否应该停止
   */
  private async checkStopSignal(batchId: string): Promise<boolean> {
    // 检查本地停止标记
    if (this.stoppedBatches.has(batchId)) {
      return true;
    }

    try {
      // 从服务器获取批次信息
      const response = await apiClient.get(`/api/publishing/batches/${batchId}`);
      if (response.data?.success && response.data?.data) {
        const info = response.data.data as BatchInfo;
        return info.pending_tasks === 0;
      }
      return false;
    } catch (error: any) {
      console.error(`⚠️  检查停止信号失败:`, error.message);
      return false;
    }
  }

  /**
   * 等待指定时间，期间频繁检查停止信号
   */
  private async waitWithStopCheck(
    batchId: string,
    intervalMinutes: number
  ): Promise<boolean> {
    // 验证和规范化间隔时间
    if (intervalMinutes < 0) {
      console.log(`⚠️  间隔时间为负数 (${intervalMinutes})，视为0`);
      intervalMinutes = 0;
    }
    
    if (intervalMinutes === 0) {
      console.log(`⏭️  无需等待，立即执行下一个任务`);
      return false;
    }
    
    const waitMs = intervalMinutes * 60 * 1000;
    const nextExecutionTime = new Date(Date.now() + waitMs);
    
    console.log(`⏳ 等待 ${intervalMinutes} 分钟后执行下一个任务...`);
    console.log(`   当前时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`   预计下次执行时间: ${nextExecutionTime.toLocaleString('zh-CN')}`);
    
    let waitedTime = 0;
    let lastServerCheckTime = 0;
    
    // 使用精确的等待时间计算
    const startTime = Date.now();
    
    while (waitedTime < waitMs) {
      // 检查本地停止标记（立即响应）
      if (this.stoppedBatches.has(batchId)) {
        console.log(`🛑 批次 ${batchId} 被本地停止`);
        return true;
      }
      
      // 每30秒检查一次服务器状态（减少 API 调用）
      if (waitedTime - lastServerCheckTime >= this.SERVER_CHECK_INTERVAL_MS) {
        try {
          const response = await apiClient.get(`/api/publishing/batches/${batchId}`);
          if (response.data?.success && response.data?.data) {
            const info = response.data.data as BatchInfo;
            if (info.pending_tasks === 0) {
              console.log(`🛑 批次 ${batchId} 服务器显示无待处理任务`);
              return true;
            }
          }
        } catch (error: any) {
          console.error(`⚠️  检查停止信号失败:`, error.message);
        }
        lastServerCheckTime = waitedTime;
      }
      
      // 等待1秒
      await sleep(this.LOCAL_CHECK_INTERVAL_MS);
      
      // 使用实际经过的时间，而不是累加（避免 API 调用延迟累积）
      waitedTime = Date.now() - startTime;
    }
    
    console.log(`✅ 等待完成，实际等待时间: ${Math.round(waitedTime / 60000)} 分钟`);
    return false;
  }

  /**
   * 获取批次任务列表
   */
  private async getBatchTasks(batchId: string): Promise<LocalTask[]> {
    try {
      const response = await apiClient.get(`/api/publishing/tasks`, {
        params: { batch_id: batchId }
      });
      
      if (response.data?.success && response.data?.data?.tasks) {
        // 按 batch_order 排序
        const tasks = response.data.data.tasks as LocalTask[];
        return tasks.sort((a, b) => (a.batch_order || 0) - (b.batch_order || 0));
      }
      return [];
    } catch (error) {
      console.error(`获取批次任务失败:`, error);
      return [];
    }
  }

  /**
   * 获取任务详情
   */
  private async getTaskById(taskId: number): Promise<LocalTask | null> {
    try {
      const response = await apiClient.get(`/api/publishing/tasks/${taskId}`);
      if (response.data?.success && response.data?.data) {
        return response.data.data as LocalTask;
      }
      return null;
    } catch (error) {
      console.error(`获取任务详情失败:`, error);
      return null;
    }
  }

  /**
   * 执行批次中的所有任务（串行）
   * 
   * 使用 Singleton Promise 模式：
   * - 如果批次已经在执行，返回现有的 Promise（多个调用共享同一个执行）
   * - 如果批次未执行，创建新的 Promise 并存储
   * - 执行完成后自动清理 Promise
   * 
   * 这种模式完全避免了竞态条件，因为 Map.get() 和 Map.set() 在同步代码中是原子的
   */
  async executeBatch(batchId: string): Promise<void> {
    // 检查是否已有执行中的 Promise（Singleton Promise 模式的核心）
    const existingPromise = this.executionPromises.get(batchId);
    if (existingPromise) {
      console.log(`⚠️  批次 ${batchId} 正在执行中，返回现有 Promise（避免重复执行）`);
      return existingPromise;
    }
    
    console.log(`🔒 批次 ${batchId} 开始执行，创建新的执行 Promise`);
    
    // 创建执行 Promise 并立即存储（在任何 await 之前）
    // 这是关键：存储操作必须在同步代码中完成，确保原子性
    const executionPromise = this._executeBatchInternal(batchId)
      .finally(() => {
        // 执行完成后清理
        this.executionPromises.delete(batchId);
        this.stoppedBatches.delete(batchId);
        console.log(`🔓 批次 ${batchId} 执行完成，已从执行队列中移除`);
      });
    
    // 存储 Promise（必须在 await 之前，确保后续调用能获取到）
    this.executionPromises.set(batchId, executionPromise);
    
    return executionPromise;
  }

  /**
   * 内部批次执行方法
   */
  private async _executeBatchInternal(batchId: string): Promise<void> {
    // 清除停止标记
    this.stoppedBatches.delete(batchId);
    
    const startTime = Date.now();
    console.log(`🚀 开始执行批次 ${batchId} at ${new Date().toISOString()}`);

    try {
      // 获取批次中的所有任务（按 batch_order 排序）
      const tasks = await this.getBatchTasks(batchId);
      
      if (tasks.length === 0) {
        console.log(`⚠️  批次 ${batchId} 没有任务`);
        return;
      }

      console.log(`📋 批次 ${batchId} 共有 ${tasks.length} 个任务`);

      // 按顺序执行每个任务
      let taskIndex = 0;
      while (taskIndex < tasks.length) {
        // 在开始每个任务前检查停止信号
        const shouldStopBefore = await this.checkStopSignal(batchId);
        if (shouldStopBefore) {
          console.log(`🛑 批次 ${batchId} 在任务 ${taskIndex + 1} 开始前被停止`);
          break;
        }
        
        const task = tasks[taskIndex];
        
        // 从服务器重新获取任务状态
        const currentTask = await this.getTaskById(task.id);
        
        // 检查任务状态
        if (!currentTask) {
          console.log(`⏭️  任务 #${task.id} 不存在，跳过`);
          taskIndex++;
          continue;
        }
        
        // 如果任务已经成功或失败（重试次数用完），跳过
        if (currentTask.status === 'success') {
          console.log(`⏭️  任务 #${task.id} 已成功，跳过`);
          taskIndex++;
          continue;
        }
        
        if (currentTask.status === 'failed' || currentTask.status === 'timeout') {
          console.log(`⏭️  任务 #${task.id} 已失败（重试次数用完），跳过`);
          taskIndex++;
          continue;
        }
        
        if (currentTask.status === 'cancelled') {
          console.log(`⏭️  任务 #${task.id} 已取消，跳过`);
          taskIndex++;
          continue;
        }
        
        // 只有 pending 状态的任务才执行
        if (currentTask.status !== 'pending') {
          console.log(`⏭️  任务 #${task.id} 状态为 ${currentTask.status}，跳过`);
          taskIndex++;
          continue;
        }

        const taskStartTime = Date.now();
        console.log(`\n📝 [批次 ${batchId}] 执行第 ${taskIndex + 1}/${tasks.length} 个任务 #${task.id}`);
        console.log(`   文章: ${task.article_title}, 平台: ${task.platform_id}`);
        console.log(`   重试次数: ${currentTask.retry_count}/${currentTask.max_retries}`);
        console.log(`   开始时间: ${new Date().toLocaleString('zh-CN')}`);

        let taskCompleted = false; // 任务是否完成（成功或重试次数用完）
        let taskSucceeded = false;
        
        try {
          // 执行任务
          await publishingExecutor.executeTask(task.id);
          
          const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
          
          // 检查任务最终状态
          const finalTask = await this.getTaskById(task.id);
          if (finalTask?.status === 'success') {
            console.log(`✅ [批次 ${batchId}] 任务 #${task.id} 执行成功，耗时: ${taskDuration}秒`);
            taskSucceeded = true;
            taskCompleted = true;
          } else if (finalTask?.status === 'pending') {
            // 任务失败但还有重试机会，不移动到下一个任务
            console.log(`🔄 [批次 ${batchId}] 任务 #${task.id} 失败，将重试 (${finalTask.retry_count}/${finalTask.max_retries})，耗时: ${taskDuration}秒`);
            taskCompleted = false;
          } else if (finalTask?.status === 'failed' || finalTask?.status === 'timeout') {
            console.log(`❌ [批次 ${batchId}] 任务 #${task.id} 失败，重试次数已用完，耗时: ${taskDuration}秒`);
            taskCompleted = true;
          } else if (finalTask?.status === 'cancelled') {
            console.log(`⚠️ [批次 ${batchId}] 任务 #${task.id} 已取消，耗时: ${taskDuration}秒`);
            taskCompleted = true;
          }
        } catch (error: any) {
          const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
          console.error(`❌ [批次 ${batchId}] 任务 #${task.id} 执行异常，耗时: ${taskDuration}秒:`, error.message);
          
          // 检查任务状态，判断是否需要重试
          const finalTask = await this.getTaskById(task.id);
          if (finalTask?.status === 'pending') {
            taskCompleted = false;
          } else {
            taskCompleted = true;
          }
        }

        // 任务完成后检查停止信号
        const shouldStopAfter = await this.checkStopSignal(batchId);
        if (shouldStopAfter) {
          console.log(`🛑 批次 ${batchId} 在任务 ${taskIndex + 1} 完成后被停止`);
          break;
        }

        // 如果任务完成（成功或重试次数用完），移动到下一个任务
        if (taskCompleted) {
          // 如果不是最后一个任务，等待间隔时间
          if (taskIndex < tasks.length - 1) {
            const nextTask = tasks[taskIndex + 1];
            
            console.log(`\n⏸️  [批次 ${batchId}] 任务 ${taskIndex + 1} 完成（${taskSucceeded ? '成功' : '失败'}），准备等待间隔...`);
            
            // 优先使用下一个任务的定时时间
            if (nextTask.scheduled_at) {
              const now = Date.now();
              const scheduledTime = new Date(nextTask.scheduled_at).getTime();
              const waitMs = scheduledTime - now;
              
              if (waitMs > 0) {
                const waitMinutes = Math.ceil(waitMs / 60000);
                console.log(`⏰ 下一个任务定时发布时间: ${new Date(nextTask.scheduled_at).toLocaleString('zh-CN')}`);
                const stopped = await this.waitWithStopCheck(batchId, waitMinutes);
                if (stopped) break;
              } else {
                console.log(`⏭️  下一个任务的定时时间已到，立即执行`);
              }
            } else {
              // 使用当前任务的 interval_minutes（表示执行完当前任务后等待多久）
              const intervalMinutes = task.interval_minutes || 0;
              
              if (intervalMinutes > 0) {
                console.log(`⏳ 使用固定间隔: ${intervalMinutes} 分钟`);
                const stopped = await this.waitWithStopCheck(batchId, intervalMinutes);
                if (stopped) break;
              } else {
                console.log(`⏭️  无需等待，立即执行下一个任务`);
              }
            }
          }
          
          taskIndex++;
        } else {
          // 任务未完成（需要重试），等待间隔后重新执行同一个任务
          const intervalMinutes = task.interval_minutes || 1; // 重试时默认等待1分钟
          
          console.log(`\n🔄 [批次 ${batchId}] 任务 ${taskIndex + 1} 需要重试，等待 ${intervalMinutes} 分钟后重新执行...`);
          const stopped = await this.waitWithStopCheck(batchId, intervalMinutes);
          if (stopped) break;
          
          // 不增加 taskIndex，继续执行同一个任务
        }
      }

      // 记录批次完成
      const duration = Date.now() - startTime;
      console.log(`\n🎉 批次 ${batchId} 执行完成！耗时: ${Math.round(duration / 1000)}秒`);
      
      // 获取并记录最终状态统计
      await this.logBatchSummary(batchId);

    } catch (error: any) {
      console.error(`❌ 批次 ${batchId} 执行失败:`, error);
    }
  }

  /**
   * 记录批次摘要
   */
  private async logBatchSummary(batchId: string): Promise<void> {
    try {
      const response = await apiClient.get(`/api/publishing/batches/${batchId}`);
      if (response.data?.success && response.data?.data) {
        const stats = response.data.data as BatchInfo;
        console.log(`📊 批次 ${batchId} 统计:`);
        console.log(`   总任务数: ${stats.total_tasks}`);
        console.log(`   成功: ${stats.success_tasks}`);
        console.log(`   失败: ${stats.failed_tasks}`);
        console.log(`   已取消: ${stats.cancelled_tasks}`);
        console.log(`   待处理: ${stats.pending_tasks}`);
      }
    } catch (error: any) {
      console.error(`⚠️  获取批次统计失败:`, error.message);
    }
  }

  /**
   * 停止批次
   */
  async stopBatch(batchId: string): Promise<{ cancelledCount: number; terminatedCount: number }> {
    console.log(`🛑 停止批次 ${batchId}...`);
    
    // 标记批次为停止
    this.stoppedBatches.add(batchId);
    
    try {
      // 调用服务器 API 停止批次
      const response = await apiClient.post(`/api/publishing/batches/${batchId}/stop`);
      
      if (response.data?.success && response.data?.data) {
        const result = response.data.data;
        console.log(`✅ 已取消 ${result.cancelledCount} 个待处理任务`);
        console.log(`✅ 已终止 ${result.terminatedCount} 个运行中任务`);
        return result;
      }
      
      return { cancelledCount: 0, terminatedCount: 0 };
    } catch (error: any) {
      console.error(`停止批次失败:`, error.message);
      return { cancelledCount: 0, terminatedCount: 0 };
    }
  }

  /**
   * 获取正在执行的批次列表
   */
  getExecutingBatches(): string[] {
    return Array.from(this.executionPromises.keys());
  }

  /**
   * 检查是否有批次正在执行
   */
  isExecuting(): boolean {
    return this.executionPromises.size > 0;
  }
}

// 导出单例
export const batchExecutor = new BatchExecutor();
