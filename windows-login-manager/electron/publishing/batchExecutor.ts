/**
 * 批次执行器
 * 本地发布模块 - 负责按顺序执行批次中的任务
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
  private executingBatches: Set<string> = new Set();
  private stoppedBatches: Set<string> = new Set();
  private mainWindow: BrowserWindow | null = null;
  private readonly STOP_CHECK_INTERVAL_MS = 1000; // 每1秒检查一次停止信号

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
      const response = await apiClient.get(`/publishing/batches/${batchId}`);
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
    
    // 每1秒检查一次停止信号
    while (waitedTime < waitMs) {
      const sleepTime = Math.min(this.STOP_CHECK_INTERVAL_MS, waitMs - waitedTime);
      await sleep(sleepTime);
      waitedTime += sleepTime;
      
      // 检查批次是否被停止
      const shouldStop = await this.checkStopSignal(batchId);
      if (shouldStop) {
        console.log(`🛑 批次 ${batchId} 在等待期间被停止`);
        return true;
      }
    }
    
    console.log(`✅ 等待完成`);
    return false;
  }

  /**
   * 获取批次任务列表
   */
  private async getBatchTasks(batchId: string): Promise<LocalTask[]> {
    try {
      const response = await apiClient.get(`/publishing/tasks`, {
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
      const response = await apiClient.get(`/publishing/tasks/${taskId}`);
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
   */
  async executeBatch(batchId: string): Promise<void> {
    // 避免重复执行同一批次
    if (this.executingBatches.has(batchId)) {
      console.log(`⚠️  批次 ${batchId} 正在执行中，跳过`);
      return;
    }

    // 清除停止标记
    this.stoppedBatches.delete(batchId);
    
    this.executingBatches.add(batchId);
    const startTime = Date.now();
    console.log(`🚀 开始执行批次 ${batchId} at ${new Date().toISOString()}`);

    try {
      // 获取批次中的所有任务
      const tasks = await this.getBatchTasks(batchId);
      
      if (tasks.length === 0) {
        console.log(`⚠️  批次 ${batchId} 没有任务`);
        return;
      }

      console.log(`📋 批次 ${batchId} 共有 ${tasks.length} 个任务`);

      // 按顺序执行每个任务
      for (let i = 0; i < tasks.length; i++) {
        // 在开始每个任务前检查停止信号
        const shouldStopBefore = await this.checkStopSignal(batchId);
        if (shouldStopBefore) {
          console.log(`🛑 批次 ${batchId} 在任务 ${i + 1} 开始前被停止`);
          break;
        }
        
        const task = tasks[i];
        
        // 从服务器重新获取任务状态
        const currentTask = await this.getTaskById(task.id);
        if (!currentTask || currentTask.status !== 'pending') {
          console.log(`⏭️  任务 #${task.id} 状态为 ${currentTask?.status || '不存在'}，跳过`);
          continue;
        }

        const taskStartTime = Date.now();
        console.log(`\n📝 [批次 ${batchId}] 执行第 ${i + 1}/${tasks.length} 个任务 #${task.id}`);
        console.log(`   文章: ${task.article_title}, 平台: ${task.platform_id}`);
        console.log(`   开始时间: ${new Date().toLocaleString('zh-CN')}`);

        try {
          // 执行任务
          await publishingExecutor.executeTask(task.id);
          
          const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
          
          // 检查任务最终状态
          const finalTask = await this.getTaskById(task.id);
          if (finalTask?.status === 'success') {
            console.log(`✅ [批次 ${batchId}] 任务 #${task.id} 执行成功，耗时: ${taskDuration}秒`);
          } else if (finalTask?.status === 'pending') {
            console.log(`🔄 [批次 ${batchId}] 任务 #${task.id} 失败，已标记为待重试，耗时: ${taskDuration}秒`);
          } else if (finalTask?.status === 'failed') {
            console.log(`❌ [批次 ${batchId}] 任务 #${task.id} 失败，重试次数已用完，耗时: ${taskDuration}秒`);
          }
        } catch (error: any) {
          const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
          console.error(`❌ [批次 ${batchId}] 任务 #${task.id} 执行异常，耗时: ${taskDuration}秒:`, error.message);
        }

        // 任务完成后检查停止信号
        const shouldStopAfter = await this.checkStopSignal(batchId);
        if (shouldStopAfter) {
          console.log(`🛑 批次 ${batchId} 在任务 ${i + 1} 完成后被停止`);
          break;
        }

        // 如果不是最后一个任务，等待间隔时间
        if (i < tasks.length - 1) {
          const nextTask = tasks[i + 1];
          
          console.log(`\n⏸️  [批次 ${batchId}] 任务 ${i + 1} 完成，准备等待间隔...`);
          
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
            // 使用 interval_minutes
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
      }

      // 记录批次完成
      const duration = Date.now() - startTime;
      console.log(`\n🎉 批次 ${batchId} 执行完成！耗时: ${Math.round(duration / 1000)}秒`);
      
      // 获取并记录最终状态统计
      await this.logBatchSummary(batchId);

    } catch (error: any) {
      console.error(`❌ 批次 ${batchId} 执行失败:`, error);
    } finally {
      this.executingBatches.delete(batchId);
      this.stoppedBatches.delete(batchId);
      console.log(`✅ 批次 ${batchId} 已从执行队列中移除`);
    }
  }

  /**
   * 记录批次摘要
   */
  private async logBatchSummary(batchId: string): Promise<void> {
    try {
      const response = await apiClient.get(`/publishing/batches/${batchId}`);
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
      const response = await apiClient.post(`/publishing/batches/${batchId}/stop`);
      
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
    return Array.from(this.executingBatches);
  }

  /**
   * 检查是否有批次正在执行
   */
  isExecuting(): boolean {
    return this.executingBatches.size > 0;
  }
}

// 导出单例
export const batchExecutor = new BatchExecutor();
