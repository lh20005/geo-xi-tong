/**
 * 批次执行器
 * 本地发布模块 - 负责按顺序执行批次中的任务
 * 
 * 核心设计：使用全局执行锁确保任务严格串行执行
 * - 全局只有一个任务在执行（不管是哪个批次）
 * - 使用 Promise 链确保串行：每个任务必须等待上一个任务完成
 * 
 * 参考: https://www.webdevtutor.net/blog/typescript-promise-queue
 */

import { BrowserWindow } from 'electron';
import { publishingExecutor } from './executor';
import { apiClient } from '../api/client';
import { LocalTask, BatchInfo } from './types';
import { sleep } from './utils';

/**
 * 批次执行器
 */
export class BatchExecutor {
  private mainWindow: BrowserWindow | null = null;
  
  // 全局执行锁：确保同一时间只有一个任务在执行
  private globalExecutionPromise: Promise<void> = Promise.resolve();
  private isGlobalExecuting = false;
  
  // 批次状态
  private activeBatches: Set<string> = new Set();
  private stoppedBatches: Set<string> = new Set();
  
  // 配置
  private readonly STOP_CHECK_INTERVAL_MS = 1000;

  /**
   * 设置主窗口
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
    publishingExecutor.setMainWindow(window);
  }

  /**
   * 执行批次（入口方法）
   * 
   * 关键：使用 Promise 链确保串行执行
   * 每次调用都会将新任务追加到 Promise 链的末尾
   */
  async executeBatch(batchId: string): Promise<void> {
    // 检查批次是否已在执行
    if (this.activeBatches.has(batchId)) {
      console.log(`⚠️  批次 ${batchId} 已在执行队列中，跳过重复调用`);
      return;
    }
    
    // 标记批次为活跃
    this.activeBatches.add(batchId);
    this.stoppedBatches.delete(batchId);
    
    console.log(`📥 批次 ${batchId} 加入执行队列`);
    
    // 将批次执行追加到全局 Promise 链
    // 这确保了即使多个批次同时调用，也会串行执行
    this.globalExecutionPromise = this.globalExecutionPromise
      .then(() => this.runBatch(batchId))
      .catch(error => {
        console.error(`❌ 批次 ${batchId} 执行出错:`, error);
      })
      .finally(() => {
        this.activeBatches.delete(batchId);
        this.stoppedBatches.delete(batchId);
        console.log(`📤 批次 ${batchId} 已从执行队列移除`);
      });
    
    return this.globalExecutionPromise;
  }

  /**
   * 执行单个批次的所有任务
   */
  private async runBatch(batchId: string): Promise<void> {
    if (this.stoppedBatches.has(batchId)) {
      console.log(`🛑 批次 ${batchId} 已被停止，跳过执行`);
      return;
    }
    
    this.isGlobalExecuting = true;
    const startTime = Date.now();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 开始执行批次 ${batchId}`);
    console.log(`   时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // 获取批次任务列表（按 batch_order 排序）
      const tasks = await this.fetchBatchTasks(batchId);
      
      if (tasks.length === 0) {
        console.log(`⚠️  批次 ${batchId} 没有任务`);
        return;
      }

      console.log(`� 批次共有 ${tasks.length} 个任务\n`);

      // 串行执行每个任务
      for (let i = 0; i < tasks.length; i++) {
        // 检查停止信号
        if (this.stoppedBatches.has(batchId)) {
          console.log(`\n🛑 批次 ${batchId} 被用户停止`);
          break;
        }

        const task = tasks[i];
        const taskNumber = i + 1;
        
        // 获取最新任务状态
        const currentTask = await this.fetchTaskById(task.id);
        if (!currentTask) {
          console.log(`⏭️  任务 #${task.id} 不存在，跳过`);
          continue;
        }

        // 跳过非 pending 状态的任务
        if (currentTask.status !== 'pending') {
          console.log(`⏭️  任务 #${task.id} 状态为 ${currentTask.status}，跳过执行`);
          
          // 关键修复：即使任务已完成，如果它属于当前批次序列，也需要检查是否需要等待间隔
          // 这样可以防止"断点续传"或重启后，忽略了已完成任务的间隔时间，导致后续任务立即执行
          if (i < tasks.length - 1) {
            // 兼容可能的大小写问题，并确保转为数字
            const rawInterval = (task as any).intervalMinutes ?? task.interval_minutes;
            const intervalMinutes = Number(rawInterval) || 0;
            
            if (intervalMinutes > 0 && currentTask.completed_at) {
              const completedAt = new Date(currentTask.completed_at).getTime();
              const waitDurationMs = intervalMinutes * 60 * 1000;
              const targetTime = completedAt + waitDurationMs;
              const now = Date.now();
              const remainingMs = targetTime - now;
              
              if (remainingMs > 0) {
                // 向上取整到分钟，确保 waitWithStopCheck 能处理
                // 注意：waitWithStopCheck 最小单位是分钟，这里可能不够精确，但足够解决"立即执行"的问题
                // 为了更好的体验，我们至少等待1分钟（如果剩余时间大于0）
                const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
                
                console.log(`\n⏳ 任务 #${task.id} 已完成，但需补足间隔时间（剩余约 ${remainingMinutes} 分钟）...`);
                console.log(`   [Debug] Interval: ${intervalMinutes}m, Completed: ${new Date(completedAt).toLocaleString()}, Target: ${new Date(targetTime).toLocaleString()}`);
                
                const stopped = await this.waitWithStopCheck(batchId, remainingMinutes);
                if (stopped) {
                  console.log(`\n🛑 批次 ${batchId} 在等待期间被停止`);
                  break;
                }
              }
            }
          }
          
          continue;
        }

        // 执行任务
        console.log(`\n${'─'.repeat(50)}`);
        console.log(`📝 执行任务 ${taskNumber}/${tasks.length}`);
        console.log(`   任务ID: #${task.id}`);
        console.log(`   文章: ${task.article_title}`);
        console.log(`   平台: ${task.platform_id}`);
        console.log(`   时间: ${new Date().toLocaleString('zh-CN')}`);
        console.log(`${'─'.repeat(50)}`);

        const taskStartTime = Date.now();
        
        try {
          // 执行任务（这里会等待任务完成）
          await publishingExecutor.executeTask(task.id);
          
          const duration = Math.round((Date.now() - taskStartTime) / 1000);
          
          // 检查任务最终状态
          const finalTask = await this.fetchTaskById(task.id);
          if (finalTask?.status === 'success') {
            console.log(`✅ 任务 #${task.id} 成功，耗时 ${duration}秒`);
          } else {
            console.log(`❌ 任务 #${task.id} 失败，状态: ${finalTask?.status}，耗时 ${duration}秒`);
          }
        } catch (error: any) {
          const duration = Math.round((Date.now() - taskStartTime) / 1000);
          console.error(`❌ 任务 #${task.id} 异常，耗时 ${duration}秒:`, error.message);
        }

        // 检查停止信号
        if (this.stoppedBatches.has(batchId)) {
          console.log(`\n🛑 批次 ${batchId} 被用户停止`);
          break;
        }

        // 如果不是最后一个任务，等待间隔
        if (i < tasks.length - 1) {
          // 兼容可能的大小写问题，并确保转为数字
          const rawInterval = (task as any).intervalMinutes ?? task.interval_minutes;
          const intervalMinutes = Number(rawInterval) || 0;
          
          if (intervalMinutes > 0) {
            console.log(`\n⏳ 等待 ${intervalMinutes} 分钟后执行下一个任务...`);
            console.log(`   [Debug] Interval: ${intervalMinutes}m (Raw: ${rawInterval})`);
            
            const stopped = await this.waitWithStopCheck(batchId, intervalMinutes);
            if (stopped) {
              console.log(`\n🛑 批次 ${batchId} 在等待期间被停止`);
              break;
            }
          }
        }
      }

      // 批次完成
      const totalDuration = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎉 批次 ${batchId} 执行完成`);
      console.log(`   总耗时: ${totalDuration}秒`);
      console.log(`${'='.repeat(60)}\n`);

      // 打印统计
      await this.printBatchSummary(batchId);

    } catch (error: any) {
      console.error(`❌ 批次 ${batchId} 执行失败:`, error);
    } finally {
      this.isGlobalExecuting = false;
    }
  }

  /**
   * 等待指定时间，期间检查停止信号
   */
  private async waitWithStopCheck(batchId: string, minutes: number): Promise<boolean> {
    if (minutes <= 0) return false;
    
    const totalMs = minutes * 60 * 1000;
    const startTime = Date.now();
    const endTime = startTime + totalMs;
    
    console.log(`[BatchExecutor] Starting wait. Minutes: ${minutes}, TotalMs: ${totalMs}, EndTime: ${new Date(endTime).toLocaleString()}`);
    
    while (Date.now() < endTime) {
      // 检查停止信号
      if (this.stoppedBatches.has(batchId)) {
        console.log(`[BatchExecutor] Stop signal received for batch ${batchId}`);
        return true;
      }
      
      // 等待1秒
      await sleep(this.STOP_CHECK_INTERVAL_MS);
    }
    
    console.log(`[BatchExecutor] Wait finished.`);
    return false;
  }

  /**
   * 获取批次任务列表
   */
  private async fetchBatchTasks(batchId: string): Promise<LocalTask[]> {
    try {
      const response = await apiClient.get('/api/publishing/tasks', {
        params: { batch_id: batchId }
      });
      
      if (response.data?.success && response.data?.data?.tasks) {
        const tasks = response.data.data.tasks as LocalTask[];
        // 按 batch_order 排序
        return tasks.sort((a, b) => (a.batch_order || 0) - (b.batch_order || 0));
      }
      return [];
    } catch (error) {
      console.error('获取批次任务失败:', error);
      return [];
    }
  }

  /**
   * 获取单个任务详情
   */
  private async fetchTaskById(taskId: number): Promise<LocalTask | null> {
    try {
      const response = await apiClient.get(`/api/publishing/tasks/${taskId}`);
      if (response.data?.success && response.data?.data) {
        return response.data.data as LocalTask;
      }
      return null;
    } catch (error) {
      console.error('获取任务详情失败:', error);
      return null;
    }
  }

  /**
   * 打印批次统计
   */
  private async printBatchSummary(batchId: string): Promise<void> {
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
    } catch (error: any) {
      console.error('获取批次统计失败:', error.message);
    }
  }

  /**
   * 停止批次
   */
  async stopBatch(batchId: string): Promise<{ cancelledCount: number; terminatedCount: number }> {
    console.log(`🛑 停止批次 ${batchId}...`);
    
    // 标记为停止
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
      console.error('停止批次失败:', error.message);
      return { cancelledCount: 0, terminatedCount: 0 };
    }
  }

  /**
   * 获取正在执行的批次列表
   */
  getExecutingBatches(): string[] {
    return Array.from(this.activeBatches);
  }

  /**
   * 检查是否有批次正在执行
   */
  isExecuting(): boolean {
    return this.isGlobalExecuting || this.activeBatches.size > 0;
  }
}

// 导出单例
export const batchExecutor = new BatchExecutor();
