import fc from 'fast-check';
import { pool } from '../db/database';
import { KnowledgeBaseService } from './knowledgeBaseService';

/**
 * Feature: enterprise-knowledge-base, Property 7: AI上下文注入的正确性
 * 验证: 需求 4.2, 4.3
 * 
 * 对于任何选定的知识库集合，当生成文章时，
 * AI服务接收的prompt应该包含这些知识库中所有文档的内容。
 */

describe('KnowledgeBaseService - Property Tests', () => {
  const service = new KnowledgeBaseService();
  const testKbIds: number[] = [];
  const testDocIds: number[] = [];

  beforeAll(async () => {
    // 确保测试表存在
    await pool.query(`
      CREATE TABLE IF NOT EXISTS knowledge_bases (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id SERIAL PRIMARY KEY,
        knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterEach(async () => {
    // 清理测试数据
    if (testDocIds.length > 0) {
      await pool.query('DELETE FROM knowledge_documents WHERE id = ANY($1)', [testDocIds]);
      testDocIds.length = 0;
    }
    if (testKbIds.length > 0) {
      await pool.query('DELETE FROM knowledge_bases WHERE id = ANY($1)', [testKbIds]);
      testKbIds.length = 0;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  test('Property 7: AI上下文注入的正确性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            kbName: fc.string({ minLength: 1, maxLength: 50 }),
            docs: fc.array(
              fc.record({
                filename: fc.string({ minLength: 1, maxLength: 50 }),
                content: fc.string({ minLength: 10, maxLength: 200 })
              }),
              { minLength: 1, maxLength: 3 }
            )
          }),
          { minLength: 1, maxLength: 3 }
        ),
        async (knowledgeBases) => {
          const kbIds: number[] = [];
          const allContents: string[] = [];

          try {
            // 创建知识库和文档
            for (const kb of knowledgeBases) {
              const kbResult = await pool.query(
                'INSERT INTO knowledge_bases (name) VALUES ($1) RETURNING id',
                [kb.kbName]
              );
              const kbId = kbResult.rows[0].id;
              kbIds.push(kbId);
              testKbIds.push(kbId);

              for (const doc of kb.docs) {
                const docResult = await pool.query(
                  'INSERT INTO knowledge_documents (knowledge_base_id, filename, file_type, file_size, content) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                  [kbId, doc.filename, '.txt', 100, doc.content]
                );
                testDocIds.push(docResult.rows[0].id);
                allContents.push(doc.content);
              }
            }

            // 获取知识上下文
            const context = await service.getKnowledgeContext(kbIds);

            // 验证所有文档内容都在上下文中
            const allIncluded = allContents.every(content => context.includes(content));
            
            return allIncluded && context.length > 0;
          } catch (error) {
            console.error('测试失败:', error);
            return false;
          }
        }
      ),
      { numRuns: 20 } // 减少运行次数因为涉及数据库操作
    );
  });

  test('空知识库ID数组应返回空字符串', async () => {
    const context = await service.getKnowledgeContext([]);
    expect(context).toBe('');
  });

  test('不存在的知识库ID应返回空字符串', async () => {
    const context = await service.getKnowledgeContext([999999]);
    expect(context).toBe('');
  });
});
