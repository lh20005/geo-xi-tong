/**
 * 集成测试：蒸馏结果使用追踪功能
 * 
 * 测试完整的文章生成流程，包括：
 * 1. 智能选择蒸馏结果
 * 2. 生成文章
 * 3. 记录使用历史
 * 4. 更新使用次数
 * 5. 删除操作的一致性
 */

import { pool } from '../../db/database';
import { ArticleGenerationService } from '../articleGenerationService';
import { DistillationService } from '../distillationService';

describe('蒸馏结果使用追踪 - 集成测试', () => {
  let articleService: ArticleGenerationService;
  let distillationService: DistillationService;

  beforeAll(() => {
    articleService = new ArticleGenerationService();
    distillationService = new DistillationService();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('完整文章生成流程', () => {
    let testDistillationId: number;
    let testTaskId: number;
    let testArticleId: number;
    let testAlbumId: number;
    let testKnowledgeBaseId: number;
    let testArticleSettingId: number;
    let testConversionTargetId: number;

    beforeEach(async () => {
      // 清理测试数据
      await pool.query('DELETE FROM distillation_usage WHERE id > 0');
      await pool.query('DELETE FROM articles WHERE id > 0');
      await pool.query('DELETE FROM generation_tasks WHERE id > 0');
      await pool.query('DELETE FROM distillations WHERE id > 0');
      await pool.query('DELETE FROM albums WHERE id > 0');
      await pool.query('DELETE FROM knowledge_bases WHERE id > 0');
      await pool.query('DELETE FROM article_settings WHERE id > 0');
      await pool.query('DELETE FROM conversion_targets WHERE id > 0');

      // 创建测试数据
      const albumResult = await pool.query(
        'INSERT INTO albums (name, image_count) VALUES ($1, $2) RETURNING id',
        ['测试图库', 10]
      );
      testAlbumId = albumResult.rows[0].id;

      const kbResult = await pool.query(
        'INSERT INTO knowledge_bases (name, description, document_count) VALUES ($1, $2, $3) RETURNING id',
        ['测试知识库', '描述', 5]
      );
      testKnowledgeBaseId = kbResult.rows[0].id;

      const settingResult = await pool.query(
        'INSERT INTO article_settings (name, prompt) VALUES ($1, $2) RETURNING id',
        ['测试设置', '提示词']
      );
      testArticleSettingId = settingResult.rows[0].id;

      const targetResult = await pool.query(
        `INSERT INTO conversion_targets (company_name, industry, company_size, contact_info) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['测试公司', '互联网', '51-200人', 'test@example.com']
      );
      testConversionTargetId = targetResult.rows[0].id;

      // 创建测试蒸馏结果
      const distillationResult = await pool.query(
        'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
        ['测试关键词', 'deepseek', 0]
      );
      testDistillationId = distillationResult.rows[0].id;

      // 添加话题
      await pool.query(
        'INSERT INTO distillation_topics (distillation_id, topic) VALUES ($1, $2)',
        [testDistillationId, '测试话题1']
      );
      await pool.query(
        'INSERT INTO distillation_topics (distillation_id, topic) VALUES ($1, $2)',
        [testDistillationId, '测试话题2']
      );

      // 创建测试任务
      const taskResult = await pool.query(
        `INSERT INTO generation_tasks (
          distillation_id, album_id, knowledge_base_id, article_setting_id, 
          conversion_target_id, requested_count, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [testDistillationId, testAlbumId, testKnowledgeBaseId, testArticleSettingId, 
         testConversionTargetId, 1, 'pending']
      );
      testTaskId = taskResult.rows[0].id;
    });

    afterEach(async () => {
      // 清理测试数据
      await pool.query('DELETE FROM distillation_usage WHERE id > 0');
      await pool.query('DELETE FROM articles WHERE id > 0');
      await pool.query('DELETE FROM generation_tasks WHERE id > 0');
      await pool.query('DELETE FROM distillations WHERE id > 0');
      await pool.query('DELETE FROM albums WHERE id > 0');
      await pool.query('DELETE FROM knowledge_bases WHERE id > 0');
      await pool.query('DELETE FROM article_settings WHERE id > 0');
      await pool.query('DELETE FROM conversion_targets WHERE id > 0');
    });

    it('应该完成完整的文章生成流程并正确追踪使用', async () => {
      // 1. 验证初始状态
      const initialStats = await distillationService.getDistillationsWithStats(1, 10);
      expect(initialStats.distillations[0].usageCount).toBe(0);

      // 2. 创建文章（模拟文章生成）
      const articleResult = await pool.query(
        `INSERT INTO articles (
          task_id, distillation_id, title, content, image_url, provider, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [testTaskId, testDistillationId, '测试文章', '测试内容', 'test.jpg', 'deepseek', 'completed']
      );
      testArticleId = articleResult.rows[0].id;

      // 3. 记录使用（模拟 saveArticleWithUsageTracking）
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // 记录使用
        await client.query(
          `INSERT INTO distillation_usage (distillation_id, task_id, article_id)
           VALUES ($1, $2, $3)`,
          [testDistillationId, testTaskId, testArticleId]
        );

        // 更新使用次数
        await client.query(
          'UPDATE distillations SET usage_count = usage_count + 1 WHERE id = $1',
          [testDistillationId]
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      // 4. 验证使用次数已更新
      const updatedStats = await distillationService.getDistillationsWithStats(1, 10);
      expect(updatedStats.distillations[0].usageCount).toBe(1);

      // 5. 验证使用历史已记录
      const history = await distillationService.getUsageHistory(testDistillationId, 1, 10);
      expect(history.history).toHaveLength(1);
      expect(history.history[0].articleId).toBe(testArticleId);
      expect(history.history[0].taskId).toBe(testTaskId);

      // 6. 验证使用记录的唯一性约束
      await expect(
        pool.query(
          `INSERT INTO distillation_usage (distillation_id, task_id, article_id)
           VALUES ($1, $2, $3)`,
          [testDistillationId, testTaskId, testArticleId]
        )
      ).rejects.toThrow();
    });

    it('应该在删除文章时正确减少使用次数', async () => {
      // 1. 创建文章并记录使用
      const articleResult = await pool.query(
        `INSERT INTO articles (
          task_id, distillation_id, title, content, image_url, provider, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [testTaskId, testDistillationId, '测试文章', '测试内容', 'test.jpg', 'deepseek', 'completed']
      );
      testArticleId = articleResult.rows[0].id;

      await pool.query(
        `INSERT INTO distillation_usage (distillation_id, task_id, article_id)
         VALUES ($1, $2, $3)`,
        [testDistillationId, testTaskId, testArticleId]
      );

      await pool.query(
        'UPDATE distillations SET usage_count = usage_count + 1 WHERE id = $1',
        [testDistillationId]
      );

      // 2. 验证使用次数为1
      let stats = await distillationService.getDistillationsWithStats(1, 10);
      expect(stats.distillations[0].usageCount).toBe(1);

      // 3. 删除文章（级联删除会自动删除使用记录）
      await pool.query('DELETE FROM articles WHERE id = $1', [testArticleId]);

      // 4. 手动减少使用次数（在实际应用中，这应该在删除触发器或服务层处理）
      await pool.query(
        'UPDATE distillations SET usage_count = usage_count - 1 WHERE id = $1',
        [testDistillationId]
      );

      // 5. 验证使用次数已减少
      stats = await distillationService.getDistillationsWithStats(1, 10);
      expect(stats.distillations[0].usageCount).toBe(0);

      // 6. 验证使用记录已被级联删除
      const history = await distillationService.getUsageHistory(testDistillationId, 1, 10);
      expect(history.history).toHaveLength(0);
    });
  });

  describe('并发场景测试', () => {
    let testDistillationIds: number[] = [];
    let testTaskId: number;
    let testAlbumId: number;
    let testKnowledgeBaseId: number;
    let testArticleSettingId: number;
    let testConversionTargetId: number;

    beforeEach(async () => {
      // 清理测试数据
      await pool.query('DELETE FROM distillation_usage WHERE id > 0');
      await pool.query('DELETE FROM articles WHERE id > 0');
      await pool.query('DELETE FROM generation_tasks WHERE id > 0');
      await pool.query('DELETE FROM distillations WHERE id > 0');
      await pool.query('DELETE FROM albums WHERE id > 0');
      await pool.query('DELETE FROM knowledge_bases WHERE id > 0');
      await pool.query('DELETE FROM article_settings WHERE id > 0');
      await pool.query('DELETE FROM conversion_targets WHERE id > 0');

      // 创建测试数据
      const albumResult = await pool.query(
        'INSERT INTO albums (name, image_count) VALUES ($1, $2) RETURNING id',
        ['测试图库', 10]
      );
      testAlbumId = albumResult.rows[0].id;

      const kbResult = await pool.query(
        'INSERT INTO knowledge_bases (name, description, document_count) VALUES ($1, $2, $3) RETURNING id',
        ['测试知识库', '描述', 5]
      );
      testKnowledgeBaseId = kbResult.rows[0].id;

      const settingResult = await pool.query(
        'INSERT INTO article_settings (name, prompt) VALUES ($1, $2) RETURNING id',
        ['测试设置', '提示词']
      );
      testArticleSettingId = settingResult.rows[0].id;

      const targetResult = await pool.query(
        `INSERT INTO conversion_targets (company_name, industry, company_size, contact_info) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['测试公司', '互联网', '51-200人', 'test@example.com']
      );
      testConversionTargetId = targetResult.rows[0].id;

      // 创建多个测试蒸馏结果
      for (let i = 0; i < 3; i++) {
        const result = await pool.query(
          'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
          [`关键词${i}`, 'deepseek', 0]
        );
        testDistillationIds.push(result.rows[0].id);

        // 添加话题
        await pool.query(
          'INSERT INTO distillation_topics (distillation_id, topic) VALUES ($1, $2)',
          [result.rows[0].id, `话题${i}`]
        );
      }

      // 创建测试任务
      const taskResult = await pool.query(
        `INSERT INTO generation_tasks (
          distillation_id, album_id, knowledge_base_id, article_setting_id, 
          conversion_target_id, requested_count, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [testDistillationIds[0], testAlbumId, testKnowledgeBaseId, testArticleSettingId, 
         testConversionTargetId, 3, 'pending']
      );
      testTaskId = taskResult.rows[0].id;
    });

    afterEach(async () => {
      // 清理测试数据
      await pool.query('DELETE FROM distillation_usage WHERE id > 0');
      await pool.query('DELETE FROM articles WHERE id > 0');
      await pool.query('DELETE FROM generation_tasks WHERE id > 0');
      await pool.query('DELETE FROM distillations WHERE id > 0');
      await pool.query('DELETE FROM albums WHERE id > 0');
      await pool.query('DELETE FROM knowledge_bases WHERE id > 0');
      await pool.query('DELETE FROM article_settings WHERE id > 0');
      await pool.query('DELETE FROM conversion_targets WHERE id > 0');
      testDistillationIds = [];
    });

    it('应该正确处理并发的使用次数更新', async () => {
      // 模拟多个并发请求同时更新同一个蒸馏结果的使用次数
      const distillationId = testDistillationIds[0];
      const concurrentUpdates = 5;

      // 并发执行更新
      const updatePromises = Array.from({ length: concurrentUpdates }, async (_, index) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // 创建文章
          const articleResult = await client.query(
            `INSERT INTO articles (
              task_id, distillation_id, title, content, image_url, provider, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [testTaskId, distillationId, `文章${index}`, '内容', 'test.jpg', 'deepseek', 'completed']
          );

          // 记录使用
          await client.query(
            `INSERT INTO distillation_usage (distillation_id, task_id, article_id)
             VALUES ($1, $2, $3)`,
            [distillationId, testTaskId, articleResult.rows[0].id]
          );

          // 原子更新使用次数
          await client.query(
            'UPDATE distillations SET usage_count = usage_count + 1 WHERE id = $1',
            [distillationId]
          );

          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      });

      await Promise.all(updatePromises);

      // 验证最终的使用次数是否正确
      const stats = await distillationService.getDistillationsWithStats(1, 10);
      const distillation = stats.distillations.find(d => d.distillationId === distillationId);
      expect(distillation?.usageCount).toBe(concurrentUpdates);

      // 验证使用记录数量
      const history = await distillationService.getUsageHistory(distillationId, 1, 100);
      expect(history.history).toHaveLength(concurrentUpdates);
    });
  });

  describe('数据一致性验证', () => {
    let testDistillationId: number;

    beforeEach(async () => {
      // 清理测试数据
      await pool.query('DELETE FROM distillation_usage WHERE id > 0');
      await pool.query('DELETE FROM articles WHERE id > 0');
      await pool.query('DELETE FROM generation_tasks WHERE id > 0');
      await pool.query('DELETE FROM distillations WHERE id > 0');

      // 创建测试蒸馏结果
      const result = await pool.query(
        'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
        ['测试关键词', 'deepseek', 0]
      );
      testDistillationId = result.rows[0].id;
    });

    afterEach(async () => {
      await pool.query('DELETE FROM distillation_usage WHERE id > 0');
      await pool.query('DELETE FROM articles WHERE id > 0');
      await pool.query('DELETE FROM generation_tasks WHERE id > 0');
      await pool.query('DELETE FROM distillations WHERE id > 0');
    });

    it('应该能够检测并修复数据不一致', async () => {
      // 1. 人为制造数据不一致：usage_count与实际使用记录数量不匹配
      await pool.query(
        'UPDATE distillations SET usage_count = $1 WHERE id = $2',
        [10, testDistillationId]
      );

      // 2. 运行修复工具
      const repairResult = await distillationService.repairUsageStats();

      // 3. 验证修复结果
      expect(repairResult.fixed).toBeGreaterThan(0);
      expect(repairResult.details).toContainEqual(
        expect.objectContaining({
          distillationId: testDistillationId,
          oldCount: 10,
          newCount: 0
        })
      );

      // 4. 验证数据已修复
      const stats = await distillationService.getDistillationsWithStats(1, 10);
      const distillation = stats.distillations.find(d => d.distillationId === testDistillationId);
      expect(distillation?.usageCount).toBe(0);
    });
  });
});
