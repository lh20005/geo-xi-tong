import { Router } from 'express';
import { z } from 'zod';
import { ArticleGenerationService } from '../services/articleGenerationService';
import { pool } from '../db/database';

export const articleGenerationRouter = Router();

const service = new ArticleGenerationService();

// Zod验证schemas
const createTaskSchema = z.object({
  distillationId: z.number().int().positive('蒸馏历史ID必须是正整数'),
  albumId: z.number().int().positive('图库ID必须是正整数'),
  knowledgeBaseId: z.number().int().positive('知识库ID必须是正整数'),
  articleSettingId: z.number().int().positive('文章设置ID必须是正整数'),
  conversionTargetId: z.number().int().positive('转化目标ID必须是正整数').optional(),
  articleCount: z.number().int().positive('文章数量必须是正整数').max(100, '文章数量不能超过100')
});

/**
 * 创建生成任务
 * POST /api/article-generation/tasks
 */
articleGenerationRouter.post('/tasks', async (req, res) => {
  try {
    const validatedData = createTaskSchema.parse(req.body);

    // 验证引用的资源是否存在
    const distillationCheck = await pool.query('SELECT id FROM distillations WHERE id = $1', [validatedData.distillationId]);
    if (distillationCheck.rows.length === 0) {
      return res.status(404).json({ error: '蒸馏历史不存在' });
    }

    const albumCheck = await pool.query('SELECT id FROM albums WHERE id = $1', [validatedData.albumId]);
    if (albumCheck.rows.length === 0) {
      return res.status(404).json({ error: '图库不存在' });
    }

    const knowledgeBaseCheck = await pool.query('SELECT id FROM knowledge_bases WHERE id = $1', [validatedData.knowledgeBaseId]);
    if (knowledgeBaseCheck.rows.length === 0) {
      return res.status(404).json({ error: '知识库不存在' });
    }

    const articleSettingCheck = await pool.query('SELECT id FROM article_settings WHERE id = $1', [validatedData.articleSettingId]);
    if (articleSettingCheck.rows.length === 0) {
      return res.status(404).json({ error: '文章设置不存在' });
    }

    // 验证转化目标是否存在（如果提供了）
    if (validatedData.conversionTargetId) {
      const conversionTargetCheck = await pool.query('SELECT id FROM conversion_targets WHERE id = $1', [validatedData.conversionTargetId]);
      if (conversionTargetCheck.rows.length === 0) {
        return res.status(404).json({ error: '转化目标不存在' });
      }
    }

    // 创建任务
    const taskId = await service.createTask({
      distillationId: validatedData.distillationId,
      albumId: validatedData.albumId,
      knowledgeBaseId: validatedData.knowledgeBaseId,
      articleSettingId: validatedData.articleSettingId,
      conversionTargetId: validatedData.conversionTargetId,
      articleCount: validatedData.articleCount
    });

    // 获取任务详情（包含selected_distillation_ids）
    const taskResult = await pool.query(
      'SELECT id, status, created_at, selected_distillation_ids FROM generation_tasks WHERE id = $1',
      [taskId]
    );
    
    const task = taskResult.rows[0];
    let selectedDistillationIds: number[] = [];
    
    // 解析selected_distillation_ids（需求 13.1）
    if (task.selected_distillation_ids) {
      try {
        selectedDistillationIds = JSON.parse(task.selected_distillation_ids);
      } catch (error) {
        console.error('解析selected_distillation_ids失败:', error);
      }
    }

    res.json({
      taskId: task.id,
      status: task.status,
      selectedDistillationIds, // 新增字段
      createdAt: task.created_at
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '数据验证失败', details: error.errors });
    }
    console.error('创建任务错误:', error);
    res.status(500).json({ error: '创建任务失败', details: error.message });
  }
});

/**
 * 获取任务列表
 * GET /api/article-generation/tasks?page=1&pageSize=10
 */
articleGenerationRouter.get('/tasks', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: '无效的分页参数' });
    }

    const result = await service.getTasks(page, pageSize);

    res.json({
      tasks: result.tasks,
      total: result.total,
      page,
      pageSize
    });
  } catch (error: any) {
    console.error('获取任务列表错误:', error);
    res.status(500).json({ error: '获取任务列表失败', details: error.message });
  }
});

/**
 * 获取任务详情
 * GET /api/article-generation/tasks/:id
 */
articleGenerationRouter.get('/tasks/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);

    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({ error: '无效的任务ID' });
    }

    const task = await service.getTaskDetail(taskId);

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    // 获取该任务生成的文章列表
    const articlesResult = await pool.query(
      `SELECT id, title, keyword, image_url, created_at 
       FROM articles 
       WHERE task_id = $1 
       ORDER BY created_at DESC`,
      [taskId]
    );

    // 获取selected_distillation_ids对应的蒸馏结果（需求 8.1, 8.2, 13.2）
    let selectedDistillations: Array<{ id: number; keyword: string }> = [];
    
    const taskDetailResult = await pool.query(
      'SELECT selected_distillation_ids FROM generation_tasks WHERE id = $1',
      [taskId]
    );
    
    const selectedIdsJson = taskDetailResult.rows[0]?.selected_distillation_ids;
    
    if (selectedIdsJson) {
      try {
        const selectedIds: number[] = JSON.parse(selectedIdsJson);
        
        if (selectedIds.length > 0) {
          // 批量查询蒸馏结果信息
          const distillationsResult = await pool.query(
            'SELECT id, keyword FROM distillations WHERE id = ANY($1)',
            [selectedIds]
          );
          
          // 按使用顺序排列（需求 8.2）
          const distillationsMap = new Map(
            distillationsResult.rows.map(row => [row.id, row.keyword])
          );
          
          selectedDistillations = selectedIds.map(id => ({
            id,
            keyword: distillationsMap.get(id) || '已删除' // 处理已删除的蒸馏结果（需求 8.3）
          }));
        }
      } catch (error) {
        console.error('解析selected_distillation_ids失败:', error);
      }
    }

    res.json({
      ...task,
      selectedDistillations, // 新增字段
      generatedArticles: articlesResult.rows.map(row => ({
        id: row.id,
        title: row.title,
        keyword: row.keyword,
        imageUrl: row.image_url,
        createdAt: row.created_at
      }))
    });
  } catch (error: any) {
    console.error('获取任务详情错误:', error);
    res.status(500).json({ error: '获取任务详情失败', details: error.message });
  }
});

/**
 * 诊断任务
 * GET /api/article-generation/tasks/:id/diagnose
 */
articleGenerationRouter.get('/tasks/:id/diagnose', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);

    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({ error: '无效的任务ID' });
    }

    const report = await service.diagnoseTask(taskId);

    res.json(report);
  } catch (error: any) {
    console.error('诊断任务错误:', error);
    res.status(500).json({ error: '诊断任务失败', details: error.message });
  }
});

/**
 * 重试任务
 * POST /api/article-generation/tasks/:id/retry
 */
articleGenerationRouter.post('/tasks/:id/retry', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);

    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({ error: '无效的任务ID' });
    }

    // 检查任务是否存在
    const task = await service.getTaskDetail(taskId);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    // 只允许重试失败或已完成的任务
    if (task.status === 'running') {
      return res.status(400).json({ error: '任务正在运行中，无法重试' });
    }

    if (task.status === 'pending') {
      return res.status(400).json({ error: '任务尚未执行，无需重试' });
    }

    await service.retryTask(taskId);

    res.json({
      success: true,
      message: '任务已重新启动',
      taskId
    });
  } catch (error: any) {
    console.error('重试任务错误:', error);
    res.status(500).json({ error: '重试任务失败', details: error.message });
  }
});

/**
 * 删除单个任务
 * DELETE /api/article-generation/tasks/:id
 */
articleGenerationRouter.delete('/tasks/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);

    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({ error: '无效的任务ID' });
    }

    // 检查任务是否存在
    const task = await service.getTaskDetail(taskId);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    // 不允许删除正在运行的任务
    if (task.status === 'running') {
      return res.status(400).json({ error: '无法删除正在运行的任务，请等待任务完成或失败后再删除' });
    }

    // 删除任务（会级联删除关联的文章）
    await pool.query('DELETE FROM generation_tasks WHERE id = $1', [taskId]);

    res.json({
      success: true,
      message: '任务已删除',
      taskId
    });
  } catch (error: any) {
    console.error('删除任务错误:', error);
    res.status(500).json({ error: '删除任务失败', details: error.message });
  }
});

/**
 * 批量删除任务
 * POST /api/article-generation/tasks/batch-delete
 */
articleGenerationRouter.post('/tasks/batch-delete', async (req, res) => {
  try {
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: '请提供要删除的任务ID列表' });
    }

    // 验证所有ID都是有效的正整数
    const validIds = taskIds.filter(id => Number.isInteger(id) && id > 0);
    if (validIds.length === 0) {
      return res.status(400).json({ error: '没有有效的任务ID' });
    }

    // 检查是否有正在运行的任务
    const runningTasksResult = await pool.query(
      'SELECT id FROM generation_tasks WHERE id = ANY($1) AND status = $2',
      [validIds, 'running']
    );

    if (runningTasksResult.rows.length > 0) {
      const runningIds = runningTasksResult.rows.map(row => row.id);
      return res.status(400).json({ 
        error: '无法删除正在运行的任务', 
        runningTaskIds: runningIds,
        message: `任务 ${runningIds.join(', ')} 正在运行中，请等待完成后再删除`
      });
    }

    // 批量删除任务
    const result = await pool.query(
      'DELETE FROM generation_tasks WHERE id = ANY($1) RETURNING id',
      [validIds]
    );

    const deletedCount = result.rows.length;
    const deletedIds = result.rows.map(row => row.id);

    res.json({
      success: true,
      message: `成功删除 ${deletedCount} 个任务`,
      deletedCount,
      deletedIds,
      requestedCount: validIds.length
    });
  } catch (error: any) {
    console.error('批量删除任务错误:', error);
    res.status(500).json({ error: '批量删除任务失败', details: error.message });
  }
});

/**
 * 删除所有任务（除了正在运行的）
 * DELETE /api/article-generation/tasks
 */
articleGenerationRouter.delete('/tasks', async (req, res) => {
  try {
    // 检查是否有正在运行的任务
    const runningTasksResult = await pool.query(
      'SELECT id FROM generation_tasks WHERE status = $1',
      ['running']
    );

    if (runningTasksResult.rows.length > 0) {
      const runningIds = runningTasksResult.rows.map(row => row.id);
      return res.status(400).json({ 
        error: '存在正在运行的任务', 
        runningTaskIds: runningIds,
        message: `任务 ${runningIds.join(', ')} 正在运行中，无法删除所有任务`
      });
    }

    // 删除所有非运行中的任务
    const result = await pool.query(
      'DELETE FROM generation_tasks WHERE status != $1 RETURNING id',
      ['running']
    );

    const deletedCount = result.rows.length;

    res.json({
      success: true,
      message: `成功删除 ${deletedCount} 个任务`,
      deletedCount
    });
  } catch (error: any) {
    console.error('删除所有任务错误:', error);
    res.status(500).json({ error: '删除所有任务失败', details: error.message });
  }
});
