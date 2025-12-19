import { publishingService } from './PublishingService';
import { publishingExecutor } from './PublishingExecutor';
import { batchExecutor } from './BatchExecutor';

/**
 * 任务调度器
 * 负责检查和执行定时任务（包括批次任务）
 */
export class TaskScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkInterval = 10000; // 每10秒检查一次（更频繁，以便及时执行批次任务）
  private executingTasks: Set<number> = new Set();

  /**
   * 启动调度器
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️  任务调度器已在运行');
      return;
    }

    this.isRunning = true;
    console.log('✅ 任务调度器已启动（检查间隔: 10秒）');

    // 立即执行一次检查
    this.checkAndExecuteTasks();

    // 定期检查
    this.intervalId = setInterval(() => {
      this.checkAndExecuteTasks();
    }, this.checkInterval);
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️  任务调度器已停止');
  }

  /**
   * 检查并执行到期任务
   */
  private async checkAndExecuteTasks(): Promise<void> {
    try {
      // 1. 检查批次任务（优先）
      await batchExecutor.checkAndExecuteBatches();

      // 2. 检查普通定时任务（没有 batch_id 的任务）
      const tasks = await publishingService.getPendingScheduledTasks();

      if (tasks.length > 0) {
        console.log(`📋 发现 ${tasks.length} 个待执行的定时任务`);

        for (const task of tasks) {
          // 跳过批次任务（由 batchExecutor 处理）
          if (task.batch_id) {
            continue;
          }

          // 避免重复执行
          if (this.executingTasks.has(task.id)) {
            continue;
          }

          this.executingTasks.add(task.id);

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

export const taskScheduler = new TaskScheduler();
