/**
 * 蒸馏服务类（PostgreSQL 版本）
 * 
 * 功能：
 * - 管理用户的关键词蒸馏记录
 * - 关联话题生成
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import log from 'electron-log';

/**
 * 蒸馏接口
 */
export interface Distillation {
  id: number;
  user_id: number;
  keyword: string;
  topics_count: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 创建蒸馏输入
 */
export interface CreateDistillationInput {
  keyword: string;
}

/**
 * 更新蒸馏输入
 */
export interface UpdateDistillationInput {
  topics_count?: number;
  status?: string;
}

/**
 * 蒸馏服务类
 */
export class DistillationServicePostgres extends BaseServicePostgres<Distillation> {
  constructor() {
    super('distillations', 'DistillationService');
  }

  /**
   * 创建蒸馏
   */
  async createDistillation(input: CreateDistillationInput): Promise<Distillation> {
    return await this.create({
      ...input,
      topics_count: 0,
      status: 'pending'
    });
  }

  /**
   * 更新蒸馏
   */
  async updateDistillation(id: number, input: UpdateDistillationInput): Promise<Distillation> {
    return await this.update(id, input);
  }

  /**
   * 删除蒸馏
   */
  async deleteDistillation(id: number): Promise<void> {
    await this.delete(id);
  }

  /**
   * 根据关键词查找蒸馏
   */
  async findByKeyword(keyword: string): Promise<Distillation[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM distillations WHERE user_id = $1 AND keyword = $2 ORDER BY created_at DESC',
        [this.userId, keyword]
      );

      return result.rows as Distillation[];
    } catch (error) {
      log.error('DistillationService: findByKeyword 失败:', error);
      throw error;
    }
  }

  /**
   * 搜索蒸馏
   */
  async search(searchTerm: string): Promise<Distillation[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM distillations WHERE user_id = $1 AND keyword ILIKE $2 ORDER BY created_at DESC',
        [this.userId, `%${searchTerm}%`]
      );

      return result.rows as Distillation[];
    } catch (error) {
      log.error('DistillationService: search 失败:', error);
      throw error;
    }
  }

  /**
   * 获取最近的蒸馏记录
   */
  async findRecent(limit: number = 10): Promise<Distillation[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM distillations WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [this.userId, limit]
      );

      return result.rows as Distillation[];
    } catch (error) {
      log.error('DistillationService: findRecent 失败:', error);
      throw error;
    }
  }

  /**
   * 根据状态获取蒸馏
   */
  async getByStatus(status: string): Promise<Distillation[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM distillations WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
        [this.userId, status]
      );

      return result.rows as Distillation[];
    } catch (error) {
      log.error('DistillationService: getByStatus 失败:', error);
      throw error;
    }
  }

  /**
   * 更新话题计数
   */
  async updateTopicsCount(id: number): Promise<void> {
    this.validateUserId();

    try {
      await this.pool.query(
        `UPDATE distillations 
         SET topics_count = (
           SELECT COUNT(*) FROM topics WHERE distillation_id = $1
         )
         WHERE id = $1 AND user_id = $2`,
        [id, this.userId]
      );

      log.info(`DistillationService: 更新话题计数成功, ID: ${id}`);
    } catch (error) {
      log.error('DistillationService: updateTopicsCount 失败:', error);
      throw error;
    }
  }

  /**
   * 获取蒸馏统计
   */
  async getStats(): Promise<{
    total: number;
    completed: number;
    pending: number;
    totalTopics: number;
  }> {
    this.validateUserId();

    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM distillations WHERE user_id = $1',
        [this.userId]
      );

      const completedResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM distillations WHERE user_id = $1 AND status = $2',
        [this.userId, 'completed']
      );

      const pendingResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM distillations WHERE user_id = $1 AND status = $2',
        [this.userId, 'pending']
      );

      const topicsResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM topics WHERE user_id = $1',
        [this.userId]
      );

      return {
        total: parseInt(totalResult.rows[0].count),
        completed: parseInt(completedResult.rows[0].count),
        pending: parseInt(pendingResult.rows[0].count),
        totalTopics: parseInt(topicsResult.rows[0].count)
      };
    } catch (error) {
      log.error('DistillationService: getStats 失败:', error);
      throw error;
    }
  }
}
