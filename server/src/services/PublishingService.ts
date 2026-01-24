import { pool } from '../db/database';
import { logBroadcaster } from './LogBroadcaster';

export interface PublishingTask {
  id: number;
  article_id: number;
  account_id: number;
  account_name?: string;
  real_username?: string;
  platform_id: string;
  user_id: number; // 添加 user_id 字段
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
  // 文章快照字段（创建任务时保存，确保原文章删除后仍可发布）
  article_title?: string;
  article_content?: string;
  article_keyword?: string;
  article_image_url?: string;
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
   * 重要：创建任务时会保存文章快照，确保即使原文章被删除，任务仍可执行
   */
  async createTask(input: CreateTaskInput): Promise<PublishingTask> {
    // 调试日志：记录收到的输入
    console.log(`📝 PublishingService.createTask 收到: article_id=${input.article_id} (type: ${typeof input.article_id})`);
    
    // 验证 scheduled_at 必须是未来时间
    if (input.scheduled_at) {
      const now = new Date();
      if (input.scheduled_at <= now) {
        throw new Error('定时发布时间必须晚于当前时间');
      }
    }

    // 获取文章内容和蒸馏信息用于快照（在创建任务时保存，避免文章删除后丢失）
    const articleResult = await pool.query(
      `SELECT 
        a.title, a.content, a.keyword, a.image_url,
        COALESCE(a.topic_question_snapshot, t.question) as topic_question,
        COALESCE(a.distillation_keyword_snapshot, d.keyword) as distillation_keyword,
        COALESCE(gt.article_setting_name, ast.name) as article_setting_name
       FROM articles a
       LEFT JOIN topics t ON a.topic_id = t.id
       LEFT JOIN distillations d ON a.distillation_id = d.id
       LEFT JOIN generation_tasks gt ON a.task_id = gt.id
       LEFT JOIN article_settings ast ON gt.article_setting_id = ast.id
       WHERE a.id = $1`,
      [input.article_id]
    );
    
    if (articleResult.rows.length === 0) {
      throw new Error('文章不存在');
    }
    
    const article = articleResult.rows[0];

    const result = await pool.query(
      `INSERT INTO publishing_tasks 
       (article_id, account_id, platform_id, user_id, config, scheduled_at, status, batch_id, batch_order, interval_minutes,
        article_title, article_content, article_keyword, article_image_url,
        topic_question_snapshot, distillation_keyword_snapshot, article_setting_name_snapshot) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
       RETURNING id, article_id, account_id, platform_id, user_id, config, scheduled_at, status, 
                 batch_id, batch_order, interval_minutes, retry_count, max_retries,
                 created_at, updated_at, article_title, article_keyword`,
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
        input.interval_minutes || 0,
        article.title,
        article.content,
        article.keyword,
        article.image_url,
        article.topic_question || '',
        article.distillation_keyword || '',
        article.article_setting_name || ''
      ]
    );

    // 调试日志：记录插入结果
    console.log(`📝 数据库插入结果: id=${result.rows[0].id}, article_id=${result.rows[0].article_id}, 快照已保存`);

    return this.formatTask(result.rows[0]);
  }

  /**
   * 获取任务详情
   */
  async getTaskById(taskId: number): Promise<PublishingTask | null> {
    // 优化：排除 article_content 大字段
    const result = await pool.query(
      `SELECT id, user_id, article_id, account_id, platform_id,
              status, config, scheduled_at, started_at, completed_at,
              error_message, retry_count, max_retries, batch_id,
              batch_order, interval_minutes, created_at, updated_at,
              article_title, article_keyword, article_image_url
       FROM publishing_tasks WHERE id = $1`,
      [taskId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatTask(result.rows[0]);
  }

  /**
   * 获取任务详情（用于执行任务，包含 article_content）
   * 仅在实际执行发布时调用，不用于列表展示
   */
  async getTaskForExecution(taskId: number): Promise<PublishingTask | null> {
    const result = await pool.query(
      `SELECT id, user_id, article_id, account_id, platform_id,
              status, config, scheduled_at, started_at, completed_at,
              error_message, retry_count, max_retries, batch_id,
              batch_order, interval_minutes, created_at, updated_at,
              article_title, article_content, article_keyword, article_image_url
       FROM publishing_tasks WHERE id = $1`,
      [taskId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // 手动构建包含 article_content 的任务对象
    const row = result.rows[0];
    const task = this.formatTask(row);
    task.article_content = row.article_content;
    return task;
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
    // 优化：排除 article_content 大字段，减少带宽
    // 优化：直接使用 pa.real_username 而不是查询整个 credentials（平均110KB/账号）再解密
    const offset = (page - 1) * pageSize;
    const dataResult = await pool.query(
      `SELECT 
        pt.id, pt.user_id, pt.article_id, pt.account_id, pt.platform_id,
        pt.status, pt.config, pt.scheduled_at, pt.started_at, pt.completed_at,
        pt.error_message, pt.retry_count, pt.max_retries, pt.batch_id,
        pt.batch_order, pt.interval_minutes, pt.created_at, pt.updated_at,
        pt.article_title, pt.article_keyword, pt.article_image_url,
        pa.account_name,
        pa.real_username
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
    // 防止并发执行：如果尝试将状态更新为 running，使用原子更新确保唯一性
    if (status === 'running') {
      // 先进行间隔检查（在设置 started_at 之前）
      const taskRes = await pool.query('SELECT batch_id, batch_order, status FROM publishing_tasks WHERE id = $1', [taskId]);
      if (taskRes.rows.length === 0) {
        throw new Error('任务不存在');
      }
      
      // 如果任务已经是 running，则认为是幂等操作，不报错
      if (taskRes.rows[0].status === 'running') {
        return;
      }
      
      const { batch_id, batch_order } = taskRes.rows[0];
      
      // 批次任务的间隔检查
      if (batch_id && batch_order > 0) {
        // 查找最近的一个前序任务（不再假设 order 连续）
        const prevTaskRes = await pool.query(
          `SELECT id, status, completed_at, interval_minutes FROM publishing_tasks 
           WHERE batch_id = $1 AND batch_order < $2
           ORDER BY batch_order DESC
           LIMIT 1`,
          [batch_id, batch_order]
        );

        if (prevTaskRes.rows.length > 0) {
          const prevTask = prevTaskRes.rows[0];
          
          // 调试日志
          console.log(`[间隔检查] Task #${taskId} (Order ${batch_order}) -> Prev Task #${prevTask.id} (Status: ${prevTask.status})`);

          // 1. 严格串行检查：前一个任务必须已完成
          if (prevTask.status === 'pending' || prevTask.status === 'running') {
            console.warn(`[间隔检查] 拦截：前一个任务 #${prevTask.id} 尚未完成`);
            throw new Error(`顺序控制：前一个任务 #${prevTask.id} 尚未完成，请稍后重试`);
          }

          // 2. 时间间隔检查
          if (prevTask.completed_at) {
            const completedAt = new Date(prevTask.completed_at).getTime();
            const intervalMinutes = Number(prevTask.interval_minutes) || 0; // 强制转为数字
            const nextAllowedTime = completedAt + intervalMinutes * 60 * 1000;
            const now = Date.now();

            console.log(`[间隔检查] Completed: ${prevTask.completed_at}, Interval: ${intervalMinutes}m, Allow: ${new Date(nextAllowedTime).toISOString()}, Now: ${new Date(now).toISOString()}`);

            if (now < nextAllowedTime) {
              const waitSeconds = Math.ceil((nextAllowedTime - now) / 1000);
              throw new Error(`间隔控制：需等待 ${waitSeconds} 秒后才能执行`);
            }
          } else {
            // 任务已完成但没有时间戳？属于异常情况，建议等待
            console.warn(`[间隔检查] 前一个任务 #${prevTask.id} 已完成但无 completed_at`);
          }
        }
      }
      
      // 间隔检查通过后，再执行原子更新
      // 使用带条件的 UPDATE 语句，确保同一用户同一时间只有一个任务在运行
      const result = await pool.query(
        `UPDATE publishing_tasks 
         SET status = 'running', 
             started_at = CURRENT_TIMESTAMP, 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
           AND status = 'pending'
           AND NOT EXISTS (
             SELECT 1 FROM publishing_tasks 
             WHERE user_id = (SELECT user_id FROM publishing_tasks WHERE id = $1) 
             AND status = 'running' 
             AND id != $1
           )
         RETURNING id`,
        [taskId]
      );

      if (result.rows.length === 0) {
        // 更新失败，需要区分是任务不存在还是并发冲突
        const check = await pool.query('SELECT status FROM publishing_tasks WHERE id = $1', [taskId]);
        
        if (check.rows.length === 0) {
          throw new Error('任务不存在');
        }
        
        // 如果当前任务已经是 running，则认为是幂等操作，不报错
        if (check.rows[0].status === 'running') {
          return;
        }
        
        // 否则，说明有其他任务正在运行或状态已变更
        throw new Error('并发控制：当前已有正在执行的任务，请等待其完成');
      }
      
      // 更新成功，直接返回
      return;
    }

    const updates: string[] = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [status];
    let paramIndex = 2;

    // 如果状态回退到 pending（重试场景），清除 started_at
    if (status === 'pending') {
      updates.push('started_at = NULL');
    }

    if (status === 'success' || status === 'failed' || status === 'cancelled' || status === 'timeout') {
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

    // 如果发布成功，记录配额使用
    if (status === 'success') {
      try {
        // 获取任务信息
        const taskResult = await pool.query(
          'SELECT user_id, article_id, platform_id FROM publishing_tasks WHERE id = $1',
          [taskId]
        );
        
        if (taskResult.rows.length > 0) {
          const { user_id, article_id, platform_id } = taskResult.rows[0];
          
          // 记录发布配额使用
          const { usageTrackingService } = await import('./UsageTrackingService');
          await usageTrackingService.recordUsage(
            user_id,
            'publish_per_month',
            'publish',
            taskId,
            1,
            { articleId: article_id, platformId: platform_id }
          );
          console.log(`✅ 发布配额已记录 (任务 #${taskId}, 用户 #${user_id})`);
        }
      } catch (error: any) {
        console.error(`记录发布配额失败（不影响发布结果）:`, error.message);
      }
    }
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
    // 优化：排除 article_content 大字段
    const result = await pool.query(
      `SELECT id, user_id, article_id, account_id, platform_id,
              status, config, scheduled_at, started_at, completed_at,
              error_message, retry_count, max_retries, batch_id,
              batch_order, interval_minutes, created_at, updated_at,
              article_title, article_keyword, article_image_url
       FROM publishing_tasks 
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
    // 优化：排除 article_content 大字段
    const result = await pool.query(
      `SELECT id, user_id, article_id, account_id, platform_id,
              status, config, scheduled_at, started_at, completed_at,
              error_message, retry_count, max_retries, batch_id,
              batch_order, interval_minutes, created_at, updated_at,
              article_title, article_keyword, article_image_url
       FROM publishing_tasks 
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
    // 优化：排除 article_content 大字段
    const result = await pool.query(
      `SELECT id, user_id, article_id, account_id, platform_id,
              status, config, scheduled_at, started_at, completed_at,
              error_message, retry_count, max_retries, batch_id,
              batch_order, interval_minutes, created_at, updated_at,
              article_title, article_keyword, article_image_url
       FROM publishing_tasks 
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
      user_id: row.user_id, // 添加 user_id 字段
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
      updated_at: row.updated_at,
      // 文章快照字段（优化：不返回 article_content 大字段，减少带宽）
      article_title: row.article_title,
      // article_content 已从列表查询中排除，仅在执行任务时从数据库读取
      article_keyword: row.article_keyword,
      article_image_url: row.article_image_url,
      // 优化：直接使用 real_username 字段，不再从 credentials 解密（减少 ~110KB/账号 的数据传输）
      real_username: row.real_username
    };

    return task;
  }

  /**
   * 清理旧的已完成任务
   * 删除超过指定天数的 success/failed/cancelled/timeout 状态的任务
   * @param daysToKeep 保留天数，默认30天
   * @returns 删除的任务数量
   */
  async cleanupOldTasks(daysToKeep: number = 30): Promise<number> {
    try {
      const result = await pool.query(
        `DELETE FROM publishing_tasks 
         WHERE status IN ('success', 'failed', 'cancelled', 'timeout')
         AND updated_at < NOW() - INTERVAL '1 day' * $1
         RETURNING id`,
        [daysToKeep]
      );
      
      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        console.log(`🧹 清理了 ${deletedCount} 个超过 ${daysToKeep} 天的旧发布任务`);
      }
      return deletedCount;
    } catch (error) {
      console.error('清理旧发布任务失败:', error);
      return 0;
    }
  }

  /**
   * 清理旧的发布记录
   * 删除超过指定天数的发布记录
   * @param daysToKeep 保留天数，默认10天
   * @returns 删除的记录数量
   */
  async cleanupOldRecords(daysToKeep: number = 10): Promise<number> {
    try {
      const result = await pool.query(
        `DELETE FROM publishing_records 
         WHERE created_at < NOW() - INTERVAL '1 day' * $1
         RETURNING id`,
        [daysToKeep]
      );
      
      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        console.log(`🧹 清理了 ${deletedCount} 条超过 ${daysToKeep} 天的旧发布记录`);
      }
      return deletedCount;
    } catch (error) {
      console.error('清理旧发布记录失败:', error);
      return 0;
    }
  }
}

export const publishingService = new PublishingService();
