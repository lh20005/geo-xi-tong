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
   * 检测并处理超时任务
   */
  private async detectTimeoutTasks(): Promise<void> {
    try {
      const { pool } = require('../db/database');
      
      // 查询所有running状态的任务
      const result = await pool.query(`
        SELECT id, started_at, config
        FROM publishing_tasks
        WHERE status = 'running'
      `);

      const now = Date.now();

      for (const task of result.rows) {
        // 获取超时配置（默认15分钟）
        const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
        const timeout = config?.timeout_minutes || 15;
        
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
      await publishingService.logMessage(
        taskId,
        'warning',
        '任务执行超时，调度器检测到并标记为超时'
      );

      // 增加重试次数
      await publishingService.incrementRetryCount(taskId);

      // 获取任务信息
      const task = await publishingService.getTaskById(taskId);
      if (!task) {
        console.error(`❌ 任务 #${taskId} 不存在`);
        return;
      }

      const nextRetryCount = task.retry_count + 1;

      if (nextRetryCount < task.max_retries) {
        // 还可以重试，标记为pending
        await publishingService.updateTaskStatus(
          taskId,
          'pending',
          `执行超时，将自动重试 (${nextRetryCount}/${task.max_retries})`
        );
        console.log(`🔄 超时任务 #${taskId} 将在下次调度时重试 (${nextRetryCount}/${task.max_retries})`);
      } else {
        // 重试次数已用完，标记为timeout
        await publishingService.updateTaskStatus(
          taskId,
          'timeout',
          '重试次数已用完'
        );
        console.log(`❌ 超时任务 #${taskId} 重试次数已用完，标记为timeout`);

        // 清除文章锁
        const { pool } = require('../db/database');
        await pool.query(
          'UPDATE articles SET publishing_status = NULL WHERE id = $1',
          [task.article_id]
        );
      }

      // 尝试清理浏览器进程（如果有的话）
      // 注意：这里只是尝试，可能浏览器已经被关闭或不存在
      console.log(`🧹 尝试清理任务 #${taskId} 的浏览器资源...`);
    } catch (error) {
      console.error(`❌ 处理超时任务 #${taskId} 失败:`, error);
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
      await batchExecutor.checkAndExecuteBatches();

      // 2. 检查普通定时任务（没有 batch_id 的任务）
      const tasks = await publishingService.getPendingScheduledTasks();

      if (tasks.length > 0) {
        // 统计重试任务和新任务
        const retryTasks = tasks.filter(t => t.retry_count > 0);
        const newTasks = tasks.filter(t => t.retry_count === 0);
        
        if (retryTasks.length > 0) {
          console.log(`🔄 发现 ${retryTasks.length} 个重试任务`);
        }
        if (newTasks.length > 0) {
          console.log(`📋 发现 ${newTasks.length} 个新任务`);
        }

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
          
          // 记录任务类型
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
