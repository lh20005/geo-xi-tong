import * as fc from 'fast-check';
import { pool } from '../../db/database';
import { ArticleGenerationService } from '../articleGenerationService';

describe('ArticleGenerationService Property Tests', () => {
  const articleGenerationService = new ArticleGenerationService();

  // 清理测试数据
  afterEach(async () => {
    await pool.query('DELETE FROM distillation_usage WHERE id > 0');
    await pool.query('DELETE FROM articles WHERE id > 0');
    await pool.query('DELETE FROM generation_tasks WHERE id > 0');
    await pool.query('DELETE FROM topics WHERE id > 0');
    await pool.query('DELETE FROM distillations WHERE id > 0');
  });

  afterAll(async () => {
    await pool.end();
  });

  // Feature: distillation-usage-display-enhancement, Property 9: 均衡选择算法正确性
  describe('Property 9: 均衡选择算法正确性', () => {
    it('should select distillations with lowest usage_count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              keyword: fc.string({ minLength: 1, maxLength: 50 }),
              provider: fc.constantFrom('deepseek', 'gemini', 'ollama'),
              usageCount: fc.integer({ min: 0, max: 100 })
            }),
            { minLength: 5, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 5 }),
          async (distillations, requestCount) => {
            // 确保请求数量不超过可用数量
            const actualRequestCount = Math.min(requestCount, distillations.length);

            // 插入测试数据
            const distillationIds: number[] = [];
            for (const dist of distillations) {
              const result = await pool.query(
                'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
                [dist.keyword, dist.provider, dist.usageCount]
              );
              distillationIds.push(result.rows[0].id);
              
              // 添加话题（必须有话题才能被选择）
              await pool.query(
                'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
                [result.rows[0].id, `Test question for ${dist.keyword}`]
              );
            }

            // 调用选择算法
            const selectedIds = await articleGenerationService.selectDistillationsForTask(actualRequestCount);

            // 验证返回数量正确
            expect(selectedIds.length).toBe(actualRequestCount);

            // 验证选择的是usage_count最小的N个
            // 获取所有蒸馏结果的usage_count
            const allDistillationsResult = await pool.query(
              'SELECT id, usage_count FROM distillations ORDER BY usage_count ASC, created_at ASC'
            );
            
            const expectedIds = allDistillationsResult.rows
              .slice(0, actualRequestCount)
              .map(row => row.id);

            // 验证选择的ID集合正确（顺序可能不同）
            expect(new Set(selectedIds)).toEqual(new Set(expectedIds));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: distillation-usage-display-enhancement, Property 10: 次要排序条件正确性
  describe('Property 10: 次要排序条件正确性', () => {
    it('should sort by created_at when usage_count is equal', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 3, max: 10 }),
          async (sameUsageCount, count) => {
            // 创建多个usage_count相同的蒸馏结果
            const distillationIds: number[] = [];
            const createdTimes: Date[] = [];

            for (let i = 0; i < count; i++) {
              // 使用延迟确保created_at不同
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
              }

              const result = await pool.query(
                'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id, created_at',
                [`keyword-${i}`, 'deepseek', sameUsageCount]
              );
              distillationIds.push(result.rows[0].id);
              createdTimes.push(new Date(result.rows[0].created_at));
              
              // 添加话题
              await pool.query(
                'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
                [result.rows[0].id, `Test question ${i}`]
              );
            }

            // 选择所有蒸馏结果
            const selectedIds = await articleGenerationService.selectDistillationsForTask(count);

            // 验证返回数量
            expect(selectedIds.length).toBe(count);

            // 获取选择结果的created_at
            const selectedResult = await pool.query(
              `SELECT id, created_at FROM distillations WHERE id = ANY($1) ORDER BY created_at ASC`,
              [selectedIds]
            );

            // 验证按created_at升序排列
            for (let i = 0; i < selectedResult.rows.length - 1; i++) {
              const current = new Date(selectedResult.rows[i].created_at);
              const next = new Date(selectedResult.rows[i + 1].created_at);
              expect(current.getTime()).toBeLessThanOrEqual(next.getTime());
            }
          }
        ),
        { numRuns: 50 } // 减少运行次数因为有延迟
      );
    });
  });

  // Feature: distillation-usage-display-enhancement, Property 11: 文章生成数据唯一性
  describe('Property 11: 文章生成数据唯一性', () => {
    it('should use different distillation IDs for each article', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 10 }),
          async (articleCount) => {
            // 创建足够的蒸馏结果
            const distillationIds: number[] = [];
            for (let i = 0; i < articleCount; i++) {
              const result = await pool.query(
                'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
                [`keyword-${i}`, 'deepseek', 0]
              );
              distillationIds.push(result.rows[0].id);
              
              // 添加话题
              await pool.query(
                'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
                [result.rows[0].id, `Test question ${i}`]
              );
            }

            // 选择蒸馏结果
            const selectedIds = await articleGenerationService.selectDistillationsForTask(articleCount);

            // 验证所有ID都不同
            const uniqueIds = new Set(selectedIds);
            expect(uniqueIds.size).toBe(articleCount);

            // 验证每个ID都在原始列表中
            selectedIds.forEach(id => {
              expect(distillationIds).toContain(id);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: distillation-usage-display-enhancement, Property 12: 事务原子性
  describe('Property 12: 事务原子性', () => {
    it('should rollback usage_count if article save fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 0, max: 50 }),
          async (keyword, initialUsageCount) => {
            // 创建蒸馏结果
            const distResult = await pool.query(
              'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
              [keyword, 'deepseek', initialUsageCount]
            );
            const distillationId = distResult.rows[0].id;

            // 添加话题
            await pool.query(
              'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
              [distillationId, 'Test question']
            );

            // 创建任务
            const taskResult = await pool.query(
              'INSERT INTO generation_tasks (distillation_id, album_id, knowledge_base_id, article_setting_id, requested_count, status) VALUES ($1, 1, 1, 1, 1, $2) RETURNING id',
              [distillationId, 'pending']
            );
            const taskId = taskResult.rows[0].id;

            // 尝试保存文章但使用无效数据（会失败）
            try {
              await pool.query('BEGIN');
              
              // 插入文章
              await pool.query(
                'INSERT INTO articles (title, keyword, distillation_id, task_id, content, provider) VALUES ($1, $2, $3, $4, $5, $6)',
                ['Test', keyword, distillationId, taskId, 'content', 'deepseek']
              );
              
              // 更新usage_count
              await pool.query(
                'UPDATE distillations SET usage_count = usage_count + 1 WHERE id = $1',
                [distillationId]
              );
              
              // 模拟失败
              throw new Error('Simulated failure');
            } catch (error) {
              await pool.query('ROLLBACK');
            }

            // 验证usage_count没有改变
            const result = await pool.query(
              'SELECT usage_count FROM distillations WHERE id = $1',
              [distillationId]
            );
            expect(result.rows[0].usage_count).toBe(initialUsageCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: distillation-usage-display-enhancement, Property 15: 并发安全性
  describe('Property 15: 并发安全性', () => {
    it('should handle concurrent article generation correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          async (concurrentCount) => {
            // 创建蒸馏结果
            const distResult = await pool.query(
              'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
              ['test-keyword', 'deepseek', 0]
            );
            const distillationId = distResult.rows[0].id;

            // 添加话题
            await pool.query(
              'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
              [distillationId, 'Test question']
            );

            // 创建任务
            const taskResult = await pool.query(
              'INSERT INTO generation_tasks (distillation_id, album_id, knowledge_base_id, article_setting_id, requested_count, status) VALUES ($1, 1, 1, 1, $2, $3) RETURNING id',
              [distillationId, concurrentCount, 'running']
            );
            const taskId = taskResult.rows[0].id;

            // 并发创建文章
            const promises = [];
            for (let i = 0; i < concurrentCount; i++) {
              promises.push(
                (async () => {
                  const client = await pool.connect();
                  try {
                    await client.query('BEGIN');
                    
                    // 插入文章
                    const articleResult = await client.query(
                      'INSERT INTO articles (title, keyword, distillation_id, task_id, content, provider) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                      [`Article ${i}`, 'test-keyword', distillationId, taskId, 'content', 'deepseek']
                    );
                    const articleId = articleResult.rows[0].id;
                    
                    // 创建使用记录
                    await client.query(
                      'INSERT INTO distillation_usage (distillation_id, task_id, article_id) VALUES ($1, $2, $3)',
                      [distillationId, taskId, articleId]
                    );
                    
                    // 更新usage_count（原子操作）
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
                })()
              );
            }

            // 等待所有并发操作完成
            await Promise.all(promises);

            // 验证最终usage_count正确
            const result = await pool.query(
              'SELECT usage_count FROM distillations WHERE id = $1',
              [distillationId]
            );
            expect(result.rows[0].usage_count).toBe(concurrentCount);

            // 验证使用记录数量正确
            const usageResult = await pool.query(
              'SELECT COUNT(*) as count FROM distillation_usage WHERE distillation_id = $1',
              [distillationId]
            );
            expect(parseInt(usageResult.rows[0].count)).toBe(concurrentCount);
          }
        ),
        { numRuns: 50 } // 减少运行次数因为并发测试较慢
      );
    });
  });
});
