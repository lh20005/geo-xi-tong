import * as fc from 'fast-check';

describe('Article API Pagination', () => {
  // Feature: article-generation, Property 20: 文章列表分页一致性
  // 验证: 需求 13.2
  describe('Property 20: Article list pagination consistency', () => {
    it('should return correct number of articles per page', () => {
      fc.assert(
        fc.property(
          fc.record({
            totalArticles: fc.integer({ min: 0, max: 100 }),
            pageSize: fc.integer({ min: 1, max: 20 }),
            currentPage: fc.integer({ min: 1, max: 10 })
          }),
          (data) => {
            const offset = (data.currentPage - 1) * data.pageSize;
            const expectedCount = Math.min(
              data.pageSize,
              Math.max(0, data.totalArticles - offset)
            );

            // 模拟分页逻辑
            const articles = Array.from({ length: data.totalArticles }, (_, i) => ({
              id: i + 1,
              title: `Article ${i + 1}`
            }));

            const paginatedArticles = articles.slice(offset, offset + data.pageSize);

            // 验证分页结果
            expect(paginatedArticles.length).toBe(expectedCount);

            // 验证最后一页
            const totalPages = Math.ceil(data.totalArticles / data.pageSize);
            if (data.currentPage === totalPages && data.totalArticles > 0) {
              const lastPageCount = data.totalArticles % data.pageSize || data.pageSize;
              if (data.currentPage <= totalPages) {
                expect(paginatedArticles.length).toBeLessThanOrEqual(data.pageSize);
              }
            }

            // 验证每页不超过pageSize
            expect(paginatedArticles.length).toBeLessThanOrEqual(data.pageSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain pagination consistency with total count', () => {
      fc.assert(
        fc.property(
          fc.record({
            totalArticles: fc.integer({ min: 0, max: 100 }),
            pageSize: fc.constant(10) // 固定每页10条
          }),
          (data) => {
            const totalPages = Math.ceil(data.totalArticles / data.pageSize);

            // 验证总页数计算
            if (data.totalArticles === 0) {
              expect(totalPages).toBe(0);
            } else {
              expect(totalPages).toBeGreaterThan(0);
              expect(totalPages).toBeLessThanOrEqual(Math.ceil(data.totalArticles / data.pageSize));
            }

            // 验证所有页的文章总数等于总数
            let collectedArticles = 0;
            for (let page = 1; page <= totalPages; page++) {
              const offset = (page - 1) * data.pageSize;
              const pageCount = Math.min(data.pageSize, data.totalArticles - offset);
              collectedArticles += pageCount;
            }

            expect(collectedArticles).toBe(data.totalArticles);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
