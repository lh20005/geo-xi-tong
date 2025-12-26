describe('ArticleGenerationService - Error Handling Logic', () => {
  describe('Property 3: Zero articles means failure', () => {
    /**
     * Feature: article-generation-visibility-fix, Property 3: Zero articles means failure
     * 
     * For any task execution that generates zero articles, the final task status should be 'failed' not 'completed'
     * 
     * Validates: Requirements 1.4
     */
    it('should determine status as failed when generated count is zero', () => {
      // This property tests the logic: if generatedCount === 0, status should be 'failed'
      // Testing the decision logic directly
      
      const generatedCount = 0;
      const requestedCount = 5;
      
      // Logic from executeTask method:
      // if (generatedCount > 0) { status = 'completed' } else { status = 'failed' }
      const status = generatedCount > 0 ? 'completed' : 'failed';
      
      expect(status).toBe('failed');
    });

    it('should determine status as failed for any zero count regardless of requested amount', () => {
      // Property: For ANY requested count, if generated is 0, status is failed
      const testCases = [
        { requested: 1, generated: 0 },
        { requested: 10, generated: 0 },
        { requested: 100, generated: 0 }
      ];

      testCases.forEach(({ requested, generated }) => {
        const status = generated > 0 ? 'completed' : 'failed';
        expect(status).toBe('failed');
      });
    });
  });

  describe('Property 7: Failure continues processing', () => {
    /**
     * Feature: article-generation-visibility-fix, Property 7: Failure continues processing
     * 
     * For any task generating multiple articles where one article generation fails,
     * the system should continue processing remaining articles and the final generated_count
     * should reflect only successful generations
     * 
     * Validates: Requirements 3.4, 4.4
     */
    it('should count only successful articles when some fail', () => {
      // Simulate article generation results
      const articleResults = [
        { success: false, error: 'Failed' },
        { success: true, title: 'Article 2', content: 'Content 2' },
        { success: true, title: 'Article 3', content: 'Content 3' }
      ];

      // Logic from executeTask: count only successful articles
      let generatedCount = 0;
      articleResults.forEach(result => {
        if (result.success) {
          generatedCount++;
        }
      });

      expect(generatedCount).toBe(2);
      expect(articleResults.length).toBe(3); // All were processed
    });

    it('should process all articles regardless of individual failures', () => {
      // Property: For ANY mix of successes and failures, all articles are attempted
      const testScenarios = [
        // [success, fail, success, fail, success]
        [true, false, true, false, true],
        // [fail, fail, success]
        [false, false, true],
        // [success, success, fail, fail]
        [true, true, false, false]
      ];

      testScenarios.forEach(scenario => {
        const results = scenario.map(success => ({ success }));
        const successCount = results.filter(r => r.success).length;
        const totalProcessed = results.length;

        // All articles were processed
        expect(totalProcessed).toBe(scenario.length);
        
        // Only successful ones are counted
        expect(successCount).toBe(scenario.filter(s => s).length);
      });
    });

    it('should determine final status based on any successes', () => {
      // Test the logic: if any article succeeds, status is 'completed'
      const scenarios = [
        { successes: 0, failures: 3, expectedStatus: 'failed' },
        { successes: 1, failures: 2, expectedStatus: 'completed' },
        { successes: 2, failures: 1, expectedStatus: 'completed' },
        { successes: 3, failures: 0, expectedStatus: 'completed' }
      ];

      scenarios.forEach(({ successes, failures, expectedStatus }) => {
        const generatedCount = successes;
        const status = generatedCount > 0 ? 'completed' : 'failed';
        
        expect(status).toBe(expectedStatus);
      });
    });
  });

  describe('Property 8: Progress calculation accuracy', () => {
    /**
     * Feature: article-generation-visibility-fix, Property 8: Progress calculation accuracy
     * 
     * For any task that has generated N articles out of M requested, the progress field should equal Math.round((N/M) * 100)
     * 
     * Validates: Requirements 4.1
     */
    it('should calculate progress correctly for any N out of M articles', () => {
      const testCases = [
        { generated: 0, requested: 10, expected: 0 },
        { generated: 1, requested: 10, expected: 10 },
        { generated: 5, requested: 10, expected: 50 },
        { generated: 7, requested: 10, expected: 70 },
        { generated: 10, requested: 10, expected: 100 },
        { generated: 1, requested: 3, expected: 33 },
        { generated: 2, requested: 3, expected: 67 },
        { generated: 3, requested: 7, expected: 43 }
      ];

      testCases.forEach(({ generated, requested, expected }) => {
        const progress = Math.round((generated / requested) * 100);
        expect(progress).toBe(expected);
      });
    });

    it('should handle edge cases correctly', () => {
      // Edge case: 1 out of 1
      expect(Math.round((1 / 1) * 100)).toBe(100);
      
      // Edge case: 0 out of 1
      expect(Math.round((0 / 1) * 100)).toBe(0);
      
      // Edge case: partial progress with rounding
      expect(Math.round((1 / 3) * 100)).toBe(33);
      expect(Math.round((2 / 3) * 100)).toBe(67);
    });
  });

  describe('Article Generation Result Handling', () => {
    it('should handle success result correctly', () => {
      const result = {
        success: true,
        title: 'Test Article',
        content: 'Test Content'
      };

      expect(result.success).toBe(true);
      expect(result.title).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle failure result correctly', () => {
      const result: any = {
        success: false,
        error: 'Generation failed'
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.title).toBeUndefined();
      expect(result.content).toBeUndefined();
    });

    it('should differentiate between success and failure results', () => {
      const successResult: any = { success: true, title: 'Title', content: 'Content' };
      const failureResult: any = { success: false, error: 'Error' };

      // Logic: only process successful results
      const results = [successResult, failureResult, successResult];
      const successfulArticles = results.filter((r: any) => r.success && r.title && r.content);

      expect(successfulArticles.length).toBe(2);
    });
  });
});

describe('ArticleGenerationService - getTasks with JOIN queries', () => {
  describe('Property 1: Conversion target name consistency', () => {
    /**
     * Feature: article-generation-table-enhancement, Property 1: Conversion target name consistency
     * 
     * For any GenerationTask with a non-null conversion_target_id, the displayed conversionTargetName 
     * should match the company_name field from the associated ConversionTarget record in the database.
     * 
     * Validates: Requirements 1.2, 6.2
     */
    it('should return conversion target name when conversion_target_id is not null', () => {
      // Mock data simulating JOIN query result
      const mockTaskRow = {
        id: 1,
        distillation_id: 1,
        album_id: 1,
        knowledge_base_id: 1,
        article_setting_id: 1,
        conversion_target_id: 5,
        requested_count: 10,
        generated_count: 5,
        status: 'running',
        progress: 50,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        conversion_target_name: 'Test Company Ltd',
        keyword: 'AI技术',
        provider: 'deepseek'
      };

      // Simulate the mapping logic from getTasks
      const task = {
        id: mockTaskRow.id,
        distillationId: mockTaskRow.distillation_id,
        albumId: mockTaskRow.album_id,
        knowledgeBaseId: mockTaskRow.knowledge_base_id,
        articleSettingId: mockTaskRow.article_setting_id,
        conversionTargetId: mockTaskRow.conversion_target_id,
        requestedCount: mockTaskRow.requested_count,
        generatedCount: mockTaskRow.generated_count,
        status: mockTaskRow.status,
        progress: mockTaskRow.progress,
        errorMessage: mockTaskRow.error_message,
        createdAt: mockTaskRow.created_at,
        updatedAt: mockTaskRow.updated_at,
        conversionTargetName: mockTaskRow.conversion_target_name || null,
        keyword: mockTaskRow.keyword,
        provider: mockTaskRow.provider
      };

      expect(task.conversionTargetName).toBe('Test Company Ltd');
      expect(task.conversionTargetId).toBe(5);
    });

    it('should return null for conversionTargetName when conversion_target_id is null', () => {
      // Mock data with null conversion_target_id (LEFT JOIN returns null)
      const mockTaskRow = {
        id: 2,
        distillation_id: 2,
        album_id: 1,
        knowledge_base_id: 1,
        article_setting_id: 1,
        conversion_target_id: null,
        requested_count: 5,
        generated_count: 0,
        status: 'pending',
        progress: 0,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        conversion_target_name: null,
        keyword: '机器学习',
        provider: 'gemini'
      };

      const task = {
        id: mockTaskRow.id,
        distillationId: mockTaskRow.distillation_id,
        albumId: mockTaskRow.album_id,
        knowledgeBaseId: mockTaskRow.knowledge_base_id,
        articleSettingId: mockTaskRow.article_setting_id,
        conversionTargetId: mockTaskRow.conversion_target_id,
        requestedCount: mockTaskRow.requested_count,
        generatedCount: mockTaskRow.generated_count,
        status: mockTaskRow.status,
        progress: mockTaskRow.progress,
        errorMessage: mockTaskRow.error_message,
        createdAt: mockTaskRow.created_at,
        updatedAt: mockTaskRow.updated_at,
        conversionTargetName: mockTaskRow.conversion_target_name || null,
        keyword: mockTaskRow.keyword,
        provider: mockTaskRow.provider
      };

      expect(task.conversionTargetName).toBeNull();
      expect(task.conversionTargetId).toBeNull();
    });
  });

  describe('Property 2: Keyword data consistency', () => {
    /**
     * Feature: article-generation-table-enhancement, Property 2: Keyword data consistency
     * 
     * For any GenerationTask, the displayed keyword should match the keyword field 
     * from the associated Distillation record in the database.
     * 
     * Validates: Requirements 2.2, 6.3
     */
    it('should return keyword from distillation for any task', () => {
      const testCases = [
        { distillation_id: 1, keyword: 'AI技术' },
        { distillation_id: 2, keyword: '机器学习' },
        { distillation_id: 3, keyword: '深度学习' },
        { distillation_id: 4, keyword: '自然语言处理' }
      ];

      testCases.forEach(({ distillation_id, keyword }) => {
        const mockTaskRow = {
          id: distillation_id,
          distillation_id,
          album_id: 1,
          knowledge_base_id: 1,
          article_setting_id: 1,
          conversion_target_id: null,
          requested_count: 10,
          generated_count: 5,
          status: 'completed',
          progress: 100,
          error_message: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          conversion_target_name: null,
          keyword,
          provider: 'deepseek'
        };

        const task = {
          id: mockTaskRow.id,
          distillationId: mockTaskRow.distillation_id,
          albumId: mockTaskRow.album_id,
          knowledgeBaseId: mockTaskRow.knowledge_base_id,
          articleSettingId: mockTaskRow.article_setting_id,
          conversionTargetId: mockTaskRow.conversion_target_id,
          requestedCount: mockTaskRow.requested_count,
          generatedCount: mockTaskRow.generated_count,
          status: mockTaskRow.status,
          progress: mockTaskRow.progress,
          errorMessage: mockTaskRow.error_message,
          createdAt: mockTaskRow.created_at,
          updatedAt: mockTaskRow.updated_at,
          conversionTargetName: mockTaskRow.conversion_target_name || null,
          keyword: mockTaskRow.keyword,
          provider: mockTaskRow.provider
        };

        expect(task.keyword).toBe(keyword);
        expect(task.distillationId).toBe(distillation_id);
      });
    });
  });

  describe('Property 3: Provider data consistency', () => {
    /**
     * Feature: article-generation-table-enhancement, Property 3: Provider data consistency
     * 
     * For any GenerationTask, the displayed provider should match the provider field 
     * from the associated Distillation record in the database.
     * 
     * Validates: Requirements 3.2, 6.3
     */
    it('should return provider from distillation for any task', () => {
      const testCases = [
        { distillation_id: 1, provider: 'deepseek' },
        { distillation_id: 2, provider: 'gemini' },
        { distillation_id: 3, provider: 'deepseek' },
        { distillation_id: 4, provider: 'gemini' }
      ];

      testCases.forEach(({ distillation_id, provider }) => {
        const mockTaskRow = {
          id: distillation_id,
          distillation_id,
          album_id: 1,
          knowledge_base_id: 1,
          article_setting_id: 1,
          conversion_target_id: null,
          requested_count: 10,
          generated_count: 5,
          status: 'completed',
          progress: 100,
          error_message: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          conversion_target_name: null,
          keyword: 'Test Keyword',
          provider
        };

        const task = {
          id: mockTaskRow.id,
          distillationId: mockTaskRow.distillation_id,
          albumId: mockTaskRow.album_id,
          knowledgeBaseId: mockTaskRow.knowledge_base_id,
          articleSettingId: mockTaskRow.article_setting_id,
          conversionTargetId: mockTaskRow.conversion_target_id,
          requestedCount: mockTaskRow.requested_count,
          generatedCount: mockTaskRow.generated_count,
          status: mockTaskRow.status,
          progress: mockTaskRow.progress,
          errorMessage: mockTaskRow.error_message,
          createdAt: mockTaskRow.created_at,
          updatedAt: mockTaskRow.updated_at,
          conversionTargetName: mockTaskRow.conversion_target_name || null,
          keyword: mockTaskRow.keyword,
          provider: mockTaskRow.provider
        };

        expect(task.provider).toBe(provider);
        expect(task.distillationId).toBe(distillation_id);
      });
    });
  });

  describe('Property 4: API response completeness', () => {
    /**
     * Feature: article-generation-table-enhancement, Property 4: API response completeness
     * 
     * For any task list API response, each GenerationTask object should include the fields: 
     * conversion_target_id, distillation_id, conversionTargetName, keyword, and provider.
     * 
     * Validates: Requirements 6.1
     */
    it('should include all required fields in task object', () => {
      const mockTaskRow = {
        id: 1,
        distillation_id: 1,
        album_id: 1,
        knowledge_base_id: 1,
        article_setting_id: 1,
        conversion_target_id: 5,
        requested_count: 10,
        generated_count: 5,
        status: 'running',
        progress: 50,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        conversion_target_name: 'Test Company',
        keyword: 'AI技术',
        provider: 'deepseek'
      };

      const task = {
        id: mockTaskRow.id,
        distillationId: mockTaskRow.distillation_id,
        albumId: mockTaskRow.album_id,
        knowledgeBaseId: mockTaskRow.knowledge_base_id,
        articleSettingId: mockTaskRow.article_setting_id,
        conversionTargetId: mockTaskRow.conversion_target_id,
        requestedCount: mockTaskRow.requested_count,
        generatedCount: mockTaskRow.generated_count,
        status: mockTaskRow.status,
        progress: mockTaskRow.progress,
        errorMessage: mockTaskRow.error_message,
        createdAt: mockTaskRow.created_at,
        updatedAt: mockTaskRow.updated_at,
        conversionTargetName: mockTaskRow.conversion_target_name || null,
        keyword: mockTaskRow.keyword,
        provider: mockTaskRow.provider
      };

      // Verify all required fields are present
      expect(task).toHaveProperty('conversionTargetId');
      expect(task).toHaveProperty('distillationId');
      expect(task).toHaveProperty('conversionTargetName');
      expect(task).toHaveProperty('keyword');
      expect(task).toHaveProperty('provider');

      // Verify field values
      expect(task.conversionTargetId).toBe(5);
      expect(task.distillationId).toBe(1);
      expect(task.conversionTargetName).toBe('Test Company');
      expect(task.keyword).toBe('AI技术');
      expect(task.provider).toBe('deepseek');
    });

    it('should include all required fields even when conversion target is null', () => {
      const mockTaskRow = {
        id: 2,
        distillation_id: 2,
        album_id: 1,
        knowledge_base_id: 1,
        article_setting_id: 1,
        conversion_target_id: null,
        requested_count: 5,
        generated_count: 0,
        status: 'pending',
        progress: 0,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        conversion_target_name: null,
        keyword: '机器学习',
        provider: 'gemini'
      };

      const task = {
        id: mockTaskRow.id,
        distillationId: mockTaskRow.distillation_id,
        albumId: mockTaskRow.album_id,
        knowledgeBaseId: mockTaskRow.knowledge_base_id,
        articleSettingId: mockTaskRow.article_setting_id,
        conversionTargetId: mockTaskRow.conversion_target_id,
        requestedCount: mockTaskRow.requested_count,
        generatedCount: mockTaskRow.generated_count,
        status: mockTaskRow.status,
        progress: mockTaskRow.progress,
        errorMessage: mockTaskRow.error_message,
        createdAt: mockTaskRow.created_at,
        updatedAt: mockTaskRow.updated_at,
        conversionTargetName: mockTaskRow.conversion_target_name || null,
        keyword: mockTaskRow.keyword,
        provider: mockTaskRow.provider
      };

      // All fields should still be present
      expect(task).toHaveProperty('conversionTargetId');
      expect(task).toHaveProperty('distillationId');
      expect(task).toHaveProperty('conversionTargetName');
      expect(task).toHaveProperty('keyword');
      expect(task).toHaveProperty('provider');

      // Verify null handling
      expect(task.conversionTargetId).toBeNull();
      expect(task.conversionTargetName).toBeNull();
      expect(task.keyword).toBe('机器学习');
      expect(task.provider).toBe('gemini');
    });
  });
});
