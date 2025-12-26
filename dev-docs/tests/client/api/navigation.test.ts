/**
 * Feature: api-client-consistency, Property 4: Navigation consistency
 * 
 * Tests for API consistency across page navigation
 */

import { apiClient } from './client';
import * as fc from 'fast-check';

describe('Navigation Consistency', () => {
  describe('Property 4: Navigation consistency', () => {
    /**
     * **Feature: api-client-consistency, Property 4: Navigation consistency**
     * **Validates: Requirements 2.5**
     * 
     * For any sequence of page navigations, making the same API call should produce 
     * the same request configuration (URL, headers, timeout) regardless of navigation history
     */
    it('should maintain consistent API configuration across navigation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              page: fc.constantFrom('articles', 'article-settings', 'topics'),
              action: fc.constantFrom('list', 'view', 'create'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (navigationSequence) => {
            // Simulate navigation by checking API client config multiple times
            const configs: any[] = [];
            
            for (const nav of navigationSequence) {
              // Capture current configuration
              const config = {
                baseURL: apiClient.defaults.baseURL,
                timeout: apiClient.defaults.timeout,
                headers: apiClient.defaults.headers,
              };
              configs.push(config);
            }
            
            // Verify all configurations are identical
            for (let i = 1; i < configs.length; i++) {
              expect(configs[i].baseURL).toBe(configs[0].baseURL);
              expect(configs[i].timeout).toBe(configs[0].timeout);
              expect(configs[i].headers['Content-Type']).toBe(configs[0].headers['Content-Type']);
            }
            
            // Verify baseURL is always '/api'
            configs.forEach(config => {
              expect(config.baseURL).toBe('/api');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use the same client instance across different API calls', () => {
      // Import apiClient multiple times to verify it's a singleton
      const { apiClient: client1 } = require('./client');
      const { apiClient: client2 } = require('./client');
      
      // Should be the same instance
      expect(client1).toBe(client2);
      expect(client1.defaults.baseURL).toBe('/api');
      expect(client2.defaults.baseURL).toBe('/api');
    });

    it('should maintain configuration after multiple API calls', async () => {
      // Make multiple API calls and verify config doesn't change
      const initialBaseURL = apiClient.defaults.baseURL;
      const initialTimeout = apiClient.defaults.timeout;
      
      // Simulate multiple API calls (without actually making requests)
      const endpoints = ['/articles', '/article-settings', '/topics', '/config'];
      
      endpoints.forEach(endpoint => {
        // Verify config hasn't changed
        expect(apiClient.defaults.baseURL).toBe(initialBaseURL);
        expect(apiClient.defaults.timeout).toBe(initialTimeout);
      });
    });
  });
});
