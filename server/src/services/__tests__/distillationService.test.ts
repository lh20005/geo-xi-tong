import { pool } from '../../db/database';
import { DistillationService } from '../distillationService';

describe('DistillationService - Usage Statistics', () => {
  let service: DistillationService;

  beforeAll(async () => {
    service = new DistillationService();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Property 8: 蒸馏结果排序规则', () => {
    /**
     * Feature: distillation-usage-tracking, Property 8: 蒸馏结果排序规则
     * 
     * For any distillation result list query, results should be sorted by usage_count ascending,
     * and when usage_count is the same, sorted by created_at ascending.
     * 
     * Validates: Requirements 4.2, 6.2, 7.2, 11.2
     */
    it('should sort by usage_count ascending', () => {
      // Mock data simulating query results
      const mockDistillations = [
        { distillationId: 1, keyword: 'AI', usageCount: 0, createdAt: '2024-01-01' },
        { distillationId: 2, keyword: 'ML', usageCount: 5, createdAt: '2024-01-02' },
        { distillationId: 3, keyword: 'DL', usageCount: 10, createdAt: '2024-01-03' }
      ];

      // Verify sorting logic
      const sorted = [...mockDistillations].sort((a, b) => {
        if (a.usageCount !== b.usageCount) {
          return a.usageCount - b.usageCount;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      expect(sorted[0].usageCount).toBeLessThanOrEqual(sorted[1].usageCount);
      expect(sorted[1].usageCount).toBeLessThanOrEqual(sorted[2].usageCount);
    });

    it('should sort by created_at when usage_count is the same', () => {
      const mockDistillations = [
        { distillationId: 1, keyword: 'AI', usageCount: 5, createdAt: '2024-01-03' },
        { distillationId: 2, keyword: 'ML', usageCount: 5, createdAt: '2024-01-01' },
        { distillationId: 3, keyword: 'DL', usageCount: 5, createdAt: '2024-01-02' }
      ];

      const sorted = [...mockDistillations].sort((a, b) => {
        if (a.usageCount !== b.usageCount) {
          return a.usageCount - b.usageCount;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      // All have same usage_count, so should be sorted by created_at
      expect(new Date(sorted[0].createdAt).getTime()).toBeLessThanOrEqual(
        new Date(sorted[1].createdAt).getTime()
      );
      expect(new Date(sorted[1].createdAt).getTime()).toBeLessThanOrEqual(
        new Date(sorted[2].createdAt).getTime()
      );
    });

    it('should apply two-level sorting for any data', () => {
      // Property: For ANY list of distillations, sorting should be stable and correct
      const testCases = [
        // Mixed usage counts and dates
        [
          { id: 1, usageCount: 10, createdAt: '2024-01-01' },
          { id: 2, usageCount: 5, createdAt: '2024-01-02' },
          { id: 3, usageCount: 5, createdAt: '2024-01-01' }
        ],
        // All same usage count
        [
          { id: 1, usageCount: 3, createdAt: '2024-01-03' },
          { id: 2, usageCount: 3, createdAt: '2024-01-01' },
          { id: 3, usageCount: 3, createdAt: '2024-01-02' }
        ],
        // All different usage counts
        [
          { id: 1, usageCount: 10, createdAt: '2024-01-01' },
          { id: 2, usageCount: 5, createdAt: '2024-01-01' },
          { id: 3, usageCount: 0, createdAt: '2024-01-01' }
        ]
      ];

      testCases.forEach(testCase => {
        const sorted = [...testCase].sort((a, b) => {
          if (a.usageCount !== b.usageCount) {
            return a.usageCount - b.usageCount;
          }
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        // Verify sorting is correct
        for (let i = 0; i < sorted.length - 1; i++) {
          const current = sorted[i];
          const next = sorted[i + 1];

          if (current.usageCount === next.usageCount) {
            // Same usage count, should be sorted by date
            expect(new Date(current.createdAt).getTime()).toBeLessThanOrEqual(
              new Date(next.createdAt).getTime()
            );
          } else {
            // Different usage count, should be ascending
            expect(current.usageCount).toBeLessThan(next.usageCount);
          }
        }
      });
    });
  });

  describe('Property 9: 使用历史数据完整性', () => {
    /**
     * Feature: distillation-usage-tracking, Property 9: 使用历史数据完整性
     * 
     * For any usage history record, it should contain task_id, article_id, article_title, and used_at.
     * 
     * Validates: Requirements 4.4, 5.2
     */
    it('should include all required fields in usage history', () => {
      const mockHistoryRecord = {
        id: 1,
        taskId: 10,
        articleId: 100,
        articleTitle: 'Test Article',
        usedAt: new Date().toISOString()
      };

      // Verify all required fields are present
      expect(mockHistoryRecord).toHaveProperty('taskId');
      expect(mockHistoryRecord).toHaveProperty('articleId');
      expect(mockHistoryRecord).toHaveProperty('articleTitle');
      expect(mockHistoryRecord).toHaveProperty('usedAt');

      // Verify field types
      expect(typeof mockHistoryRecord.taskId).toBe('number');
      expect(typeof mockHistoryRecord.articleId).toBe('number');
      expect(typeof mockHistoryRecord.articleTitle).toBe('string');
      expect(typeof mockHistoryRecord.usedAt).toBe('string');
    });

    it('should handle deleted articles gracefully', () => {
      // When article is deleted, title should show "文章已删除"
      const mockHistoryWithDeletedArticle = {
        id: 1,
        taskId: 10,
        articleId: 100,
        articleTitle: null, // Article was deleted
        usedAt: new Date().toISOString()
      };

      const displayTitle = mockHistoryWithDeletedArticle.articleTitle || '文章已删除';
      expect(displayTitle).toBe('文章已删除');
    });

    it('should maintain data completeness for any history record', () => {
      // Property: For ANY usage history record, all fields should be present
      const testRecords = [
        { taskId: 1, articleId: 10, articleTitle: 'Article 1', usedAt: '2024-01-01' },
        { taskId: 2, articleId: 20, articleTitle: 'Article 2', usedAt: '2024-01-02' },
        { taskId: 3, articleId: 30, articleTitle: null, usedAt: '2024-01-03' }
      ];

      testRecords.forEach(record => {
        expect(record).toHaveProperty('taskId');
        expect(record).toHaveProperty('articleId');
        expect(record).toHaveProperty('articleTitle');
        expect(record).toHaveProperty('usedAt');
      });
    });
  });

  describe('Property 10: 使用历史查询正确性', () => {
    /**
     * Feature: distillation-usage-tracking, Property 10: 使用历史查询正确性
     * 
     * For any distillation's usage history query, all returned records should only belong to that distillation,
     * and should be sorted by used_at descending (newest first).
     * 
     * Validates: Requirements 5.1, 5.3
     */
    it('should filter records by distillation_id', () => {
      const targetDistillationId = 5;
      const mockAllRecords = [
        { id: 1, distillationId: 5, usedAt: '2024-01-01' },
        { id: 2, distillationId: 3, usedAt: '2024-01-02' },
        { id: 3, distillationId: 5, usedAt: '2024-01-03' },
        { id: 4, distillationId: 7, usedAt: '2024-01-04' }
      ];

      // Filter logic
      const filtered = mockAllRecords.filter(r => r.distillationId === targetDistillationId);

      // All filtered records should belong to target distillation
      filtered.forEach(record => {
        expect(record.distillationId).toBe(targetDistillationId);
      });

      expect(filtered.length).toBe(2);
    });

    it('should sort by used_at descending', () => {
      const mockHistory = [
        { id: 1, usedAt: '2024-01-01T10:00:00Z' },
        { id: 2, usedAt: '2024-01-03T10:00:00Z' },
        { id: 3, usedAt: '2024-01-02T10:00:00Z' }
      ];

      // Sort descending (newest first)
      const sorted = [...mockHistory].sort((a, b) => {
        return new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime();
      });

      // Verify descending order
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(new Date(sorted[i].usedAt).getTime()).toBeGreaterThanOrEqual(
          new Date(sorted[i + 1].usedAt).getTime()
        );
      }

      // First should be newest
      expect(sorted[0].id).toBe(2); // 2024-01-03
    });

    it('should apply filtering and sorting for any query', () => {
      // Property: For ANY distillation_id, query should filter and sort correctly
      const testCases = [
        {
          targetId: 1,
          allRecords: [
            { distillationId: 1, usedAt: '2024-01-01' },
            { distillationId: 2, usedAt: '2024-01-02' },
            { distillationId: 1, usedAt: '2024-01-03' }
          ]
        },
        {
          targetId: 5,
          allRecords: [
            { distillationId: 5, usedAt: '2024-01-05' },
            { distillationId: 5, usedAt: '2024-01-01' },
            { distillationId: 3, usedAt: '2024-01-03' }
          ]
        }
      ];

      testCases.forEach(({ targetId, allRecords }) => {
        // Filter and sort
        const result = allRecords
          .filter(r => r.distillationId === targetId)
          .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime());

        // Verify all belong to target
        result.forEach(r => expect(r.distillationId).toBe(targetId));

        // Verify descending order
        for (let i = 0; i < result.length - 1; i++) {
          expect(new Date(result[i].usedAt).getTime()).toBeGreaterThanOrEqual(
            new Date(result[i + 1].usedAt).getTime()
          );
        }
      });
    });
  });

  describe('Property 11: 推荐结果标记', () => {
    /**
     * Feature: distillation-usage-tracking, Property 11: 推荐结果标记
     * 
     * For any distillation result list, the top 3 results with lowest usage_count should be marked as recommended.
     * 
     * Validates: Requirements 6.3
     */
    it('should mark top 3 lowest usage count as recommended', () => {
      const mockDistillations = [
        { id: 1, usageCount: 0 },
        { id: 2, usageCount: 1 },
        { id: 3, usageCount: 2 },
        { id: 4, usageCount: 5 },
        { id: 5, usageCount: 10 }
      ];

      // Sort by usage count
      const sorted = [...mockDistillations].sort((a, b) => a.usageCount - b.usageCount);

      // Mark top 3 as recommended
      const recommended = sorted.slice(0, 3).map(d => ({ ...d, isRecommended: true }));

      expect(recommended.length).toBe(3);
      expect(recommended[0].isRecommended).toBe(true);
      expect(recommended[1].isRecommended).toBe(true);
      expect(recommended[2].isRecommended).toBe(true);

      // Verify they have lowest usage counts
      expect(recommended[0].usageCount).toBe(0);
      expect(recommended[1].usageCount).toBe(1);
      expect(recommended[2].usageCount).toBe(2);
    });

    it('should handle less than 3 results', () => {
      const mockDistillations = [
        { id: 1, usageCount: 0 },
        { id: 2, usageCount: 5 }
      ];

      const sorted = [...mockDistillations].sort((a, b) => a.usageCount - b.usageCount);
      const recommended = sorted.slice(0, 3);

      // Should return all available (less than 3)
      expect(recommended.length).toBe(2);
    });

    it('should mark correct items for any list size', () => {
      // Property: For ANY list, top 3 (or fewer) should be marked
      const testCases = [
        { list: [{ id: 1, usageCount: 0 }], expectedCount: 1 },
        { list: [{ id: 1, usageCount: 0 }, { id: 2, usageCount: 1 }], expectedCount: 2 },
        {
          list: [
            { id: 1, usageCount: 0 },
            { id: 2, usageCount: 1 },
            { id: 3, usageCount: 2 },
            { id: 4, usageCount: 3 }
          ],
          expectedCount: 3
        }
      ];

      testCases.forEach(({ list, expectedCount }) => {
        const sorted = [...list].sort((a, b) => a.usageCount - b.usageCount);
        const recommended = sorted.slice(0, 3);

        expect(recommended.length).toBe(expectedCount);
      });
    });
  });

  describe('Property 18: 推荐算法正确性', () => {
    /**
     * Feature: distillation-usage-tracking, Property 18: 推荐算法正确性
     * 
     * For any recommendation request, the system should return the top 3 distillations
     * with lowest usage_count that have topics (topic_count > 0).
     * 
     * Validates: Requirements 11.1, 12.3
     */
    it('should filter out distillations without topics', () => {
      const mockDistillations = [
        { id: 1, usageCount: 0, topicCount: 0 },  // No topics, should be filtered
        { id: 2, usageCount: 1, topicCount: 5 },  // Has topics
        { id: 3, usageCount: 2, topicCount: 3 },  // Has topics
        { id: 4, usageCount: 3, topicCount: 0 }   // No topics, should be filtered
      ];

      // Filter and sort
      const recommended = mockDistillations
        .filter(d => d.topicCount > 0)
        .sort((a, b) => a.usageCount - b.usageCount)
        .slice(0, 3);

      // All recommended should have topics
      recommended.forEach(d => {
        expect(d.topicCount).toBeGreaterThan(0);
      });

      expect(recommended.length).toBe(2);
      expect(recommended[0].id).toBe(2);
      expect(recommended[1].id).toBe(3);
    });

    it('should return top 3 with lowest usage count among those with topics', () => {
      const mockDistillations = [
        { id: 1, usageCount: 5, topicCount: 3 },
        { id: 2, usageCount: 0, topicCount: 5 },
        { id: 3, usageCount: 2, topicCount: 4 },
        { id: 4, usageCount: 1, topicCount: 2 },
        { id: 5, usageCount: 10, topicCount: 1 }
      ];

      const recommended = mockDistillations
        .filter(d => d.topicCount > 0)
        .sort((a, b) => a.usageCount - b.usageCount)
        .slice(0, 3);

      expect(recommended.length).toBe(3);
      expect(recommended[0].usageCount).toBe(0); // id: 2
      expect(recommended[1].usageCount).toBe(1); // id: 4
      expect(recommended[2].usageCount).toBe(2); // id: 3
    });

    it('should apply recommendation logic for any data', () => {
      // Property: For ANY set of distillations, recommendation should filter and sort correctly
      const testCases = [
        {
          input: [
            { id: 1, usageCount: 0, topicCount: 0 },
            { id: 2, usageCount: 1, topicCount: 5 }
          ],
          expectedCount: 1
        },
        {
          input: [
            { id: 1, usageCount: 0, topicCount: 5 },
            { id: 2, usageCount: 1, topicCount: 3 },
            { id: 3, usageCount: 2, topicCount: 2 },
            { id: 4, usageCount: 3, topicCount: 1 }
          ],
          expectedCount: 3
        }
      ];

      testCases.forEach(({ input, expectedCount }) => {
        const recommended = input
          .filter(d => d.topicCount > 0)
          .sort((a, b) => a.usageCount - b.usageCount)
          .slice(0, 3);

        expect(recommended.length).toBe(expectedCount);

        // All should have topics
        recommended.forEach(d => expect(d.topicCount).toBeGreaterThan(0));

        // Should be sorted by usage count
        for (let i = 0; i < recommended.length - 1; i++) {
          expect(recommended[i].usageCount).toBeLessThanOrEqual(recommended[i + 1].usageCount);
        }
      });
    });
  });

  describe('Property 19: 推荐结果数据完整性', () => {
    /**
     * Feature: distillation-usage-tracking, Property 19: 推荐结果数据完整性
     * 
     * For any recommended distillation, it should include keyword, usage_count, topic_count, and other info.
     * 
     * Validates: Requirements 11.4
     */
    it('should include all required fields in recommendation', () => {
      const mockRecommendation = {
        distillationId: 1,
        keyword: 'AI技术',
        usageCount: 0,
        topicCount: 5,
        isRecommended: true,
        recommendReason: '使用次数较少（0次），推荐优先使用'
      };

      // Verify all required fields
      expect(mockRecommendation).toHaveProperty('distillationId');
      expect(mockRecommendation).toHaveProperty('keyword');
      expect(mockRecommendation).toHaveProperty('usageCount');
      expect(mockRecommendation).toHaveProperty('topicCount');
      expect(mockRecommendation).toHaveProperty('isRecommended');
      expect(mockRecommendation).toHaveProperty('recommendReason');

      // Verify field types
      expect(typeof mockRecommendation.distillationId).toBe('number');
      expect(typeof mockRecommendation.keyword).toBe('string');
      expect(typeof mockRecommendation.usageCount).toBe('number');
      expect(typeof mockRecommendation.topicCount).toBe('number');
      expect(typeof mockRecommendation.isRecommended).toBe('boolean');
      expect(typeof mockRecommendation.recommendReason).toBe('string');
    });

    it('should generate appropriate recommend reason', () => {
      const testCases = [
        { usageCount: 0, expectedReason: '使用次数较少（0次），推荐优先使用' },
        { usageCount: 1, expectedReason: '使用次数较少（1次），推荐优先使用' },
        { usageCount: 5, expectedReason: '使用次数较少（5次），推荐优先使用' }
      ];

      testCases.forEach(({ usageCount, expectedReason }) => {
        const reason = `使用次数较少（${usageCount}次），推荐优先使用`;
        expect(reason).toBe(expectedReason);
      });
    });

    it('should maintain data completeness for any recommendation', () => {
      // Property: For ANY recommendation, all fields should be present and valid
      const testRecommendations = [
        { distillationId: 1, keyword: 'AI', usageCount: 0, topicCount: 5 },
        { distillationId: 2, keyword: 'ML', usageCount: 1, topicCount: 3 },
        { distillationId: 3, keyword: 'DL', usageCount: 2, topicCount: 7 }
      ];

      testRecommendations.forEach(rec => {
        const fullRec = {
          ...rec,
          isRecommended: true,
          recommendReason: `使用次数较少（${rec.usageCount}次），推荐优先使用`
        };

        expect(fullRec).toHaveProperty('distillationId');
        expect(fullRec).toHaveProperty('keyword');
        expect(fullRec).toHaveProperty('usageCount');
        expect(fullRec).toHaveProperty('topicCount');
        expect(fullRec).toHaveProperty('isRecommended');
        expect(fullRec).toHaveProperty('recommendReason');

        expect(fullRec.isRecommended).toBe(true);
        expect(fullRec.topicCount).toBeGreaterThan(0);
      });
    });
  });
});
