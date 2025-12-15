import { AIService } from '../aiService';
import { OllamaService } from '../ollamaService';
import axios from 'axios';

// Mock axios and OllamaService
jest.mock('axios');
jest.mock('../ollamaService');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 6: AI retry attempts', () => {
    /**
     * Feature: article-generation-visibility-fix, Property 6: AI retry attempts
     * 
     * For any AI API call that consistently fails, the system should make exactly 3 total attempts
     * (1 initial + 2 retries) before throwing an error
     * 
     * Validates: Requirements 3.2
     */
    it('should make exactly 3 attempts (1 initial + 2 retries) when AI call consistently fails', async () => {
      // Arrange: Create AIService with DeepSeek provider
      const service = new AIService({
        provider: 'deepseek',
        apiKey: 'test-key',
        maxRetries: 2
      });

      // Mock axios.post to always fail
      const mockError = new Error('API call failed');
      mockedAxios.post = jest.fn().mockRejectedValue(mockError);

      // Act & Assert: Call should fail after 3 attempts
      await expect(service['callAI']('test prompt')).rejects.toThrow('AI调用失败，已重试 3 次');

      // Verify exactly 3 calls were made
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should make exactly 3 attempts for Gemini provider when calls fail', async () => {
      // Arrange
      const service = new AIService({
        provider: 'gemini',
        apiKey: 'test-key',
        maxRetries: 2
      });

      const mockError = new Error('Gemini API failed');
      mockedAxios.post = jest.fn().mockRejectedValue(mockError);

      // Act & Assert
      await expect(service['callAI']('test prompt')).rejects.toThrow('AI调用失败，已重试 3 次');
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should succeed on second attempt if first fails', async () => {
      // Arrange
      const service = new AIService({
        provider: 'deepseek',
        apiKey: 'test-key',
        maxRetries: 2
      });

      // Mock: fail first, succeed second
      mockedAxios.post = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({
          data: {
            choices: [{ message: { content: 'Success on retry' } }]
          }
        });

      // Act
      const result = await service['callAI']('test prompt');

      // Assert
      expect(result).toBe('Success on retry');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should succeed on third attempt if first two fail', async () => {
      // Arrange
      const service = new AIService({
        provider: 'deepseek',
        apiKey: 'test-key',
        maxRetries: 2
      });

      // Mock: fail twice, succeed third time
      mockedAxios.post = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce({
          data: {
            choices: [{ message: { content: 'Success on third attempt' } }]
          }
        });

      // Act
      const result = await service['callAI']('test prompt');

      // Assert
      expect(result).toBe('Success on third attempt');
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should respect custom maxRetries configuration', async () => {
      // Arrange: Set maxRetries to 1 (total 2 attempts)
      const service = new AIService({
        provider: 'deepseek',
        apiKey: 'test-key',
        maxRetries: 1
      });

      mockedAxios.post = jest.fn().mockRejectedValue(new Error('API failed'));

      // Act & Assert
      await expect(service['callAI']('test prompt')).rejects.toThrow('AI调用失败，已重试 2 次');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should wait between retry attempts', async () => {
      // Arrange
      const service = new AIService({
        provider: 'deepseek',
        apiKey: 'test-key',
        maxRetries: 2
      });

      mockedAxios.post = jest.fn().mockRejectedValue(new Error('API failed'));

      const startTime = Date.now();

      // Act
      try {
        await service['callAI']('test prompt');
      } catch (error) {
        // Expected to fail
      }

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Assert: Should have waited at least 5s + 10s = 15s total
      // Using a lower threshold to account for test execution time
      expect(elapsed).toBeGreaterThanOrEqual(14000);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    }, 20000); // Increase test timeout to 20s
  });
});
