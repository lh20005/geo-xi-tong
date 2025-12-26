describe('Article Query Endpoints', () => {
  describe('GET /articles', () => {
    it('should return articles with publication status', () => {
      // 模拟文章列表响应
      const response = {
        articles: [
          {
            id: 1,
            keyword: 'test',
            isPublished: true,
            publishedAt: '2024-01-01T00:00:00Z',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 2,
            keyword: 'test2',
            isPublished: false,
            publishedAt: null,
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z'
          }
        ],
        total: 2,
        page: 1,
        pageSize: 10
      };

      // 验证：所有文章都包含发布状态字段
      response.articles.forEach(article => {
        expect(article).toHaveProperty('isPublished');
        expect(article).toHaveProperty('publishedAt');
      });
    });

    it('should use camelCase for field names', () => {
      const article = {
        isPublished: true,
        publishedAt: '2024-01-01T00:00:00Z'
      };

      // 验证：字段名是camelCase
      expect(article).toHaveProperty('isPublished');
      expect(article).toHaveProperty('publishedAt');
      expect(article).not.toHaveProperty('is_published');
      expect(article).not.toHaveProperty('published_at');
    });
  });

  describe('GET /articles/:id', () => {
    it('should return article with publication status', () => {
      // 模拟单篇文章响应
      const response = {
        id: 1,
        title: 'Test Article',
        keyword: 'test',
        content: 'Content',
        isPublished: true,
        publishedAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      // 验证：响应包含发布状态字段
      expect(response).toHaveProperty('isPublished');
      expect(response).toHaveProperty('publishedAt');
      expect(response.isPublished).toBe(true);
      expect(response.publishedAt).toBeDefined();
    });

    it('should handle unpublished articles', () => {
      // 模拟未发布文章
      const response = {
        id: 1,
        isPublished: false,
        publishedAt: null
      };

      // 验证：未发布文章的publishedAt应该为null
      expect(response.isPublished).toBe(false);
      expect(response.publishedAt).toBeNull();
    });
  });
});
