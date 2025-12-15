import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../db/database';

describe('Article Persistence - Image Embedding', () => {
  let testArticleId: number;

  afterAll(async () => {
    // 清理测试数据
    if (testArticleId) {
      await pool.query('DELETE FROM articles WHERE id = $1', [testArticleId]);
    }
  });

  // Feature: article-image-embedding, Property 3: 内容持久化完整性
  // 验证需求: 1.4
  describe('Property 3: 内容持久化完整性', () => {
    it('应该能保存包含Markdown图片标记的文章', async () => {
      const title = '测试文章';
      const content = '这是第一段\n\n![测试图片](https://example.com/test.jpg)\n\n这是第二段';
      const keyword = '测试关键词';
      const imageUrl = 'https://example.com/test.jpg';
      const provider = 'test';

      // 插入文章
      const result = await pool.query(
        `INSERT INTO articles 
         (title, keyword, content, image_url, provider) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id`,
        [title, keyword, content, imageUrl, provider]
      );

      testArticleId = result.rows[0].id;
      expect(testArticleId).toBeDefined();

      // 查询文章
      const queryResult = await pool.query(
        'SELECT title, content, image_url FROM articles WHERE id = $1',
        [testArticleId]
      );

      expect(queryResult.rows.length).toBe(1);
      const article = queryResult.rows[0];
      
      // 验证内容包含图片标记
      expect(article.content).toContain('![测试图片]');
      expect(article.content).toContain('(https://example.com/test.jpg)');
      expect(article.content).toMatch(/!\[.*?\]\(.*?\)/);
    });

    it('应该能保存包含多个图片标记的文章', async () => {
      const content = `第一段

![图片1](https://example.com/1.jpg)

第二段

![图片2](https://example.com/2.jpg)

第三段`;

      const result = await pool.query(
        `INSERT INTO articles 
         (title, keyword, content, provider) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        ['多图文章', '测试', content, 'test']
      );

      const articleId = result.rows[0].id;

      // 查询并验证
      const queryResult = await pool.query(
        'SELECT content FROM articles WHERE id = $1',
        [articleId]
      );

      const savedContent = queryResult.rows[0].content;
      const imageMatches = savedContent.match(/!\[.*?\]\(.*?\)/g);
      
      expect(imageMatches).toBeTruthy();
      expect(imageMatches?.length).toBe(2);

      // 清理
      await pool.query('DELETE FROM articles WHERE id = $1', [articleId]);
    });
  });

  // Feature: article-image-embedding, Property 8: 向后兼容性保持
  // 验证需求: 5.1
  describe('Property 8: 向后兼容性保持', () => {
    it('应该保持现有文章的image_url字段不变', async () => {
      const imageUrl = 'https://example.com/old-format.jpg';
      
      // 插入旧格式文章（只有image_url，内容中没有图片标记）
      const result = await pool.query(
        `INSERT INTO articles 
         (title, keyword, content, image_url, provider) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id`,
        ['旧格式文章', '测试', '纯文本内容，没有图片标记', imageUrl, 'test']
      );

      const articleId = result.rows[0].id;

      // 查询并验证
      const queryResult = await pool.query(
        'SELECT image_url, content FROM articles WHERE id = $1',
        [articleId]
      );

      const article = queryResult.rows[0];
      
      // 验证image_url字段保持不变
      expect(article.image_url).toBe(imageUrl);
      
      // 验证内容中没有图片标记
      expect(article.content).not.toMatch(/!\[.*?\]\(.*?\)/);

      // 清理
      await pool.query('DELETE FROM articles WHERE id = $1', [articleId]);
    });

    it('新格式文章应该同时保存content中的图片标记和image_url', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const content = '文字\n\n![图片](https://example.com/image.jpg)\n\n更多文字';
      
      const result = await pool.query(
        `INSERT INTO articles 
         (title, keyword, content, image_url, provider) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id`,
        ['新格式文章', '测试', content, imageUrl, 'test']
      );

      const articleId = result.rows[0].id;

      // 查询并验证
      const queryResult = await pool.query(
        'SELECT image_url, content FROM articles WHERE id = $1',
        [articleId]
      );

      const article = queryResult.rows[0];
      
      // 验证两个字段都存在
      expect(article.image_url).toBe(imageUrl);
      expect(article.content).toContain('![图片]');

      // 清理
      await pool.query('DELETE FROM articles WHERE id = $1', [articleId]);
    });
  });
});
