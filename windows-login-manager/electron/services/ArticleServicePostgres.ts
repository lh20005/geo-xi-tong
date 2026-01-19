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

import { BaseServicePostgres, PaginationParams, SortParams, PaginatedResult } from './BaseServicePostgres';
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
  task_id?: number | null;
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
  article_setting_id?: number;
  article_setting_snapshot?: string;
  conversion_target_id?: number;
  conversion_target_snapshot?: string;
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
  articleSettingId?: number;
  articleSettingSnapshot?: string;
  conversionTargetId?: number;
  conversionTargetSnapshot?: string;
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
  albumId?: number;
  taskId?: number;
  requirements?: string;
  imageUrl?: string;
  imageSizeBytes?: number;
  distillationKeywordSnapshot?: string;
  topicQuestionSnapshot?: string;
  articleSettingId?: number;
  articleSettingSnapshot?: string;
  conversionTargetId?: number;
  conversionTargetSnapshot?: string;
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
  provider?: string;
  distillationId?: number;
  distillationKeywordSnapshot?: string;
  topicId?: number;
  topicQuestionSnapshot?: string;
  taskId?: number;
  imageId?: number;
  articleSettingId?: number;
  articleSettingSnapshot?: string;
  conversionTargetId?: number;
  conversionTargetSnapshot?: string;
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

      // ---------------------------------------------------------
      // 修复：强制从本地图库选择图片
      // 原因：图片只存储在 Windows 端本地数据库，服务器不负责图片管理
      // ---------------------------------------------------------
      let imageId: number | null = null;
      let imageUrl: string | null = null;
      let imageSizeBytes = 0;

      // 1. 获取相册 ID
      let albumId: number | null = null;
      
      // 尝试从 articleSettingId 获取
      if (article.articleSettingId) {
          const settingResult = await this.pool.query(
            'SELECT setting_value FROM article_settings WHERE id = $1',
            [article.articleSettingId]
          );
          if (settingResult.rows.length > 0) {
            try {
              const config = JSON.parse(settingResult.rows[0].setting_value);
              if (config.albumId) {
                albumId = parseInt(config.albumId);
              }
            } catch (e) {
              log.warn('ArticleService: 解析文章设置失败', e);
            }
          }
      }

      // 2. 如果有相册 ID，选择图片
      if (albumId) {
        // 选择使用次数最少的图片
        const imageResult = await this.pool.query(
          `SELECT * FROM images 
            WHERE user_id = $1 AND album_id = $2 AND deleted_at IS NULL
            ORDER BY usage_count ASC, created_at ASC
            LIMIT 1`,
          [this.userId, albumId]
        );

        if (imageResult.rows.length > 0) {
          const image = imageResult.rows[0];
          log.info(`ArticleService: 为文章自动选择本地图片 ID: ${image.id}`);
          
          imageId = image.id;
          // 使用绝对路径，ArticlePreview 组件会通过 local-file 协议处理
          imageUrl = image.filepath;
          imageSizeBytes = image.size;

          // 更新图片引用计数
          await this.pool.query(
            `UPDATE images 
              SET usage_count = usage_count + 1, reference_count = reference_count + 1 
              WHERE id = $1`,
            [imageId]
          );
        } else {
          log.warn(`ArticleService: 相册 ID ${albumId} 中没有可用图片`);
        }
      }
      // ---------------------------------------------------------

      const articleData = {
        user_id: this.userId,
        title: article.title,
        keyword: article.keyword,
        content: article.content,
        provider: article.provider,
        distillation_id: article.distillationId || null,
        topic_id: article.topicId || null,
        image_id: imageId,
        task_id: null,  // ⭐ 始终设为 NULL（generation_tasks 表在服务器）
        requirements: article.requirements || null,
        image_url: imageUrl,
        image_size_bytes: imageSizeBytes,
        is_published: false,
        publishing_status: null,
        published_at: null,
        distillation_keyword_snapshot: article.distillationKeywordSnapshot || null,
        topic_question_snapshot: article.topicQuestionSnapshot || null,
        article_setting_id: article.articleSettingId || null,
        article_setting_snapshot: article.articleSettingSnapshot || null,
        conversion_target_id: article.conversionTargetId || null,
        conversion_target_snapshot: article.conversionTargetSnapshot || null,
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
   * 分页查询（重写以支持 isPublished 过滤）
   * 
   * @param params 分页和排序参数
   * @param searchFields 搜索字段
   * @returns 分页结果
   */
  async findPaginated(
    params: PaginationParams & SortParams & { search?: string, isPublished?: boolean },
    searchFields: string[] = []
  ): Promise<PaginatedResult<Article>> {
    this.validateUserId();

    try {
      const page = params.page || 1;
      const pageSize = params.pageSize || 20;
      const offset = (page - 1) * pageSize;

      const whereClauses: string[] = ['user_id = $1'];
      const queryParams: any[] = [this.userId];
      let paramIndex = 2;

      // 过滤发布状态
      if (params.isPublished !== undefined) {
        whereClauses.push(`is_published = $${paramIndex}`);
        queryParams.push(params.isPublished);
        paramIndex++;
      }

      // 搜索条件
      if (params.search && searchFields.length > 0) {
        const searchConditions = searchFields.map(field => {
          const condition = `${field}::text ILIKE $${paramIndex}`;
          paramIndex++;
          return condition;
        });
        whereClauses.push(`(${searchConditions.join(' OR ')})`);
        searchFields.forEach(() => {
          queryParams.push(`%${params.search}%`);
        });
      }

      const whereClause = whereClauses.join(' AND ');

      // 排序
      const sortField = params.sortField || 'created_at';
      const sortOrder = params.sortOrder || 'desc';
      const orderClause = `ORDER BY ${sortField} ${sortOrder.toUpperCase()}`;

      // 查询总数
      const countSql = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE ${whereClause}`;
      const countResult = await this.pool.query(countSql, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // 查询数据
      const dataSql = `
        SELECT * FROM ${this.tableName} 
        WHERE ${whereClause} 
        ${orderClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      log.info('ArticleService: findPaginated SQL:', { 
        sql: dataSql, 
        params: [...queryParams, pageSize, offset] 
      });

      const dataResult = await this.pool.query(dataSql, [...queryParams, pageSize, offset]);
      
      const data = dataResult.rows as Article[];

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      log.error('ArticleService: findPaginated 失败:', error);
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
      log.info('ArticleService: createArticle input:', JSON.stringify(input, null, 2));

      // ---------------------------------------------------------
      // 修复：如果未提供图片，尝试从本地图库自动选择
      // ---------------------------------------------------------
      let imageId = input.imageId || null;
      let imageUrl = input.imageUrl || null;
      let imageSizeBytes = input.imageSizeBytes || 0;

      if (!imageId) {
        let albumId: number | null = input.albumId || null;
        
        // 尝试从 articleSettingId 获取 (如果 albumId 未提供)
        if (!albumId && input.articleSettingId) {
            const settingResult = await this.pool.query(
              'SELECT setting_value FROM article_settings WHERE id = $1',
              [input.articleSettingId]
            );
            if (settingResult.rows.length > 0) {
              try {
                const config = JSON.parse(settingResult.rows[0].setting_value);
                if (config.albumId) {
                  albumId = parseInt(config.albumId);
                }
              } catch (e) {
                log.warn('ArticleService: 解析文章设置失败', e);
              }
            }
        }

        // 2. 如果有相册 ID，选择图片
        if (albumId) {
          // 选择使用次数最少的图片
          const imageResult = await this.pool.query(
            `SELECT * FROM images 
              WHERE user_id = $1 AND album_id = $2 AND deleted_at IS NULL
              ORDER BY usage_count ASC, created_at ASC
              LIMIT 1`,
            [this.userId, albumId]
          );

          if (imageResult.rows.length > 0) {
            const image = imageResult.rows[0];
            log.info(`ArticleService: 为文章自动选择本地图片 ID: ${image.id}`);
            
            imageId = image.id;
            imageUrl = image.filepath;
            imageSizeBytes = image.size;

            // 更新图片引用计数
            await this.pool.query(
              `UPDATE images 
                SET usage_count = usage_count + 1, reference_count = reference_count + 1 
                WHERE id = $1`,
              [imageId]
            );
          } else {
            log.warn(`ArticleService: 相册 ID ${albumId} 中没有可用图片`);
          }
        }
      }
      // ---------------------------------------------------------

      const articleData = {
        user_id: this.userId,
        title: input.title,
        keyword: input.keyword,
        content: input.content,
        provider: input.provider,
        distillation_id: input.distillationId || null,
        topic_id: input.topicId || null,
        image_id: imageId,
        task_id: input.taskId || null,
        requirements: input.requirements || null,
        image_url: imageUrl,
        image_size_bytes: imageSizeBytes,
        is_published: false,
        publishing_status: null,
        published_at: null,
        distillation_keyword_snapshot: input.distillationKeywordSnapshot || null,
        topic_question_snapshot: input.topicQuestionSnapshot || null,
        article_setting_id: input.articleSettingId || null,
        article_setting_snapshot: input.articleSettingSnapshot || null,
        conversion_target_id: input.conversionTargetId || null,
        conversion_target_snapshot: input.conversionTargetSnapshot || null,
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
   * 检查文章是否存在（防止重复同步）
   * 
   * @param taskId 任务 ID
   * @param title 文章标题
   */
  async checkArticleExists(taskId: number, title: string): Promise<boolean> {
    this.validateUserId();
    
    try {
      const query = `
        SELECT 1 FROM articles 
        WHERE user_id = $1 AND task_id = $2 AND title = $3
      `;
      
      const result = await this.pool.query(query, [this.userId, taskId, title]);
      return result.rows.length > 0;
    } catch (error) {
      log.error('ArticleService: 检查文章是否存在失败:', error);
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
    this.validateUserId();
    
    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.keyword !== undefined) updateData.keyword = input.keyword;
    if (input.content !== undefined) updateData.content = input.content;
    if (input.imageUrl !== undefined) updateData.image_url = input.imageUrl;
    if (input.imageSizeBytes !== undefined) updateData.image_size_bytes = input.imageSizeBytes;
    if (input.provider !== undefined) updateData.provider = input.provider;
    if (input.isPublished !== undefined) updateData.is_published = input.isPublished;
    if (input.publishingStatus !== undefined) updateData.publishing_status = input.publishingStatus;
    if (input.publishedAt !== undefined) updateData.published_at = input.publishedAt;
    if (input.distillationId !== undefined) updateData.distillation_id = input.distillationId;
    if (input.distillationKeywordSnapshot !== undefined) updateData.distillation_keyword_snapshot = input.distillationKeywordSnapshot;
    if (input.topicId !== undefined) updateData.topic_id = input.topicId;
    if (input.topicQuestionSnapshot !== undefined) updateData.topic_question_snapshot = input.topicQuestionSnapshot;
    if (input.taskId !== undefined) updateData.task_id = input.taskId;
    if (input.imageId !== undefined) updateData.image_id = input.imageId;
    if (input.requirements !== undefined) updateData.requirements = input.requirements;
    if (input.articleSettingId !== undefined) updateData.article_setting_id = input.articleSettingId;
    if (input.articleSettingSnapshot !== undefined) updateData.article_setting_snapshot = input.articleSettingSnapshot;
    if (input.conversionTargetId !== undefined) updateData.conversion_target_id = input.conversionTargetId;
    if (input.conversionTargetSnapshot !== undefined) updateData.conversion_target_snapshot = input.conversionTargetSnapshot;

    return await this.update(id, updateData);
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
