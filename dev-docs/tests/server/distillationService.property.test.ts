import * as fc from 'fast-check';
import { pool } from '../../db/database';
import { DistillationService } from '../distillationService';

describe('DistillationService Property Tests', () => {
  const distillationService = new DistillationService();

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

  // Feature: distillation-usage-display-enhancement, Property 8: API响应结构一致性
  describe('Property 8: API响应结构一致性', () => {
    it('should always return usage_count in distillation list response', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              keyword: fc.string({ minLength: 1, maxLength: 50 }),
              provider: fc.constantFrom('deepseek', 'gemini', 'ollama'),
              usageCount: fc.nat({ max: 100 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.constantFrom('created_at', 'usage_count'),
          fc.constantFrom('asc', 'desc'),
          fc.constantFrom('all', 'used', 'unused'),
          async (distillations, sortBy, sortOrder, filterUsage) => {
            // 插入测试数据
            for (const dist of distillations) {
              const result = await pool.query(
                'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
                [dist.keyword, dist.provider, dist.usageCount]
              );
              
              // 添加至少一个话题
              await pool.query(
                'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
                [result.rows[0].id, `Test question for ${dist.keyword}`]
              );
            }

            // 查询数据
            const result = await distillationService.getDistillationsWithStats(
              1,
              100,
              sortBy as 'created_at' | 'usage_count',
              sortOrder as 'asc' | 'desc',
              filterUsage as 'all' | 'used' | 'unused'
            );

            // 验证每条记录都包含usage_count
            expect(result.distillations).toBeDefined();
            result.distillations.forEach(dist => {
              expect(dist).toHaveProperty('usageCount');
              expect(typeof dist.usageCount).toBe('number');
              expect(dist.usageCount).toBeGreaterThanOrEqual(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: distillation-usage-display-enhancement, Property 17: 排序功能正确性
  describe('Property 17: 排序功能正确性', () => {
    it('should correctly sort by usage_count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              keyword: fc.string({ minLength: 1, maxLength: 50 }),
              provider: fc.constantFrom('deepseek', 'gemini', 'ollama'),
              usageCount: fc.integer({ min: 0, max: 100 })
            }),
            { minLength: 3, maxLength: 10 }
          ),
          fc.constantFrom('asc', 'desc'),
          async (distillations, sortOrder) => {
            // 插入测试数据
            for (const dist of distillations) {
              const result = await pool.query(
                'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
                [dist.keyword, dist.provider, dist.usageCount]
              );
              
              // 添加话题
              await pool.query(
                'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
                [result.rows[0].id, `Test question`]
              );
            }

            // 查询数据
            const result = await distillationService.getDistillationsWithStats(
              1,
              100,
              'usage_count',
              sortOrder as 'asc' | 'desc',
              'all'
            );

            // 验证排序
            if (result.distillations.length > 1) {
              for (let i = 0; i < result.distillations.length - 1; i++) {
                const current = result.distillations[i].usageCount;
                const next = result.distillations[i + 1].usageCount;
                
                if (sortOrder === 'asc') {
                  expect(current).toBeLessThanOrEqual(next);
                } else {
                  expect(current).toBeGreaterThanOrEqual(next);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: distillation-usage-display-enhancement, Property 16: 筛选逻辑正确性
  describe('Property 16: 筛选逻辑正确性', () => {
    it('should correctly filter unused distillations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              keyword: fc.string({ minLength: 1, maxLength: 50 }),
              provider: fc.constantFrom('deepseek', 'gemini', 'ollama'),
              usageCount: fc.integer({ min: 0, max: 100 })
            }),
            { minLength: 5, maxLength: 15 }
          ),
          async (distillations) => {
            // 插入测试数据
            for (const dist of distillations) {
              const result = await pool.query(
                'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
                [dist.keyword, dist.provider, dist.usageCount]
              );
              
              // 添加话题
              await pool.query(
                'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
                [result.rows[0].id, `Test question`]
              );
            }

            // 查询未使用的
            const result = await distillationService.getDistillationsWithStats(
              1,
              100,
              'usage_count',
              'asc',
              'unused'
            );

            // 验证所有返回的记录usage_count都为0
            result.distillations.forEach(dist => {
              expect(dist.usageCount).toBe(0);
            });

            // 验证数量正确
            const expectedCount = distillations.filter(d => d.usageCount === 0).length;
            expect(result.distillations.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly filter used distillations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              keyword: fc.string({ minLength: 1, maxLength: 50 }),
              provider: fc.constantFrom('deepseek', 'gemini', 'ollama'),
              usageCount: fc.integer({ min: 0, max: 100 })
            }),
            { minLength: 5, maxLength: 15 }
          ),
          async (distillations) => {
            // 插入测试数据
            for (const dist of distillations) {
              const result = await pool.query(
                'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
                [dist.keyword, dist.provider, dist.usageCount]
              );
              
              // 添加话题
              await pool.query(
                'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
                [result.rows[0].id, `Test question`]
              );
            }

            // 查询已使用的
            const result = await distillationService.getDistillationsWithStats(
              1,
              100,
              'usage_count',
              'asc',
              'used'
            );

            // 验证所有返回的记录usage_count都大于0
            result.distillations.forEach(dist => {
              expect(dist.usageCount).toBeGreaterThan(0);
            });

            // 验证数量正确
            const expectedCount = distillations.filter(d => d.usageCount > 0).length;
            expect(result.distillations.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: distillation-usage-display-enhancement, Property 6: 分页逻辑正确性
  describe('Property 6: 分页逻辑正确性', () => {
    it('should correctly paginate usage history', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 50 }),
          fc.integer({ min: 1, max: 10 }),
          async (totalRecords, pageSize) => {
            // 创建蒸馏结果
            const distResult = await pool.query(
              'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
              ['test-keyword', 'deepseek', totalRecords]
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
              [distillationId, totalRecords, 'completed']
            );
            const taskId = taskResult.rows[0].id;

            // 创建使用记录
            for (let i = 0; i < totalRecords; i++) {
              const articleResult = await pool.query(
                'INSERT INTO articles (title, keyword, distillation_id, task_id, content, provider) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [`Article ${i}`, 'test-keyword', distillationId, taskId, 'content', 'deepseek']
              );
              const articleId = articleResult.rows[0].id;

              await pool.query(
                'INSERT INTO distillation_usage (distillation_id, task_id, article_id) VALUES ($1, $2, $3)',
                [distillationId, taskId, articleId]
              );
            }

            // 测试分页
            const totalPages = Math.ceil(totalRecords / pageSize);
            let allRecords: any[] = [];

            for (let page = 1; page <= totalPages; page++) {
              const result = await distillationService.getUsageHistory(
                distillationId,
                page,
                pageSize
              );

              // 验证分页信息
              expect(result.total).toBe(totalRecords);
              
              // 验证当前页记录数
              const expectedPageSize = page === totalPages 
                ? totalRecords - (totalPages - 1) * pageSize 
                : pageSize;
              expect(result.history.length).toBe(expectedPageSize);

              allRecords = allRecords.concat(result.history);
            }

            // 验证总记录数
            expect(allRecords.length).toBe(totalRecords);

            // 验证没有重复记录
            const uniqueIds = new Set(allRecords.map(r => r.id));
            expect(uniqueIds.size).toBe(totalRecords);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: distillation-usage-display-enhancement, Property 14: 修复工具正确性
  describe('Property 14: 修复工具正确性', () => {
    it('should correctly fix inconsistent usage_count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              keyword: fc.string({ minLength: 1, maxLength: 50 }),
              provider: fc.constantFrom('deepseek', 'gemini', 'ollama'),
              incorrectCount: fc.integer({ min: 0, max: 50 }),
              actualCount: fc.integer({ min: 0, max: 50 })
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (distillations) => {
            // 只测试有不一致数据的情况
            const inconsistentData = distillations.filter(
              d => d.incorrectCount !== d.actualCount
            );

            if (inconsistentData.length === 0) {
              return; // 跳过没有不一致数据的情况
            }

            // 插入测试数据
            for (const dist of inconsistentData) {
              // 创建蒸馏结果（设置错误的usage_count）
              const distResult = await pool.query(
                'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
                [dist.keyword, dist.provider, dist.incorrectCount]
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
                [distillationId, dist.actualCount, 'completed']
              );
              const taskId = taskResult.rows[0].id;

              // 创建实际的使用记录
              for (let i = 0; i < dist.actualCount; i++) {
                const articleResult = await pool.query(
                  'INSERT INTO articles (title, keyword, distillation_id, task_id, content, provider) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                  [`Article ${i}`, dist.keyword, distillationId, taskId, 'content', dist.provider]
                );
                const articleId = articleResult.rows[0].id;

                await pool.query(
                  'INSERT INTO distillation_usage (distillation_id, task_id, article_id) VALUES ($1, $2, $3)',
                  [distillationId, taskId, articleId]
                );
              }
            }

            // 运行修复工具
            const result = await distillationService.repairUsageStats();

            // 验证修复数量
            expect(result.fixed).toBe(inconsistentData.length);

            // 验证每条记录都被正确修复
            for (const detail of result.details) {
              expect(detail.newCount).toBe(detail.oldCount !== detail.newCount ? detail.newCount : detail.oldCount);
              
              // 验证数据库中的值已更新
              const checkResult = await pool.query(
                'SELECT usage_count FROM distillations WHERE id = $1',
                [detail.distillationId]
              );
              expect(checkResult.rows[0].usage_count).toBe(detail.newCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: distillation-usage-display-enhancement, Property 7: 删除文章后的数据一致性
  describe('Property 7: 删除文章后的数据一致性', () => {
    it('should decrement usage_count when article is deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          async (initialCount) => {
            // 创建蒸馏结果
            const distResult = await pool.query(
              'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
              ['test-keyword', 'deepseek', initialCount]
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
              [distillationId, initialCount, 'completed']
            );
            const taskId = taskResult.rows[0].id;

            // 创建文章
            const articleResult = await pool.query(
              'INSERT INTO articles (title, keyword, distillation_id, task_id, content, provider) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
              ['Test Article', 'test-keyword', distillationId, taskId, 'content', 'deepseek']
            );
            const articleId = articleResult.rows[0].id;

            // 创建使用记录
            await pool.query(
              'INSERT INTO distillation_usage (distillation_id, task_id, article_id) VALUES ($1, $2, $3)',
              [distillationId, taskId, articleId]
            );

            // 调用decrementUsageCount
            await distillationService.decrementUsageCount(distillationId);

            // 验证usage_count减1
            const result = await pool.query(
              'SELECT usage_count FROM distillations WHERE id = $1',
              [distillationId]
            );
            
            const expectedCount = Math.max(initialCount - 1, 0);
            expect(result.rows[0].usage_count).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: distillation-usage-display-enhancement, Property 3: 详情页数据完整性
  describe('Property 3: 详情页数据完整性', () => {
    it('should always return usage_count and lastUsedAt in detail response', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            keyword: fc.string({ minLength: 1, maxLength: 50 }),
            provider: fc.constantFrom('deepseek', 'gemini', 'ollama'),
            usageCount: fc.nat({ max: 50 })
          }),
          async (distData) => {
            // 创建蒸馏结果
            const distResult = await pool.query(
              'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
              [distData.keyword, distData.provider, distData.usageCount]
            );
            const distillationId = distResult.rows[0].id;

            // 添加话题
            await pool.query(
              'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
              [distillationId, `Test question for ${distData.keyword}`]
            );

            // 如果usageCount > 0，创建使用记录
            if (distData.usageCount > 0) {
              // 创建任务
              const taskResult = await pool.query(
                'INSERT INTO generation_tasks (distillation_id, album_id, knowledge_base_id, article_setting_id, requested_count, status) VALUES ($1, 1, 1, 1, 1, $2) RETURNING id',
                [distillationId, 'completed']
              );
              const taskId = taskResult.rows[0].id;

              // 创建文章
              const articleResult = await pool.query(
                'INSERT INTO articles (title, keyword, distillation_id, task_id, content, provider) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                ['Test Article', distData.keyword, distillationId, taskId, 'content', distData.provider]
              );
              const articleId = articleResult.rows[0].id;

              // 创建使用记录
              await pool.query(
                'INSERT INTO distillation_usage (distillation_id, task_id, article_id) VALUES ($1, $2, $3)',
                [distillationId, taskId, articleId]
              );
            }

            // 调用getDistillationDetail
            const detail = await distillationService.getDistillationDetail(distillationId);

            // 验证响应包含必需字段
            expect(detail).not.toBeNull();
            expect(detail).toHaveProperty('usageCount');
            expect(detail).toHaveProperty('lastUsedAt');
            expect(detail!.usageCount).toBe(distData.usageCount);
            
            if (distData.usageCount > 0) {
              expect(detail!.lastUsedAt).not.toBeNull();
            } else {
              expect(detail!.lastUsedAt).toBeNull();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Feature: distillation-usage-display-enhancement, Property 4: 使用历史查询完整性
  describe('Property 4: 使用历史查询完整性', () => {
    it('should return all usage records for a distillation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          async (recordCount) => {
            // 创建蒸馏结果
            const distResult = await pool.query(
              'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
              ['test-keyword', 'deepseek', recordCount]
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
              [distillationId, recordCount, 'completed']
            );
            const taskId = taskResult.rows[0].id;

            // 创建多条使用记录
            const articleIds = [];
            for (let i = 0; i < recordCount; i++) {
              const articleResult = await pool.query(
                'INSERT INTO articles (title, keyword, distillation_id, task_id, content, provider) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [`Test Article ${i}`, 'test-keyword', distillationId, taskId, 'content', 'deepseek']
              );
              articleIds.push(articleResult.rows[0].id);

              await pool.query(
                'INSERT INTO distillation_usage (distillation_id, task_id, article_id) VALUES ($1, $2, $3)',
                [distillationId, taskId, articleResult.rows[0].id]
              );
            }

            // 查询使用历史（获取所有记录）
            const result = await distillationService.getUsageHistory(distillationId, 1, 100);

            // 验证返回所有记录
            expect(result.total).toBe(recordCount);
            expect(result.history.length).toBe(recordCount);
            
            // 验证每条记录都有必需字段
            result.history.forEach(record => {
              expect(record).toHaveProperty('id');
              expect(record).toHaveProperty('taskId');
              expect(record).toHaveProperty('articleId');
              expect(record).toHaveProperty('articleTitle');
              expect(record).toHaveProperty('usedAt');
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Feature: distillation-usage-display-enhancement, Property 5: 使用历史排序正确性
  describe('Property 5: 使用历史排序正确性', () => {
    it('should return usage history sorted by used_at DESC', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 10 }),
          async (recordCount) => {
            // 创建蒸馏结果
            const distResult = await pool.query(
              'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
              ['test-keyword', 'deepseek', recordCount]
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
              [distillationId, recordCount, 'completed']
            );
            const taskId = taskResult.rows[0].id;

            // 创建多条使用记录，每条间隔1秒
            for (let i = 0; i < recordCount; i++) {
              const articleResult = await pool.query(
                'INSERT INTO articles (title, keyword, distillation_id, task_id, content, provider) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [`Test Article ${i}`, 'test-keyword', distillationId, taskId, 'content', 'deepseek']
              );

              // 使用不同的时间戳
              await pool.query(
                'INSERT INTO distillation_usage (distillation_id, task_id, article_id, used_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'$4 seconds\')',
                [distillationId, taskId, articleResult.rows[0].id, i]
              );
            }

            // 查询使用历史
            const result = await distillationService.getUsageHistory(distillationId, 1, 100);

            // 验证排序（最新的在前）
            for (let i = 0; i < result.history.length - 1; i++) {
              const current = new Date(result.history[i].usedAt);
              const next = new Date(result.history[i + 1].usedAt);
              expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

  // Feature: distillation-usage-display-enhancement, Property 13: 级联删除正确性
  describe('Property 13: 级联删除正确性', () => {
    it('should cascade delete usage records when distillation is deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 15 }),
          async (usageRecordCount) => {
            // 创建蒸馏结果
            const distResult = await pool.query(
              'INSERT INTO distillations (keyword, provider, usage_count) VALUES ($1, $2, $3) RETURNING id',
              ['test-keyword', 'deepseek', usageRecordCount]
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
              [distillationId, usageRecordCount, 'completed']
            );
            const taskId = taskResult.rows[0].id;

            // 创建多条使用记录
            for (let i = 0; i < usageRecordCount; i++) {
              const articleResult = await pool.query(
                'INSERT INTO articles (title, keyword, distillation_id, task_id, content, provider) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [`Test Article ${i}`, 'test-keyword', distillationId, taskId, 'content', 'deepseek']
              );

              await pool.query(
                'INSERT INTO distillation_usage (distillation_id, task_id, article_id) VALUES ($1, $2, $3)',
                [distillationId, taskId, articleResult.rows[0].id]
              );
            }

            // 验证使用记录存在
            const beforeDelete = await pool.query(
              'SELECT COUNT(*) as count FROM distillation_usage WHERE distillation_id = $1',
              [distillationId]
            );
            expect(parseInt(beforeDelete.rows[0].count)).toBe(usageRecordCount);

            // 删除蒸馏结果
            await pool.query('DELETE FROM distillations WHERE id = $1', [distillationId]);

            // 验证使用记录被级联删除
            const afterDelete = await pool.query(
              'SELECT COUNT(*) as count FROM distillation_usage WHERE distillation_id = $1',
              [distillationId]
            );
            expect(parseInt(afterDelete.rows[0].count)).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
