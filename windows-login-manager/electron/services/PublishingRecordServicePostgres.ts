/**
 * 发布记录服务类（PostgreSQL 版本）
 * 
 * 功能：
 * - 管理用户的发布记录
 * - 记录发布结果和详情
 * - 处理 task_id 字段（需要验证是否存在）
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import log from 'electron-log';

/**
 * 发布记录接口
 */
export interface PublishingRecord {
  id: number;
  user_id: number;
  task_id: number;
  article_id: number;
  platform: string;
  platform_account_id: string;
  status: string;
  platform_post_id?: string;
  platform_url?: string;
  error_message?: string;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * 创建发布记录输入
 */
export interface CreatePublishingRecordInput {
  task_id: number;
  article_id: number;
  platform: string;
  platform_account_id: string;
  status: string;
  platform_post_id?: string;
  platform_url?: string;
  error_message?: string;
  published_at?: Date;
}

/**
 * 更新发布记录输入
 */
export interface UpdatePublishingRecordInput {
  status?: string;
  platform_post_id?: string;
  platform_url?: string;
  error_message?: string;
  published_at?: Date;
}

/**
 * 发布记录服务类
 * 
 * 注意：需要验证 task_id 字段是否引用 generation_tasks 表
 */
export class PublishingRecordServicePostgres extends BaseServicePostgres<PublishingRecord> {
  constructor() {
    super('publishing_records', 'PublishingRecordService');
  }

  /**
   * 创建发布记录
   */
  async createRecord(input: CreatePublishingRecordInput): Promise<PublishingRecord> {
    return await this.create(input);
  }

  /**
   * 更新发布记录
   */
  async updateRecord(id: number, input: UpdatePublishingRecordInput): Promise<PublishingRecord> {
    return await this.update(id, input);
  }

  /**
   * 删除发布记录
   */
  async deleteRecord(id: number): Promise<void> {
    await this.delete(id);
  }

  /**
   * 根据任务 ID 获取记录
   */
  async getByTaskId(taskId: number): Promise<PublishingRecord[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM publishing_records WHERE user_id = $1 AND task_id = $2 ORDER BY created_at DESC',
        [this.userId, taskId]
      );

      return result.rows as PublishingRecord[];
    } catch (error) {
      log.error('PublishingRecordService: getByTaskId 失败:', error);
      throw error;
    }
  }

  /**
   * 根据任务 ID 获取记录（别名方法）
   */
  async findByTaskId(taskId: number): Promise<PublishingRecord[]> {
    return await this.getByTaskId(taskId);
  }

  /**
   * 根据文章 ID 获取记录
   */
  async getByArticleId(articleId: number): Promise<PublishingRecord[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM publishing_records WHERE user_id = $1 AND article_id = $2 ORDER BY created_at DESC',
        [this.userId, articleId]
      );

      return result.rows as PublishingRecord[];
    } catch (error) {
      log.error('PublishingRecordService: getByArticleId 失败:', error);
      throw error;
    }
  }

  /**
   * 根据平台获取记录
   */
  async getByPlatform(platform: string): Promise<PublishingRecord[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM publishing_records WHERE user_id = $1 AND platform = $2 ORDER BY created_at DESC',
        [this.userId, platform]
      );

      return result.rows as PublishingRecord[];
    } catch (error) {
      log.error('PublishingRecordService: getByPlatform 失败:', error);
      throw error;
    }
  }

  /**
   * 根据状态获取记录
   */
  async getByStatus(status: string): Promise<PublishingRecord[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM publishing_records WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
        [this.userId, status]
      );

      return result.rows as PublishingRecord[];
    } catch (error) {
      log.error('PublishingRecordService: getByStatus 失败:', error);
      throw error;
    }
  }

  /**
   * 获取成功的发布记录
   */
  async getSuccessfulRecords(): Promise<PublishingRecord[]> {
    return await this.getByStatus('success');
  }

  /**
   * 获取失败的发布记录
   */
  async getFailedRecords(): Promise<PublishingRecord[]> {
    return await this.getByStatus('failed');
  }

  /**
   * 获取最近的发布记录
   */
  async getRecentRecords(limit: number = 10): Promise<PublishingRecord[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM publishing_records WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [this.userId, limit]
      );

      return result.rows as PublishingRecord[];
    } catch (error) {
      log.error('PublishingRecordService: getRecentRecords 失败:', error);
      throw error;
    }
  }

  /**
   * 获取发布记录统计
   */
  async getStats(): Promise<{
    total: number;
    success: number;
    failed: number;
    pending: number;
    byPlatform: Record<string, number>;
    successRate: number;
  }> {
    this.validateUserId();

    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_records WHERE user_id = $1',
        [this.userId]
      );

      const successResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_records WHERE user_id = $1 AND status = $2',
        [this.userId, 'success']
      );

      const failedResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_records WHERE user_id = $1 AND status = $2',
        [this.userId, 'failed']
      );

      const pendingResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_records WHERE user_id = $1 AND status = $2',
        [this.userId, 'pending']
      );

      const byPlatformResult = await this.pool.query(
        'SELECT platform, COUNT(*) as count FROM publishing_records WHERE user_id = $1 GROUP BY platform',
        [this.userId]
      );

      const byPlatform: Record<string, number> = {};
      byPlatformResult.rows.forEach(row => {
        byPlatform[row.platform] = parseInt(row.count);
      });

      const total = parseInt(totalResult.rows[0].count);
      const success = parseInt(successResult.rows[0].count);
      const successRate = total > 0 ? (success / total) * 100 : 0;

      return {
        total,
        success,
        failed: parseInt(failedResult.rows[0].count),
        pending: parseInt(pendingResult.rows[0].count),
        byPlatform,
        successRate
      };
    } catch (error) {
      log.error('PublishingRecordService: getStats 失败:', error);
      throw error;
    }
  }
}
