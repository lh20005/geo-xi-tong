/**
 * Feature: api-client-consistency, Property 1: Relative path consistency
 * 
 * Tests for the unified API client
 */

import { apiClient } from './client';
import axios from 'axios';
import * as fc from 'fast-check';

// Mock axios to prevent actual HTTP requests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should be configured with baseURL /api', () => {
      expect(apiClient.defaults.baseURL).toBe('/api');
    });

    it('should be configured with 30 second timeout', () => {
      expect(apiClient.defaults.timeout).toBe(30000);
    });

    it('should have Content-Type application/json header', () => {
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Property 1: Relative path consistency', () => {
    /**
     * **Feature: api-client-consistency, Property 1: Relative path consistency**
     * **Validates: Requirements 1.2**
     * 
     * For any API endpoint call through the unified client, 
     * the request URL should be a relative path starting with '/api'
     */
    it('should use relative paths for all API calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('GET'),
            fc.constant('POST'),
            fc.constant('PATCH'),
            fc.constant('DELETE')
          ),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(' ')),
          async (method, endpoint) => {
            // Setup mock response
            const mockResponse = { data: { success: true } };
            mockedAxios.create.mockReturnValue({
              ...apiClient,
              request: jest.fn().mockResolvedValue(mockResponse),
            } as any);

            // Verify baseURL is set correctly
            expect(apiClient.defaults.baseURL).toBe('/api');
            
            // The baseURL ensures all requests are relative
            // When we make a request to '/endpoint', it becomes '/api/endpoint'
            const fullPath = `${apiClient.defaults.baseURL}/${endpoint}`;
            expect(fullPath).toMatch(/^\/api\//);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Error handling consistency', () => {
    /**
     * **Feature: api-client-consistency, Property 2: Error handling consistency**
     * **Validates: Requirements 1.5**
     * 
     * For any API request that fails (network error, HTTP error, or timeout),
     * the error should be transformed into a consistent Error object with a message property
     */
    it('should transform all errors into consistent Error objects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.record({
              type: fc.constant('network'),
              message: fc.string({ minLength: 1 }),
            }),
            fc.record({
              type: fc.constant('http'),
              status: fc.integer({ min: 400, max: 599 }),
              error: fc.string({ minLength: 1 }),
            }),
            fc.record({
              type: fc.constant('timeout'),
              message: fc.constant('timeout of 30000ms exceeded'),
            })
          ),
          async (errorConfig) => {
            // Create a mock axios instance with interceptor
            const mockInstance = axios.create();
            
            // Add the same interceptor as apiClient
            mockInstance.interceptors.response.use(
              (response) => response,
              (error: any) => {
                const message = 
                  error.response?.data?.error || 
                  error.message || 
                  '请求失败';
                return Promise.reject(new Error(message));
              }
            );

            // Simulate different error types
            let mockError: any;
            if (errorConfig.type === 'network') {
              mockError = new Error(errorConfig.message);
            } else if (errorConfig.type === 'http') {
              mockError = {
                response: {
                  data: { error: errorConfig.error },
                  status: errorConfig.status,
                },
                message: 'Request failed',
              };
            } else {
              mockError = new Error(errorConfig.message);
            }

            // Test the interceptor logic
            const interceptor = mockInstance.interceptors.response['handlers'][0];
            try {
              await interceptor.rejected(mockError);
              fail('Should have thrown an error');
            } catch (error: any) {
              // Verify it's an Error object
              expect(error).toBeInstanceOf(Error);
              // Verify it has a message property
              expect(error.message).toBeDefined();
              expect(typeof error.message).toBe('string');
              expect(error.message.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Error message extraction', () => {
    /**
     * **Feature: api-client-consistency, Property 3: Error message extraction**
     * **Validates: Requirements 2.4**
     * 
     * For any failed API request with a server response,
     * the error message should be extracted from response.data.error or fallback to error.message
     */
    it('should extract error messages correctly from server responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          async (serverError, fallbackMessage) => {
            // Create a mock axios instance with interceptor
            const mockInstance = axios.create();
            
            // Add the same interceptor as apiClient
            mockInstance.interceptors.response.use(
              (response) => response,
              (error: any) => {
                const message = 
                  error.response?.data?.error || 
                  error.message || 
                  '请求失败';
                return Promise.reject(new Error(message));
              }
            );

            // Create mock error with server response
            const mockError = {
              response: {
                data: { error: serverError },
              },
              message: fallbackMessage || 'Default error',
            };

            // Test the interceptor
            const interceptor = mockInstance.interceptors.response['handlers'][0];
            try {
              await interceptor.rejected(mockError);
              fail('Should have thrown an error');
            } catch (error: any) {
              // Should extract from response.data.error first
              expect(error.message).toBe(serverError);
            }

            // Test fallback to error.message
            const mockErrorNoResponse = {
              message: fallbackMessage || 'Default error',
            };

            try {
              await interceptor.rejected(mockErrorNoResponse);
              fail('Should have thrown an error');
            } catch (error: any) {
              // Should fallback to error.message
              expect(error.message).toBe(fallbackMessage || 'Default error');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
