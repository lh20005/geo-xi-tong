import { publishingService } from './PublishingService';
import { publishingExecutor } from './PublishingExecutor';

/**
 * 批次执行器
 * 负责按顺序执行批次中的任务，每个任务完成后等待指定间隔再执行下一个
 */
export class BatchExecutor {
  private executingBatches: Set<string> = new Set();

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
    console.log(`🚀 开始执行批次 ${batchId}`);

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
        // 在执行每个任务前，检查批次是否还有 pending 任务
        // 如果没有，说明批次已被停止
        const { pool } = require('../db/database');
        const checkResult = await pool.query(
          `SELECT COUNT(*) as pending_count 
           FROM publishing_tasks 
           WHERE batch_id = $1 AND status = 'pending'`,
          [batchId]
        );
        
        const pendingCount = parseInt(checkResult.rows[0].pending_count);
        if (pendingCount === 0) {
          console.log(`🛑 批次 ${batchId} 已被停止，没有待处理任务，终止执行`);
          break;
        }
        
        const task = tasks[i];
        
        // 重新获取任务状态（可能已被用户取消）
        const currentTask = await publishingService.getTaskById(task.id);
        if (!currentTask || currentTask.status !== 'pending') {
          console.log(`⏭️  任务 #${task.id} 状态为 ${currentTask?.status || '不存在'}，跳过`);
          continue;
        }

        console.log(`\n📝 执行批次 ${batchId} 中的第 ${i + 1}/${tasks.length} 个任务 #${task.id}`);
        console.log(`   文章ID: ${task.article_id}, 平台: ${task.platform_id}`);

        try {
          // 执行任务（同步等待完成）
          await publishingExecutor.executeTask(task.id);
          console.log(`✅ 任务 #${task.id} 执行完成`);
        } catch (error: any) {
          console.error(`❌ 任务 #${task.id} 执行失败:`, error.message);
          // 继续执行下一个任务，不中断批次
        }

        // 如果不是最后一个任务，等待间隔时间
        if (i < tasks.length - 1 && task.interval_minutes && task.interval_minutes > 0) {
          const waitMs = task.interval_minutes * 60 * 1000;
          const waitMinutes = task.interval_minutes;
          
          console.log(`⏳ 等待 ${waitMinutes} 分钟后执行下一个任务...`);
          console.log(`   预计下次执行时间: ${new Date(Date.now() + waitMs).toLocaleString('zh-CN')}`);
          
          // 分段等待，每10秒检查一次批次是否被停止
          const checkInterval = 10000; // 10秒
          const totalWaitTime = waitMs;
          let waitedTime = 0;
          
          while (waitedTime < totalWaitTime) {
            const sleepTime = Math.min(checkInterval, totalWaitTime - waitedTime);
            await this.sleep(sleepTime);
            waitedTime += sleepTime;
            
            // 检查批次是否被停止
            const { pool } = require('../db/database');
            const checkResult = await pool.query(
              `SELECT COUNT(*) as pending_count 
               FROM publishing_tasks 
               WHERE batch_id = $1 AND status = 'pending'`,
              [batchId]
            );
            
            const pendingCount = parseInt(checkResult.rows[0].pending_count);
            if (pendingCount === 0) {
              console.log(`🛑 批次 ${batchId} 在等待期间被停止，终止执行`);
              return; // 直接返回，不再继续
            }
          }
          
          console.log(`✅ 等待完成，继续执行下一个任务`);
        }
      }

      console.log(`\n🎉 批次 ${batchId} 执行完成！`);
      
      // 检查批次是否全部完成
      const isCompleted = await publishingService.isBatchCompleted(batchId);
      if (isCompleted) {
        console.log(`✅ 批次 ${batchId} 所有任务已完成`);
      } else {
        console.log(`⚠️  批次 ${batchId} 仍有未完成的任务`);
      }

    } catch (error: any) {
      console.error(`❌ 批次 ${batchId} 执行失败:`, error);
    } finally {
      this.executingBatches.delete(batchId);
    }
  }

  /**
   * 检查并执行所有待执行的批次
   */
  async checkAndExecuteBatches(): Promise<void> {
    try {
      const { pool } = require('../db/database');
      
      // 查找所有有 pending 任务的批次
      const result = await pool.query(`
        SELECT DISTINCT batch_id 
        FROM publishing_tasks 
        WHERE batch_id IS NOT NULL 
        AND status = 'pending'
        AND batch_order = (
          SELECT MIN(batch_order) 
          FROM publishing_tasks t2 
          WHERE t2.batch_id = publishing_tasks.batch_id 
          AND t2.status = 'pending'
        )
      `);

      const batchIds = result.rows.map((row: any) => row.batch_id);

      if (batchIds.length > 0) {
        console.log(`📋 发现 ${batchIds.length} 个待执行的批次`);
        
        for (const batchId of batchIds) {
          // 异步执行批次，不阻塞其他批次
          this.executeBatch(batchId).catch(error => {
            console.error(`批次 ${batchId} 执行失败:`, error);
          });
        }
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
   * 停止整个批次（取消所有 pending 任务）
   */
  async stopBatch(batchId: string): Promise<{ cancelledCount: number }> {
    const { pool } = require('../db/database');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log(`🛑 停止批次 ${batchId}...`);
      
      // 获取所有待处理任务的文章ID
      const articlesResult = await client.query(
        `SELECT DISTINCT article_id 
         FROM publishing_tasks 
         WHERE batch_id = $1 
         AND status = 'pending'`,
        [batchId]
      );
      
      const articleIds = articlesResult.rows.map((row: any) => row.article_id);
      
      // 取消所有 pending 状态的任务
      const result = await client.query(
        `UPDATE publishing_tasks 
         SET status = 'cancelled', 
             updated_at = CURRENT_TIMESTAMP,
             error_message = '用户手动停止批次'
         WHERE batch_id = $1 
         AND status = 'pending'
         RETURNING id`,
        [batchId]
      );
      
      const cancelledCount = result.rows.length;
      
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
      
      // 如果批次正在执行，标记为需要停止
      if (this.executingBatches.has(batchId)) {
        console.log(`⚠️ 批次 ${batchId} 正在执行中，将在当前任务完成后停止`);
      }
      
      return { cancelledCount };
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
