/**
 * 话题服务类（PostgreSQL 版本）
 * 
 * 功能：
 * - 管理用户的话题
 * - 关联蒸馏记录
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import log from 'electron-log';

/**
 * 话题接口
 */
export interface Topic {
  id: number;
  user_id: number;
  distillation_id: number;
  keyword: string;
  question: string;
  category?: string;
  priority: number;
  used_count: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * 创建话题输入
 */
export interface CreateTopicInput {
  distillation_id: number;
  keyword: string;
  question: string;
  category?: string;
  priority?: number;
}

/**
 * 更新话题输入
 */
export interface UpdateTopicInput {
  question?: string;
  category?: string;
  priority?: number;
  used_count?: number;
}

/**
 * 话题服务类
 */
export class TopicServicePostgres extends BaseServicePostgres<Topic> {
  constructor() {
    super('topics', 'TopicService');
  }

  /**
   * 创建话题
   */
  async createTopic(input: CreateTopicInput): Promise<Topic> {
    return await this.create({
      ...input,
      priority: input.priority || 0,
      used_count: 0
    });
  }

  /**
   * 更新话题
   */
  async updateTopic(id: number, input: UpdateTopicInput): Promise<Topic> {
    return await this.update(id, input);
  }

  /**
   * 删除话题
   */
  async deleteTopic(id: number): Promise<void> {
    await this.delete(id);
  }

  /**
   * 根据蒸馏 ID 获取话题
   */
  async getByDistillationId(distillationId: number): Promise<Topic[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM topics WHERE user_id = $1 AND distillation_id = $2 ORDER BY priority DESC, created_at DESC',
        [this.userId, distillationId]
      );

      return result.rows as Topic[];
    } catch (error) {
      log.error('TopicService: getByDistillationId 失败:', error);
      throw error;
    }
  }

  /**
   * 根据蒸馏 ID 获取话题（别名方法）
   */
  async findByDistillation(distillationId: number): Promise<Topic[]> {
    return await this.getByDistillationId(distillationId);
  }

  /**
   * 搜索话题
   */
  async search(searchTerm: string): Promise<Topic[]> {
    return await this.searchTopics(searchTerm);
  }

  /**
   * 获取未使用的话题
   */
  async findUnused(limit: number = 10): Promise<Topic[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM topics WHERE user_id = $1 AND used_count = 0 ORDER BY priority DESC, created_at DESC LIMIT $2',
        [this.userId, limit]
      );

      return result.rows as Topic[];
    } catch (error) {
      log.error('TopicService: findUnused 失败:', error);
      throw error;
    }
  }

  /**
   * 获取最近的话题
   */
  async findRecent(limit: number = 10): Promise<Topic[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM topics WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [this.userId, limit]
      );

      return result.rows as Topic[];
    } catch (error) {
      log.error('TopicService: findRecent 失败:', error);
      throw error;
    }
  }

  /**
   * 根据分类获取话题
   */
  async getByCategory(category: string): Promise<Topic[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM topics WHERE user_id = $1 AND category = $2 ORDER BY priority DESC, created_at DESC',
        [this.userId, category]
      );

      return result.rows as Topic[];
    } catch (error) {
      log.error('TopicService: getByCategory 失败:', error);
      throw error;
    }
  }

  /**
   * 搜索话题
   */
  async searchTopics(searchTerm: string): Promise<Topic[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM topics WHERE user_id = $1 AND question ILIKE $2 ORDER BY priority DESC, created_at DESC',
        [this.userId, `%${searchTerm}%`]
      );

      return result.rows as Topic[];
    } catch (error) {
      log.error('TopicService: searchTopics 失败:', error);
      throw error;
    }
  }

  /**
   * 增加使用次数
   */
  async incrementUsedCount(id: number): Promise<void> {
    this.validateUserId();

    try {
      await this.pool.query(
        'UPDATE topics SET used_count = used_count + 1 WHERE id = $1 AND user_id = $2',
        [id, this.userId]
      );

      log.info(`TopicService: 增加使用次数, ID: ${id}`);
    } catch (error) {
      log.error('TopicService: incrementUsedCount 失败:', error);
      throw error;
    }
  }

  /**
   * 获取未使用的话题
   */
  async getUnusedTopics(): Promise<Topic[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM topics WHERE user_id = $1 AND used_count = 0 ORDER BY priority DESC, created_at DESC',
        [this.userId]
      );

      return result.rows as Topic[];
    } catch (error) {
      log.error('TopicService: getUnusedTopics 失败:', error);
      throw error;
    }
  }

  /**
   * 获取话题统计
   */
  async getStats(): Promise<{
    total: number;
    used: number;
    unused: number;
    byCategory: Record<string, number>;
  }> {
    this.validateUserId();

    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM topics WHERE user_id = $1',
        [this.userId]
      );

      const usedResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM topics WHERE user_id = $1 AND used_count > 0',
        [this.userId]
      );

      const unusedResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM topics WHERE user_id = $1 AND used_count = 0',
        [this.userId]
      );

      const byCategoryResult = await this.pool.query(
        'SELECT category, COUNT(*) as count FROM topics WHERE user_id = $1 AND category IS NOT NULL GROUP BY category',
        [this.userId]
      );

      const byCategory: Record<string, number> = {};
      byCategoryResult.rows.forEach(row => {
        byCategory[row.category] = parseInt(row.count);
      });

      return {
        total: parseInt(totalResult.rows[0].count),
        used: parseInt(usedResult.rows[0].count),
        unused: parseInt(unusedResult.rows[0].count),
        byCategory
      };
    } catch (error) {
      log.error('TopicService: getStats 失败:', error);
      throw error;
    }
  }
}
