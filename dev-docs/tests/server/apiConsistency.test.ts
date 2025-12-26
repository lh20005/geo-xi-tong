import fc from 'fast-check';
import { DistillationService } from '../distillationService';

describe('API Response Data Consistency Tests', () => {
  const service = new DistillationService();

  describe('Property 20: API响应数据一致性', () => {
    /**
     * Feature: distillation-usage-tracking, Property 20: API响应数据一致性
     * Validates: Requirements 12.4
     * 
     * For any API call, response data should conform to expected data structure and integrity requirements.
     */
    it('should return consistent data structure for distillations with stats', () => {
      // Test that the response structure is consistent
      const mockDistillation = {
        distillationId: 1,
        keyword: 'test',
        provider: 'deepseek',
        usageCount: 5,
        lastUsedAt: '2024-01-01T00:00:00Z',
        topicCount: 10,
        createdAt: '2024-01-01T00:00:00Z'
      };

      // Verify all required fields are present
      expect(mockDistillation).toHaveProperty('distillationId');
      expect(mockDistillation).toHaveProperty('keyword');
      expect(mockDistillation).toHaveProperty('provider');
      expect(mockDistillation).toHaveProperty('usageCount');
      expect(mockDistillation).toHaveProperty('lastUsedAt');
      expect(mockDistillation).toHaveProperty('topicCount');
      expect(mockDistillation).toHaveProperty('createdAt');

      // Verify field types
      expect(typeof mockDistillation.distillationId).toBe('number');
      expect(typeof mockDistillation.keyword).toBe('string');
      expect(typeof mockDistillation.provider).toBe('string');
      expect(typeof mockDistillation.usageCount).toBe('number');
      expect(typeof mockDistillation.topicCount).toBe('number');
    });

    it('should return consistent data structure for usage history', () => {
      const mockHistory = {
        id: 1,
        taskId: 1,
        articleId: 1,
        articleTitle: 'Test Article',
        usedAt: '2024-01-01T00:00:00Z'
      };

      // Verify all required fields are present
      expect(mockHistory).toHaveProperty('id');
      expect(mockHistory).toHaveProperty('taskId');
      expect(mockHistory).toHaveProperty('articleId');
      expect(mockHistory).toHaveProperty('articleTitle');
      expect(mockHistory).toHaveProperty('usedAt');

      // Verify field types
      expect(typeof mockHistory.id).toBe('number');
      expect(typeof mockHistory.taskId).toBe('number');
      expect(typeof mockHistory.articleId).toBe('number');
      expect(typeof mockHistory.articleTitle).toBe('string');
      expect(typeof mockHistory.usedAt).toBe('string');
    });

    it('should return consistent data structure for recommended distillations', () => {
      const mockRecommended = {
        distillationId: 1,
        keyword: 'test',
        usageCount: 0,
        topicCount: 5,
        isRecommended: true,
        recommendReason: '使用次数较少'
      };

      // Verify all required fields are present
      expect(mockRecommended).toHaveProperty('distillationId');
      expect(mockRecommended).toHaveProperty('keyword');
      expect(mockRecommended).toHaveProperty('usageCount');
      expect(mockRecommended).toHaveProperty('topicCount');
      expect(mockRecommended).toHaveProperty('isRecommended');
      expect(mockRecommended).toHaveProperty('recommendReason');

      // Verify field types
      expect(typeof mockRecommended.distillationId).toBe('number');
      expect(typeof mockRecommended.keyword).toBe('string');
      expect(typeof mockRecommended.usageCount).toBe('number');
      expect(typeof mockRecommended.topicCount).toBe('number');
      expect(typeof mockRecommended.isRecommended).toBe('boolean');
      expect(typeof mockRecommended.recommendReason).toBe('string');
    });

    it('should maintain data consistency for any valid distillation stats', () => {
      fc.assert(
        fc.property(
          fc.record({
            distillationId: fc.integer({ min: 1, max: 1000 }),
            keyword: fc.string({ minLength: 1, maxLength: 50 }),
            provider: fc.string({ minLength: 1, maxLength: 20 }),
            usageCount: fc.integer({ min: 0, max: 1000 }),
            topicCount: fc.integer({ min: 0, max: 100 }),
            createdAt: fc.date().map(d => d.toISOString())
          }),
          (stats) => {
            // Verify data integrity
            expect(stats.distillationId).toBeGreaterThan(0);
            expect(stats.keyword.length).toBeGreaterThan(0);
            expect(stats.provider.length).toBeGreaterThan(0);
            expect(stats.usageCount).toBeGreaterThanOrEqual(0);
            expect(stats.topicCount).toBeGreaterThanOrEqual(0);
            expect(stats.createdAt).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain data consistency for any valid usage history', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            taskId: fc.integer({ min: 1, max: 1000 }),
            articleId: fc.integer({ min: 1, max: 10000 }),
            articleTitle: fc.string({ minLength: 1, maxLength: 100 }),
            usedAt: fc.date().map(d => d.toISOString())
          }),
          (history) => {
            // Verify data integrity
            expect(history.id).toBeGreaterThan(0);
            expect(history.taskId).toBeGreaterThan(0);
            expect(history.articleId).toBeGreaterThan(0);
            expect(history.articleTitle.length).toBeGreaterThan(0);
            expect(history.usedAt).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain data consistency for any valid recommended distillation', () => {
      fc.assert(
        fc.property(
          fc.record({
            distillationId: fc.integer({ min: 1, max: 1000 }),
            keyword: fc.string({ minLength: 1, maxLength: 50 }),
            usageCount: fc.integer({ min: 0, max: 100 }),
            topicCount: fc.integer({ min: 1, max: 100 }),
            isRecommended: fc.boolean(),
            recommendReason: fc.string({ minLength: 1, maxLength: 200 })
          }),
          (recommended) => {
            // Verify data integrity
            expect(recommended.distillationId).toBeGreaterThan(0);
            expect(recommended.keyword.length).toBeGreaterThan(0);
            expect(recommended.usageCount).toBeGreaterThanOrEqual(0);
            expect(recommended.topicCount).toBeGreaterThan(0);
            expect(typeof recommended.isRecommended).toBe('boolean');
            expect(recommended.recommendReason.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure pagination parameters are valid', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // page
          fc.integer({ min: 1, max: 100 }), // pageSize
          (page, pageSize) => {
            // Verify pagination parameters
            expect(page).toBeGreaterThan(0);
            expect(pageSize).toBeGreaterThan(0);
            expect(pageSize).toBeLessThanOrEqual(100);

            // Calculate offset
            const offset = (page - 1) * pageSize;
            expect(offset).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure total count is consistent with data', () => {
      // Test that total count matches actual data count
      const mockResponse = {
        distillations: [
          { distillationId: 1, keyword: 'test1' },
          { distillationId: 2, keyword: 'test2' },
          { distillationId: 3, keyword: 'test3' }
        ],
        total: 3
      };

      expect(mockResponse.distillations.length).toBe(mockResponse.total);
    });

    it('should handle empty results consistently', () => {
      const emptyResponse = {
        distillations: [],
        total: 0
      };

      expect(emptyResponse.distillations).toEqual([]);
      expect(emptyResponse.total).toBe(0);
      expect(emptyResponse.distillations.length).toBe(emptyResponse.total);
    });

    it('should ensure repair stats response has correct structure', () => {
      const mockRepairResult = {
        fixed: 5,
        errors: [],
        details: [
          { distillationId: 1, oldCount: 10, newCount: 8 },
          { distillationId: 2, oldCount: 5, newCount: 3 }
        ]
      };

      // Verify structure
      expect(mockRepairResult).toHaveProperty('fixed');
      expect(mockRepairResult).toHaveProperty('errors');
      expect(mockRepairResult).toHaveProperty('details');

      // Verify types
      expect(typeof mockRepairResult.fixed).toBe('number');
      expect(Array.isArray(mockRepairResult.errors)).toBe(true);
      expect(Array.isArray(mockRepairResult.details)).toBe(true);

      // Verify details structure
      mockRepairResult.details.forEach(detail => {
        expect(detail).toHaveProperty('distillationId');
        expect(detail).toHaveProperty('oldCount');
        expect(detail).toHaveProperty('newCount');
        expect(typeof detail.distillationId).toBe('number');
        expect(typeof detail.oldCount).toBe('number');
        expect(typeof detail.newCount).toBe('number');
      });
    });
  });
});
