import { publishingService } from './PublishingService';
import { publishingExecutor } from './PublishingExecutor';

/**
 * 批次执行器
 * 负责按顺序执行批次中的任务，每个任务完成后等待指定间隔再执行下一个
 */
export class BatchExecutor {
  private executingBatches: Set<string> = new Set();
  private readonly STOP_CHECK_INTERVAL_MS = 1000; // 每1秒检查一次停止信号（原来是10秒）

  /**
   * 检查批次是否应该停止（pending 任务数为 0）
   */
  private async checkStopSignal(batchId: string): Promise<boolean> {
    try {
      const { pool } = require('../db/database');
      const result = await pool.query(
        `SELECT COUNT(*) as pending_count 
         FROM publishing_tasks 
         WHERE batch_id = $1 AND status = 'pending'`,
        [batchId]
      );
      
      const pendingCount = parseInt(result.rows[0].pending_count);
      return pendingCount === 0;
    } catch (error: any) {
      console.error(`⚠️  检查停止信号失败，尝试重试:`, error.message);
      // 查询失败时重试一次
      try {
        const { pool } = require('../db/database');
        const result = await pool.query(
          `SELECT COUNT(*) as pending_count 
           FROM publishing_tasks 
           WHERE batch_id = $1 AND status = 'pending'`,
          [batchId]
        );
        
        const pendingCount = parseInt(result.rows[0].pending_count);
        return pendingCount === 0;
      } catch (retryError: any) {
        console.error(`⚠️  重试检查停止信号失败，假设未停止:`, retryError.message);
        return false; // 双重失败时假设未停止
      }
    }
  }

  /**
   * 等待指定时间，期间频繁检查停止信号
   */
  private async waitWithStopCheck(
    batchId: string,
    intervalMinutes: number
  ): Promise<void> {
    // 验证和规范化间隔时间
    if (intervalMinutes < 0) {
      console.log(`⚠️  间隔时间为负数 (${intervalMinutes})，视为0`);
      intervalMinutes = 0;
    }
    
    if (intervalMinutes > 1440) {
      console.log(`⚠️  间隔时间超过24小时 (${intervalMinutes}分钟)，但仍会执行`);
    }
    
    if (intervalMinutes === 0) {
      console.log(`⏭️  无需等待，立即执行下一个任务`);
      return;
    }
    
    const waitMs = intervalMinutes * 60 * 1000;
    const nextExecutionTime = new Date(Date.now() + waitMs);
    
    console.log(`⏳ 等待 ${intervalMinutes} 分钟后执行下一个任务...`);
    console.log(`   当前时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`   预计下次执行时间: ${nextExecutionTime.toLocaleString('zh-CN')}`);
    console.log(`   等待时长: ${waitMs}ms (${intervalMinutes}分钟)`);
    
    const waitStartTime = Date.now();
    let waitedTime = 0;
    
    // 每1秒检查一次停止信号（原来是10秒）
    while (waitedTime < waitMs) {
      const sleepTime = Math.min(this.STOP_CHECK_INTERVAL_MS, waitMs - waitedTime);
      
      try {
        await this.sleep(sleepTime);
      } catch (error: any) {
        console.error(`⚠️  睡眠被中断:`, error.message);
        // 处理中断并检查停止信号
      }
      
      waitedTime += sleepTime;
      
      // 检查批次是否被停止
      const shouldStop = await this.checkStopSignal(batchId);
      if (shouldStop) {
        const remainingMs = waitMs - waitedTime;
        const remainingMinutes = Math.round(remainingMs / 60000);
        console.log(`🛑 批次 ${batchId} 在等待期间被停止`);
        console.log(`   已等待: ${Math.round(waitedTime / 1000)}秒`);
        console.log(`   剩余等待: ${remainingMinutes}分钟`);
        return; // 立即退出等待
      }
    }
    
    const actualWaitTime = Date.now() - waitStartTime;
    const actualWaitMinutes = Math.round(actualWaitTime / 60000);
    console.log(`✅ 等待完成`);
    console.log(`   预期等待: ${intervalMinutes}分钟`);
    console.log(`   实际等待: ${actualWaitMinutes}分钟 (${actualWaitTime}ms)`);
    
    // 等待完成后最后检查一次停止信号
    const shouldStopFinal = await this.checkStopSignal(batchId);
    if (shouldStopFinal) {
      console.log(`🛑 批次 ${batchId} 在等待完成后被停止，不执行下一个任务`);
      return;
    }
  }

  /**
   * 记录批次摘要，包含最终状态统计
   */
  private async logBatchSummary(batchId: string): Promise<void> {
    try {
      const { pool } = require('../db/database');
      const result = await pool.query(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'success') as success,
           COUNT(*) FILTER (WHERE status = 'failed') as failed,
           COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
           COUNT(*) FILTER (WHERE status = 'pending') as pending
         FROM publishing_tasks 
         WHERE batch_id = $1`,
        [batchId]
      );
      
      const stats = result.rows[0];
      console.log(`📊 批次 ${batchId} 统计:`);
      console.log(`   总任务数: ${stats.total}`);
      console.log(`   成功: ${stats.success}`);
      console.log(`   失败: ${stats.failed}`);
      console.log(`   已取消: ${stats.cancelled}`);
      console.log(`   待处理: ${stats.pending}`);
    } catch (error: any) {
      console.error(`⚠️  获取批次统计失败:`, error.message);
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

    this.executingBatches.add(batchId);
    const startTime = Date.now();
    console.log(`🚀 开始执行批次 ${batchId} at ${new Date().toISOString()}`);

    try {
      // 获取批次中的所有任务
      const tasks = await publishingService.getBatchTasks(batchId);
      
      if (tasks.length === 0) {
        console.log(`⚠️  批次 ${batchId} 没有任务`);
        return;
      }

      console.log(`📋 批次 ${batchId} 共有 ${tasks.length} 个任务`);

      // 按顺序执行每个任务
      for (let i = 0; i < tasks.length; i++) {
        // CRITICAL: 在开始每个任务前检查停止信号
        const shouldStopBefore = await this.checkStopSignal(batchId);
        if (shouldStopBefore) {
          console.log(`🛑 批次 ${batchId} 在任务 ${i + 1} 开始前被停止`);
          break;
        }
        
        const task = tasks[i];
        
        // 从数据库重新获取任务状态（使用新鲜数据，不用缓存）
        const currentTask = await publishingService.getTaskById(task.id);
        if (!currentTask || currentTask.status !== 'pending') {
          console.log(`⏭️  任务 #${task.id} 状态为 ${currentTask?.status || '不存在'}，跳过`);
          continue;
        }

        const taskStartTime = Date.now();
        console.log(`\n📝 [批次 ${batchId}] 执行第 ${i + 1}/${tasks.length} 个任务 #${task.id}`);
        console.log(`   文章ID: ${task.article_id}, 平台: ${task.platform_id}`);
        console.log(`   开始时间: ${new Date().toLocaleString('zh-CN')}`);

        try {
          // 执行任务（同步等待完成，包括浏览器清理）
          await publishingExecutor.executeTask(task.id);
          
          const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
          
          // 检查任务最终状态
          const finalTask = await publishingService.getTaskById(task.id);
          if (finalTask?.status === 'success') {
            console.log(`✅ [批次 ${batchId}] 任务 #${task.id} 执行成功，耗时: ${taskDuration}秒`);
          } else if (finalTask?.status === 'pending') {
            console.log(`🔄 [批次 ${batchId}] 任务 #${task.id} 失败，已标记为待重试 (${finalTask.retry_count}/${finalTask.max_retries})，耗时: ${taskDuration}秒`);
          } else if (finalTask?.status === 'failed') {
            console.log(`❌ [批次 ${batchId}] 任务 #${task.id} 失败，重试次数已用完，耗时: ${taskDuration}秒`);
          }
        } catch (error: any) {
          const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
          console.error(`❌ [批次 ${batchId}] 任务 #${task.id} 执行异常，耗时: ${taskDuration}秒:`, error.message);
          // 继续执行下一个任务，不中断批次
          // 失败的任务会被 handleTaskFailure 标记为 pending 以便重试
        }

        // CRITICAL: 任务完成后检查停止信号
        const shouldStopAfter = await this.checkStopSignal(batchId);
        if (shouldStopAfter) {
          console.log(`🛑 批次 ${batchId} 在任务 ${i + 1} 完成后被停止`);
          break;
        }

        // 如果不是最后一个任务，等待间隔时间
        if (i < tasks.length - 1) {
          const nextTask = tasks[i + 1];
          
          console.log(`\n⏸️  [批次 ${batchId}] 任务 ${i + 1} 完成，准备等待间隔...`);
          
          // 优先使用下一个任务的定时时间（scheduled_at）
          if (nextTask.scheduled_at) {
            const now = Date.now();
            const scheduledTime = new Date(nextTask.scheduled_at).getTime();
            const waitMs = scheduledTime - now;
            
            if (waitMs > 0) {
              const waitMinutes = Math.ceil(waitMs / 60000);
              console.log(`⏰ 下一个任务定时发布时间: ${new Date(nextTask.scheduled_at).toLocaleString('zh-CN')}`);
              console.log(`⏳ 需要等待 ${waitMinutes} 分钟（从任务完成时间计算）`);
              await this.waitWithStopCheck(batchId, waitMinutes);
              console.log(`✅ [批次 ${batchId}] 间隔等待完成，准备执行下一个任务\n`);
            } else {
              console.log(`⏭️  下一个任务的定时时间已到，立即执行\n`);
            }
          } else {
            // 如果没有定时时间，使用 interval_minutes
            const intervalMinutes = task.interval_minutes || 0;
            
            if (intervalMinutes > 0) {
              console.log(`⏳ 使用固定间隔: ${intervalMinutes} 分钟（从任务完成时间计算）`);
              await this.waitWithStopCheck(batchId, intervalMinutes);
              console.log(`✅ [批次 ${batchId}] 间隔等待完成，准备执行下一个任务\n`);
            } else {
              console.log(`⏭️  [批次 ${batchId}] 无需等待，立即执行下一个任务\n`);
            }
          }
        }
      }

      // 记录批次完成
      const duration = Date.now() - startTime;
      console.log(`\n🎉 批次 ${batchId} 执行完成！耗时: ${Math.round(duration / 1000)}秒`);
      
      // 查询并记录最终状态统计
      await this.logBatchSummary(batchId);

    } catch (error: any) {
      console.error(`❌ 批次 ${batchId} 执行失败:`, error);
    } finally {
      // CRITICAL: 始终从执行集合中移除批次
      this.executingBatches.delete(batchId);
      console.log(`✅ 批次 ${batchId} 已从执行队列中移除`);
    }
  }

  /**
   * 检查并执行所有待执行的批次
   * 重要：同一时间只允许一个批次执行，其他批次需要排队等待
   */
  async checkAndExecuteBatches(): Promise<void> {
    try {
      // 关键检查：如果已经有批次在执行，不启动新的批次
      if (this.executingBatches.size > 0) {
        // 不打印日志，避免每10秒刷屏
        return;
      }
      
      const { pool } = require('../db/database');
      
      // 查找所有有 pending 任务的批次，按创建时间排序（先创建的先执行）
      const result = await pool.query(`
        SELECT DISTINCT ON (batch_id) batch_id, MIN(created_at) as first_created
        FROM publishing_tasks 
        WHERE batch_id IS NOT NULL 
        AND status = 'pending'
        GROUP BY batch_id
        ORDER BY batch_id, first_created ASC
      `);

      const batchIds = result.rows.map((row: any) => row.batch_id);

      if (batchIds.length > 0) {
        console.log(`📋 发现 ${batchIds.length} 个待执行的批次`);
        
        // 只执行第一个批次（队列模式：一个一个执行）
        const batchId = batchIds[0];
        
        // 再次检查是否有批次在执行（双重保护）
        if (this.executingBatches.size > 0) {
          console.log(`⏳ 有批次正在执行中，批次 ${batchId} 排队等待`);
          return;
        }
        
        console.log(`🚀 开始执行队列中的第一个批次: ${batchId}`);
        if (batchIds.length > 1) {
          console.log(`📋 剩余 ${batchIds.length - 1} 个批次在队列中等待`);
        }
        
        // 异步执行批次
        this.executeBatch(batchId).catch(error => {
          console.error(`批次 ${batchId} 执行失败:`, error);
        });
      }
    } catch (error) {
      console.error('❌ 检查批次失败:', error);
    }
  }

  /**
   * 睡眠指定毫秒数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取正在执行的批次列表
   */
  getExecutingBatches(): string[] {
    return Array.from(this.executingBatches);
  }

  /**
   * 停止整个批次（取消所有 pending 任务，终止 running 任务）
   */
  async stopBatch(batchId: string): Promise<{ cancelledCount: number; terminatedCount: number }> {
    const { pool } = require('../db/database');
    const { browserAutomationService } = require('./BrowserAutomationService');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log(`🛑 停止批次 ${batchId}...`);
      
      // 获取所有待处理和运行中任务的文章ID
      const articlesResult = await client.query(
        `SELECT DISTINCT article_id 
         FROM publishing_tasks 
         WHERE batch_id = $1 
         AND status IN ('pending', 'running')`,
        [batchId]
      );
      
      const articleIds = articlesResult.rows.map((row: any) => row.article_id);
      
      // 取消所有 pending 状态的任务
      const pendingResult = await client.query(
        `UPDATE publishing_tasks 
         SET status = 'cancelled', 
             updated_at = CURRENT_TIMESTAMP,
             completed_at = CURRENT_TIMESTAMP,
             error_message = '用户手动停止批次'
         WHERE batch_id = $1 
         AND status = 'pending'
         RETURNING id`,
        [batchId]
      );
      
      const cancelledCount = pendingResult.rows.length;
      
      // 终止所有 running 状态的任务
      const runningResult = await client.query(
        `UPDATE publishing_tasks 
         SET status = 'cancelled', 
             updated_at = CURRENT_TIMESTAMP,
             completed_at = CURRENT_TIMESTAMP,
             error_message = '用户手动停止批次（任务被终止）'
         WHERE batch_id = $1 
         AND status = 'running'
         RETURNING id`,
        [batchId]
      );
      
      const terminatedCount = runningResult.rows.length;
      
      // 恢复所有相关文章的可见状态
      if (articleIds.length > 0) {
        await client.query(
          `UPDATE articles 
           SET publishing_status = NULL 
           WHERE id = ANY($1)`,
          [articleIds]
        );
        
        console.log(`✅ 已恢复 ${articleIds.length} 篇文章的可见状态`);
      }
      
      await client.query('COMMIT');
      
      console.log(`✅ 已取消批次 ${batchId} 中的 ${cancelledCount} 个待处理任务`);
      console.log(`✅ 已终止批次 ${batchId} 中的 ${terminatedCount} 个运行中任务`);
      console.log(`✅ 已清除 ${articleIds.length} 篇文章的锁定状态`);
      
      // 为每个取消的任务记录日志
      const { publishingService } = require('./PublishingService');
      for (const row of pendingResult.rows) {
        await publishingService.logMessage(row.id, 'info', '批次已被用户手动停止，任务已取消');
      }
      for (const row of runningResult.rows) {
        await publishingService.logMessage(row.id, 'warning', '批次已被用户手动停止，任务被强制终止');
      }
      
      // 如果有运行中的任务被终止，强制关闭浏览器
      if (terminatedCount > 0) {
        console.log(`🔄 正在强制关闭浏览器...`);
        try {
          await browserAutomationService.forceCloseBrowser();
          console.log(`✅ 浏览器已强制关闭`);
        } catch (browserError: any) {
          console.error(`⚠️ 关闭浏览器失败:`, browserError.message);
        }
      }
      
      // 如果批次正在执行，标记为需要停止
      if (this.executingBatches.has(batchId)) {
        console.log(`⚠️ 批次 ${batchId} 正在执行中，已标记停止`);
      }
      
      return { cancelledCount, terminatedCount };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ 停止批次 ${batchId} 失败:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 删除整个批次（删除所有任务）
   */
  async deleteBatch(batchId: string): Promise<{ deletedCount: number }> {
    const { pool } = require('../db/database');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log(`🗑️ 删除批次 ${batchId}...`);
      
      // 获取所有任务的文章ID（包括所有状态）
      const articlesResult = await client.query(
        `SELECT DISTINCT article_id 
         FROM publishing_tasks 
         WHERE batch_id = $1`,
        [batchId]
      );
      
      const articleIds = articlesResult.rows.map((row: any) => row.article_id);
      
      // 删除所有任务的日志
      await client.query(
        `DELETE FROM publishing_logs 
         WHERE task_id IN (
           SELECT id FROM publishing_tasks WHERE batch_id = $1
         )`,
        [batchId]
      );
      
      // 删除所有任务
      const result = await client.query(
        `DELETE FROM publishing_tasks 
         WHERE batch_id = $1
         RETURNING id`,
        [batchId]
      );
      
      const deletedCount = result.rows.length;
      
      // 恢复所有相关文章的可见状态
      if (articleIds.length > 0) {
        await client.query(
          `UPDATE articles 
           SET publishing_status = NULL 
           WHERE id = ANY($1)`,
          [articleIds]
        );
        
        console.log(`✅ 已恢复 ${articleIds.length} 篇文章的可见状态`);
      }
      
      await client.query('COMMIT');
      
      console.log(`✅ 已删除批次 ${batchId} 中的 ${deletedCount} 个任务`);
      
      return { deletedCount };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ 删除批次 ${batchId} 失败:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取批次信息
   */
  async getBatchInfo(batchId: string): Promise<any> {
    try {
      const { pool } = require('../db/database');
      
      const result = await pool.query(
        `SELECT 
           COUNT(*) as total_tasks,
           COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
           COUNT(*) FILTER (WHERE status = 'running') as running_tasks,
           COUNT(*) FILTER (WHERE status = 'success') as success_tasks,
           COUNT(*) FILTER (WHERE status = 'failed') as failed_tasks,
           COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_tasks,
           MIN(created_at) as created_at,
           MAX(interval_minutes) as interval_minutes
         FROM publishing_tasks 
         WHERE batch_id = $1`,
        [batchId]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error(`❌ 获取批次信息失败:`, error);
      throw error;
    }
  }
}

export const batchExecutor = new BatchExecutor();
