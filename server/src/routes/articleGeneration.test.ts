import request from 'supertest';
import express from 'express';
import { articleGenerationRouter } from './articleGeneration';
import { pool } from '../db/database';
import { ArticleGenerationService } from '../services/articleGenerationService';

// Mock dependencies
jest.mock('../db/database');
jest.mock('../services/articleGenerationService');

const mockPool = pool as jest.Mocked<typeof pool>;
const MockedService = ArticleGenerationService as jest.MockedClass<typeof ArticleGenerationService>;

describe('Article Generation Routes - Conversion Target Integration', () => {
  let app: express.Application;
  let mockService: jest.Mocked<ArticleGenerationService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/article-generation', articleGenerationRouter);

    mockService = new MockedService() as jest.Mocked<ArticleGenerationService>;
    jest.clearAllMocks();
  });

  describe('POST /api/article-generation/tasks', () => {
    const validTaskData = {
      distillationId: 1,
      albumId: 1,
      knowledgeBaseId: 1,
      articleSettingId: 1,
      conversionTargetId: 1,
      articleCount: 5
    };

    beforeEach(() => {
      // Mock successful resource checks
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // distillation check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // album check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // knowledge base check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // article setting check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any); // conversion target check

      mockService.createTask.mockResolvedValue(1);
      mockService.getTaskDetail.mockResolvedValue({
        id: 1,
        distillationId: 1,
        albumId: 1,
        knowledgeBaseId: 1,
        articleSettingId: 1,
        conversionTargetId: 1,
        requestedCount: 5,
        generatedCount: 0,
        status: 'pending',
        progress: 0,
        errorMessage: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });
    });

    it('should successfully create task with conversionTargetId', async () => {
      const response = await request(app)
        .post('/api/article-generation/tasks')
        .send(validTaskData)
        .expect(200);

      expect(response.body).toHaveProperty('taskId', 1);
      expect(response.body).toHaveProperty('status', 'pending');
      expect(mockService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          conversionTargetId: 1
        })
      );
    });

    it('should successfully create task without conversionTargetId (backward compatibility)', async () => {
      const taskDataWithoutConversionTarget = {
        distillationId: 1,
        albumId: 1,
        knowledgeBaseId: 1,
        articleSettingId: 1,
        articleCount: 5
      };

      // Reset mocks for this test
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any);

      const response = await request(app)
        .post('/api/article-generation/tasks')
        .send(taskDataWithoutConversionTarget)
        .expect(200);

      expect(response.body).toHaveProperty('taskId', 1);
      expect(mockService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          distillationId: 1,
          albumId: 1,
          knowledgeBaseId: 1,
          articleSettingId: 1,
          articleCount: 5
        })
      );
      expect(mockService.createTask).toHaveBeenCalledWith(
        expect.not.objectContaining({
          conversionTargetId: expect.anything()
        })
      );
    });

    it('should return 404 when conversionTargetId does not exist', async () => {
      // Reset mocks - conversion target check returns empty
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // distillation check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // album check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // knowledge base check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // article setting check
        .mockResolvedValueOnce({ rows: [] } as any); // conversion target check - NOT FOUND

      const response = await request(app)
        .post('/api/article-generation/tasks')
        .send(validTaskData)
        .expect(404);

      expect(response.body).toHaveProperty('error', '转化目标不存在');
      expect(mockService.createTask).not.toHaveBeenCalled();
    });

    it('should return 400 when conversionTargetId is not a positive integer', async () => {
      const invalidTaskData = {
        ...validTaskData,
        conversionTargetId: -1
      };

      const response = await request(app)
        .post('/api/article-generation/tasks')
        .send(invalidTaskData)
        .expect(400);

      expect(response.body).toHaveProperty('error', '数据验证失败');
      expect(response.body.details).toBeDefined();
      expect(mockService.createTask).not.toHaveBeenCalled();
    });

    it('should return 400 when conversionTargetId is zero', async () => {
      const invalidTaskData = {
        ...validTaskData,
        conversionTargetId: 0
      };

      const response = await request(app)
        .post('/api/article-generation/tasks')
        .send(invalidTaskData)
        .expect(400);

      expect(response.body).toHaveProperty('error', '数据验证失败');
      expect(mockService.createTask).not.toHaveBeenCalled();
    });

    it('should return 400 when conversionTargetId is not a number', async () => {
      const invalidTaskData = {
        ...validTaskData,
        conversionTargetId: 'invalid'
      };

      const response = await request(app)
        .post('/api/article-generation/tasks')
        .send(invalidTaskData)
        .expect(400);

      expect(response.body).toHaveProperty('error', '数据验证失败');
      expect(mockService.createTask).not.toHaveBeenCalled();
    });

    it('should validate conversionTargetId only when provided', async () => {
      const taskDataWithoutConversionTarget = {
        distillationId: 1,
        albumId: 1,
        knowledgeBaseId: 1,
        articleSettingId: 1,
        articleCount: 5
      };

      // Reset mocks - only 4 checks (no conversion target check)
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any);

      await request(app)
        .post('/api/article-generation/tasks')
        .send(taskDataWithoutConversionTarget)
        .expect(200);

      // Should only have 4 query calls (no conversion target check)
      expect(mockPool.query).toHaveBeenCalledTimes(4);
    });

    it('should pass conversionTargetId to service.createTask', async () => {
      await request(app)
        .post('/api/article-generation/tasks')
        .send(validTaskData)
        .expect(200);

      expect(mockService.createTask).toHaveBeenCalledWith({
        distillationId: 1,
        albumId: 1,
        knowledgeBaseId: 1,
        articleSettingId: 1,
        conversionTargetId: 1,
        articleCount: 5
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/article-generation/tasks')
        .send(validTaskData)
        .expect(500);

      expect(response.body).toHaveProperty('error', '创建任务失败');
      expect(mockService.createTask).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/article-generation/tasks/:id', () => {
    it('should return task with conversionTargetId in response', async () => {
      mockService.getTaskDetail.mockResolvedValue({
        id: 1,
        distillationId: 1,
        albumId: 1,
        knowledgeBaseId: 1,
        articleSettingId: 1,
        conversionTargetId: 1,
        requestedCount: 5,
        generatedCount: 0,
        status: 'pending',
        progress: 0,
        errorMessage: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });

      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const response = await request(app)
        .get('/api/article-generation/tasks/1')
        .expect(200);

      expect(response.body).toHaveProperty('conversionTargetId', 1);
    });

    it('should handle tasks without conversionTargetId', async () => {
      mockService.getTaskDetail.mockResolvedValue({
        id: 1,
        distillationId: 1,
        albumId: 1,
        knowledgeBaseId: 1,
        articleSettingId: 1,
        conversionTargetId: null,
        requestedCount: 5,
        generatedCount: 0,
        status: 'pending',
        progress: 0,
        errorMessage: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });

      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const response = await request(app)
        .get('/api/article-generation/tasks/1')
        .expect(200);

      expect(response.body).toHaveProperty('conversionTargetId', null);
    });
  });
});
