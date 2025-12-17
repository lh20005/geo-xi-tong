import { pool } from '../db/database';

export interface PublishingTask {
  id: number;
  article_id: number;
  account_id: number;
  platform_id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  config: any;
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTaskInput {
  article_id: number;
  account_id: number;
  platform_id: string;
  config: {
    title?: string;
    category?: string;
    tags?: string[];
    cover_image?: string;
    [key: string]: any;
  };
  scheduled_at?: Date;
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
       (article_id, account_id, platform_id, config, scheduled_at, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        input.article_id,
        input.account_id,
        input.platform_id,
        JSON.stringify(input.config),
        input.scheduled_at || null,
        input.scheduled_at ? 'pending' : 'pending'
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
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (platform_id) {
      conditions.push(`platform_id = $${paramIndex}`);
      params.push(platform_id);
      paramIndex++;
    }

    if (article_id) {
      conditions.push(`article_id = $${paramIndex}`);
      params.push(article_id);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM publishing_tasks ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取数据
    const offset = (page - 1) * pageSize;
    const dataResult = await pool.query(
      `SELECT * FROM publishing_tasks 
       ${whereClause} 
       ORDER BY created_at DESC 
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

    if (status === 'running' && !errorMessage) {
      updates.push(`started_at = CURRENT_TIMESTAMP`);
    }

    if (status === 'success' || status === 'failed') {
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
   */
  async getPendingScheduledTasks(): Promise<PublishingTask[]> {
    const result = await pool.query(
      `SELECT * FROM publishing_tasks 
       WHERE status = 'pending' 
       AND scheduled_at IS NOT NULL 
       AND scheduled_at <= CURRENT_TIMESTAMP 
       ORDER BY scheduled_at ASC`
    );

    return result.rows.map(row => this.formatTask(row));
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: number): Promise<void> {
    await pool.query(
      `UPDATE publishing_tasks 
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND status = 'pending'`,
      [taskId]
    );
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
    await pool.query(
      `INSERT INTO publishing_logs (task_id, level, message, details) 
       VALUES ($1, $2, $3, $4)`,
      [taskId, level, message, details ? JSON.stringify(details) : null]
    );
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

      // 删除任务日志
      await client.query('DELETE FROM publishing_logs WHERE task_id = $1', [taskId]);

      // 删除任务
      await client.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);

      await client.query('COMMIT');
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
   * 格式化任务数据
   */
  private formatTask(row: any): PublishingTask {
    return {
      id: row.id,
      article_id: row.article_id,
      account_id: row.account_id,
      platform_id: row.platform_id,
      status: row.status,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      scheduled_at: row.scheduled_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      error_message: row.error_message,
      retry_count: row.retry_count,
      max_retries: row.max_retries,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

export const publishingService = new PublishingService();
