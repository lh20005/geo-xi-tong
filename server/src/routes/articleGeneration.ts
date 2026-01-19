import { Router } from 'express';
import { z } from 'zod';
import { ArticleGenerationService } from '../services/articleGenerationService';
import { articleGenerationCacheService } from '../services/ArticleGenerationCacheService';
import { pool } from '../db/database';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';
import { usageTrackingService } from '../services/UsageTrackingService';

export const articleGenerationRouter = Router();

// 所有路由都需要认证和租户
articleGenerationRouter.use(authenticate);
articleGenerationRouter.use(setTenantContext);
articleGenerationRouter.use(requireTenantContext);

const service = new ArticleGenerationService();

// Zod验证schemas
// 支持数字ID（Web端/服务器数据库）和UUID字符串（Windows端本地SQLite）
const createTaskSchema = z.object({
  distillationId: z.number().int().positive('蒸馏历史ID必须是正整数'),
  albumId: z.union([
    z.number().int().positive('图库ID必须是正整数'),
    z.string().uuid('图库ID必须是有效的UUID')
  ]),
  knowledgeBaseId: z.union([
    z.number().int().positive('知识库ID必须是正整数'),
    z.string().uuid('知识库ID必须是有效的UUID')
  ]),
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
    
    // 添加详细日志
    console.log('🔍 服务器收到的原始数据:', JSON.stringify(req.body, null, 2));
    console.log('🔍 各字段类型:', {
      distillationId: typeof req.body.distillationId,
      albumId: typeof req.body.albumId,
      knowledgeBaseId: typeof req.body.knowledgeBaseId,
      articleSettingId: typeof req.body.articleSettingId,
      conversionTargetId: typeof req.body.conversionTargetId,
      articleCount: typeof req.body.articleCount
    });
    
    const validatedData = createTaskSchema.parse(req.body);

    // ========== 配额检查 ==========
    // 检查用户是否有足够的文章生成配额
    const quota = await usageTrackingService.checkQuota(userId, 'articles_per_month');
    
    if (!quota.hasQuota || quota.remaining < validatedData.articleCount) {
      return res.status(403).json({ 
        error: '文章生成配额不足',
        message: `您今日的文章生成配额不足。需要 ${validatedData.articleCount} 篇，剩余 ${quota.remaining} 篇`,
        quota: {
          required: validatedData.articleCount,
          remaining: quota.remaining,
          total: quota.quotaLimit,
          resetTime: '明天 00:00'
        }
      });
    }

    // 验证引用的资源是否存在
    const distillationCheck = await pool.query(
      'SELECT id FROM distillations WHERE id = $1 AND user_id = $2',
      [validatedData.distillationId, userId]
    );
    if (distillationCheck.rows.length === 0) {
      return res.status(404).json({ error: '蒸馏历史不存在' });
    }

    // 如果 albumId 是数字，验证服务器数据库中是否存在
    // 如果是 UUID，说明来自 Windows 端本地数据，跳过验证
    if (typeof validatedData.albumId === 'number') {
      const albumCheck = await pool.query(
        'SELECT id FROM albums WHERE id = $1 AND user_id = $2',
        [validatedData.albumId, userId]
      );
      if (albumCheck.rows.length === 0) {
        return res.status(404).json({ error: '图库不存在' });
      }
    }

    // 如果 knowledgeBaseId 是数字，验证服务器数据库中是否存在
    // 如果是 UUID，说明来自 Windows 端本地数据，跳过验证
    if (typeof validatedData.knowledgeBaseId === 'number') {
      const knowledgeBaseCheck = await pool.query(
        'SELECT id FROM knowledge_bases WHERE id = $1 AND user_id = $2',
        [validatedData.knowledgeBaseId, userId]
      );
      if (knowledgeBaseCheck.rows.length === 0) {
        return res.status(404).json({ error: '知识库不存在' });
      }
    }

    const articleSettingCheck = await pool.query(
      'SELECT id FROM article_settings WHERE id = $1 AND user_id = $2',
      [validatedData.articleSettingId, userId]
    );
    if (articleSettingCheck.rows.length === 0) {
      return res.status(404).json({ error: '文章设置不存在' });
    }

    // 验证转化目标是否存在（如果提供了）
    if (validatedData.conversionTargetId) {
      const conversionTargetCheck = await pool.query(
        'SELECT id FROM conversion_targets WHERE id = $1 AND user_id = $2',
        [validatedData.conversionTargetId, userId]
      );
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
      articleCount: validatedData.articleCount,
      userId
    });

    // 获取任务详情（包含selected_distillation_ids）
    const taskResult = await pool.query(
      'SELECT id, status, created_at, selected_distillation_ids FROM generation_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
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
    const userId = getCurrentTenantId(req);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: '无效的分页参数' });
    }

    const result = await service.getTasks(page, pageSize, userId);

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
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);

    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({ error: '无效的任务ID' });
    }

    const task = await service.getTaskDetail(taskId, userId);

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    // 获取该任务生成的文章列表
    const articlesResult = await pool.query(
      `SELECT id, title, keyword, image_url, created_at 
       FROM articles 
       WHERE task_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [taskId, userId]
    );

    // 获取selected_distillation_ids对应的蒸馏结果（需求 8.1, 8.2, 13.2）
    let selectedDistillations: Array<{ id: number; keyword: string }> = [];
    
    const taskDetailResult = await pool.query(
      'SELECT selected_distillation_ids FROM generation_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );
    
    const selectedIdsJson = taskDetailResult.rows[0]?.selected_distillation_ids;
    
    if (selectedIdsJson) {
      try {
        const selectedIds: number[] = JSON.parse(selectedIdsJson);
        
        if (selectedIds.length > 0) {
          // 批量查询蒸馏结果信息，优先使用任务表的快照字段
          const distillationsResult = await pool.query(
            'SELECT id, keyword FROM distillations WHERE id = ANY($1) AND user_id = $2',
            [selectedIds, userId]
          );
          
          // 同时查询任务的快照字段
          const taskSnapshotResult = await pool.query(
            'SELECT distillation_keyword FROM generation_tasks WHERE id = $1 AND user_id = $2',
            [taskId, userId]
          );
          const snapshotKeyword = taskSnapshotResult.rows[0]?.distillation_keyword;
          
          // 按使用顺序排列（需求 8.2）
          const distillationsMap = new Map(
            distillationsResult.rows.map(row => [row.id, row.keyword])
          );
          
          selectedDistillations = selectedIds.map(id => ({
            id,
            // 优先使用蒸馏表的关键词，如果不存在则使用快照，最后显示"已删除"
            keyword: distillationsMap.get(id) || snapshotKeyword || '已删除'
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
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);

    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({ error: '无效的任务ID' });
    }

    // 先检查任务是否属于当前用户
    const task = await service.getTaskDetail(taskId, userId);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
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
    const task = await service.getTaskDetail(taskId, userId);
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
    const task = await service.getTaskDetail(taskId, userId);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    // 只能终止运行中或待处理的任务
    if (task.status !== 'running' && task.status !== 'pending') {
      return res.status(400).json({ error: `任务状态为 ${task.status}，无法终止` });
    }

    // 将任务标记为失败
    await service.updateTaskStatus(taskId, 'failed', task.generatedCount, '任务已被用户终止', userId);

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
    const task = await service.getTaskDetail(taskId, userId);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    // 如果任务正在运行，需要先终止
    if (task.status === 'running' && force !== 'true') {
      // 先终止任务
      await service.updateTaskStatus(taskId, 'failed', task.generatedCount, '任务已被用户终止', userId);
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

    // 检查是否有正在运行的任务（只检查属于当前用户的任务）
    const runningTasksResult = await pool.query(
      'SELECT id FROM generation_tasks WHERE id = ANY($1) AND status = $2 AND user_id = $3',
      [validIds, 'running', userId]
    );

    if (runningTasksResult.rows.length > 0) {
      const runningIds = runningTasksResult.rows.map(row => row.id);
      return res.status(400).json({ 
        error: '无法删除正在运行的任务', 
        runningTaskIds: runningIds,
        message: `任务 ${runningIds.join(', ')} 正在运行中，请等待完成后再删除`
      });
    }

    // 批量删除任务（只删除属于当前用户的任务）
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

    // 检查是否有正在运行的任务（只检查属于当前用户的任务）
    const runningTasksResult = await pool.query(
      'SELECT id FROM generation_tasks WHERE status = $1 AND user_id = $2',
      ['running', userId]
    );

    if (runningTasksResult.rows.length > 0) {
      const runningIds = runningTasksResult.rows.map(row => row.id);
      return res.status(400).json({ 
        error: '存在正在运行的任务', 
        runningTaskIds: runningIds,
        message: `任务 ${runningIds.join(', ')} 正在运行中，无法删除所有任务`
      });
    }

    // 删除所有非运行中的任务（只删除属于当前用户的任务）
    const result = await pool.query(
      'DELETE FROM generation_tasks WHERE status != $1 AND user_id = $2 RETURNING id',
      ['running', userId]
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

// ==================== AI 生成确认机制 ====================
// 用于解决 AI 生成文章后网络中断导致用户丢失已生成文章的问题

/**
 * 确认收到生成结果
 * POST /api/article-generation/confirm
 * 
 * 客户端确认已成功保存文章后调用，删除服务器缓存
 */
articleGenerationRouter.post('/confirm', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { generationId } = req.body;

    if (!generationId || typeof generationId !== 'string') {
      return res.status(400).json({ 
        success: false,
        error: 'INVALID_GENERATION_ID',
        message: '缺少有效的 generationId' 
      });
    }

    const success = await articleGenerationCacheService.confirmReceived(generationId, userId);

    if (success) {
      res.json({
        success: true,
        message: '确认成功'
      });
    } else {
      res.status(403).json({
        success: false,
        error: 'CONFIRM_FAILED',
        message: '确认失败，可能是权限不足或 generationId 无效'
      });
    }
  } catch (error: any) {
    console.error('确认生成结果错误:', error);
    res.status(500).json({ 
      success: false,
      error: 'INTERNAL_ERROR',
      message: '确认失败',
      details: error.message 
    });
  }
});

/**
 * 重新获取生成结果
 * GET /api/article-generation/retrieve/:generationId
 * 
 * 用于网络恢复后重新获取之前生成的文章
 */
articleGenerationRouter.get('/retrieve/:generationId', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { generationId } = req.params;

    if (!generationId || typeof generationId !== 'string') {
      return res.status(400).json({ 
        success: false,
        error: 'INVALID_GENERATION_ID',
        message: '缺少有效的 generationId' 
      });
    }

    const article = await articleGenerationCacheService.retrieveGeneration(generationId, userId);

    if (article) {
      // 获取剩余过期时间
      const ttl = await articleGenerationCacheService.getTTL(generationId);
      const expiresAt = ttl > 0 
        ? new Date(Date.now() + ttl * 1000).toISOString()
        : null;

      res.json({
        success: true,
        article,
        expiresAt
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'GENERATION_EXPIRED',
        message: '生成结果已过期或不存在'
      });
    }
  } catch (error: any) {
    console.error('获取生成结果错误:', error);
    res.status(500).json({ 
      success: false,
      error: 'INTERNAL_ERROR',
      message: '获取失败',
      details: error.message 
    });
  }
});

/**
 * 获取用户未确认的生成结果列表
 * GET /api/article-generation/pending
 * 
 * 用于客户端启动时检查是否有未确认的生成结果
 */
articleGenerationRouter.get('/pending', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);

    const pendingGenerations = await articleGenerationCacheService.getUserPendingGenerations(userId);

    res.json({
      success: true,
      count: pendingGenerations.length,
      generations: pendingGenerations
    });
  } catch (error: any) {
    console.error('获取未确认生成结果错误:', error);
    res.status(500).json({ 
      success: false,
      error: 'INTERNAL_ERROR',
      message: '获取失败',
      details: error.message 
    });
  }
});

// ==================== 辅助数据接口 ====================
// 为文章生成任务配置提供必要的数据

/**
 * 获取相册列表
 * GET /api/article-generation/albums
 */
articleGenerationRouter.get('/albums', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    
    const result = await pool.query(
      `SELECT a.id, a.name, a.created_at,
              COUNT(i.id) as image_count,
              (SELECT url FROM images WHERE album_id = a.id ORDER BY created_at DESC LIMIT 1) as cover_image
       FROM albums a
       LEFT JOIN images i ON a.id = i.album_id
       WHERE a.user_id = $1
       GROUP BY a.id
       ORDER BY a.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('获取相册列表错误:', error);
    res.status(500).json({ error: '获取相册列表失败', details: error.message });
  }
});

/**
 * 获取知识库列表
 * GET /api/article-generation/knowledge-bases
 */
articleGenerationRouter.get('/knowledge-bases', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    
    const result = await pool.query(
      `SELECT kb.id, kb.name, kb.description, kb.created_at,
              COUNT(kd.id) as document_count
       FROM knowledge_bases kb
       LEFT JOIN knowledge_documents kd ON kb.id = kd.knowledge_base_id
       WHERE kb.user_id = $1
       GROUP BY kb.id
       ORDER BY kb.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('获取知识库列表错误:', error);
    res.status(500).json({ error: '获取知识库列表失败', details: error.message });
  }
});
