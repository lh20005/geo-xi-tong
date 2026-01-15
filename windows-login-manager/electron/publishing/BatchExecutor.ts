import { taskService } from '../services/TaskService';
import { publishingExecutor } from './PublishingExecutor';
import { browserAutomationService } from '../browser/BrowserAutomationService';

/**
 * 批次执行器
 * 负责按顺序执行批次中的任务，每个任务完成后等待指定间隔再执行下一个
 * 
 * 改造说明：从服务器迁移到 Windows 端
 * - 使用本地 SQLite 替代 PostgreSQL
 * - 使用本地 TaskService 替代服务器 PublishingService
 */
export class BatchExecutor {
  private executingBatches: Set<string> = new Set();
  private readonly STOP_CHECK_INTERVAL_MS = 1000;

  /**
   * 检查批次是否应该停止（pending 任务数为 0）
   */
  private checkStopSignal(batchId: string): boolean {
    try {
      const stats = taskService.getBatchStats(batchId);
      return stats.pending === 0;
    } catch (error: any) {
      console.error(`⚠️ 检查停止信号失败:`, error.message);
      return false;
    }
  }

  /**
   * 等待指定时间，期间频繁检查停止信号
   */
  private async waitWithStopCheck(batchId: string, intervalMinutes: number): Promise<boolean> {
    if (intervalMinutes < 0) {
      console.log(`⚠️ 间隔时间为负数 (${intervalMinutes})，视为0`);
      intervalMinutes = 0;
    }
    
    if (intervalMinutes === 0) {
      console.log(`⏭️ 无需等待，立即执行下一个任务`);
      return false;
    }
    
    const waitMs = intervalMinutes * 60 * 1000;
    const nextExecutionTime = new Date(Date.now() + waitMs);
    
    console.log(`⏳ 等待 ${intervalMinutes} 分钟后执行下一个任务...`);
    console.log(`   当前时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`   预计下次执行时间: ${nextExecutionTime.toLocaleString('zh-CN')}`);
    
    let waitedTime = 0;
    
    while (waitedTime < waitMs) {
      const sleepTime = Math.min(this.STOP_CHECK_INTERVAL_MS, waitMs - waitedTime);
      await this.sleep(sleepTime);
      waitedTime += sleepTime;
      
      // 检查批次是否被停止
      if (this.checkStopSignal(batchId)) {
        console.log(`🛑 批次 ${batchId} 在等待期间被停止`);
        return true;
      }
    }
    
    console.log(`✅ 等待完成`);
    return this.checkStopSignal(batchId);
  }

  /**
   * 执行批次中的所有任务（串行）
   */
  async executeBatch(batchId: string): Promise<void> {
    // 避免重复执行同一批次
    if (this.executingBatches.has(batchId)) {
      console.log(`⚠️ 批次 ${batchId} 正在执行中，跳过`);
      return;
    }

    this.executingBatches.add(batchId);
    const startTime = Date.now();
    console.log(`🚀 开始执行批次 ${batchId} at ${new Date().toISOString()}`);

    try {
      // 获取批次中的所有任务
      const tasks = taskService.findByBatchId(batchId);
      
      if (tasks.length === 0) {
        console.log(`⚠️ 批次 ${batchId} 没有任务`);
        return;
      }

      console.log(`📋 批次 ${batchId} 共有 ${tasks.length} 个任务`);

      // 按顺序执行每个任务
      for (let i = 0; i < tasks.length; i++) {
        // 检查停止信号
        if (this.checkStopSignal(batchId)) {
          console.log(`🛑 批次 ${batchId} 在任务 ${i + 1} 开始前被停止`);
          break;
        }
        
        const task = tasks[i];
        
        // 重新获取任务状态
        const currentTask = taskService.findById(task.id);
        if (!currentTask || currentTask.status !== 'pending') {
          console.log(`⏭️ 任务 ${task.id} 状态为 ${currentTask?.status || '不存在'}，跳过`);
          continue;
        }

        const taskStartTime = Date.now();
        console.log(`\n📝 [批次 ${batchId}] 执行第 ${i + 1}/${tasks.length} 个任务 ${task.id}`);
        console.log(`   文章ID: ${task.article_id}, 平台: ${task.platform_id}`);

        try {
          await publishingExecutor.executeTask(task.id);
          
          const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
          const finalTask = taskService.findById(task.id);
          
          if (finalTask?.status === 'completed') {
            console.log(`✅ [批次 ${batchId}] 任务 ${task.id} 执行成功，耗时: ${taskDuration}秒`);
          } else if (finalTask?.status === 'pending') {
            console.log(`🔄 [批次 ${batchId}] 任务 ${task.id} 失败，已标记为待重试`);
          } else if (finalTask?.status === 'failed') {
            console.log(`❌ [批次 ${batchId}] 任务 ${task.id} 失败，重试次数已用完`);
          }
        } catch (error: any) {
          const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
          console.error(`❌ [批次 ${batchId}] 任务 ${task.id} 执行异常，耗时: ${taskDuration}秒:`, error.message);
        }

        // 任务完成后检查停止信号
        if (this.checkStopSignal(batchId)) {
          console.log(`🛑 批次 ${batchId} 在任务 ${i + 1} 完成后被停止`);
          break;
        }

        // 如果不是最后一个任务，等待间隔时间
        if (i < tasks.length - 1) {
          const nextTask = tasks[i + 1];
          
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
            }
          } else {
            // 使用 interval_minutes
            const intervalMinutes = task.interval_minutes || 0;
            if (intervalMinutes > 0) {
              const stopped = await this.waitWithStopCheck(batchId, intervalMinutes);
              if (stopped) break;
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      console.log(`\n🎉 批次 ${batchId} 执行完成！耗时: ${Math.round(duration / 1000)}秒`);
      
      // 记录最终状态统计
      const stats = taskService.getBatchStats(batchId);
      console.log(`📊 批次 ${batchId} 统计:`);
      console.log(`   总任务数: ${stats.total}`);
      console.log(`   成功: ${stats.completed}`);
      console.log(`   失败: ${stats.failed}`);
      console.log(`   已取消: ${stats.cancelled}`);
      console.log(`   待处理: ${stats.pending}`);

    } catch (error: any) {
      console.error(`❌ 批次 ${batchId} 执行失败:`, error);
    } finally {
      this.executingBatches.delete(batchId);
      console.log(`✅ 批次 ${batchId} 已从执行队列中移除`);
    }
  }

  /**
   * 停止批次
   */
  async stopBatch(batchId: string): Promise<{ cancelledCount: number }> {
    console.log(`🛑 停止批次 ${batchId}...`);
    
    const result = taskService.cancelBatch(batchId);
    
    // 如果有运行中的任务，强制关闭浏览器
    const stats = taskService.getBatchStats(batchId);
    if (stats.running > 0) {
      console.log(`🔄 正在强制关闭浏览器...`);
      try {
        await browserAutomationService.forceCloseBrowser();
        console.log(`✅ 浏览器已强制关闭`);
      } catch (browserError: any) {
        console.error(`⚠️ 关闭浏览器失败:`, browserError.message);
      }
    }
    
    return result;
  }

  /**
   * 删除批次
   */
  async deleteBatch(batchId: string): Promise<{ deletedCount: number }> {
    console.log(`🗑️ 删除批次 ${batchId}...`);
    return taskService.deleteBatch(batchId);
  }

  /**
   * 获取正在执行的批次列表
   */
  getExecutingBatches(): string[] {
    return Array.from(this.executingBatches);
  }

  /**
   * 睡眠指定毫秒数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const batchExecutor = new BatchExecutor();
