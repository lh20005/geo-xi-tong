/**
 * 文章服务类（PostgreSQL 版本）
 * 
 * 核心功能：
 * - 保存 AI 生成的文章到本地数据库
 * - 处理 task_id 字段（设为 NULL，因为 generation_tasks 表在服务器）
 * - 管理文章的 CRUD 操作
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import log from 'electron-log';

/**
 * 文章接口
 */
export interface Article {
  id: number;
  user_id: number;
  title: string;
  keyword: string;
  distillation_id?: number;
  topic_id?: number;
  task_id?: number | null;  // ⚠️ 始终为 NULL（generation_tasks 表在服务器）
  image_id?: number;
  requirements?: string;
  content: string;
  image_url?: string;
  image_size_bytes?: number;
  provider: string;
  is_published: boolean;
  publishing_status?: string;
  published_at?: Date;
  distillation_keyword_snapshot?: string;
  topic_question_snapshot?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * AI 生成的文章数据
 */
export interface GeneratedArticle {
  title: string;
  keyword: string;
  content: string;
  provider: string;
  distillationId?: number;
  topicId?: number;
  imageId?: number;
  requirements?: string;
  imageUrl?: string;
  imageSizeBytes?: number;
  distillationKeywordSnapshot?: string;
  topicQuestionSnapshot?: string;
}

/**
 * 创建文章输入
 */
export interface CreateArticleInput {
  title: string;
  keyword: string;
  content: string;
  provider: string;
  distillationId?: number;
  topicId?: number;
  imageId?: number;
  requirements?: string;
  imageUrl?: string;
  imageSizeBytes?: number;
}

/**
 * 更新文章输入
 */
export interface UpdateArticleInput {
  title?: string;
  keyword?: string;
  content?: string;
  requirements?: string;
  imageUrl?: string;
  imageSizeBytes?: number;
  isPublished?: boolean;
  publishingStatus?: string;
  publishedAt?: Date;
}

/**
 * 文章服务类
 * 
 * 注意：
 * - AI 生成逻辑在服务器端（不受迁移影响）
 * - Windows 端只负责保存生成结果到本地数据库
 * - task_id 字段始终设为 NULL（generation_tasks 表在服务器）
 */
export class ArticleServicePostgres extends BaseServicePostgres<Article> {
  constructor() {
    super('articles', 'ArticleService');
  }

  /**
   * 保存 AI 生成的文章
   * 
   * 功能：
   * - 接收服务器返回的生成结果
   * - 保存到本地 PostgreSQL 数据库
   * - task_id 设为 NULL（generation_tasks 表在服务器）
   * 
   * 工作流程：
   * 1. Windows 端发起生成请求 → 服务器
   * 2. 服务器调用 AI API（DeepSeek/Gemini）
   * 3. 服务器返回生成结果
   * 4. Windows 端调用此方法保存到本地 ⬅️ 这里
   * 
   * @param article AI 生成的文章数据
   * @returns 保存后的文章
   */
  async saveGeneratedArticle(article: GeneratedArticle): Promise<Article> {
    this.validateUserId();

    try {
      log.info('ArticleService: 保存 AI 生成的文章...');

      const articleData = {
        user_id: this.userId,
        title: article.title,
        keyword: article.keyword,
        content: article.content,
        provider: article.provider,
        distillation_id: article.distillationId || null,
        topic_id: article.topicId || null,
        image_id: article.imageId || null,
        task_id: null,  // ⭐ 始终设为 NULL（generation_tasks 表在服务器）
        requirements: article.requirements || null,
        image_url: article.imageUrl || null,
        image_size_bytes: article.imageSizeBytes || 0,
        is_published: false,
        publishing_status: null,
        published_at: null,
        distillation_keyword_snapshot: article.distillationKeywordSnapshot || null,
        topic_question_snapshot: article.topicQuestionSnapshot || null,
        created_at: this.now(),
        updated_at: this.now()
      };

      const fields = Object.keys(articleData);
      const values = Object.values(articleData);
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

      const query = `
        INSERT INTO articles (${fields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await this.pool.query(query, values);

      log.info(`ArticleService: 文章保存成功, ID: ${result.rows[0].id}`);

      return result.rows[0] as Article;
    } catch (error) {
      log.error('ArticleService: 保存文章失败:', error);
      throw error;
    }
  }

  /**
   * 创建文章（手动创建）
   * 
   * @param input 文章输入数据
   * @returns 创建的文章
   */
  async createArticle(input: CreateArticleInput): Promise<Article> {
    this.validateUserId();

    try {
      const articleData = {
        user_id: this.userId,
        title: input.title,
        keyword: input.keyword,
        content: input.content,
        provider: input.provider,
        distillation_id: input.distillationId || null,
        topic_id: input.topicId || null,
        image_id: input.imageId || null,
        task_id: null,  // ⭐ 始终设为 NULL
        requirements: input.requirements || null,
        image_url: input.imageUrl || null,
        image_size_bytes: input.imageSizeBytes || 0,
        is_published: false,
        publishing_status: null,
        published_at: null,
        created_at: this.now(),
        updated_at: this.now()
      };

      const fields = Object.keys(articleData);
      const values = Object.values(articleData);
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

      const query = `
        INSERT INTO articles (${fields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await this.pool.query(query, values);

      log.info(`ArticleService: 创建文章成功, ID: ${result.rows[0].id}`);

      return result.rows[0] as Article;
    } catch (error) {
      log.error('ArticleService: 创建文章失败:', error);
      throw error;
    }
  }

  /**
   * 更新文章
   * 
   * @param id 文章 ID
   * @param input 更新数据
   * @returns 更新后的文章
   */
  async updateArticle(id: number, input: UpdateArticleInput): Promise<Article> {
    return await this.update(id, input);
  }

  /**
   * 删除文章
   * 
   * @param id 文章 ID
   */
  async deleteArticle(id: number): Promise<void> {
    await this.delete(id);
  }

  /**
   * 根据关键词查找文章
   * 
   * @param keyword 关键词
   * @returns 文章数组
   */
  async findByKeyword(keyword: string): Promise<Article[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM articles 
         WHERE user_id = $1 AND keyword = $2
         ORDER BY created_at DESC`,
        [this.userId, keyword]
      );

      return result.rows as Article[];
    } catch (error) {
      log.error('ArticleService: findByKeyword 失败:', error);
      throw error;
    }
  }

  /**
   * 搜索文章
   * 
   * @param searchTerm 搜索词
   * @returns 文章数组
   */
  async searchArticles(searchTerm: string): Promise<Article[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM articles 
         WHERE user_id = $1 
         AND (
           title ILIKE $2 
           OR keyword ILIKE $2 
           OR content ILIKE $2
         )
         ORDER BY created_at DESC`,
        [this.userId, `%${searchTerm}%`]
      );

      return result.rows as Article[];
    } catch (error) {
      log.error('ArticleService: searchArticles 失败:', error);
      throw error;
    }
  }

  /**
   * 获取已发布的文章
   * 
   * @returns 文章数组
   */
  async getPublishedArticles(): Promise<Article[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM articles 
         WHERE user_id = $1 AND is_published = TRUE
         ORDER BY published_at DESC`,
        [this.userId]
      );

      return result.rows as Article[];
    } catch (error) {
      log.error('ArticleService: getPublishedArticles 失败:', error);
      throw error;
    }
  }

  /**
   * 获取未发布的文章
   * 
   * @returns 文章数组
   */
  async getUnpublishedArticles(): Promise<Article[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM articles 
         WHERE user_id = $1 AND is_published = FALSE
         ORDER BY created_at DESC`,
        [this.userId]
      );

      return result.rows as Article[];
    } catch (error) {
      log.error('ArticleService: getUnpublishedArticles 失败:', error);
      throw error;
    }
  }

  /**
   * 标记文章为已发布
   * 
   * @param id 文章 ID
   * @param publishingStatus 发布状态
   */
  async markAsPublished(id: number, publishingStatus?: string): Promise<Article> {
    return await this.update(id, {
      is_published: true,
      publishing_status: publishingStatus || 'published',
      published_at: this.now()
    });
  }

  /**
   * 根据蒸馏 ID 获取文章
   * 
   * @param distillationId 蒸馏 ID
   * @returns 文章数组
   */
  async getByDistillationId(distillationId: number): Promise<Article[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM articles 
         WHERE user_id = $1 AND distillation_id = $2
         ORDER BY created_at DESC`,
        [this.userId, distillationId]
      );

      return result.rows as Article[];
    } catch (error) {
      log.error('ArticleService: getByDistillationId 失败:', error);
      throw error;
    }
  }

  /**
   * 根据话题 ID 获取文章
   * 
   * @param topicId 话题 ID
   * @returns 文章数组
   */
  async getByTopicId(topicId: number): Promise<Article[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM articles 
         WHERE user_id = $1 AND topic_id = $2
         ORDER BY created_at DESC`,
        [this.userId, topicId]
      );

      return result.rows as Article[];
    } catch (error) {
      log.error('ArticleService: getByTopicId 失败:', error);
      throw error;
    }
  }

  /**
   * 获取关键词统计
   * 
   * @returns 关键词统计数据
   */
  async getKeywordStats(): Promise<Array<{ keyword: string; count: number }>> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT keyword, COUNT(*) as count 
         FROM articles 
         WHERE user_id = $1 
         GROUP BY keyword 
         ORDER BY count DESC`,
        [this.userId]
      );

      return result.rows.map(row => ({
        keyword: row.keyword,
        count: parseInt(row.count)
      }));
    } catch (error) {
      log.error('ArticleService: getKeywordStats 失败:', error);
      throw error;
    }
  }

  /**
   * 获取未发布的文章
   * 
   * @returns 文章数组
   */
  async findUnpublished(): Promise<Article[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM articles 
         WHERE user_id = $1 AND is_published = FALSE
         ORDER BY created_at DESC`,
        [this.userId]
      );

      return result.rows as Article[];
    } catch (error) {
      log.error('ArticleService: findUnpublished 失败:', error);
      throw error;
    }
  }

  /**
   * 获取文章统计
   * 
   * @returns 统计数据
   */
  async getStats(): Promise<{
    total: number;
    published: number;
    unpublished: number;
    byProvider: Record<string, number>;
  }> {
    this.validateUserId();

    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM articles WHERE user_id = $1',
        [this.userId]
      );

      const publishedResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM articles WHERE user_id = $1 AND is_published = TRUE',
        [this.userId]
      );

      const unpublishedResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM articles WHERE user_id = $1 AND is_published = FALSE',
        [this.userId]
      );

      const byProviderResult = await this.pool.query(
        `SELECT provider, COUNT(*) as count 
         FROM articles 
         WHERE user_id = $1 
         GROUP BY provider`,
        [this.userId]
      );

      const byProvider: Record<string, number> = {};
      byProviderResult.rows.forEach(row => {
        byProvider[row.provider] = parseInt(row.count);
      });

      return {
        total: parseInt(totalResult.rows[0].count),
        published: parseInt(publishedResult.rows[0].count),
        unpublished: parseInt(unpublishedResult.rows[0].count),
        byProvider
      };
    } catch (error) {
      log.error('ArticleService: getStats 失败:', error);
      throw error;
    }
  }
}
