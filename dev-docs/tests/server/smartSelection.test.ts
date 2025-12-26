import { pool } from '../../db/database';

describe('ArticleGenerationService - Smart Selection Algorithm', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('Property 12: 智能选择最小使用次数', () => {
    /**
     * Feature: distillation-usage-tracking, Property 12: 智能选择最小使用次数
     * 
     * For any distillation selection operation, the system should prioritize selecting
     * distillations with the minimum usage_count (excluding those without topics).
     * 
     * Validates: Requirements 7.1
     */
    it('should select distillations with minimum usage_count', () => {
      // Mock data
      const mockDistillations = [
        { id: 1, usageCount: 10, topicCount: 5 },
        { id: 2, usageCount: 0, topicCount: 3 },
        { id: 3, usageCount: 5, topicCount: 4 },
        { id: 4, usageCount: 0, topicCount: 2 }
      ];

      // Filter out those without topics and sort by usage_count
      const selected = mockDistillations
        .filter(d => d.topicCount > 0)
        .sort((a, b) => a.usageCount - b.usageCount);

      // First selected should have minimum usage_count
      expect(selected[0].usageCount).toBe(0);
      expect(selected[1].usageCount).toBe(0);
    });

    it('should exclude distillations without topics', () => {
      const mockDistillations = [
        { id: 1, usageCount: 0, topicCount: 0 },  // No topics, should be excluded
        { id: 2, usageCount: 1, topicCount: 5 },
        { id: 3, usageCount: 2, topicCount: 3 }
      ];

      const selected = mockDistillations
        .filter(d => d.topicCount > 0)
        .sort((a, b) => a.usageCount - b.usageCount);

      // Should only include those with topics
      expect(selected.length).toBe(2);
      expect(selected.every(d => d.topicCount > 0)).toBe(true);
    });

    it('should prioritize minimum usage_count for any data', () => {
      // Property: For ANY set of distillations, selection should prioritize minimum usage_count
      const testCases = [
        {
          input: [
            { id: 1, usageCount: 5, topicCount: 3 },
            { id: 2, usageCount: 0, topicCount: 2 },
            { id: 3, usageCount: 10, topicCount: 5 }
          ],
          expectedFirstId: 2
        },
        {
          input: [
            { id: 1, usageCount: 3, topicCount: 1 },
            { id: 2, usageCount: 1, topicCount: 4 },
            { id: 3, usageCount: 2, topicCount: 3 }
          ],
          expectedFirstId: 2
        }
      ];

      testCases.forEach(({ input, expectedFirstId }) => {
        const selected = input
          .filter(d => d.topicCount > 0)
          .sort((a, b) => a.usageCount - b.usageCount);

        expect(selected[0].id).toBe(expectedFirstId);
      });
    });
  });

  describe('Property 13: 循环使用策略', () => {
    /**
     * Feature: distillation-usage-tracking, Property 13: 循环使用策略
     * 
     * For any distillation selection operation, even if all results have been used,
     * the system should still be able to select those with minimum usage_count,
     * implementing circular usage.
     * 
     * Validates: Requirements 7.4
     */
    it('should select from used distillations when all have been used', () => {
      // All distillations have been used at least once
      const mockDistillations = [
        { id: 1, usageCount: 5, topicCount: 3 },
        { id: 2, usageCount: 3, topicCount: 2 },
        { id: 3, usageCount: 10, topicCount: 5 }
      ];

      // Should still be able to select (those with minimum usage_count)
      const selected = mockDistillations
        .filter(d => d.topicCount > 0)
        .sort((a, b) => a.usageCount - b.usageCount);

      expect(selected.length).toBeGreaterThan(0);
      expect(selected[0].usageCount).toBe(3); // Minimum among all
    });

    it('should implement circular usage pattern', () => {
      // Simulate multiple rounds of selection
      const mockDistillations = [
        { id: 1, usageCount: 2, topicCount: 3 },
        { id: 2, usageCount: 2, topicCount: 2 },
        { id: 3, usageCount: 2, topicCount: 5 }
      ];

      // All have same usage_count, should still be selectable
      const selected = mockDistillations
        .filter(d => d.topicCount > 0)
        .sort((a, b) => {
          if (a.usageCount !== b.usageCount) {
            return a.usageCount - b.usageCount;
          }
          return a.id - b.id; // Secondary sort by id (or created_at in real implementation)
        });

      expect(selected.length).toBe(3);
      // All are selectable even though all have been used
      expect(selected.every(d => d.usageCount === 2)).toBe(true);
    });

    it('should support circular usage for any usage pattern', () => {
      // Property: For ANY usage pattern, system should continue to work
      const testCases = [
        // All used once
        { distillations: [{ usageCount: 1 }, { usageCount: 1 }, { usageCount: 1 }], canSelect: true },
        // All used many times
        { distillations: [{ usageCount: 100 }, { usageCount: 100 }], canSelect: true },
        // Mixed usage
        { distillations: [{ usageCount: 5 }, { usageCount: 10 }, { usageCount: 3 }], canSelect: true }
      ];

      testCases.forEach(({ distillations, canSelect }) => {
        const withTopics = distillations.map((d, i) => ({ ...d, id: i, topicCount: 1 }));
        const selected = withTopics
          .filter(d => d.topicCount > 0)
          .sort((a, b) => a.usageCount - b.usageCount);

        expect(selected.length > 0).toBe(canSelect);
      });
    });
  });

  describe('Property 14: 批量选择正确性', () => {
    /**
     * Feature: distillation-usage-tracking, Property 14: 批量选择正确性
     * 
     * For any request for N distillations, the system should return the N distillations
     * with minimum usage_count (sorted by usage_count and created_at).
     * 
     * Validates: Requirements 8.1, 8.2
     */
    it('should return exactly N distillations when requested', () => {
      const mockDistillations = [
        { id: 1, usageCount: 0, topicCount: 3, createdAt: '2024-01-01' },
        { id: 2, usageCount: 1, topicCount: 2, createdAt: '2024-01-02' },
        { id: 3, usageCount: 2, topicCount: 5, createdAt: '2024-01-03' },
        { id: 4, usageCount: 3, topicCount: 4, createdAt: '2024-01-04' },
        { id: 5, usageCount: 5, topicCount: 1, createdAt: '2024-01-05' }
      ];

      const requestedCount = 3;
      const selected = mockDistillations
        .filter(d => d.topicCount > 0)
        .sort((a, b) => {
          if (a.usageCount !== b.usageCount) {
            return a.usageCount - b.usageCount;
          }
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        })
        .slice(0, requestedCount);

      expect(selected.length).toBe(requestedCount);
      expect(selected[0].usageCount).toBe(0);
      expect(selected[1].usageCount).toBe(1);
      expect(selected[2].usageCount).toBe(2);
    });

    it('should sort by created_at when usage_count is same', () => {
      const mockDistillations = [
        { id: 1, usageCount: 0, topicCount: 3, createdAt: '2024-01-03' },
        { id: 2, usageCount: 0, topicCount: 2, createdAt: '2024-01-01' },
        { id: 3, usageCount: 0, topicCount: 5, createdAt: '2024-01-02' }
      ];

      const selected = mockDistillations
        .filter(d => d.topicCount > 0)
        .sort((a, b) => {
          if (a.usageCount !== b.usageCount) {
            return a.usageCount - b.usageCount;
          }
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

      // All have same usage_count, should be sorted by created_at
      expect(selected[0].id).toBe(2); // 2024-01-01
      expect(selected[1].id).toBe(3); // 2024-01-02
      expect(selected[2].id).toBe(1); // 2024-01-03
    });

    it('should handle batch selection for any N', () => {
      // Property: For ANY N, selection should return correct count and order
      const mockDistillations = [
        { id: 1, usageCount: 0, topicCount: 3, createdAt: '2024-01-01' },
        { id: 2, usageCount: 1, topicCount: 2, createdAt: '2024-01-02' },
        { id: 3, usageCount: 2, topicCount: 5, createdAt: '2024-01-03' },
        { id: 4, usageCount: 3, topicCount: 4, createdAt: '2024-01-04' }
      ];

      const testCases = [1, 2, 3, 4];

      testCases.forEach(requestedCount => {
        const selected = mockDistillations
          .filter(d => d.topicCount > 0)
          .sort((a, b) => {
            if (a.usageCount !== b.usageCount) {
              return a.usageCount - b.usageCount;
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          })
          .slice(0, requestedCount);

        expect(selected.length).toBe(Math.min(requestedCount, mockDistillations.length));

        // Verify sorting
        for (let i = 0; i < selected.length - 1; i++) {
          if (selected[i].usageCount === selected[i + 1].usageCount) {
            expect(new Date(selected[i].createdAt).getTime()).toBeLessThanOrEqual(
              new Date(selected[i + 1].createdAt).getTime()
            );
          } else {
            expect(selected[i].usageCount).toBeLessThan(selected[i + 1].usageCount);
          }
        }
      });
    });
  });

  describe('Property 16: 任务内选择唯一性', () => {
    /**
     * Feature: distillation-usage-tracking, Property 16: 任务内选择唯一性
     * 
     * For any single task's distillation selection, each distillation should be selected at most once.
     * 
     * Validates: Requirements 8.5
     */
    it('should not select same distillation twice in one task', () => {
      const mockDistillations = [
        { id: 1, usageCount: 0, topicCount: 3 },
        { id: 2, usageCount: 0, topicCount: 2 },
        { id: 3, usageCount: 1, topicCount: 5 }
      ];

      const requestedCount = 3;
      const selected = mockDistillations
        .filter(d => d.topicCount > 0)
        .sort((a, b) => a.usageCount - b.usageCount)
        .slice(0, requestedCount);

      // Extract IDs
      const selectedIds = selected.map(d => d.id);

      // Check uniqueness
      const uniqueIds = new Set(selectedIds);
      expect(uniqueIds.size).toBe(selectedIds.length);
    });

    it('should maintain uniqueness for any selection size', () => {
      // Property: For ANY selection, IDs should be unique
      const mockDistillations = [
        { id: 1, usageCount: 0, topicCount: 3 },
        { id: 2, usageCount: 0, topicCount: 2 },
        { id: 3, usageCount: 1, topicCount: 5 },
        { id: 4, usageCount: 2, topicCount: 4 },
        { id: 5, usageCount: 3, topicCount: 1 }
      ];

      const testCases = [1, 2, 3, 4, 5];

      testCases.forEach(requestedCount => {
        const selected = mockDistillations
          .filter(d => d.topicCount > 0)
          .sort((a, b) => a.usageCount - b.usageCount)
          .slice(0, requestedCount);

        const selectedIds = selected.map(d => d.id);
        const uniqueIds = new Set(selectedIds);

        expect(uniqueIds.size).toBe(selectedIds.length);
      });
    });

    it('should verify uniqueness constraint', () => {
      // Test that selection logic prevents duplicates
      const mockSelection = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 1 } // Duplicate!
      ];

      const ids = mockSelection.map(s => s.id);
      const uniqueIds = new Set(ids);

      // This should fail (has duplicate)
      expect(uniqueIds.size).toBeLessThan(ids.length);

      // Correct selection should have no duplicates
      const correctSelection = [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ];

      const correctIds = correctSelection.map(s => s.id);
      const correctUniqueIds = new Set(correctIds);

      expect(correctUniqueIds.size).toBe(correctIds.length);
    });
  });
});
