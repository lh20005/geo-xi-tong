import { ArticleGenerationService, TaskConfig } from './articleGenerationService';
import { pool } from '../db/database';

// Mock the database pool
jest.mock('../db/database');
const mockPool = pool as jest.Mocked<typeof pool>;

describe('ArticleGenerationService - Conversion Target Integration', () => {
  let service: ArticleGenerationService;

  beforeEach(() => {
    service = new ArticleGenerationService();
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should correctly save conversionTargetId when provided', async () => {
      const config: TaskConfig = {
        distillationId: 1,
        albumId: 1,
        knowledgeBaseId: 1,
        articleSettingId: 1,
        conversionTargetId: 5,
        articleCount: 10
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 100 }]
      } as any);

      const taskId = await service.createTask(config);

      expect(taskId).toBe(100);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO generation_tasks'),
        expect.arrayContaining([
          config.distillationId,
          config.albumId,
          config.knowledgeBaseId,
          config.articleSettingId,
          config.conversionTargetId,
          config.articleCount
        ])
      );
    });

    it('should insert NULL for conversionTargetId when not provided', async () => {
      const config: TaskConfig = {
        distillationId: 1,
        albumId: 1,
        knowledgeBaseId: 1,
        articleSettingId: 1,
        articleCount: 10
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 101 }]
      } as any);

      const taskId = await service.createTask(config);

      expect(taskId).toBe(101);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO generation_tasks'),
        expect.arrayContaining([
          config.distillationId,
          config.albumId,
          config.knowledgeBaseId,
          config.articleSettingId,
          null, // conversionTargetId should be null
          config.articleCount
        ])
      );
    });

    it('should insert NULL for conversionTargetId when undefined', async () => {
      const config: TaskConfig = {
        distillationId: 1,
        albumId: 1,
        knowledgeBaseId: 1,
        articleSettingId: 1,
        conversionTargetId: undefined,
        articleCount: 10
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 102 }]
      } as any);

      await service.createTask(config);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO generation_tasks'),
        expect.arrayContaining([null]) // conversionTargetId should be null
      );
    });

    it('should include conversion_target_id in INSERT statement', async () => {
      const config: TaskConfig = {
        distillationId: 1,
        albumId: 1,
        knowledgeBaseId: 1,
        articleSettingId: 1,
        conversionTargetId: 3,
        articleCount: 5
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 103 }]
      } as any);

      await service.createTask(config);

      const insertQuery = mockPool.query.mock.calls[0][0] as string;
      expect(insertQuery).toContain('conversion_target_id');
    });
  });

  describe('getTasks', () => {
    it('should return tasks with conversionTargetId field', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] } as any)
        .mockResolvedValueOnce({
          rows: [
            {
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
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            },
            {
              id: 2,
              distillation_id: 2,
              album_id: 2,
              knowledge_base_id: 2,
              article_setting_id: 2,
              conversion_target_id: null,
              requested_count: 5,
              generated_count: 0,
              status: 'pending',
              progress: 0,
              error_message: null,
              created_at: '2024-01-02T00:00:00Z',
              updated_at: '2024-01-02T00:00:00Z'
            }
          ]
        } as any);

      const result = await service.getTasks(1, 10);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0]).toHaveProperty('conversionTargetId', 5);
      expect(result.tasks[1]).toHaveProperty('conversionTargetId', null);
    });

    it('should include conversion_target_id in SELECT statement', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await service.getTasks(1, 10);

      const selectQuery = mockPool.query.mock.calls[1][0] as string;
      expect(selectQuery).toContain('conversion_target_id');
    });
  });

  describe('getTaskDetail', () => {
    it('should return task with conversionTargetId when present', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            distillation_id: 1,
            album_id: 1,
            knowledge_base_id: 1,
            article_setting_id: 1,
            conversion_target_id: 7,
            requested_count: 10,
            generated_count: 10,
            status: 'completed',
            progress: 100,
            error_message: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ]
      } as any);

      const task = await service.getTaskDetail(1);

      expect(task).not.toBeNull();
      expect(task).toHaveProperty('conversionTargetId', 7);
    });

    it('should return task with null conversionTargetId when not set', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            distillation_id: 2,
            album_id: 2,
            knowledge_base_id: 2,
            article_setting_id: 2,
            conversion_target_id: null,
            requested_count: 5,
            generated_count: 0,
            status: 'pending',
            progress: 0,
            error_message: null,
            created_at: '2024-01-02T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z'
          }
        ]
      } as any);

      const task = await service.getTaskDetail(2);

      expect(task).not.toBeNull();
      expect(task).toHaveProperty('conversionTargetId', null);
    });

    it('should include conversion_target_id in SELECT statement', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await service.getTaskDetail(1);

      const selectQuery = mockPool.query.mock.calls[0][0] as string;
      expect(selectQuery).toContain('conversion_target_id');
    });

    it('should return null when task does not exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const task = await service.getTaskDetail(999);

      expect(task).toBeNull();
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle tasks created without conversionTargetId', async () => {
      // Simulate old task data without conversion_target_id
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            distillation_id: 1,
            album_id: 1,
            knowledge_base_id: 1,
            article_setting_id: 1,
            conversion_target_id: null, // Old tasks will have NULL
            requested_count: 10,
            generated_count: 10,
            status: 'completed',
            progress: 100,
            error_message: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ]
      } as any);

      const task = await service.getTaskDetail(1);

      expect(task).not.toBeNull();
      expect(task?.conversionTargetId).toBeNull();
    });
  });
});
