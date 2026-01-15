/**
 * 知识库服务
 * 负责知识库和文档的本地 CRUD 操作
 * Requirements: Phase 2 - 数据服务层
 */

import { BaseService, PaginationParams, SortParams, PaginatedResult } from './BaseService';
import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/**
 * 知识库接口
 */
export interface KnowledgeBase {
  id: string;
  user_id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 知识文档接口
 */
export interface KnowledgeDocument {
  id: string;
  knowledge_base_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  content: string;
  created_at: string;
}

/**
 * 创建知识库参数
 */
export interface CreateKnowledgeBaseParams {
  user_id: number;
  name: string;
  description?: string;
}

/**
 * 更新知识库参数
 */
export interface UpdateKnowledgeBaseParams {
  name?: string;
  description?: string;
}

/**
 * 上传文档参数
 */
export interface UploadDocumentParams {
  knowledge_base_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  content: string;
}

/**
 * 知识库服务类
 */
class KnowledgeBaseService extends BaseService<KnowledgeBase> {
  private static instance: KnowledgeBaseService;
  private storageDir: string;

  private constructor() {
    super('knowledge_bases', 'KnowledgeBaseService');
    // 知识库文件存储目录
    this.storageDir = path.join(app.getPath('userData'), 'knowledge-files');
    this.ensureStorageDir();
  }

  static getInstance(): KnowledgeBaseService {
    if (!KnowledgeBaseService.instance) {
      KnowledgeBaseService.instance = new KnowledgeBaseService();
    }
    return KnowledgeBaseService.instance;
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      log.info(`KnowledgeBaseService: Created storage directory: ${this.storageDir}`);
    }
  }

  /**
   * 创建知识库
   */
  create(params: CreateKnowledgeBaseParams): KnowledgeBase {
    try {
      const id = this.generateId();
      const now = this.now();

      this.db.prepare(`
        INSERT INTO knowledge_bases (id, user_id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, params.user_id, params.name, params.description || null, now, now);

      log.info(`KnowledgeBaseService: Created knowledge base ${id}`);
      return this.findById(id)!;
    } catch (error) {
      log.error('KnowledgeBaseService: create failed:', error);
      throw error;
    }
  }

  /**
   * 更新知识库
   */
  update(id: string, params: UpdateKnowledgeBaseParams): KnowledgeBase | null {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (params.name !== undefined) {
        updates.push('name = ?');
        values.push(params.name);
      }
      if (params.description !== undefined) {
        updates.push('description = ?');
        values.push(params.description);
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      updates.push('updated_at = ?');
      values.push(this.now());
      values.push(id);

      const sql = `UPDATE knowledge_bases SET ${updates.join(', ')} WHERE id = ?`;
      this.db.prepare(sql).run(...values);

      log.info(`KnowledgeBaseService: Updated knowledge base ${id}`);
      return this.findById(id);
    } catch (error) {
      log.error('KnowledgeBaseService: update failed:', error);
      throw error;
    }
  }

  /**
   * 删除知识库（包括所有文档）
   */
  delete(id: string, userId?: number): boolean {
    try {
      return this.transaction(() => {
        // 如果提供了 userId，先验证权限
        if (userId !== undefined) {
          const kb = this.findById(id);
          if (!kb || kb.user_id !== userId) {
            return false;
          }
        }
        
        // 先删除所有文档
        this.db.prepare('DELETE FROM knowledge_documents WHERE knowledge_base_id = ?').run(id);
        
        // 删除知识库
        const result = this.db.prepare('DELETE FROM knowledge_bases WHERE id = ?').run(id);
        
        log.info(`KnowledgeBaseService: Deleted knowledge base ${id}`);
        return result.changes > 0;
      });
    } catch (error) {
      log.error('KnowledgeBaseService: delete failed:', error);
      throw error;
    }
  }

  /**
   * 获取知识库详情（包含文档列表）
   */
  getWithDocuments(id: string): (KnowledgeBase & { documents: KnowledgeDocument[] }) | null {
    try {
      const kb = this.findById(id);
      if (!kb) return null;

      const documents = this.db.prepare(
        'SELECT * FROM knowledge_documents WHERE knowledge_base_id = ? ORDER BY created_at DESC'
      ).all(id) as KnowledgeDocument[];

      return { ...kb, documents };
    } catch (error) {
      log.error('KnowledgeBaseService: getWithDocuments failed:', error);
      throw error;
    }
  }

  /**
   * 上传文档
   */
  uploadDocument(params: UploadDocumentParams): KnowledgeDocument {
    try {
      const id = this.generateId();
      const now = this.now();

      this.db.prepare(`
        INSERT INTO knowledge_documents (id, knowledge_base_id, filename, file_type, file_size, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        params.knowledge_base_id,
        params.filename,
        params.file_type,
        params.file_size,
        params.content,
        now
      );

      // 更新知识库的更新时间
      this.db.prepare('UPDATE knowledge_bases SET updated_at = ? WHERE id = ?')
        .run(now, params.knowledge_base_id);

      log.info(`KnowledgeBaseService: Uploaded document ${id} to knowledge base ${params.knowledge_base_id}`);
      return this.findDocumentById(id)!;
    } catch (error) {
      log.error('KnowledgeBaseService: uploadDocument failed:', error);
      throw error;
    }
  }

  /**
   * 根据 ID 查找文档
   */
  findDocumentById(id: string): KnowledgeDocument | null {
    try {
      const result = this.db.prepare(
        'SELECT * FROM knowledge_documents WHERE id = ?'
      ).get(id) as KnowledgeDocument | undefined;
      
      return result || null;
    } catch (error) {
      log.error('KnowledgeBaseService: findDocumentById failed:', error);
      throw error;
    }
  }

  /**
   * 删除文档
   */
  deleteDocument(id: string): boolean {
    try {
      // 获取文档信息以更新知识库时间
      const doc = this.findDocumentById(id);
      if (!doc) return false;

      const result = this.db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(id);

      if (result.changes > 0) {
        // 更新知识库的更新时间
        this.db.prepare('UPDATE knowledge_bases SET updated_at = ? WHERE id = ?')
          .run(this.now(), doc.knowledge_base_id);
      }

      log.info(`KnowledgeBaseService: Deleted document ${id}`);
      return result.changes > 0;
    } catch (error) {
      log.error('KnowledgeBaseService: deleteDocument failed:', error);
      throw error;
    }
  }

  /**
   * 获取知识库的所有文档内容（用于 AI 生成）
   */
  getDocumentsContent(knowledgeBaseId: string): string {
    try {
      const documents = this.db.prepare(
        'SELECT content FROM knowledge_documents WHERE knowledge_base_id = ?'
      ).all(knowledgeBaseId) as { content: string }[];

      return documents.map(d => d.content).join('\n\n---\n\n');
    } catch (error) {
      log.error('KnowledgeBaseService: getDocumentsContent failed:', error);
      throw error;
    }
  }

  /**
   * 获取知识库统计
   */
  getStats(userId: number): {
    totalKnowledgeBases: number;
    totalDocuments: number;
    totalSize: number;
  } {
    try {
      const kbCount = this.count(userId);

      const docStats = this.db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(kd.file_size), 0) as total_size
        FROM knowledge_documents kd
        JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id
        WHERE kb.user_id = ?
      `).get(userId) as { count: number; total_size: number };

      return {
        totalKnowledgeBases: kbCount,
        totalDocuments: docStats.count,
        totalSize: docStats.total_size
      };
    } catch (error) {
      log.error('KnowledgeBaseService: getStats failed:', error);
      throw error;
    }
  }

  /**
   * 搜索文档内容
   */
  searchDocuments(userId: number, query: string): KnowledgeDocument[] {
    try {
      return this.db.prepare(`
        SELECT kd.* FROM knowledge_documents kd
        JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id
        WHERE kb.user_id = ? AND (kd.filename LIKE ? OR kd.content LIKE ?)
        ORDER BY kd.created_at DESC
        LIMIT 50
      `).all(userId, `%${query}%`, `%${query}%`) as KnowledgeDocument[];
    } catch (error) {
      log.error('KnowledgeBaseService: searchDocuments failed:', error);
      throw error;
    }
  }
}

export const knowledgeBaseService = KnowledgeBaseService.getInstance();
export { KnowledgeBaseService };
