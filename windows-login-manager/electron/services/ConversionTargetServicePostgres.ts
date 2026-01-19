/**
 * 转化目标服务类（PostgreSQL 版本）
 * 
 * 功能：
 * - 管理用户的转化目标
 * - 用于文章中的 CTA（Call To Action）
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import log from 'electron-log';

/**
 * 转化目标接口
 */
export interface ConversionTarget {
  id: number;
  user_id: number;
  company_name: string;
  industry: string;
  company_size?: string;
  features?: string;
  contact_info?: string;
  website?: string;
  target_audience?: string;
  core_products?: string;
  address?: string;
  is_default: boolean;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateConversionTargetInput {
  company_name: string;
  industry?: string;
  company_size?: string;
  features?: string;
  contact_info?: string;
  website?: string;
  target_audience?: string;
  core_products?: string;
  address?: string;
  is_default?: boolean;
}

export interface UpdateConversionTargetInput {
  company_name?: string;
  industry?: string;
  company_size?: string;
  features?: string;
  contact_info?: string;
  website?: string;
  target_audience?: string;
  core_products?: string;
  address?: string;
  is_default?: boolean;
}

/**
 * 转化目标服务类
 */
export class ConversionTargetServicePostgres extends BaseServicePostgres<ConversionTarget> {
  constructor() {
    super('conversion_targets', 'ConversionTargetService');
  }

  /**
   * 创建转化目标
   */
  async createTarget(input: CreateConversionTargetInput): Promise<ConversionTarget> {
    return await this.create({
      ...input,
      is_default: input.is_default || false,
      usage_count: 0
    });
  }

  /**
   * 更新转化目标
   */
  async updateTarget(id: number, input: UpdateConversionTargetInput): Promise<ConversionTarget> {
    return await this.update(id, input);
  }

  /**
   * 删除转化目标
   */
  async deleteTarget(id: number): Promise<void> {
    await this.delete(id);
  }

  /**
   * 根据类型获取转化目标
   */
  async getByType(type: string): Promise<ConversionTarget[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM conversion_targets WHERE user_id = $1 AND industry = $2 ORDER BY created_at DESC',
        [this.userId, type]
      );

      return result.rows as ConversionTarget[];
    } catch (error) {
      log.error('ConversionTargetService: getByType 失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认转化目标
   */
  async getDefaultTarget(): Promise<ConversionTarget | null> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM conversion_targets WHERE user_id = $1 AND is_default = TRUE LIMIT 1',
        [this.userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      log.error('ConversionTargetService: getDefaultTarget 失败:', error);
      throw error;
    }
  }

  /**
   * 设置默认转化目标
   */
  async setDefaultTarget(id: number): Promise<void> {
    this.validateUserId();

    try {
      await this.transaction(async (client) => {
        // 取消所有默认转化目标
        await client.query(
          'UPDATE conversion_targets SET is_default = FALSE WHERE user_id = $1',
          [this.userId]
        );

        // 设置新的默认转化目标
        await client.query(
          'UPDATE conversion_targets SET is_default = TRUE WHERE id = $1 AND user_id = $2',
          [id, this.userId]
        );

        log.info(`ConversionTargetService: 设置默认转化目标成功, ID: ${id}`);
      });
    } catch (error) {
      log.error('ConversionTargetService: setDefaultTarget 失败:', error);
      throw error;
    }
  }

  /**
   * 增加使用次数
   */
  async incrementUsageCount(id: number): Promise<void> {
    this.validateUserId();

    try {
      await this.pool.query(
        'UPDATE conversion_targets SET usage_count = usage_count + 1 WHERE id = $1 AND user_id = $2',
        [id, this.userId]
      );

      log.info(`ConversionTargetService: 增加使用次数, ID: ${id}`);
    } catch (error) {
      log.error('ConversionTargetService: incrementUsageCount 失败:', error);
      throw error;
    }
  }

  /**
   * 搜索转化目标
   */
  async searchTargets(searchTerm: string): Promise<ConversionTarget[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM conversion_targets 
         WHERE user_id = $1 
         AND (company_name ILIKE $2 OR address ILIKE $2)
         ORDER BY created_at DESC`,
        [this.userId, `%${searchTerm}%`]
      );

      return result.rows as ConversionTarget[];
    } catch (error) {
      log.error('ConversionTargetService: searchTargets 失败:', error);
      throw error;
    }
  }

  /**
   * 获取转化目标统计
   */
  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    totalUsage: number;
  }> {
    this.validateUserId();

    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM conversion_targets WHERE user_id = $1',
        [this.userId]
      );

      const byTypeResult = await this.pool.query(
        'SELECT industry as type, COUNT(*) as count FROM conversion_targets WHERE user_id = $1 GROUP BY industry',
        [this.userId]
      );

      const usageResult = await this.pool.query(
        'SELECT COALESCE(SUM(usage_count), 0) as total FROM conversion_targets WHERE user_id = $1',
        [this.userId]
      );

      const byType: Record<string, number> = {};
      byTypeResult.rows.forEach(row => {
        if (row.type) {
          byType[row.type] = parseInt(row.count);
        }
      });

      return {
        total: parseInt(totalResult.rows[0].count),
        byType,
        totalUsage: parseInt(usageResult.rows[0].total)
      };
    } catch (error) {
      log.error('ConversionTargetService: getStats 失败:', error);
      throw error;
    }
  }
}
