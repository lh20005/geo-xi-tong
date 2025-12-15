import { pool } from '../db/database';

interface KnowledgeDocument {
  id: number;
  knowledge_base_id: number;
  filename: string;
  content: string;
}

export class KnowledgeBaseService {
  /**
   * 获取知识库上下文，用于AI生成文章
   * @param knowledgeBaseIds - 知识库ID数组
   * @returns 格式化的知识上下文字符串
   */
  async getKnowledgeContext(knowledgeBaseIds: number[]): Promise<string> {
    if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) {
      return '';
    }

    // 从数据库获取所有相关文档
    const documents = await this.getDocumentsByKnowledgeBaseIds(knowledgeBaseIds);
    
    if (documents.length === 0) {
      return '';
    }

    // 格式化为AI可理解的格式
    return this.formatForAI(documents);
  }

  /**
   * 从数据库获取指定知识库的所有文档
   */
  private async getDocumentsByKnowledgeBaseIds(knowledgeBaseIds: number[]): Promise<KnowledgeDocument[]> {
    try {
      const result = await pool.query(
        `SELECT id, knowledge_base_id, filename, content 
         FROM knowledge_documents 
         WHERE knowledge_base_id = ANY($1)
         ORDER BY knowledge_base_id, created_at ASC`,
        [knowledgeBaseIds]
      );
      
      return result.rows;
    } catch (error: any) {
      console.error('获取知识库文档失败:', error);
      throw new Error(`获取知识库文档失败: ${error.message}`);
    }
  }

  /**
   * 将文档内容格式化为AI可理解的格式
   */
  private formatForAI(documents: KnowledgeDocument[]): string {
    const sections: string[] = [];
    
    // 按知识库分组
    const groupedDocs = new Map<number, KnowledgeDocument[]>();
    for (const doc of documents) {
      if (!groupedDocs.has(doc.knowledge_base_id)) {
        groupedDocs.set(doc.knowledge_base_id, []);
      }
      groupedDocs.get(doc.knowledge_base_id)!.push(doc);
    }

    // 格式化每个知识库的文档
    for (const [kbId, docs] of groupedDocs) {
      sections.push(`\n=== 知识库 #${kbId} ===\n`);
      
      for (const doc of docs) {
        sections.push(`【文档: ${doc.filename}】`);
        sections.push(doc.content);
        sections.push(''); // 空行分隔
      }
    }

    return sections.join('\n');
  }

  /**
   * 获取知识库的文档数量
   */
  async getDocumentCount(knowledgeBaseId: number): Promise<number> {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) as count FROM knowledge_documents WHERE knowledge_base_id = $1',
        [knowledgeBaseId]
      );
      
      return parseInt(result.rows[0].count);
    } catch (error: any) {
      console.error('获取文档数量失败:', error);
      return 0;
    }
  }
}
