/**
 * 任务清理服务
 * 定期清理本地数据库中的旧任务记录
 */

import log from 'electron-log';
import { getPool } from '../database/postgres';

export class TaskCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24小时
  private readonly DEFAULT_RETENTION_DAYS = 30; // 默认保留30天

  /**
   * 启动定时清理服务
   */
  start(): void {
    log.info('[TaskCleanup] 启动定时清理服务');

    // 立即执行一次清理
    this.performCleanup();

    // 设置定时清理（每24小时执行一次）
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);

    log.info('[TaskCleanup] 定时清理服务已启动，间隔: 24小时');
  }

  /**
   * 停止定时清理服务
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      log.info('[TaskCleanup] 定时清理服务已停止');
    }
  }

  /**
   * 执行清理操作
   */
  private async performCleanup(): Promise<void> {
    try {
      log.info('[TaskCleanup] 开始清理旧任务记录...');

      const pool = getPool();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.DEFAULT_RETENTION_DAYS);

      // 清理旧的发布任务记录
      const publishingTasksResult = await pool.query(
        `DELETE FROM publishing_tasks 
         WHERE created_at < $1 
         AND status IN ('success', 'failed', 'cancelled')
         RETURNING id`,
        [cutoffDate]
      );

      const deletedPublishingTasks = publishingTasksResult.rowCount || 0;

      // 清理旧的发布记录
      const publishingRecordsResult = await pool.query(
        `DELETE FROM publishing_records 
         WHERE created_at < $1
         RETURNING id`,
        [cutoffDate]
      );

      const deletedPublishingRecords = publishingRecordsResult.rowCount || 0;

      // 清理旧的蒸馏记录（可选，根据需求决定是否清理）
      // const distillationResult = await pool.query(
      //   `DELETE FROM distillations 
      //    WHERE created_at < $1
      //    RETURNING id`,
      //   [cutoffDate]
      // );
      // const deletedDistillations = distillationResult.rowCount || 0;

      log.info(
        `[TaskCleanup] 清理完成: ` +
        `发布任务 ${deletedPublishingTasks} 条, ` +
        `发布记录 ${deletedPublishingRecords} 条`
      );

      // 执行 VACUUM 优化数据库
      await this.vacuumDatabase();

    } catch (error: any) {
      log.error('[TaskCleanup] 清理失败:', error);
    }
  }

  /**
   * 手动触发清理（供用户主动调用）
   */
  async manualCleanup(retentionDays?: number): Promise<{
    success: boolean;
    deletedPublishingTasks: number;
    deletedPublishingRecords: number;
    error?: string;
  }> {
    try {
      log.info(`[TaskCleanup] 手动清理，保留天数: ${retentionDays || this.DEFAULT_RETENTION_DAYS}`);

      const pool = getPool();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (retentionDays || this.DEFAULT_RETENTION_DAYS));

      // 清理发布任务
      const publishingTasksResult = await pool.query(
        `DELETE FROM publishing_tasks 
         WHERE created_at < $1 
         AND status IN ('success', 'failed', 'cancelled')
         RETURNING id`,
        [cutoffDate]
      );

      const deletedPublishingTasks = publishingTasksResult.rowCount || 0;

      // 清理发布记录
      const publishingRecordsResult = await pool.query(
        `DELETE FROM publishing_records 
         WHERE created_at < $1
         RETURNING id`,
        [cutoffDate]
      );

      const deletedPublishingRecords = publishingRecordsResult.rowCount || 0;

      // 优化数据库
      await this.vacuumDatabase();

      log.info(
        `[TaskCleanup] 手动清理完成: ` +
        `发布任务 ${deletedPublishingTasks} 条, ` +
        `发布记录 ${deletedPublishingRecords} 条`
      );

      return {
        success: true,
        deletedPublishingTasks,
        deletedPublishingRecords
      };

    } catch (error: any) {
      log.error('[TaskCleanup] 手动清理失败:', error);
      return {
        success: false,
        deletedPublishingTasks: 0,
        deletedPublishingRecords: 0,
        error: error.message
      };
    }
  }

  /**
   * 获取可清理的记录统计
   */
  async getCleanupStats(retentionDays?: number): Promise<{
    success: boolean;
    publishingTasks: number;
    publishingRecords: number;
    cutoffDate: string;
    error?: string;
  }> {
    try {
      const pool = getPool();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (retentionDays || this.DEFAULT_RETENTION_DAYS));

      // 统计可清理的发布任务
      const tasksResult = await pool.query(
        `SELECT COUNT(*) as count FROM publishing_tasks 
         WHERE created_at < $1 
         AND status IN ('success', 'failed', 'cancelled')`,
        [cutoffDate]
      );

      // 统计可清理的发布记录
      const recordsResult = await pool.query(
        `SELECT COUNT(*) as count FROM publishing_records 
         WHERE created_at < $1`,
        [cutoffDate]
      );

      return {
        success: true,
        publishingTasks: parseInt(tasksResult.rows[0].count),
        publishingRecords: parseInt(recordsResult.rows[0].count),
        cutoffDate: cutoffDate.toISOString()
      };

    } catch (error: any) {
      log.error('[TaskCleanup] 获取统计失败:', error);
      return {
        success: false,
        publishingTasks: 0,
        publishingRecords: 0,
        cutoffDate: '',
        error: error.message
      };
    }
  }

  /**
   * 执行数据库 VACUUM 优化
   */
  private async vacuumDatabase(): Promise<void> {
    try {
      const pool = getPool();
      
      // PostgreSQL VACUUM 命令需要在事务外执行
      // 这里只记录日志，实际 VACUUM 可以通过定期维护脚本执行
      log.info('[TaskCleanup] 建议定期执行 VACUUM 优化数据库');
      
      // 可以执行 ANALYZE 来更新统计信息
      await pool.query('ANALYZE publishing_tasks');
      await pool.query('ANALYZE publishing_records');
      
      log.info('[TaskCleanup] 数据库统计信息已更新');
    } catch (error: any) {
      log.error('[TaskCleanup] 数据库优化失败:', error);
    }
  }
}

// 导出单例
export const taskCleanupService = new TaskCleanupService();
