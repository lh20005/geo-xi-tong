/**
 * 发布日志服务类（PostgreSQL 版本）
 * 
 * 功能：
 * - 管理用户的发布日志
 * - 记录详细的发布过程和错误信息
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import log from 'electron-log';

/**
 * 发布日志接口
 */
export interface PublishingLog {
  id: number;
  user_id: number;
  task_id: number;
  level: string;
  message: string;
  details?: string;
  created_at: Date;
}

/**
 * 创建发布日志输入
 */
export interface CreatePublishingLogInput {
  task_id: number;
  level: string;
  message: string;
  details?: string;
}

/**
 * 发布日志服务类
 */
export class PublishingLogServicePostgres extends BaseServicePostgres<PublishingLog> {
  constructor() {
    super('publishing_logs', 'PublishingLogService');
  }

  /**
   * 创建发布日志
   */
  async createLog(input: CreatePublishingLogInput): Promise<PublishingLog> {
    return await this.create(input);
  }

  /**
   * 删除发布日志
   */
  async deleteLog(id: number): Promise<void> {
    await this.delete(id);
  }

  /**
   * 根据任务 ID 获取日志
   */
  async getByTaskId(taskId: number): Promise<PublishingLog[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM publishing_logs WHERE user_id = $1 AND task_id = $2 ORDER BY created_at ASC',
        [this.userId, taskId]
      );

      return result.rows as PublishingLog[];
    } catch (error) {
      log.error('PublishingLogService: getByTaskId 失败:', error);
      throw error;
    }
  }

  /**
   * 根据日志级别获取日志
   */
  async getByLevel(level: string): Promise<PublishingLog[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM publishing_logs WHERE user_id = $1 AND level = $2 ORDER BY created_at DESC',
        [this.userId, level]
      );

      return result.rows as PublishingLog[];
    } catch (error) {
      log.error('PublishingLogService: getByLevel 失败:', error);
      throw error;
    }
  }

  /**
   * 获取错误日志
   */
  async getErrorLogs(): Promise<PublishingLog[]> {
    return await this.getByLevel('error');
  }

  /**
   * 获取警告日志
   */
  async getWarningLogs(): Promise<PublishingLog[]> {
    return await this.getByLevel('warning');
  }

  /**
   * 获取信息日志
   */
  async getInfoLogs(): Promise<PublishingLog[]> {
    return await this.getByLevel('info');
  }

  /**
   * 获取最近的日志
   */
  async getRecentLogs(limit: number = 100): Promise<PublishingLog[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM publishing_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [this.userId, limit]
      );

      return result.rows as PublishingLog[];
    } catch (error) {
      log.error('PublishingLogService: getRecentLogs 失败:', error);
      throw error;
    }
  }

  /**
   * 搜索日志
   */
  async searchLogs(searchTerm: string): Promise<PublishingLog[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM publishing_logs 
         WHERE user_id = $1 
         AND (message ILIKE $2 OR details ILIKE $2)
         ORDER BY created_at DESC`,
        [this.userId, `%${searchTerm}%`]
      );

      return result.rows as PublishingLog[];
    } catch (error) {
      log.error('PublishingLogService: searchLogs 失败:', error);
      throw error;
    }
  }

  /**
   * 清理旧日志
   */
  async cleanOldLogs(daysToKeep: number = 30): Promise<number> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `DELETE FROM publishing_logs 
         WHERE user_id = $1 
         AND created_at < NOW() - INTERVAL '${daysToKeep} days'`,
        [this.userId]
      );

      const deletedCount = result.rowCount || 0;
      log.info(`PublishingLogService: 清理旧日志成功, 删除 ${deletedCount} 条`);

      return deletedCount;
    } catch (error) {
      log.error('PublishingLogService: cleanOldLogs 失败:', error);
      throw error;
    }
  }

  /**
   * 根据任务 ID 删除日志
   */
  async deleteByTaskId(taskId: number): Promise<number> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'DELETE FROM publishing_logs WHERE user_id = $1 AND task_id = $2',
        [this.userId, taskId]
      );

      const deletedCount = result.rowCount || 0;
      log.info(`PublishingLogService: 删除任务日志成功, task_id: ${taskId}, 删除 ${deletedCount} 条`);

      return deletedCount;
    } catch (error) {
      log.error('PublishingLogService: deleteByTaskId 失败:', error);
      throw error;
    }
  }

  /**
   * 获取日志统计
   */
  async getStats(): Promise<{
    total: number;
    error: number;
    warning: number;
    info: number;
    debug: number;
  }> {
    this.validateUserId();

    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_logs WHERE user_id = $1',
        [this.userId]
      );

      const errorResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_logs WHERE user_id = $1 AND level = $2',
        [this.userId, 'error']
      );

      const warningResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_logs WHERE user_id = $1 AND level = $2',
        [this.userId, 'warning']
      );

      const infoResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_logs WHERE user_id = $1 AND level = $2',
        [this.userId, 'info']
      );

      const debugResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM publishing_logs WHERE user_id = $1 AND level = $2',
        [this.userId, 'debug']
      );

      return {
        total: parseInt(totalResult.rows[0].count),
        error: parseInt(errorResult.rows[0].count),
        warning: parseInt(warningResult.rows[0].count),
        info: parseInt(infoResult.rows[0].count),
        debug: parseInt(debugResult.rows[0].count)
      };
    } catch (error) {
      log.error('PublishingLogService: getStats 失败:', error);
      throw error;
    }
  }

  /**
   * 批量创建日志
   */
  async createBatch(logs: CreatePublishingLogInput[]): Promise<void> {
    this.validateUserId();

    try {
      await this.transaction(async (client) => {
        for (const logInput of logs) {
          await client.query(
            `INSERT INTO publishing_logs (user_id, task_id, level, message, details, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [this.userId, logInput.task_id, logInput.level, logInput.message, logInput.details || null]
          );
        }

        log.info(`PublishingLogService: 批量创建日志成功, 数量: ${logs.length}`);
      });
    } catch (error) {
      log.error('PublishingLogService: createBatch 失败:', error);
      throw error;
    }
  }
}
