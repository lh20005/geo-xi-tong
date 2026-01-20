/**
 * 发布任务服务
 * 负责发布任务的本地 CRUD 操作
 * Requirements: Phase 2 - 数据服务层
 */

import { BaseService, PaginationParams, SortParams, PaginatedResult } from './BaseService';
import log from 'electron-log';

/**
 * 发布任务接口
 */
export interface PublishingTask {
  id: string;
  user_id: number;
  article_id: string | null;
  account_id: string;
  platform_id: string;
  status: string;
  config: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  batch_id: string | null;
  batch_order: number;
  interval_minutes: number;
  reservation_id: string | null;
  article_title: string | null;
  article_content: string | null;
  article_keyword: string | null;
  article_image_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 发布记录接口
 */
export interface PublishingRecord {
  id: string;
  user_id: number;
  article_id: string | null;
  task_id: string | null;
  account_id: string;
  account_name: string | null;
  platform_id: string;
  platform_article_id: string | null;
  platform_url: string | null;
  status: string;
  publishing_status: string;
  published_at: string | null;
  error_message: string | null;
  article_title: string | null;
  article_content: string | null;
  article_keyword: string | null;
  article_image_url: string | null;
  topic_question: string | null;
  article_setting_name: string | null;
  distillation_keyword: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 发布日志接口
 */
export interface PublishingLog {
  id: number;
  task_id: string;
  level: string;
  message: string;
  details: string | null;
  created_at: string;
}

/**
 * 创建任务参数
 */
export interface CreateTaskParams {
  user_id: number;
  article_id?: string;
  account_id: string;
  platform_id: string;
  config: object;
  scheduled_at?: string;
  batch_id?: string;
  batch_order?: number;
  interval_minutes?: number;
  reservation_id?: string;
  // 快照字段
  article_title?: string;
  article_content?: string;
  article_keyword?: string;
  article_image_url?: string;
}

/**
 * 任务查询参数
 */
export interface TaskQueryParams extends PaginationParams, SortParams {
  status?: string;
  platform_id?: string;
  batch_id?: string;
}

/**
 * 任务服务类
 */
class TaskService extends BaseService<PublishingTask> {
  private static instance: TaskService;

  private constructor() {
    super('publishing_tasks', 'TaskService');
  }

  static getInstance(): TaskService {
    if (!TaskService.instance) {
      TaskService.instance = new TaskService();
    }
    return TaskService.instance;
  }

  /**
   * 创建任务
   */
  create(params: CreateTaskParams): PublishingTask {
    try {
      const id = this.generateId();
      const now = this.now();

      this.db.prepare(`
        INSERT INTO publishing_tasks (
          id, user_id, article_id, account_id, platform_id, status, config,
          scheduled_at, batch_id, batch_order, interval_minutes, reservation_id,
          article_title, article_content, article_keyword, article_image_url,
          retry_count, max_retries, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 3, ?, ?)
      `).run(
        id,
        params.user_id,
        params.article_id || null,
        params.account_id,
        params.platform_id,
        JSON.stringify(params.config),
        params.scheduled_at || null,
        params.batch_id || null,
        params.batch_order || 0,
        params.interval_minutes || 0,
        params.reservation_id || null,
        params.article_title || null,
        params.article_content || null,
        params.article_keyword || null,
        params.article_image_url || null,
        now,
        now
      );

      log.info(`TaskService: Created task ${id}`);
      return this.findById(id)!;
    } catch (error) {
      log.error('TaskService: create failed:', error);
      throw error;
    }
  }

  /**
   * 更新任务状态
   */
  updateStatus(id: string, status: string, errorMessage?: string): boolean {
    try {
      const updates: string[] = ['status = ?', 'updated_at = ?'];
      const values: any[] = [status, this.now()];

      if (status === 'running') {
        updates.push('started_at = ?');
        values.push(this.now());
      } else if (status === 'completed' || status === 'failed') {
        updates.push('completed_at = ?');
        values.push(this.now());
      }

      if (errorMessage !== undefined) {
        updates.push('error_message = ?');
        values.push(errorMessage);
      }

      values.push(id);

      const sql = `UPDATE publishing_tasks SET ${updates.join(', ')} WHERE id = ?`;
      const result = this.db.prepare(sql).run(...values);

      log.info(`TaskService: Updated task ${id} status to ${status}`);
      return result.changes > 0;
    } catch (error) {
      log.error('TaskService: updateStatus failed:', error);
      throw error;
    }
  }

  /**
   * 增加重试次数
   */
  incrementRetryCount(id: string): number {
    try {
      this.db.prepare(`
        UPDATE publishing_tasks 
        SET retry_count = retry_count + 1, updated_at = ?
        WHERE id = ?
      `).run(this.now(), id);

      const task = this.findById(id);
      return task?.retry_count || 0;
    } catch (error) {
      log.error('TaskService: incrementRetryCount failed:', error);
      throw error;
    }
  }

  /**
   * 查询任务
   */
  query(userId: number, params: TaskQueryParams): PaginatedResult<PublishingTask> {
    try {
      const page = params.page || 1;
      const pageSize = params.pageSize || 20;
      const offset = (page - 1) * pageSize;

      const whereClauses: string[] = ['user_id = ?'];
      const queryParams: any[] = [userId];

      if (params.status) {
        whereClauses.push('status = ?');
        queryParams.push(params.status);
      }
      if (params.platform_id) {
        whereClauses.push('platform_id = ?');
        queryParams.push(params.platform_id);
      }
      if (params.batch_id) {
        whereClauses.push('batch_id = ?');
        queryParams.push(params.batch_id);
      }

      const whereClause = whereClauses.join(' AND ');
      const sortField = params.sortField || 'created_at';
      const sortOrder = params.sortOrder || 'desc';

      const countResult = this.db.prepare(
        `SELECT COUNT(*) as total FROM publishing_tasks WHERE ${whereClause}`
      ).get(...queryParams) as { total: number };

      const data = this.db.prepare(`
        SELECT * FROM publishing_tasks 
        WHERE ${whereClause}
        ORDER BY ${sortField} ${sortOrder.toUpperCase()}
        LIMIT ? OFFSET ?
      `).all(...queryParams, pageSize, offset) as PublishingTask[];

      return {
        data,
        total: countResult.total,
        page,
        pageSize,
        totalPages: Math.ceil(countResult.total / pageSize)
      };
    } catch (error) {
      log.error('TaskService: query failed:', error);
      throw error;
    }
  }

  /**
   * 获取待执行的任务
   */
  findPendingTasks(userId: number): PublishingTask[] {
    try {
      return this.db.prepare(`
        SELECT * FROM publishing_tasks 
        WHERE user_id = ? AND status = 'pending'
        ORDER BY scheduled_at ASC NULLS LAST, created_at ASC
      `).all(userId) as PublishingTask[];
    } catch (error) {
      log.error('TaskService: findPendingTasks failed:', error);
      throw error;
    }
  }

  /**
   * 获取批次任务
   */
  findByBatchId(batchId: string): PublishingTask[] {
    try {
      return this.db.prepare(`
        SELECT * FROM publishing_tasks 
        WHERE batch_id = ?
        ORDER BY batch_order ASC
      `).all(batchId) as PublishingTask[];
    } catch (error) {
      log.error('TaskService: findByBatchId failed:', error);
      throw error;
    }
  }

  // ==================== 发布记录操作 ====================

  /**
   * 创建发布记录
   */
  createRecord(params: {
    user_id: number;
    article_id?: string;
    task_id?: string;
    account_id: string;
    account_name?: string;
    platform_id: string;
    platform_article_id?: string;
    platform_url?: string;
    status?: string;
    publishing_status?: string;
    article_title?: string;
    article_content?: string;
    article_keyword?: string;
    article_image_url?: string;
  }): PublishingRecord {
    try {
      const id = this.generateId();
      const now = this.now();

      this.db.prepare(`
        INSERT INTO publishing_records (
          id, user_id, article_id, task_id, account_id, account_name, platform_id,
          platform_article_id, platform_url, status, publishing_status,
          article_title, article_content, article_keyword, article_image_url,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        params.user_id,
        params.article_id || null,
        params.task_id || null,
        params.account_id,
        params.account_name || null,
        params.platform_id,
        params.platform_article_id || null,
        params.platform_url || null,
        params.status || 'pending',
        params.publishing_status || 'draft',
        params.article_title || null,
        params.article_content || null,
        params.article_keyword || null,
        params.article_image_url || null,
        now,
        now
      );

      log.info(`TaskService: Created publishing record ${id}`);
      return this.findRecordById(id)!;
    } catch (error) {
      log.error('TaskService: createRecord failed:', error);
      throw error;
    }
  }

  /**
   * 查找发布记录
   */
  findRecordById(id: string): PublishingRecord | null {
    try {
      const result = this.db.prepare(
        'SELECT * FROM publishing_records WHERE id = ?'
      ).get(id) as PublishingRecord | undefined;
      
      return result || null;
    } catch (error) {
      log.error('TaskService: findRecordById failed:', error);
      throw error;
    }
  }

  /**
   * 更新发布记录
   */
  updateRecord(id: string, params: {
    platform_article_id?: string;
    platform_url?: string;
    status?: string;
    publishing_status?: string;
    published_at?: string;
    error_message?: string;
  }): boolean {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (params.platform_article_id !== undefined) {
        updates.push('platform_article_id = ?');
        values.push(params.platform_article_id);
      }
      if (params.platform_url !== undefined) {
        updates.push('platform_url = ?');
        values.push(params.platform_url);
      }
      if (params.status !== undefined) {
        updates.push('status = ?');
        values.push(params.status);
      }
      if (params.publishing_status !== undefined) {
        updates.push('publishing_status = ?');
        values.push(params.publishing_status);
      }
      if (params.published_at !== undefined) {
        updates.push('published_at = ?');
        values.push(params.published_at);
      }
      if (params.error_message !== undefined) {
        updates.push('error_message = ?');
        values.push(params.error_message);
      }

      if (updates.length === 0) return true;

      updates.push('updated_at = ?');
      values.push(this.now());
      values.push(id);

      const sql = `UPDATE publishing_records SET ${updates.join(', ')} WHERE id = ?`;
      const result = this.db.prepare(sql).run(...values);

      return result.changes > 0;
    } catch (error) {
      log.error('TaskService: updateRecord failed:', error);
      throw error;
    }
  }

  // ==================== 发布日志操作 ====================

  /**
   * 添加日志
   */
  addLog(taskId: string, level: string, message: string, details?: any): void {
    try {
      this.db.prepare(`
        INSERT INTO publishing_logs (task_id, level, message, details, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        taskId,
        level,
        message,
        details ? JSON.stringify(details) : null,
        this.now()
      );
    } catch (error) {
      log.error('TaskService: addLog failed:', error);
    }
  }

  /**
   * 获取任务日志
   */
  getLogs(taskId: string): PublishingLog[] {
    try {
      return this.db.prepare(
        'SELECT * FROM publishing_logs WHERE task_id = ? ORDER BY created_at ASC'
      ).all(taskId) as PublishingLog[];
    } catch (error) {
      log.error('TaskService: getLogs failed:', error);
      throw error;
    }
  }

  /**
   * 获取任务统计
   */
  getStats(userId: number): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    byPlatform: { platform_id: string; count: number; success: number }[];
  } {
    try {
      const total = this.count(userId);

      const statusCounts = this.db.prepare(`
        SELECT status, COUNT(*) as count
        FROM publishing_tasks
        WHERE user_id = ?
        GROUP BY status
      `).all(userId) as { status: string; count: number }[];

      const statusMap = new Map(statusCounts.map(s => [s.status, s.count]));

      const byPlatform = this.db.prepare(`
        SELECT 
          platform_id,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success
        FROM publishing_tasks
        WHERE user_id = ?
        GROUP BY platform_id
      `).all(userId) as { platform_id: string; count: number; success: number }[];

      return {
        total,
        pending: statusMap.get('pending') || 0,
        running: statusMap.get('running') || 0,
        completed: statusMap.get('completed') || 0,
        failed: statusMap.get('failed') || 0,
        byPlatform
      };
    } catch (error) {
      log.error('TaskService: getStats failed:', error);
      throw error;
    }
  }

  // ==================== 待上报分析队列 ====================

  /**
   * 添加待上报的分析数据
   */
  addPendingAnalytics(reportType: string, reportData: object): void {
    try {
      this.db.prepare(`
        INSERT INTO pending_analytics (report_type, report_data, retry_count, created_at)
        VALUES (?, ?, 0, ?)
      `).run(reportType, JSON.stringify(reportData), this.now());
      
      log.debug(`TaskService: Added pending analytics: ${reportType}`);
    } catch (error) {
      log.error('TaskService: addPendingAnalytics failed:', error);
    }
  }

  /**
   * 获取待上报的分析数据
   */
  getPendingAnalytics(limit: number = 100): Array<{
    id: number;
    report_type: string;
    report_data: string;
    retry_count: number;
    created_at: string;
  }> {
    try {
      return this.db.prepare(`
        SELECT * FROM pending_analytics
        WHERE retry_count < 5
        ORDER BY created_at ASC
        LIMIT ?
      `).all(limit) as any[];
    } catch (error) {
      log.error('TaskService: getPendingAnalytics failed:', error);
      return [];
    }
  }

  /**
   * 删除已上报的分析数据
   */
  deletePendingAnalytics(ids: number[]): void {
    try {
      if (ids.length === 0) return;
      
      const placeholders = ids.map(() => '?').join(',');
      this.db.prepare(`
        DELETE FROM pending_analytics WHERE id IN (${placeholders})
      `).run(...ids);
      
      log.debug(`TaskService: Deleted ${ids.length} pending analytics`);
    } catch (error) {
      log.error('TaskService: deletePendingAnalytics failed:', error);
    }
  }

  /**
   * 增加待上报数据的重试次数
   */
  incrementPendingAnalyticsRetry(id: number): void {
    try {
      this.db.prepare(`
        UPDATE pending_analytics SET retry_count = retry_count + 1 WHERE id = ?
      `).run(id);
    } catch (error) {
      log.error('TaskService: incrementPendingAnalyticsRetry failed:', error);
    }
  }

  // ==================== 批次操作 ====================

  /**
   * 取消批次中的所有待处理任务
   */
  cancelBatch(batchId: string): { cancelledCount: number } {
    try {
      const result = this.db.prepare(`
        UPDATE publishing_tasks 
        SET status = 'cancelled', 
            updated_at = ?,
            completed_at = ?,
            error_message = '用户手动停止批次'
        WHERE batch_id = ? AND status IN ('pending', 'running')
      `).run(this.now(), this.now(), batchId);

      log.info(`TaskService: Cancelled ${result.changes} tasks in batch ${batchId}`);
      return { cancelledCount: result.changes };
    } catch (error) {
      log.error('TaskService: cancelBatch failed:', error);
      throw error;
    }
  }

  /**
   * 删除批次
   */
  deleteBatch(batchId: string): { deletedCount: number } {
    try {
      // 先删除日志
      this.db.prepare(`
        DELETE FROM publishing_logs 
        WHERE task_id IN (SELECT id FROM publishing_tasks WHERE batch_id = ?)
      `).run(batchId);

      // 再删除任务
      const result = this.db.prepare(`
        DELETE FROM publishing_tasks WHERE batch_id = ?
      `).run(batchId);

      log.info(`TaskService: Deleted ${result.changes} tasks in batch ${batchId}`);
      return { deletedCount: result.changes };
    } catch (error) {
      log.error('TaskService: deleteBatch failed:', error);
      throw error;
    }
  }

  /**
   * 获取批次统计
   */
  getBatchStats(batchId: string): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    try {
      const statusCounts = this.db.prepare(`
        SELECT status, COUNT(*) as count
        FROM publishing_tasks
        WHERE batch_id = ?
        GROUP BY status
      `).all(batchId) as { status: string; count: number }[];

      const statusMap = new Map(statusCounts.map(s => [s.status, s.count]));
      const total = statusCounts.reduce((sum, s) => sum + s.count, 0);

      return {
        total,
        pending: statusMap.get('pending') || 0,
        running: statusMap.get('running') || 0,
        completed: statusMap.get('completed') || 0,
        failed: statusMap.get('failed') || 0,
        cancelled: statusMap.get('cancelled') || 0
      };
    } catch (error) {
      log.error('TaskService: getBatchStats failed:', error);
      throw error;
    }
  }
}


export const taskService = TaskService.getInstance();
export { TaskService };
