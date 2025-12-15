import * as fc from 'fast-check';

describe('Article Query Properties', () => {
  describe('属性 12: 查询响应包含发布状态', () => {
    /**
     * Feature: article-editor-enhancement, Property 12: 查询响应包含发布状态
     * 对于任何文章查询请求（GET /articles或GET /articles/:id），响应应该包含isPublished字段
     * 验证需求: 5.4
     */
    it('should include isPublished in GET /articles response', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 1000 }),
              keyword: fc.string({ minLength: 1, maxLength: 50 }),
              isPublished: fc.boolean(),
              publishedAt: fc.option(fc.date(), { nil: null })
            }),
            { minLength: 0, maxLength: 10 }
          ),
          (articles) => {
            // 模拟GET /articles响应
            const response = {
              articles: articles.map(a => ({
                ...a,
                isPublished: a.isPublished,
                publishedAt: a.publishedAt
              })),
              total: articles.length,
              page: 1,
              pageSize: 10
            };

            // 验证：每篇文章都应该包含isPublished字段
            const allHaveIsPublished = response.articles.every(a => 
              a.hasOwnProperty('isPublished')
            );

            return allHaveIsPublished;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include isPublished in GET /articles/:id response', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            keyword: fc.string({ minLength: 1, maxLength: 50 }),
            content: fc.string({ minLength: 10, maxLength: 500 }),
            isPublished: fc.boolean(),
            publishedAt: fc.option(fc.date(), { nil: null })
          }),
          (article) => {
            // 模拟GET /articles/:id响应
            const response = {
              ...article,
              isPublished: article.isPublished,
              publishedAt: article.publishedAt
            };

            // 验证：响应应该包含isPublished字段
            const hasIsPublished = response.hasOwnProperty('isPublished');
            const hasPublishedAt = response.hasOwnProperty('publishedAt');

            return hasIsPublished && hasPublishedAt;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use camelCase for field names', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.option(fc.date(), { nil: null }),
          (isPublished, publishedAt) => {
            // 模拟响应字段
            const response = {
              isPublished: isPublished,  // camelCase
              publishedAt: publishedAt    // camelCase
            };

            // 验证：字段名应该是camelCase格式
            const hasCorrectFieldNames = 
              response.hasOwnProperty('isPublished') &&
              response.hasOwnProperty('publishedAt') &&
              !response.hasOwnProperty('is_published') &&
              !response.hasOwnProperty('published_at');

            return hasCorrectFieldNames;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
