/**
 * 用户服务类（PostgreSQL 版本）
 * 
 * 核心功能：
 * - 实现级联删除功能（替代数据库外键的 ON DELETE CASCADE）
 * - 按正确的依赖顺序删除用户的所有数据
 * - 使用事务保证原子性
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import { PoolClient } from 'pg';
import log from 'electron-log';
import { apiClient } from '../api/client';

/**
 * 用户接口
 */
export interface User {
  id: number;
  username: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 用户服务类
 * 
 * 注意：用户账号管理主要在服务器端
 * Windows 端只负责本地数据的级联删除
 */
export class UserServicePostgres extends BaseServicePostgres<User> {
  constructor() {
    super('users', 'UserService');
  }

  /**
   * 删除用户账号（级联删除所有数据）
   * 
   * 功能：
   * - 替代数据库外键的 ON DELETE CASCADE
   * - 按正确的依赖顺序删除数据
   * - 使用事务保证原子性
   * - 删除失败时自动回滚
   * 
   * 删除顺序（重要）：
   * 1. 先删除依赖其他表的数据（如 publishing_logs 依赖 publishing_tasks）
   * 2. 再删除被依赖的数据（如 publishing_tasks）
   * 3. 最后删除独立的数据（如 articles）
   * 
   * 注意：
   * - 这个功能通常不会在 Windows 端执行
   * - 用户账号管理在服务器端
   * - 这里只是演示如何实现级联删除
   * 
   * @throws {Error} 如果删除失败
   */
  async deleteAccount(): Promise<void> {
    this.validateUserId();

    log.info(`UserService: 开始删除用户账号, user_id: ${this.userId}`);

    try {
      await this.transaction(async (client: PoolClient) => {
        // ==================== 第 1 层：删除依赖其他表的数据 ====================
        
        // 1. 删除发布日志（依赖 publishing_tasks）
        log.info('UserService: 删除发布日志...');
        const logsResult = await client.query(
          'DELETE FROM publishing_logs WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${logsResult.rowCount} 条发布日志`);

        // 2. 删除发布记录（依赖 publishing_tasks）
        log.info('UserService: 删除发布记录...');
        const recordsResult = await client.query(
          'DELETE FROM publishing_records WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${recordsResult.rowCount} 条发布记录`);

        // 3. 删除图片使用追踪（依赖 images）
        log.info('UserService: 删除图片使用追踪...');
        const imageUsageResult = await client.query(
          'DELETE FROM image_usage WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${imageUsageResult.rowCount} 条图片使用记录`);

        // 4. 删除蒸馏使用追踪（依赖 distillations）
        log.info('UserService: 删除蒸馏使用追踪...');
        const distillationUsageResult = await client.query(
          'DELETE FROM distillation_usage WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${distillationUsageResult.rowCount} 条蒸馏使用记录`);

        // 5. 删除话题使用追踪（依赖 topics）
        log.info('UserService: 删除话题使用追踪...');
        const topicUsageResult = await client.query(
          'DELETE FROM topic_usage WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${topicUsageResult.rowCount} 条话题使用记录`);

        // ==================== 第 2 层：删除主要业务数据 ====================

        // 6. 删除发布任务
        log.info('UserService: 删除发布任务...');
        const tasksResult = await client.query(
          'DELETE FROM publishing_tasks WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${tasksResult.rowCount} 条发布任务`);

        // 7. 删除文章
        log.info('UserService: 删除文章...');
        const articlesResult = await client.query(
          'DELETE FROM articles WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${articlesResult.rowCount} 篇文章`);

        // 8. 删除话题（依赖 distillations）
        log.info('UserService: 删除话题...');
        const topicsResult = await client.query(
          'DELETE FROM topics WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${topicsResult.rowCount} 个话题`);

        // 9. 删除蒸馏记录
        log.info('UserService: 删除蒸馏记录...');
        const distillationsResult = await client.query(
          'DELETE FROM distillations WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${distillationsResult.rowCount} 条蒸馏记录`);

        // 10. 删除知识库文档（依赖 knowledge_bases）
        log.info('UserService: 删除知识库文档...');
        const documentsResult = await client.query(
          `DELETE FROM knowledge_documents 
           WHERE knowledge_base_id IN (
             SELECT id FROM knowledge_bases WHERE user_id = $1
           )`,
          [this.userId]
        );
        log.info(`UserService: 删除了 ${documentsResult.rowCount} 个知识库文档`);

        // 11. 删除知识库
        log.info('UserService: 删除知识库...');
        const knowledgeBasesResult = await client.query(
          'DELETE FROM knowledge_bases WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${knowledgeBasesResult.rowCount} 个知识库`);

        // 12. 删除图片
        log.info('UserService: 删除图片...');
        const imagesResult = await client.query(
          'DELETE FROM images WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${imagesResult.rowCount} 张图片`);

        // 13. 删除相册
        log.info('UserService: 删除相册...');
        const albumsResult = await client.query(
          'DELETE FROM albums WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${albumsResult.rowCount} 个相册`);

        // 14. 删除平台账号
        log.info('UserService: 删除平台账号...');
        const accountsResult = await client.query(
          'DELETE FROM platform_accounts WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${accountsResult.rowCount} 个平台账号`);

        // 15. 删除转化目标
        log.info('UserService: 删除转化目标...');
        const targetsResult = await client.query(
          'DELETE FROM conversion_targets WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${targetsResult.rowCount} 个转化目标`);

        // 16. 删除文章设置
        log.info('UserService: 删除文章设置...');
        const settingsResult = await client.query(
          'DELETE FROM article_settings WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${settingsResult.rowCount} 条文章设置`);

        // 17. 删除蒸馏配置
        log.info('UserService: 删除蒸馏配置...');
        const configResult = await client.query(
          'DELETE FROM distillation_config WHERE user_id = $1',
          [this.userId]
        );
        log.info(`UserService: 删除了 ${configResult.rowCount} 条蒸馏配置`);

        // ==================== 统计删除结果 ====================
        
        const totalDeleted = 
          (logsResult.rowCount || 0) +
          (recordsResult.rowCount || 0) +
          (imageUsageResult.rowCount || 0) +
          (distillationUsageResult.rowCount || 0) +
          (topicUsageResult.rowCount || 0) +
          (tasksResult.rowCount || 0) +
          (articlesResult.rowCount || 0) +
          (topicsResult.rowCount || 0) +
          (distillationsResult.rowCount || 0) +
          (documentsResult.rowCount || 0) +
          (knowledgeBasesResult.rowCount || 0) +
          (imagesResult.rowCount || 0) +
          (albumsResult.rowCount || 0) +
          (accountsResult.rowCount || 0) +
          (targetsResult.rowCount || 0) +
          (settingsResult.rowCount || 0) +
          (configResult.rowCount || 0);

        log.info(`UserService: 级联删除完成, 共删除 ${totalDeleted} 条记录`);
      });

      // 通知服务器删除账号
      await this.notifyServerDeleteAccount();

      log.info('UserService: 用户账号及所有数据已删除');
    } catch (error) {
      log.error('UserService: 删除账号失败:', error);
      throw new Error(`删除账号失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 通知服务器删除账号
   * 
   * 注意：
   * - 本地数据已删除，即使服务器通知失败也不影响
   * - 服务器端会执行自己的级联删除逻辑
   * - PostgreSQL 迁移：用户删除在本地数据库完成，暂不通知服务器
   */
  private async notifyServerDeleteAccount(): Promise<void> {
    try {
      log.info('UserService: 通知服务器删除账号...');
      // TODO: 实现服务器端用户删除 API
      // await apiClient.deleteUser();
      log.info('UserService: 服务器账号删除跳过（PostgreSQL 迁移）');
    } catch (error) {
      log.error('UserService: 通知服务器删除账号失败:', error);
      // 不抛出错误，因为本地数据已删除
      // 用户可以稍后在服务器端手动删除
    }
  }

  /**
   * 获取用户数据统计
   * 
   * 用于在删除前显示给用户确认
   * 
   * @returns 数据统计
   */
  async getDataStats(): Promise<{
    articles: number;
    images: number;
    knowledgeBases: number;
    platformAccounts: number;
    publishingTasks: number;
    distillations: number;
    topics: number;
  }> {
    this.validateUserId();

    try {
      const stats = await this.transaction(async (client: PoolClient) => {
        const articlesCount = await client.query(
          'SELECT COUNT(*) as count FROM articles WHERE user_id = $1',
          [this.userId]
        );

        const imagesCount = await client.query(
          'SELECT COUNT(*) as count FROM images WHERE user_id = $1',
          [this.userId]
        );

        const knowledgeBasesCount = await client.query(
          'SELECT COUNT(*) as count FROM knowledge_bases WHERE user_id = $1',
          [this.userId]
        );

        const platformAccountsCount = await client.query(
          'SELECT COUNT(*) as count FROM platform_accounts WHERE user_id = $1',
          [this.userId]
        );

        const publishingTasksCount = await client.query(
          'SELECT COUNT(*) as count FROM publishing_tasks WHERE user_id = $1',
          [this.userId]
        );

        const distillationsCount = await client.query(
          'SELECT COUNT(*) as count FROM distillations WHERE user_id = $1',
          [this.userId]
        );

        const topicsCount = await client.query(
          'SELECT COUNT(*) as count FROM topics WHERE user_id = $1',
          [this.userId]
        );

        return {
          articles: parseInt(articlesCount.rows[0].count),
          images: parseInt(imagesCount.rows[0].count),
          knowledgeBases: parseInt(knowledgeBasesCount.rows[0].count),
          platformAccounts: parseInt(platformAccountsCount.rows[0].count),
          publishingTasks: parseInt(publishingTasksCount.rows[0].count),
          distillations: parseInt(distillationsCount.rows[0].count),
          topics: parseInt(topicsCount.rows[0].count)
        };
      });

      return stats;
    } catch (error) {
      log.error('UserService: 获取数据统计失败:', error);
      throw error;
    }
  }
}
