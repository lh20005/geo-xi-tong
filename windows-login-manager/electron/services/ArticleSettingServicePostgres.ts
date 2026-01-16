/**
 * 文章设置服务类（PostgreSQL 版本）
 * 
 * 功能：
 * - 管理用户的文章生成设置
 * - 存储默认配置和偏好
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import log from 'electron-log';

/**
 * 文章设置接口
 */
export interface ArticleSetting {
  id: number;
  user_id: number;
  setting_key: string;
  setting_value: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 创建文章设置输入
 */
export interface CreateArticleSettingInput {
  setting_key: string;
  setting_value: string;
  description?: string;
}

/**
 * 更新文章设置输入
 */
export interface UpdateArticleSettingInput {
  setting_value?: string;
  description?: string;
}

/**
 * 文章设置服务类
 */
export class ArticleSettingServicePostgres extends BaseServicePostgres<ArticleSetting> {
  constructor() {
    super('article_settings', 'ArticleSettingService');
  }

  /**
   * 创建文章设置
   */
  async createSetting(input: CreateArticleSettingInput): Promise<ArticleSetting> {
    return await this.create(input);
  }

  /**
   * 更新文章设置
   */
  async updateSetting(id: number, input: UpdateArticleSettingInput): Promise<ArticleSetting> {
    return await this.update(id, input);
  }

  /**
   * 删除文章设置
   */
  async deleteSetting(id: number): Promise<void> {
    await this.delete(id);
  }

  /**
   * 根据设置键获取设置
   */
  async getByKey(key: string): Promise<ArticleSetting | null> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM article_settings WHERE user_id = $1 AND setting_key = $2 LIMIT 1',
        [this.userId, key]
      );

      return result.rows[0] || null;
    } catch (error) {
      log.error('ArticleSettingService: getByKey 失败:', error);
      throw error;
    }
  }

  /**
   * 设置或更新设置值
   */
  async setSetting(key: string, value: string, description?: string): Promise<ArticleSetting> {
    this.validateUserId();

    try {
      // 检查设置是否存在
      const existing = await this.getByKey(key);

      if (existing) {
        // 更新现有设置
        return await this.update(existing.id, {
          setting_value: value,
          description: description || existing.description
        });
      } else {
        // 创建新设置
        return await this.create({
          setting_key: key,
          setting_value: value,
          description
        });
      }
    } catch (error) {
      log.error('ArticleSettingService: setSetting 失败:', error);
      throw error;
    }
  }

  /**
   * 获取设置值
   */
  async getValue(key: string, defaultValue?: string): Promise<string | null> {
    const setting = await this.getByKey(key);
    return setting ? setting.setting_value : (defaultValue || null);
  }

  /**
   * 批量获取设置
   */
  async getMultiple(keys: string[]): Promise<Record<string, string>> {
    this.validateUserId();

    try {
      const placeholders = keys.map((_, i) => `$${i + 2}`).join(',');
      const result = await this.pool.query(
        `SELECT setting_key, setting_value 
         FROM article_settings 
         WHERE user_id = $1 AND setting_key IN (${placeholders})`,
        [this.userId, ...keys]
      );

      const settings: Record<string, string> = {};
      result.rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
      });

      return settings;
    } catch (error) {
      log.error('ArticleSettingService: getMultiple 失败:', error);
      throw error;
    }
  }

  /**
   * 批量设置
   */
  async setMultiple(settings: Record<string, string>): Promise<void> {
    this.validateUserId();

    try {
      await this.transaction(async (client) => {
        for (const [key, value] of Object.entries(settings)) {
          // 检查设置是否存在
          const existingResult = await client.query(
            'SELECT id FROM article_settings WHERE user_id = $1 AND setting_key = $2',
            [this.userId, key]
          );

          if (existingResult.rows.length > 0) {
            // 更新
            await client.query(
              'UPDATE article_settings SET setting_value = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
              [value, existingResult.rows[0].id, this.userId]
            );
          } else {
            // 创建
            await client.query(
              'INSERT INTO article_settings (user_id, setting_key, setting_value, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
              [this.userId, key, value]
            );
          }
        }

        log.info(`ArticleSettingService: 批量设置成功, 数量: ${Object.keys(settings).length}`);
      });
    } catch (error) {
      log.error('ArticleSettingService: setMultiple 失败:', error);
      throw error;
    }
  }

  /**
   * 删除设置（根据键）
   */
  async deleteByKey(key: string): Promise<void> {
    this.validateUserId();

    try {
      await this.pool.query(
        'DELETE FROM article_settings WHERE user_id = $1 AND setting_key = $2',
        [this.userId, key]
      );

      log.info(`ArticleSettingService: 删除设置成功, key: ${key}`);
    } catch (error) {
      log.error('ArticleSettingService: deleteByKey 失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有设置
   */
  async getAllSettings(): Promise<Record<string, string>> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT setting_key, setting_value FROM article_settings WHERE user_id = $1',
        [this.userId]
      );

      const settings: Record<string, string> = {};
      result.rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
      });

      return settings;
    } catch (error) {
      log.error('ArticleSettingService: getAllSettings 失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认设置
   */
  async getDefaultSetting(): Promise<ArticleSetting | null> {
    return await this.getByKey('default');
  }

  /**
   * 设置默认设置
   */
  async setDefaultSetting(id: number): Promise<void> {
    this.validateUserId();

    try {
      await this.transaction(async (client) => {
        // 取消所有默认设置
        await client.query(
          'DELETE FROM article_settings WHERE user_id = $1 AND setting_key = $2',
          [this.userId, 'default']
        );

        // 设置新的默认设置
        await client.query(
          'INSERT INTO article_settings (user_id, setting_key, setting_value, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [this.userId, 'default', id.toString()]
        );

        log.info(`ArticleSettingService: 设置默认设置成功, ID: ${id}`);
      });
    } catch (error) {
      log.error('ArticleSettingService: setDefaultSetting 失败:', error);
      throw error;
    }
  }

  /**
   * 搜索设置
   */
  async search(searchTerm: string): Promise<ArticleSetting[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM article_settings 
         WHERE user_id = $1 
         AND (setting_key ILIKE $2 OR setting_value ILIKE $2 OR description ILIKE $2)
         ORDER BY created_at DESC`,
        [this.userId, `%${searchTerm}%`]
      );

      return result.rows as ArticleSetting[];
    } catch (error) {
      log.error('ArticleSettingService: search 失败:', error);
      throw error;
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    total: number;
    byKey: Record<string, number>;
  }> {
    this.validateUserId();

    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM article_settings WHERE user_id = $1',
        [this.userId]
      );

      const byKeyResult = await this.pool.query(
        'SELECT setting_key, COUNT(*) as count FROM article_settings WHERE user_id = $1 GROUP BY setting_key',
        [this.userId]
      );

      const byKey: Record<string, number> = {};
      byKeyResult.rows.forEach(row => {
        byKey[row.setting_key] = parseInt(row.count);
      });

      return {
        total: parseInt(totalResult.rows[0].count),
        byKey
      };
    } catch (error) {
      log.error('ArticleSettingService: getStats 失败:', error);
      throw error;
    }
  }
}
