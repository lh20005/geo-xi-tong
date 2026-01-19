/**
 * 知识库服务类（PostgreSQL 版本）
 * 
 * 功能：
 * - 管理用户的知识库
 * - 处理知识库文档关联
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import { PoolClient } from 'pg';
import log from 'electron-log';

/**
 * 知识库接口
 */
export interface KnowledgeBase {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  document_count: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * 知识库文档接口
 */
export interface KnowledgeDocument {
  id: number;
  knowledge_base_id: number;
  user_id: number;
  filename: string;
  filepath: string;
  content: string;
  file_type: string;
  file_size: number;
  created_at: Date;
}

/**
 * 创建知识库输入
 */
export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
}

/**
 * 更新知识库输入
 */
export interface UpdateKnowledgeBaseInput {
  name?: string;
  description?: string;
}

/**
 * 知识库服务类
 */
export class KnowledgeBaseServicePostgres extends BaseServicePostgres<KnowledgeBase> {
  constructor() {
    super('knowledge_bases', 'KnowledgeBaseService');
  }

  /**
   * 创建知识库
   */
  async createKnowledgeBase(input: CreateKnowledgeBaseInput): Promise<KnowledgeBase> {
    return await this.create({
      ...input,
      document_count: 0
    });
  }

  /**
   * 更新知识库
   */
  async updateKnowledgeBase(id: number, input: UpdateKnowledgeBaseInput): Promise<KnowledgeBase> {
    return await this.update(id, input);
  }

  /**
   * 删除知识库（级联删除文档）
   */
  async deleteKnowledgeBase(id: number): Promise<void> {
    this.validateUserId();

    try {
      await this.transaction(async (client: PoolClient) => {
        // 先删除知识库文档
        await client.query(
          'DELETE FROM knowledge_documents WHERE knowledge_base_id = $1 AND user_id = $2',
          [id, this.userId]
        );

        // 再删除知识库
        await client.query(
          'DELETE FROM knowledge_bases WHERE id = $1 AND user_id = $2',
          [id, this.userId]
        );

        log.info(`KnowledgeBaseService: 删除知识库及其文档成功, ID: ${id}`);
      });
    } catch (error) {
      log.error('KnowledgeBaseService: deleteKnowledgeBase 失败:', error);
      throw error;
    }
  }

  /**
   * 根据名称查找知识库
   */
  async findByName(name: string): Promise<KnowledgeBase[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM knowledge_bases WHERE user_id = $1 AND name = $2 ORDER BY created_at DESC',
        [this.userId, name]
      );

      return result.rows as KnowledgeBase[];
    } catch (error) {
      log.error('KnowledgeBaseService: findByName 失败:', error);
      throw error;
    }
  }

  /**
   * 搜索知识库
   */
  async searchKnowledgeBases(searchTerm: string): Promise<KnowledgeBase[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM knowledge_bases 
         WHERE user_id = $1 
         AND (name ILIKE $2 OR description ILIKE $2)
         ORDER BY created_at DESC`,
        [this.userId, `%${searchTerm}%`]
      );

      return result.rows as KnowledgeBase[];
    } catch (error) {
      log.error('KnowledgeBaseService: searchKnowledgeBases 失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有知识库（带文档计数）
   */
  async findAllWithDocumentCount(): Promise<KnowledgeBase[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT kb.*, COUNT(kd.id) as document_count
         FROM knowledge_bases kb
         LEFT JOIN knowledge_documents kd ON kd.knowledge_base_id = kb.id AND kd.user_id = kb.user_id
         WHERE kb.user_id = $1
         GROUP BY kb.id
         ORDER BY kb.created_at DESC`,
        [this.userId]
      );

      return result.rows.map(row => ({
        ...row,
        document_count: parseInt(row.document_count)
      })) as KnowledgeBase[];
    } catch (error) {
      log.error('KnowledgeBaseService: findAllWithDocumentCount 失败:', error);
      throw error;
    }
  }

  /**
   * 上传文档到知识库
   */
  async uploadDocument(params: {
    knowledgeBaseId: number;
    filename: string;
    filepath: string;
    content: string;
    fileType: string;
    fileSize: number;
  }): Promise<KnowledgeDocument> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `INSERT INTO knowledge_documents 
         (knowledge_base_id, user_id, filename, filepath, content, file_type, file_size, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [
          params.knowledgeBaseId,
          this.userId,
          params.filename,
          params.filepath,
          params.content,
          params.fileType,
          params.fileSize
        ]
      );

      // 更新知识库的文档计数
      await this.updateDocumentCount(params.knowledgeBaseId);

      log.info(`KnowledgeBaseService: 上传文档成功, 文件名: ${params.filename}`);
      return result.rows[0] as KnowledgeDocument;
    } catch (error) {
      log.error('KnowledgeBaseService: uploadDocument 失败:', error);
      throw error;
    }
  }

  /**
   * 根据 ID 获取文档
   */
  async findDocumentById(docId: number): Promise<KnowledgeDocument | null> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM knowledge_documents WHERE id = $1 AND user_id = $2',
        [docId, this.userId]
      );

      return result.rows.length > 0 ? (result.rows[0] as KnowledgeDocument) : null;
    } catch (error) {
      log.error('KnowledgeBaseService: findDocumentById 失败:', error);
      throw error;
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(docId: number): Promise<void> {
    this.validateUserId();

    try {
      // 先获取文档信息以便更新知识库计数
      const doc = await this.findDocumentById(docId);
      
      if (doc) {
        await this.pool.query(
          'DELETE FROM knowledge_documents WHERE id = $1 AND user_id = $2',
          [docId, this.userId]
        );

        // 更新知识库的文档计数
        await this.updateDocumentCount(doc.knowledge_base_id);

        log.info(`KnowledgeBaseService: 删除文档成功, ID: ${docId}`);
      }
    } catch (error) {
      log.error('KnowledgeBaseService: deleteDocument 失败:', error);
      throw error;
    }
  }

  /**
   * 搜索文档
   */
  async searchDocuments(query: string, kbId?: number): Promise<KnowledgeDocument[]> {
    this.validateUserId();

    try {
      let sql = `SELECT * FROM knowledge_documents 
                 WHERE user_id = $1 
                 AND (filename ILIKE $2 OR content ILIKE $2)`;
      const params: any[] = [this.userId, `%${query}%`];

      if (kbId) {
        sql += ' AND knowledge_base_id = $3';
        params.push(kbId);
      }

      sql += ' ORDER BY created_at DESC';

      const result = await this.pool.query(sql, params);
      return result.rows as KnowledgeDocument[];
    } catch (error) {
      log.error('KnowledgeBaseService: searchDocuments 失败:', error);
      throw error;
    }
  }

  /**
   * 获取知识库的文档列表
   */
  async getDocuments(knowledgeBaseId: number): Promise<KnowledgeDocument[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM knowledge_documents 
         WHERE knowledge_base_id = $1 AND user_id = $2
         ORDER BY created_at DESC`,
        [knowledgeBaseId, this.userId]
      );

      return result.rows as KnowledgeDocument[];
    } catch (error) {
      log.error('KnowledgeBaseService: getDocuments 失败:', error);
      throw error;
    }
  }

  /**
   * 更新知识库的文档计数
   */
  async updateDocumentCount(knowledgeBaseId: number): Promise<void> {
    this.validateUserId();

    try {
      await this.pool.query(
        `UPDATE knowledge_bases 
         SET document_count = (
           SELECT COUNT(*) FROM knowledge_documents 
           WHERE knowledge_base_id = $1 AND user_id = $2
         )
         WHERE id = $1 AND user_id = $2`,
        [knowledgeBaseId, this.userId]
      );

      log.info(`KnowledgeBaseService: 更新文档计数成功, ID: ${knowledgeBaseId}`);
    } catch (error) {
      log.error('KnowledgeBaseService: updateDocumentCount 失败:', error);
      throw error;
    }
  }

  /**
   * 获取知识库统计
   */
  async getStats(): Promise<{
    total: number;
    totalDocuments: number;
    averageDocumentsPerBase: number;
  }> {
    this.validateUserId();

    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM knowledge_bases WHERE user_id = $1',
        [this.userId]
      );

      const documentsResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM knowledge_documents WHERE user_id = $1',
        [this.userId]
      );

      const total = parseInt(totalResult.rows[0].count);
      const totalDocuments = parseInt(documentsResult.rows[0].count);

      return {
        total,
        totalDocuments,
        averageDocumentsPerBase: total > 0 ? totalDocuments / total : 0
      };
    } catch (error) {
      log.error('KnowledgeBaseService: getStats 失败:', error);
      throw error;
    }
  }
}
