/**
 * 文章服务
 * 负责文章的本地 CRUD 操作
 * 与服务器端 server/src/routes/article.ts 业务逻辑保持一致
 * Requirements: Phase 2 - 数据服务层
 */

import { BaseService, PaginationParams, SortParams, PaginatedResult } from './BaseService';
import log from 'electron-log';

/**
 * 文章接口 - 与服务器端 articles 表结构一致
 */
export interface Article {
  id: string;
  user_id: number;
  title: string | null;
  keyword: string;
  distillation_id: string | null;
  topic_id: string | null;
  task_id: string | null;
  image_id: string | null;
  requirements: string | null;
  content: string;
  image_url: string | null;
  image_size_bytes: number;
  provider: string;
  is_published: number;  // SQLite 用 INTEGER 代替 BOOLEAN
  publishing_status: string | null;
  published_at: string | null;
  // 快照字段 - 删除蒸馏记录后仍能显示关键词和话题
  distillation_keyword_snapshot: string | null;
  topic_question_snapshot: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 创建文章参数
 */
export interface CreateArticleParams {
  user_id: number;
  title?: string;
  keyword: string;
  distillation_id?: string;
  topic_id?: string;
  task_id?: string;
  image_id?: string;
  requirements?: string;
  content: string;
  image_url?: string;
  image_size_bytes?: number;
  provider: string;
  distillation_keyword_snapshot?: string;
  topic_question_snapshot?: string;
}

/**
 * 更新文章参数
 */
export interface UpdateArticleParams {
  title?: string;
  keyword?: string;
  content?: string;
  image_url?: string;
  image_id?: string;
  is_published?: number;
  publishing_status?: string;
  published_at?: string;
}

/**
 * 文章查询参数
 */
export interface ArticleQueryParams extends PaginationParams, SortParams {
  search?: string;
  keyword?: string;
  provider?: string;
  is_published?: number;
}

/**
 * 文章服务类
 */
class ArticleService extends BaseService<Article> {
  private static instance: ArticleService;

  private constructor() {
    super('articles', 'ArticleService');
  }

  static getInstance(): ArticleService {
    if (!ArticleService.instance) {
      ArticleService.instance = new ArticleService();
    }
    return ArticleService.instance;
  }

  /**
   * 创建文章
   */
  create(params: CreateArticleParams): Article {
    try {
      const id = this.generateId();
      const now = this.now();

      const sql = `
        INSERT INTO articles (
          id, user_id, title, keyword, distillation_id, topic_id, task_id,
          image_id, requirements, content, image_url, image_size_bytes,
          provider, is_published, distillation_keyword_snapshot, topic_question_snapshot,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
      `;

      this.db.prepare(sql).run(
        id,
        params.user_id,
        params.title || null,
        params.keyword,
        params.distillation_id || null,
        params.topic_id || null,
        params.task_id || null,
        params.image_id || null,
        params.requirements || null,
        params.content,
        params.image_url || null,
        params.image_size_bytes || 0,
        params.provider,
        params.distillation_keyword_snapshot || null,
        params.topic_question_snapshot || null,
        now,
        now
      );

      log.info(`ArticleService: Created article ${id}`);
      return this.findById(id)!;
    } catch (error) {
      log.error('ArticleService: create failed:', error);
      throw error;
    }
  }

  /**
   * 更新文章
   */
  update(id: string, params: UpdateArticleParams): Article | null {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (params.title !== undefined) {
        updates.push('title = ?');
        values.push(params.title);
      }
      if (params.keyword !== undefined) {
        updates.push('keyword = ?');
        values.push(params.keyword);
      }
      if (params.content !== undefined) {
        updates.push('content = ?');
        values.push(params.content);
      }
      if (params.image_url !== undefined) {
        updates.push('image_url = ?');
        values.push(params.image_url);
      }
      if (params.image_id !== undefined) {
        updates.push('image_id = ?');
        values.push(params.image_id);
      }
      if (params.is_published !== undefined) {
        updates.push('is_published = ?');
        values.push(params.is_published);
      }
      if (params.publishing_status !== undefined) {
        updates.push('publishing_status = ?');
        values.push(params.publishing_status);
      }
      if (params.published_at !== undefined) {
        updates.push('published_at = ?');
        values.push(params.published_at);
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      updates.push('updated_at = ?');
      values.push(this.now());
      values.push(id);

      const sql = `UPDATE articles SET ${updates.join(', ')} WHERE id = ?`;
      this.db.prepare(sql).run(...values);

      log.info(`ArticleService: Updated article ${id}`);
      return this.findById(id);
    } catch (error) {
      log.error('ArticleService: update failed:', error);
      throw error;
    }
  }

  /**
   * 查询文章（带筛选）
   */
  query(userId: number, params: ArticleQueryParams): PaginatedResult<Article> {
    try {
      const page = params.page || 1;
      const pageSize = params.pageSize || 20;
      const offset = (page - 1) * pageSize;

      const whereClauses: string[] = ['user_id = ?'];
      const queryParams: any[] = [userId];

      // 搜索条件
      if (params.search) {
        whereClauses.push('(title LIKE ? OR keyword LIKE ? OR content LIKE ?)');
        queryParams.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`);
      }

      // 关键词筛选
      if (params.keyword) {
        whereClauses.push('keyword = ?');
        queryParams.push(params.keyword);
      }

      // 提供商筛选
      if (params.provider) {
        whereClauses.push('provider = ?');
        queryParams.push(params.provider);
      }

      // 发布状态筛选
      if (params.is_published !== undefined) {
        whereClauses.push('is_published = ?');
        queryParams.push(params.is_published);
      }

      const whereClause = whereClauses.join(' AND ');

      // 排序
      const sortField = params.sortField || 'created_at';
      const sortOrder = params.sortOrder || 'desc';
      const orderClause = `ORDER BY ${sortField} ${sortOrder.toUpperCase()}`;

      // 查询总数
      const countSql = `SELECT COUNT(*) as total FROM articles WHERE ${whereClause}`;
      const countResult = this.db.prepare(countSql).get(...queryParams) as { total: number };
      const total = countResult.total;

      // 查询数据
      const dataSql = `
        SELECT * FROM articles 
        WHERE ${whereClause} 
        ${orderClause}
        LIMIT ? OFFSET ?
      `;
      const data = this.db.prepare(dataSql).all(...queryParams, pageSize, offset) as Article[];

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      log.error('ArticleService: query failed:', error);
      throw error;
    }
  }

  /**
   * 根据关键词查找文章
   */
  findByKeyword(userId: number, keyword: string): Article[] {
    try {
      return this.db.prepare(
        'SELECT * FROM articles WHERE user_id = ? AND keyword = ? ORDER BY created_at DESC'
      ).all(userId, keyword) as Article[];
    } catch (error) {
      log.error('ArticleService: findByKeyword failed:', error);
      throw error;
    }
  }

  /**
   * 获取未发布的文章
   */
  findUnpublished(userId: number): Article[] {
    try {
      return this.db.prepare(
        'SELECT * FROM articles WHERE user_id = ? AND is_published = 0 ORDER BY created_at DESC'
      ).all(userId) as Article[];
    } catch (error) {
      log.error('ArticleService: findUnpublished failed:', error);
      throw error;
    }
  }

  /**
   * 标记文章为已发布
   */
  markAsPublished(id: string, publishedAt?: string): boolean {
    try {
      const result = this.db.prepare(`
        UPDATE articles 
        SET is_published = 1, published_at = ?, updated_at = ?
        WHERE id = ?
      `).run(publishedAt || this.now(), this.now(), id);

      return result.changes > 0;
    } catch (error) {
      log.error('ArticleService: markAsPublished failed:', error);
      throw error;
    }
  }

  /**
   * 获取文章统计
   */
  getStats(userId: number): {
    total: number;
    published: number;
    unpublished: number;
    byProvider: { provider: string; count: number }[];
  } {
    try {
      const total = this.count(userId);

      const publishedResult = this.db.prepare(
        'SELECT COUNT(*) as count FROM articles WHERE user_id = ? AND is_published = 1'
      ).get(userId) as { count: number };

      const byProvider = this.db.prepare(`
        SELECT provider, COUNT(*) as count 
        FROM articles 
        WHERE user_id = ? 
        GROUP BY provider
      `).all(userId) as { provider: string; count: number }[];

      return {
        total,
        published: publishedResult.count,
        unpublished: total - publishedResult.count,
        byProvider
      };
    } catch (error) {
      log.error('ArticleService: getStats failed:', error);
      throw error;
    }
  }

  /**
   * 获取关键词统计（与服务器端 /stats/keywords 一致）
   */
  getKeywordStats(userId: number): { keyword: string; count: number }[] {
    try {
      return this.db.prepare(`
        SELECT keyword, COUNT(*) as count
        FROM articles
        WHERE user_id = ?
        GROUP BY keyword
        ORDER BY count DESC, keyword ASC
      `).all(userId) as { keyword: string; count: number }[];
    } catch (error) {
      log.error('ArticleService: getKeywordStats failed:', error);
      throw error;
    }
  }

  /**
   * 删除文章（带用户权限检查）
   */
  delete(id: string, userId?: number): boolean {
    try {
      let sql = 'DELETE FROM articles WHERE id = ?';
      const params: any[] = [id];
      
      if (userId !== undefined) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }
      
      const result = this.db.prepare(sql).run(...params);
      
      if (result.changes > 0) {
        log.info(`ArticleService: Deleted article ${id}`);
      }
      
      return result.changes > 0;
    } catch (error) {
      log.error('ArticleService: delete failed:', error);
      throw error;
    }
  }

  /**
   * 批量删除文章（与服务器端 DELETE /batch 一致）
   */
  deleteBatch(userId: number, ids: string[]): { deletedCount: number } {
    try {
      return this.transaction(() => {
        let deletedCount = 0;
        
        for (const id of ids) {
          const result = this.db.prepare(
            'DELETE FROM articles WHERE id = ? AND user_id = ?'
          ).run(id, userId);
          
          if (result.changes > 0) {
            deletedCount++;
          }
        }
        
        log.info(`ArticleService: Batch deleted ${deletedCount} articles`);
        return { deletedCount };
      });
    } catch (error) {
      log.error('ArticleService: deleteBatch failed:', error);
      throw error;
    }
  }

  /**
   * 删除所有文章（与服务器端 DELETE /all 一致）
   */
  deleteAll(userId: number): { deletedCount: number } {
    try {
      const result = this.db.prepare(
        'DELETE FROM articles WHERE user_id = ?'
      ).run(userId);
      
      log.info(`ArticleService: Deleted all ${result.changes} articles for user ${userId}`);
      return { deletedCount: result.changes };
    } catch (error) {
      log.error('ArticleService: deleteAll failed:', error);
      throw error;
    }
  }
}

export const articleService = ArticleService.getInstance();
export { ArticleService };
