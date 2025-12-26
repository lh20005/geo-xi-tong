import * as fc from 'fast-check';
import { ArticleGenerationService } from '../articleGenerationService';
import { pool } from '../../db/database';

describe('Article Persistence Logic', () => {
  let service: ArticleGenerationService;

  beforeAll(() => {
    service = new ArticleGenerationService();
  });

  afterAll(async () => {
    await pool.end();
  });

  // Feature: article-generation, Property 18: 文章保存完整性
  // 验证: 需求 12.1, 12.2
  describe('Property 18: Article save completeness', () => {
    it('should save article with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            keyword: fc.string({ minLength: 1, maxLength: 50 }),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.string({ minLength: 10, maxLength: 500 }),
            imageUrl: fc.webUrl()
          }),
          async (data) => {
            // 创建测试数据
            const distillationResult = await pool.query(
              'INSERT INTO distillations (keyword, provider) VALUES ($1, $2) RETURNING id',
              [data.keyword, 'deepseek']
            );
            const distillationId = distillationResult.rows[0].id;

            const taskResult = await pool.query(
              'INSERT INTO generation_tasks (distillation_id, album_id, knowledge_base_id, article_setting_id, requested_count) VALUES ($1, 1, 1, 1, 1) RETURNING id',
              [distillationId]
            );
            const taskId = taskResult.rows[0].id;

            // 保存文章
            const articleId = await service.saveArticle(
              taskId,
              distillationId,
              data.keyword,
              data.title,
              data.content,
              data.imageUrl,
              'deepseek'
            );

            // 验证文章已保存且包含所有字段
            const result = await pool.query(
              'SELECT * FROM articles WHERE id = $1',
              [articleId]
            );

            expect(result.rows.length).toBe(1);
            const article = result.rows[0];
            expect(article.title).toBe(data.title);
            expect(article.keyword).toBe(data.keyword);
            expect(article.content).toBe(data.content);
            expect(article.image_url).toBe(data.imageUrl);
            expect(article.task_id).toBe(taskId);
            expect(article.distillation_id).toBe(distillationId);
            expect(article.created_at).toBeTruthy();

            // 清理
            await pool.query('DELETE FROM articles WHERE id = $1', [articleId]);
            await pool.query('DELETE FROM generation_tasks WHERE id = $1', [taskId]);
            await pool.query('DELETE FROM distillations WHERE id = $1', [distillationId]);
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);
  });

  // Feature: article-generation, Property 19: 任务完成状态更新
  // 验证: 需求 12.3
  describe('Property 19: Task completion status update', () => {
    it('should update task status to completed when all articles are saved', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (articleCount) => {
            // 创建测试任务
            const distillationResult = await pool.query(
              'INSERT INTO distillations (keyword, provider) VALUES ($1, $2) RETURNING id',
              [`test-keyword-${Date.now()}`, 'deepseek']
            );
            const distillationId = distillationResult.rows[0].id;

            const taskResult = await pool.query(
              'INSERT INTO generation_tasks (distillation_id, album_id, knowledge_base_id, article_setting_id, requested_count, status) VALUES ($1, 1, 1, 1, $2, $3) RETURNING id',
              [distillationId, articleCount, 'running']
            );
            const taskId = taskResult.rows[0].id;

            // 模拟保存所有文章
            for (let i = 0; i < articleCount; i++) {
              await service.saveArticle(
                taskId,
                distillationId,
                `keyword-${i}`,
                `title-${i}`,
                `content-${i}`,
                `/image-${i}.jpg`,
                'deepseek'
              );
            }

            // 更新任务状态为完成
            await service.updateTaskStatus(taskId, 'completed', articleCount);

            // 验证任务状态
            const result = await pool.query(
              'SELECT status, generated_count FROM generation_tasks WHERE id = $1',
              [taskId]
            );

            expect(result.rows[0].status).toBe('completed');
            expect(result.rows[0].generated_count).toBe(articleCount);

            // 清理
            await pool.query('DELETE FROM generation_tasks WHERE id = $1', [taskId]);
            await pool.query('DELETE FROM distillations WHERE id = $1', [distillationId]);
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);
  });
});
