/**
 * 发布任务服务类（PostgreSQL 版本）
 * 
 * 功能：
 * - 管理用户的发布任务
 * - 处理 task_id 字段（设为 NULL）
 * - 管理任务状态
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import log from 'electron-log';

/**
 * 发布任务接口
 */
export interface PublishingTask {
  id: number;
  user_id: number;
  article_id: number;
  platform_account_id: string;
  platform: string;
  task_id?: number | null;  // ⚠️ 始终为 NULL（generation_tasks 表在服务器）
  status: string;
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * 创建发布任务输入
 */
export interface CreatePublishingTaskInput {
  article_id: number;
  platform_account_id: string;
  platform: string;
  scheduled_at?: Date;
  max_retries?: number;
}

/**
 * 更新发布任务输入
 */
export interface UpdatePublishingTaskInput {
  status?: string;
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  retry_count?: number;
}

/**
 * 发布任务服务类
 */
export class PublishingTaskServicePostgres extends BaseServicePostgres<PublishingTask> {
  constructor() {
    super('publishing_tasks', 'PublishingTaskService');
  }

  /**
   * 创建发布任务
   * 
   * 注意：task_id 始终设为 NULL
   */
  async createTask(input: CreatePublishingTaskInput): Promise<PublishingTask> {
    return await this.create({
      ...input,
      task_id: null,  // ⭐ 始终设为 NULL
      status: 'pending',
      retry_count: 0,
      max_retries: input.max_retries || 3
    });
  }

  /**
   * 更新发布任务
   */
  async updateTask(id: number, input: UpdatePublishingTaskInput): Promise<PublishingTask> {
    return await this.update(id, input);
  }

  /**
   * 删除发布任务
   */
  async deleteTask(id: number): Promise<void> {
    await this.delete(id);
  }

  /**
   * 根据状态获取任务
   */
  async getByStatus(status: string): Promise<PublishingTask[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM publishing_tasks WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
        [this.userId, status]
      );

      return result.rows as PublishingTask[];
    } catch (error) {
      log.error('PublishingTaskService: getByStatus 失败:', error);
      throw error;
    }
  }

  /**
   * 根据文章 ID 获取任务
   */
  async getByArticleId(articleId: number): Promise<PublishingTask[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM publishing_tasks WHERE user_id = $1 AND article_id = $2 ORDER BY created_at DESC',
        [this.userId, articleId]
      );

      return result.rows as PublishingTask[];
    } catch (error) {
      log.error('PublishingTaskService: getByArticleId 失败:', error);
      throw error;
    }
  }

  /**
   * 根据平台获取任务
   */
  async getByPlatform(platform: string): Promise<PublishingTask[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM publishing_tasks WHERE user_id = $1 AND platform = $2 ORDER BY created_at DESC',
        [this.userId, platform]
      );

      return result.rows as PublishingTask[];
    } catch (error) {
      log.error('PublishingTaskService: getByPlatform 失败:', error);
      throw error;
    }
  }

  /**
   * 获取待执行的任务
   */
  async getPendingTasks(): Promise<PublishingTask[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM publishing_tasks 
         WHERE user_id = $1 
         AND status = 'pending' 
         AND (scheduled_at IS NULL OR scheduled_at <= NOW())
         ORDER BY created_at ASC`,
        [this.userId]
      );

      return result.rows as PublishingTask[];
    } catch (error) {
      log.error('PublishingTaskService: getPendingTasks 失败:', error);
      throw error;
    }
  }

  /**
   * 获取待执行的任务（别名方法）
   */
  async findPendingTasks(): Promise<PublishingTask[]> {
    return await this.getPendingTasks();
  }

  /**
   * 更新任务状态
   */
  async updateStatus(id: number, status: string, errorMessage?: string): Promise<void> {
    this.validateUserId();

    try {
      const updateData: any = {
        status,
        updated_at: this.now()
      };

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      if (status === 'running') {
        updateData.started_at = this.now();
      } else if (status === 'completed') {
        updateData.completed_at = this.now();
      }

      await this.update(id, updateData);
      log.info(`PublishingTaskService: 更新任务状态成功, ID: ${id}, 状态: ${status}`);
    } catch (error) {
      log.error('PublishingTaskService: updateStatus 失败:', error);
      throw error;
    }
  }

  /**
   * 根据批次 ID 获取任务
   */
  async findByBatchId(batchId: string): Promise<PublishingTask[]> {
    this.validateUserId();

    try {
      // 注意：如果 publishing_tasks 表没有 batch_id 字段，这个方法会失败
      // 暂时返回空数组
      log.warn('PublishingTaskService: findByBatchId - batch_id 字段可能不存在');
      return [];
    } catch (error) {
      log.error('PublishingTaskService: findByBatchId 失败:', error);
      throw error;
    }
  }

  /**
   * 取消批次
   */
  async cancelBatch(batchId: string): Promise<void> {
    this.validateUserId();

    try {
      // 注意：如果 publishing_tasks 表没有 batch_id 字段，这个方法会失败
      log.warn('PublishingTaskService: cancelBatch - batch_id 字段可能不存在');
    } catch (error) {
      log.error('PublishingTaskService: cancelBatch 失败:', error);
      throw error;
    }
  }

  /**
   * 删除批次
   */
  async deleteBatch(batchId: string): Promise<void> {
    this.validateUserId();

    try {
      // 注意：如果 publishing_tasks 表没有 batch_id 字段，这个方法会失败
      log.warn('PublishingTaskService: deleteBatch - batch_id 字段可能不存在');
    } catch (error) {
      log.error('PublishingTaskService: deleteBatch 失败:', error);
      throw error;
    }
  }

  /**
   * 获取批次统计
   */
  async getBatchStats(batchId: string): Promise<any> {
    this.validateUserId();

    try {
      // 注意：如果 publishing_tasks 表没有 batch_id 字段，这个方法会失败
      log.warn('PublishingTaskService: getBatchStats - batch_id 字段可能不存在');
      return {
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0
      };
    } catch (error) {
      log.error('PublishingTaskService: getBatchStats 失败:', error);
      throw error;
    }
  }

  /**
   * 开始执行任务
   */
  async startTask(id: number): Promise<PublishingTask> {
    return await this.update(id, {
      status: 'running',
      started_at: new Date()
    });
  }

  /**
   * 完成任务
   */
  async completeTask(id: number): Promise<PublishingTask> {
    return await this.update(id, {
      status: 'completed',
      completed_at: new Date()
    });
  }

  /**
   * 任务失败
   */
  async failTask(id: number, errorMessage: string): Promise<PublishingTask> {
    this.validateUserId();

    try {
      // 获取当前任务
      const task = await this.findById(id);
      if (!task) {
        throw new Error('任务不存在');
      }

      // 检查是否需要重试
      const shouldRetry = task.retry_count < task.max_retries;

      return await this.update(id, {
        status: shouldRetry ? 'pending' : 'failed',
        error_message: errorMessage,
        retry_count: task.retry_count + 1
      });
    } catch (error) {
      log.error('PublishingTaskService: failTask 失败:', error);
      throw error;
    }
  }

  /**
   * 取消任务
   */
  async cancelTask(id: number): Promise<PublishingTask> {
    return await this.update(id, {
      status: 'cancelled'
    });
  }

  /**
   * 获取任务统计
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    byPlatform: Record<string, number>;
  }> {
    this.validateUserId();

    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_tasks WHERE user_id = $1',
        [this.userId]
      );

      const pendingResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_tasks WHERE user_id = $1 AND status = $2',
        [this.userId, 'pending']
      );

      const runningResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_tasks WHERE user_id = $1 AND status = $2',
        [this.userId, 'running']
      );

      const completedResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_tasks WHERE user_id = $1 AND status = $2',
        [this.userId, 'completed']
      );

      const failedResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_tasks WHERE user_id = $1 AND status = $2',
        [this.userId, 'failed']
      );

      const cancelledResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_tasks WHERE user_id = $1 AND status = $2',
        [this.userId, 'cancelled']
      );

      const byPlatformResult = await this.pool.query(
        'SELECT platform, COUNT(*) as count FROM publishing_tasks WHERE user_id = $1 GROUP BY platform',
        [this.userId]
      );

      const byPlatform: Record<string, number> = {};
      byPlatformResult.rows.forEach(row => {
        byPlatform[row.platform] = parseInt(row.count);
      });

      return {
        total: parseInt(totalResult.rows[0].count),
        pending: parseInt(pendingResult.rows[0].count),
        running: parseInt(runningResult.rows[0].count),
        completed: parseInt(completedResult.rows[0].count),
        failed: parseInt(failedResult.rows[0].count),
        cancelled: parseInt(cancelledResult.rows[0].count),
        byPlatform
      };
    } catch (error) {
      log.error('PublishingTaskService: getStats 失败:', error);
      throw error;
    }
  }
}
