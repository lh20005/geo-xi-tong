import * as fc from 'fast-check';
import { ArticleGenerationService } from '../articleGenerationService';
import { pool } from '../../db/database';

describe('Data Preparation Logic', () => {
  let service: ArticleGenerationService;

  beforeAll(() => {
    service = new ArticleGenerationService();
  });

  afterAll(async () => {
    await pool.end();
  });

  // Feature: article-generation, Property 10: 关键词顺序提取
  // 验证: 需求 10.1
  describe('Property 10: Keyword order extraction', () => {
    it('should extract keyword-topic pairs in order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
          async (topics) => {
            // 创建测试蒸馏记录
            const keyword = `test-keyword-${Date.now()}`;
            const distillationResult = await pool.query(
              'INSERT INTO distillations (keyword, provider) VALUES ($1, $2) RETURNING id',
              [keyword, 'deepseek']
            );
            const distillationId = distillationResult.rows[0].id;

            // 按顺序插入话题
            for (const topic of topics) {
              await pool.query(
                'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
                [distillationId, topic]
              );
            }

            // 提取关键词-话题对
            const pairs = await service.extractKeywordTopicPairs(distillationId);

            // 验证顺序
            expect(pairs.length).toBe(1);
            expect(pairs[0].keyword).toBe(keyword);
            expect(pairs[0].topics).toEqual(topics);

            // 清理
            await pool.query('DELETE FROM distillations WHERE id = $1', [distillationId]);
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);
  });

  // Feature: article-generation, Property 11: 图片随机选择有效性
  // 验证: 需求 10.2
  describe('Property 11: Random image selection validity', () => {
    it('should select image from the specified album', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (imageCount) => {
            // 创建测试相册
            const albumResult = await pool.query(
              'INSERT INTO albums (name) VALUES ($1) RETURNING id',
              [`test-album-${Date.now()}`]
            );
            const albumId = albumResult.rows[0].id;

            // 插入图片
            const imageFilepaths: string[] = [];
            for (let i = 0; i < imageCount; i++) {
              const filepath = `test-image-${Date.now()}-${i}.jpg`;
              await pool.query(
                'INSERT INTO images (album_id, filename, filepath, mime_type, size) VALUES ($1, $2, $3, $4, $5)',
                [albumId, `image-${i}.jpg`, filepath, 'image/jpeg', 1024]
              );
              imageFilepaths.push(filepath);
            }

            // 随机选择图片
            const selectedImageUrl = await service.selectRandomImage(albumId);

            // 验证选择的图片来自该相册
            const isValid = imageFilepaths.some(fp => selectedImageUrl.includes(fp));
            expect(isValid).toBe(true);

            // 清理
            await pool.query('DELETE FROM albums WHERE id = $1', [albumId]);
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);
  });

  // Feature: article-generation, Property 3: 关键词-蒸馏结果一一对应
  // 验证: 需求 3.4
  describe('Property 3: Keyword-distillation result one-to-one correspondence', () => {
    it('should maintain one-to-one correspondence between keywords and distillation results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 })
          ),
          async ([keyword, topics]) => {
            // 创建蒸馏记录
            const distillationResult = await pool.query(
              'INSERT INTO distillations (keyword, provider) VALUES ($1, $2) RETURNING id',
              [keyword, 'deepseek']
            );
            const distillationId = distillationResult.rows[0].id;

            // 插入话题
            for (const topic of topics) {
              await pool.query(
                'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
                [distillationId, topic]
              );
            }

            // 提取关键词-话题对
            const pairs = await service.extractKeywordTopicPairs(distillationId);

            // 验证一一对应关系
            expect(pairs.length).toBe(1); // 一个蒸馏记录对应一个关键词
            expect(pairs[0].keyword).toBe(keyword);
            expect(pairs[0].topics.length).toBe(topics.length);
            
            // 验证每个话题都对应该关键词
            for (let i = 0; i < topics.length; i++) {
              expect(pairs[0].topics[i]).toBe(topics[i]);
            }

            // 清理
            await pool.query('DELETE FROM distillations WHERE id = $1', [distillationId]);
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);
  });
});
