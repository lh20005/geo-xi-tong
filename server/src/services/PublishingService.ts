import { pool } from '../db/database';
import { logBroadcaster } from './LogBroadcaster';
import { encryptionService } from './EncryptionService';

export interface PublishingTask {
  id: number;
  article_id: number;
  account_id: number;
  account_name?: string;
  real_username?: string;
  platform_id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'timeout';
  config: {
    timeout_minutes?: number;
    headless?: boolean;
    [key: string]: any;
  };
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  batch_id?: string;
  batch_order?: number;
  interval_minutes?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTaskInput {
  article_id: number;
  account_id: number;
  platform_id: string;
  user_id: number;  // 添加 user_id
  config: {
    title?: string;
    category?: string;
    tags?: string[];
    cover_image?: string;
    [key: string]: any;
  };
  scheduled_at?: Date;
  batch_id?: string;
  batch_order?: number;
  interval_minutes?: number;
}

export interface TaskFilters {
  status?: string;
  platform_id?: string;
  article_id?: number;
  page?: number;
  pageSize?: number;
}

/**
 * 发布任务服务
 */
export class PublishingService {
  /**
   * 创建发布任务
   */
  async createTask(input: CreateTaskInput): Promise<PublishingTask> {
    // 验证 scheduled_at 必须是未来时间
    if (input.scheduled_at) {
      const now = new Date();
      if (input.scheduled_at <= now) {
        throw new Error('定时发布时间必须晚于当前时间');
      }
    }

    const result = await pool.query(
      `INSERT INTO publishing_tasks 
       (article_id, account_id, platform_id, user_id, config, scheduled_at, status, batch_id, batch_order, interval_minutes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [
        input.article_id,
        input.account_id,
        input.platform_id,
        input.user_id,
        JSON.stringify(input.config),
        input.scheduled_at || null,
        input.scheduled_at ? 'pending' : 'pending',
        input.batch_id || null,
        input.batch_order || 0,
        input.interval_minutes || 0
      ]
    );

    return this.formatTask(result.rows[0]);
  }

  /**
   * 获取任务详情
   */
  async getTaskById(taskId: number): Promise<PublishingTask | null> {
    const result = await pool.query(
      'SELECT * FROM publishing_tasks WHERE id = $1',
      [taskId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatTask(result.rows[0]);
  }

  /**
   * 获取任务列表
   */
  async getTasks(filters: TaskFilters = {}): Promise<{ tasks: PublishingTask[]; total: number }> {
    const {
      status,
      platform_id,
      article_id,
      page = 1,
      pageSize = 20
    } = filters;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`pt.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (platform_id) {
      conditions.push(`pt.platform_id = $${paramIndex}`);
      params.push(platform_id);
      paramIndex++;
    }

    if (article_id) {
      conditions.push(`pt.article_id = $${paramIndex}`);
      params.push(article_id);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM publishing_tasks pt ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取数据 - 使用LEFT JOIN获取账号信息
    const offset = (page - 1) * pageSize;
    const dataResult = await pool.query(
      `SELECT 
        pt.*,
        pa.account_name,
        pa.credentials
       FROM publishing_tasks pt
       LEFT JOIN platform_accounts pa ON pt.account_id = pa.id
       ${whereClause} 
       ORDER BY pt.created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    return {
      tasks: dataResult.rows.map(row => this.formatTask(row)),
      total
    };
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(
    taskId: number,
    status: PublishingTask['status'],
    errorMessage?: string
  ): Promise<void> {
    const updates: string[] = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [status];
    let paramIndex = 2;

    if (status === 'running') {
      updates.push(`started_at = CURRENT_TIMESTAMP`);
    }

    if (status === 'success' || status === 'failed' || status === 'cancelled') {
      updates.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    if (errorMessage) {
      updates.push(`error_message = $${paramIndex}`);
      params.push(errorMessage);
      paramIndex++;
    }

    params.push(taskId);

    await pool.query(
      `UPDATE publishing_tasks 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex}`,
      params
    );
  }

  /**
   * 增加重试次数
   */
  async incrementRetryCount(taskId: number): Promise<void> {
    await pool.query(
      'UPDATE publishing_tasks SET retry_count = retry_count + 1 WHERE id = $1',
      [taskId]
    );
  }

  /**
   * 获取待执行的定时任务
   * 包括：
   * - 新任务（scheduled_at <= now）
   * - 重试任务（retry_count > 0）
   * - 立即执行任务（scheduled_at is null）
   */
  async getPendingScheduledTasks(): Promise<PublishingTask[]> {
    const result = await pool.query(
      `SELECT * FROM publishing_tasks 
       WHERE status = 'pending' 
       AND (
         scheduled_at IS NULL 
         OR scheduled_at <= CURRENT_TIMESTAMP
         OR retry_count > 0
       )
       ORDER BY 
         CASE WHEN retry_count > 0 THEN 0 ELSE 1 END,
         scheduled_at ASC NULLS FIRST`
    );

    return result.rows.map(row => this.formatTask(row));
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 获取任务信息
      const taskResult = await client.query(
        'SELECT article_id, status FROM publishing_tasks WHERE id = $1',
        [taskId]
      );
      
      if (taskResult.rows.length === 0) {
        throw new Error('任务不存在');
      }
      
      const task = taskResult.rows[0];
      
      // 只能取消待处理的任务
      if (task.status !== 'pending') {
        throw new Error(`只能取消待处理状态的任务，当前状态: ${task.status}`);
      }
      
      // 更新任务状态为已取消
      await client.query(
        `UPDATE publishing_tasks 
         SET status = 'cancelled', 
             updated_at = CURRENT_TIMESTAMP,
             completed_at = CURRENT_TIMESTAMP,
             error_message = '用户手动取消'
         WHERE id = $1`,
        [taskId]
      );
      
      // 恢复文章的可见状态（清除 publishing_status）
      await client.query(
        `UPDATE articles 
         SET publishing_status = NULL 
         WHERE id = $1`,
        [task.article_id]
      );
      
      await client.query('COMMIT');
      
      console.log(`✅ 任务 #${taskId} 已取消，文章 #${task.article_id} 已恢复可见`);
      
      // 记录取消日志
      await this.logMessage(taskId, 'info', '任务已被用户手动取消');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('取消任务失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 记录日志
   */
  async logMessage(
    taskId: number,
    level: 'info' | 'warning' | 'error',
    message: string,
    details?: any
  ): Promise<void> {
    // 保存到数据库
    await pool.query(
      `INSERT INTO publishing_logs (task_id, level, message, details) 
       VALUES ($1, $2, $3, $4)`,
      [taskId, level, message, details ? JSON.stringify(details) : null]
    );

    // 实时广播日志到连接的客户端
    logBroadcaster.broadcast(taskId, {
      level,
      message,
      timestamp: new Date().toISOString(),
      details
    });
  }

  /**
   * 获取任务日志
   */
  async getTaskLogs(taskId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM publishing_logs 
       WHERE task_id = $1 
       ORDER BY created_at ASC`,
      [taskId]
    );

    return result.rows.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null
    }));
  }

  /**
   * 添加任务日志（别名方法，与 logMessage 功能相同）
   */
  async addTaskLog(
    taskId: number,
    level: 'info' | 'warning' | 'error',
    message: string,
    details?: any
  ): Promise<void> {
    return this.logMessage(taskId, level, message, details);
  }

  /**
   * 删除单个任务
   */
  async deleteTask(taskId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 获取任务信息
      const taskResult = await client.query(
        'SELECT article_id FROM publishing_tasks WHERE id = $1',
        [taskId]
      );
      
      if (taskResult.rows.length === 0) {
        throw new Error('任务不存在');
      }
      
      const articleId = taskResult.rows[0].article_id;

      // 删除任务日志
      await client.query('DELETE FROM publishing_logs WHERE task_id = $1', [taskId]);

      // 删除任务
      await client.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);

      // 恢复文章的可见状态
      await client.query(
        `UPDATE articles 
         SET publishing_status = NULL 
         WHERE id = $1`,
        [articleId]
      );

      await client.query('COMMIT');
      
      console.log(`✅ 任务 #${taskId} 已删除，文章 #${articleId} 已恢复可见`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 批量删除任务
   */
  async deleteTasks(taskIds: number[]): Promise<{ deletedCount: number }> {
    if (taskIds.length === 0) {
      return { deletedCount: 0 };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 获取所有任务的文章ID
      const articlesResult = await client.query(
        `SELECT DISTINCT article_id 
         FROM publishing_tasks 
         WHERE id = ANY($1)`,
        [taskIds]
      );
      
      const articleIds = articlesResult.rows.map((row: any) => row.article_id);

      // 删除任务日志
      await client.query(
        `DELETE FROM publishing_logs WHERE task_id = ANY($1)`,
        [taskIds]
      );

      // 删除任务
      const result = await client.query(
        `DELETE FROM publishing_tasks WHERE id = ANY($1)`,
        [taskIds]
      );

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

      return { deletedCount: result.rowCount || 0 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 删除所有任务（可选择性删除特定状态的任务）
   */
  async deleteAllTasks(status?: string): Promise<{ deletedCount: number }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const whereClause = status ? `WHERE status = $1` : '';
      const params = status ? [status] : [];

      // 获取所有要删除的任务的文章ID
      const articlesResult = await client.query(
        `SELECT DISTINCT article_id FROM publishing_tasks ${whereClause}`,
        params
      );
      const articleIds = articlesResult.rows.map((row: any) => row.article_id);

      // 先获取要删除的任务ID
      const taskIdsResult = await client.query(
        `SELECT id FROM publishing_tasks ${whereClause}`,
        params
      );
      const taskIds = taskIdsResult.rows.map(row => row.id);

      if (taskIds.length > 0) {
        // 删除任务日志
        await client.query(
          `DELETE FROM publishing_logs WHERE task_id = ANY($1)`,
          [taskIds]
        );

        // 删除任务
        const result = await client.query(
          `DELETE FROM publishing_tasks ${whereClause}`,
          params
        );

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
        return { deletedCount: result.rowCount || 0 };
      }

      await client.query('COMMIT');
      return { deletedCount: 0 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取批次中的下一个待执行任务
   */
  async getNextBatchTask(batchId: string): Promise<PublishingTask | null> {
    const result = await pool.query(
      `SELECT * FROM publishing_tasks 
       WHERE batch_id = $1 AND status = 'pending'
       ORDER BY batch_order ASC 
       LIMIT 1`,
      [batchId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatTask(result.rows[0]);
  }

  /**
   * 获取批次中所有任务
   */
  async getBatchTasks(batchId: string): Promise<PublishingTask[]> {
    const result = await pool.query(
      `SELECT * FROM publishing_tasks 
       WHERE batch_id = $1 
       ORDER BY batch_order ASC`,
      [batchId]
    );

    return result.rows.map(row => this.formatTask(row));
  }

  /**
   * 检查批次是否完成
   */
  async isBatchCompleted(batchId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT COUNT(*) as pending_count 
       FROM publishing_tasks 
       WHERE batch_id = $1 AND status IN ('pending', 'running')`,
      [batchId]
    );

    return parseInt(result.rows[0].pending_count) === 0;
  }

  /**
   * 格式化任务数据
   */
  private formatTask(row: any): PublishingTask {
    const task: PublishingTask = {
      id: row.id,
      article_id: row.article_id,
      account_id: row.account_id,
      account_name: row.account_name,
      platform_id: row.platform_id,
      status: row.status,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      scheduled_at: row.scheduled_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      error_message: row.error_message,
      retry_count: row.retry_count,
      max_retries: row.max_retries,
      batch_id: row.batch_id,
      batch_order: row.batch_order,
      interval_minutes: row.interval_minutes,
      created_at: row.created_at,
      updated_at: row.updated_at
    };

    // 解密并提取真实用户名
    if (row.credentials) {
      try {
        const decryptedCredentials = encryptionService.decryptObject(row.credentials);
        if (decryptedCredentials.userInfo && decryptedCredentials.userInfo.username) {
          task.real_username = decryptedCredentials.userInfo.username;
        } else if (decryptedCredentials.username && decryptedCredentials.username !== 'browser_login') {
          task.real_username = decryptedCredentials.username;
        }
      } catch (error) {
        // 解密失败时忽略，使用 account_name 作为后备
        console.error('解密账号凭证失败:', error);
      }
    }

    return task;
  }
}

export const publishingService = new PublishingService();
