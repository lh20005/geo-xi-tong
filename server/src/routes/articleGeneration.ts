import { Router } from 'express';
import { z } from 'zod';
import { ArticleGenerationService } from '../services/articleGenerationService';
import { pool } from '../db/database';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

export const articleGenerationRouter = Router();

// 所有路由都需要认证和租户上下文
articleGenerationRouter.use(authenticate);
articleGenerationRouter.use(setTenantContext);
articleGenerationRouter.use(requireTenantContext);

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
    const userId = getCurrentTenantId(req);
    const validatedData = createTaskSchema.parse(req.body);

    // 验证引用的资源是否存在且属于当前用户
    const distillationCheck = await pool.query(
      'SELECT id FROM distillations WHERE id = $1 AND user_id = $2',
      [validatedData.distillationId, userId]
    );
    if (distillationCheck.rows.length === 0) {
      return res.status(404).json({ error: '蒸馏历史不存在或无权访问' });
    }

    const albumCheck = await pool.query(
      'SELECT id FROM albums WHERE id = $1 AND user_id = $2',
      [validatedData.albumId, userId]
    );
    if (albumCheck.rows.length === 0) {
      return res.status(404).json({ error: '图库不存在或无权访问' });
    }

    const knowledgeBaseCheck = await pool.query(
      'SELECT id FROM knowledge_bases WHERE id = $1 AND user_id = $2',
      [validatedData.knowledgeBaseId, userId]
    );
    if (knowledgeBaseCheck.rows.length === 0) {
      return res.status(404).json({ error: '知识库不存在或无权访问' });
    }

    const articleSettingCheck = await pool.query(
      'SELECT id FROM article_settings WHERE id = $1 AND user_id = $2',
      [validatedData.articleSettingId, userId]
    );
    if (articleSettingCheck.rows.length === 0) {
      return res.status(404).json({ error: '文章设置不存在或无权访问' });
    }

    // 验证转化目标是否存在且属于当前用户（如果提供了）
    if (validatedData.conversionTargetId) {
      const conversionTargetCheck = await pool.query(
        'SELECT id FROM conversion_targets WHERE id = $1 AND user_id = $2',
        [validatedData.conversionTargetId, userId]
      );
      if (conversionTargetCheck.rows.length === 0) {
        return res.status(404).json({ error: '转化目标不存在或无权访问' });
      }
    }

    // 创建任务（关联到当前用户）
    const taskId = await service.createTask({
      distillationId: validatedData.distillationId,
      albumId: validatedData.albumId,
      knowledgeBaseId: validatedData.knowledgeBaseId,
      articleSettingId: validatedData.articleSettingId,
      conversionTargetId: validatedData.conversionTargetId,
      articleCount: validatedData.articleCount,
      userId // 传递用户ID给服务层
    });

    // 获取任务详情（包含selected_distillation_ids）
    const taskResult = await pool.query(
      'SELECT id, status, created_at, selected_distillation_ids FROM generation_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );
    
    const task = taskResult.rows[0];
    let selectedDistillationIds: number[] = [];
    
    // 解析selected_distillation_ids
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
      selectedDistillationIds,
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
    const userId = getCurrentTenantId(req);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: '无效的分页参数' });
    }

    // 直接查询数据库，只获取当前用户的任务
    const offset = (page - 1) * pageSize;
    
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM generation_tasks WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].total);

    const tasksResult = await pool.query(
      `SELECT id, status, distillation_id, album_id, knowledge_base_id, 
              article_setting_id, conversion_target_id, requested_count,
              generated_count, created_at, updated_at
       FROM generation_tasks
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset]
    );

    res.json({
      tasks: tasksResult.rows,
      total,
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
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);

    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({ error: '无效的任务ID' });
    }

    // 查询任务（验证所有权）
    const taskResult = await pool.query(
      `SELECT id, status, distillation_id, album_id, knowledge_base_id,
              article_setting_id, conversion_target_id, requested_count,
              generated_count, error_message, created_at, updated_at,
              selected_distillation_ids
       FROM generation_tasks
       WHERE id = $1 AND user_id = $2`,
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: '任务不存在或无权访问' });
    }

    const task = taskResult.rows[0];

    // 获取该任务生成的文章列表（验证文章也属于当前用户）
    const articlesResult = await pool.query(
      `SELECT id, title, keyword, image_url, created_at 
       FROM articles 
       WHERE task_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [taskId, userId]
    );

    // 获取selected_distillation_ids对应的蒸馏结果
    let selectedDistillations: Array<{ id: number; keyword: string }> = [];
    
    if (task.selected_distillation_ids) {
      try {
        const selectedIds: number[] = JSON.parse(task.selected_distillation_ids);
        
        if (selectedIds.length > 0) {
          // 批量查询蒸馏结果信息（只查询属于当前用户的）
          const distillationsResult = await pool.query(
            'SELECT id, keyword FROM distillations WHERE id = ANY($1) AND user_id = $2',
            [selectedIds, userId]
          );
          
          // 按使用顺序排列
          const distillationsMap = new Map(
            distillationsResult.rows.map(row => [row.id, row.keyword])
          );
          
          selectedDistillations = selectedIds.map(id => ({
            id,
            keyword: distillationsMap.get(id) || '已删除'
          }));
        }
      } catch (error) {
        console.error('解析selected_distillation_ids失败:', error);
      }
    }

    res.json({
      ...task,
      selectedDistillations,
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
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);

    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({ error: '无效的任务ID' });
    }

    // 验证任务所有权
    const taskCheck = await pool.query(
      'SELECT id FROM generation_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: '任务不存在或无权访问' });
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
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);

    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({ error: '无效的任务ID' });
    }

    // 检查任务是否存在且属于当前用户
    const taskResult = await pool.query(
      'SELECT status FROM generation_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: '任务不存在或无权访问' });
    }

    const task = taskResult.rows[0];

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
 * 终止正在运行的任务
 * POST /api/article-generation/tasks/:id/cancel
 */
articleGenerationRouter.post('/tasks/:id/cancel', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);

    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({ error: '无效的任务ID' });
    }

    // 检查任务是否存在且属于当前用户
    const taskResult = await pool.query(
      'SELECT status, generated_count FROM generation_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: '任务不存在或无权访问' });
    }

    const task = taskResult.rows[0];

    // 只能终止运行中或待处理的任务
    if (task.status !== 'running' && task.status !== 'pending') {
      return res.status(400).json({ error: `任务状态为 ${task.status}，无法终止` });
    }

    // 将任务标记为失败
    await service.updateTaskStatus(taskId, 'failed', task.generated_count, '任务已被用户终止');

    res.json({
      success: true,
      message: '任务已终止',
      taskId
    });
  } catch (error: any) {
    console.error('终止任务错误:', error);
    res.status(500).json({ error: '终止任务失败', details: error.message });
  }
});

/**
 * 删除单个任务（包括运行中的任务）
 * DELETE /api/article-generation/tasks/:id
 */
articleGenerationRouter.delete('/tasks/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);
    const { force } = req.query; // 支持强制删除

    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({ error: '无效的任务ID' });
    }

    // 检查任务是否存在且属于当前用户
    const taskResult = await pool.query(
      'SELECT status, generated_count FROM generation_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: '任务不存在或无权访问' });
    }

    const task = taskResult.rows[0];

    // 如果任务正在运行，需要先终止
    if (task.status === 'running' && force !== 'true') {
      // 先终止任务
      await service.updateTaskStatus(taskId, 'failed', task.generated_count, '任务已被用户终止');
    }

    // 删除任务（会级联删除关联的文章）
    await pool.query('DELETE FROM generation_tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);

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
    const userId = getCurrentTenantId(req);
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: '请提供要删除的任务ID列表' });
    }

    // 验证所有ID都是有效的正整数
    const validIds = taskIds.filter(id => Number.isInteger(id) && id > 0);
    if (validIds.length === 0) {
      return res.status(400).json({ error: '没有有效的任务ID' });
    }

    // 检查是否有正在运行的任务（只检查属于当前用户的）
    const runningTasksResult = await pool.query(
      'SELECT id FROM generation_tasks WHERE id = ANY($1) AND user_id = $2 AND status = $3',
      [validIds, userId, 'running']
    );

    if (runningTasksResult.rows.length > 0) {
      const runningIds = runningTasksResult.rows.map(row => row.id);
      return res.status(400).json({ 
        error: '无法删除正在运行的任务', 
        runningTaskIds: runningIds,
        message: `任务 ${runningIds.join(', ')} 正在运行中，请等待完成后再删除`
      });
    }

    // 批量删除任务（只删除属于当前用户的）
    const result = await pool.query(
      'DELETE FROM generation_tasks WHERE id = ANY($1) AND user_id = $2 RETURNING id',
      [validIds, userId]
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
    const userId = getCurrentTenantId(req);

    // 检查是否有正在运行的任务（只检查当前用户的）
    const runningTasksResult = await pool.query(
      'SELECT id FROM generation_tasks WHERE user_id = $1 AND status = $2',
      [userId, 'running']
    );

    if (runningTasksResult.rows.length > 0) {
      const runningIds = runningTasksResult.rows.map(row => row.id);
      return res.status(400).json({ 
        error: '存在正在运行的任务', 
        runningTaskIds: runningIds,
        message: `任务 ${runningIds.join(', ')} 正在运行中，无法删除所有任务`
      });
    }

    // 删除所有非运行中的任务（只删除当前用户的）
    const result = await pool.query(
      'DELETE FROM generation_tasks WHERE user_id = $1 AND status != $2 RETURNING id',
      [userId, 'running']
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
