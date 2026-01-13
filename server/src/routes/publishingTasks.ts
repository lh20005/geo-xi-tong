import express from 'express';
import { publishingService } from '../services/PublishingService';
import { pool } from '../db/database';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

const router = express.Router();

// 应用认证和租户中间件
router.use(authenticate);
router.use(setTenantContext);
router.use(requireTenantContext);

/**
 * 创建发布任务
 */
router.post('/tasks', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { 
      article_id, 
      account_id, 
      platform_id, 
      config, 
      scheduled_at, 
      scheduled_time,
      batch_id,
      batch_order,
      interval_minutes
    } = req.body;

    // 调试日志：记录收到的参数
    console.log(`📝 创建发布任务请求: article_id=${article_id}, account_id=${account_id}, platform_id=${platform_id}, batch_id=${batch_id}, batch_order=${batch_order}`);

    // 严格验证必需参数（使用更严格的检查）
    if (article_id === undefined || article_id === null || article_id === '') {
      console.error(`❌ 创建任务失败: article_id 无效 (${article_id})`);
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: article_id'
      });
    }
    
    if (account_id === undefined || account_id === null || account_id === '') {
      console.error(`❌ 创建任务失败: account_id 无效 (${account_id})`);
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: account_id'
      });
    }
    
    if (!platform_id) {
      console.error(`❌ 创建任务失败: platform_id 无效 (${platform_id})`);
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: platform_id'
      });
    }

    // ========== 配额检查 ==========
    // 检查用户是否有足够的发布配额
    const { usageTrackingService } = await import('../services/UsageTrackingService');
    const quota = await usageTrackingService.checkQuota(userId, 'publish_per_month');
    
    if (!quota.hasQuota || quota.remaining < 1) {
      return res.status(403).json({ 
        success: false,
        error: '发布配额不足',
        message: `您今日的发布配额已用完。剩余 ${quota.remaining} 次`,
        quota: {
          remaining: quota.remaining,
          total: quota.quotaLimit,
          resetTime: '明天 00:00'
        }
      });
    }

    // 验证文章所有权
    const articleCheck = await pool.query(
      'SELECT id FROM articles WHERE id = $1 AND user_id = $2',
      [article_id, userId]
    );
    if (articleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '文章不存在或无权访问'
      });
    }

    // 验证账号所有权
    const accountCheck = await pool.query(
      'SELECT id FROM platform_accounts WHERE id = $1 AND user_id = $2',
      [account_id, userId]
    );
    if (accountCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '平台账号不存在或无权访问'
      });
    }

    // 兼容前端的 scheduled_time 和 scheduled_at 两种参数名
    const scheduledTime = scheduled_time || scheduled_at;

    // 调试日志：记录传递给 createTask 的参数
    console.log(`📝 调用 createTask: article_id=${article_id} (type: ${typeof article_id}), account_id=${account_id}, platform_id=${platform_id}`);

    const task = await publishingService.createTask({
      article_id,
      account_id,
      platform_id,
      user_id: userId,
      config: config || {},
      scheduled_at: scheduledTime ? new Date(scheduledTime) : undefined,
      batch_id,
      batch_order,
      interval_minutes
    });

    // 调试日志：记录创建的任务
    console.log(`✅ 任务已创建: task.id=${task.id}, task.article_id=${task.article_id}`);


    // ========== 记录配额使用 ==========
    await usageTrackingService.recordUsage(
      userId,
      'publish_per_month',
      'publish',
      task.id,
      1
    );

    // 标记文章为"发布中"状态（在文章列表中暂时隐藏）
    await pool.query(
      `UPDATE articles 
       SET publishing_status = 'pending' 
       WHERE id = $1 AND user_id = $2`,
      [article_id, userId]
    );
    console.log(`✅ 文章 #${article_id} 已标记为发布中（publishing_status = 'pending'）`);

    // 如果有 batch_id，说明是批次任务，由批次执行器处理
    if (batch_id) {
      console.log(`✅ 批次任务 #${task.id} 已创建 (批次: ${batch_id}, 顺序: ${batch_order})`);
      
      // 注意：不再在这里触发批次执行
      // 批次执行由前端在所有任务创建完成后调用 /batches/:batchId/start 触发
      // 或者由 TaskScheduler 定时检查并执行
    } else if (!scheduledTime) {
      // 普通立即发布任务
      const { publishingExecutor } = require('../services/PublishingExecutor');
      
      // 异步执行任务，不阻塞响应
      publishingExecutor.executeTask(task.id).catch((error: any) => {
        console.error(`任务 #${task.id} 自动执行失败:`, error);
      });
      
      console.log(`✅ 任务 #${task.id} 已创建并开始自动执行`);
    } else {
      console.log(`✅ 任务 #${task.id} 已创建，将在 ${scheduledTime} 执行`);
    }

    res.json({
      success: true,
      data: task,
      message: batch_id 
        ? '批次发布任务创建成功' 
        : (scheduledTime ? '定时发布任务创建成功' : '发布任务创建成功，正在后台执行')
    });
  } catch (error: any) {
    console.error('创建发布任务失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '创建发布任务失败'
    });
  }
});

/**
 * 获取任务列表
 */
router.get('/tasks', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { status, platform_id, article_id, page, pageSize } = req.query;

    // 构建查询条件，添加 user_id 过滤
    const conditions: string[] = ['pt.user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`pt.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (platform_id) {
      conditions.push(`pt.platform_id = $${paramIndex}`);
      params.push(platform_id);
      paramIndex++;
    }

    if (article_id) {
      conditions.push(`pt.article_id = $${paramIndex}`);
      params.push(parseInt(article_id as string));
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM publishing_tasks pt ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取数据
    const currentPage = page ? parseInt(page as string) : 1;
    const currentPageSize = pageSize ? parseInt(pageSize as string) : 20;
    const offset = (currentPage - 1) * currentPageSize;
    
    const dataResult = await pool.query(
      `SELECT 
        pt.*,
        pa.account_name,
        pa.credentials
       FROM publishing_tasks pt
       LEFT JOIN platform_accounts pa ON pt.account_id = pa.id
       ${whereClause} 
       ORDER BY pt.created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, currentPageSize, offset]
    );

    res.json({
      success: true,
      data: {
        tasks: dataResult.rows,
        total
      }
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取任务列表失败'
    });
  }
});

/**
 * 获取任务详情
 */
router.get('/tasks/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);
    
    // 验证任务所有权
    const result = await pool.query(
      'SELECT * FROM publishing_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在或无权访问'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('获取任务详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取任务详情失败'
    });
  }
});

/**
 * 获取任务日志
 */
router.get('/tasks/:id/logs', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);
    
    // 验证任务所有权
    const taskCheck = await pool.query(
      'SELECT id FROM publishing_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );
    
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在或无权访问'
      });
    }

    const logs = await publishingService.getTaskLogs(taskId);

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取任务日志失败:', error);
    res.status(500).json({
      success: false,
      message: '获取任务日志失败'
    });
  }
});

/**
 * 取消任务
 */
router.post('/tasks/:id/cancel', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);
    
    // 验证任务所有权
    const taskCheck = await pool.query(
      'SELECT id FROM publishing_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );
    
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在或无权访问'
      });
    }

    await publishingService.cancelTask(taskId);

    res.json({
      success: true,
      message: '任务已取消'
    });
  } catch (error) {
    console.error('取消任务失败:', error);
    res.status(500).json({
      success: false,
      message: '取消任务失败'
    });
  }
});

/**
 * 重新发布（创建新任务）
 */
router.post('/tasks/:id/retry', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);
    
    // 验证任务所有权
    const taskResult = await pool.query(
      'SELECT * FROM publishing_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '原任务不存在或无权访问'
      });
    }

    const originalTask = taskResult.rows[0];

    // 创建新任务
    const newTask = await publishingService.createTask({
      article_id: originalTask.article_id,
      account_id: originalTask.account_id,
      platform_id: originalTask.platform_id,
      user_id: userId,
      config: req.body.config || originalTask.config,
      scheduled_at: req.body.scheduled_at ? new Date(req.body.scheduled_at) : undefined
    });

    // 如果是立即发布，自动触发执行
    if (!req.body.scheduled_at) {
      const { publishingExecutor } = require('../services/PublishingExecutor');
      
      publishingExecutor.executeTask(newTask.id).catch((error: any) => {
        console.error(`重试任务 #${newTask.id} 执行失败:`, error);
      });
      
      console.log(`✅ 重试任务 #${newTask.id} 已创建并开始执行`);
    }

    res.json({
      success: true,
      data: newTask,
      message: '重新发布任务已创建'
    });
  } catch (error: any) {
    console.error('重新发布失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '重新发布失败'
    });
  }
});

/**
 * 立即执行任务
 */
router.post('/tasks/:id/execute', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);
    
    // 验证任务所有权
    const taskResult = await pool.query(
      'SELECT * FROM publishing_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在或无权访问'
      });
    }

    const task = taskResult.rows[0];

    if (task.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: '只能执行待处理状态的任务'
      });
    }

    // 异步执行任务
    const { publishingExecutor } = require('../services/PublishingExecutor');
    publishingExecutor.executeTask(taskId).catch((error: any) => {
      console.error(`任务 #${taskId} 执行失败:`, error);
    });

    res.json({
      success: true,
      message: '任务已开始执行'
    });
  } catch (error) {
    console.error('执行任务失败:', error);
    res.status(500).json({
      success: false,
      message: '执行任务失败'
    });
  }
});

/**
 * 终止任务（强制停止执行中的任务）
 */
router.post('/tasks/:id/terminate', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);
    
    // 验证任务所有权
    const taskResult = await pool.query(
      'SELECT * FROM publishing_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在或无权访问'
      });
    }

    // 更新任务状态为失败，并记录终止信息
    await publishingService.updateTaskStatus(taskId, 'failed', '任务已被用户终止');
    
    // 记录日志
    await publishingService.addTaskLog(taskId, 'warning', '任务已被用户手动终止');

    res.json({
      success: true,
      message: '任务已终止'
    });
  } catch (error) {
    console.error('终止任务失败:', error);
    res.status(500).json({
      success: false,
      message: '终止任务失败'
    });
  }
});

/**
 * 删除单个任务
 */
router.delete('/tasks/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const taskId = parseInt(req.params.id);
    
    // 验证任务所有权
    const taskResult = await pool.query(
      'SELECT * FROM publishing_tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在或无权访问'
      });
    }

    const task = taskResult.rows[0];

    // 如果任务正在执行，先终止
    if (task.status === 'running') {
      await publishingService.updateTaskStatus(taskId, 'failed', '任务已被删除');
    }

    // 删除任务（包括相关日志）
    await publishingService.deleteTask(taskId);

    res.json({
      success: true,
      message: '任务已删除'
    });
  } catch (error) {
    console.error('删除任务失败:', error);
    res.status(500).json({
      success: false,
      message: '删除任务失败'
    });
  }
});

/**
 * 批量删除任务
 */
router.post('/tasks/batch-delete', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要删除的任务ID列表'
      });
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const taskId of taskIds) {
      try {
        // 验证任务所有权
        const taskResult = await pool.query(
          'SELECT * FROM publishing_tasks WHERE id = $1 AND user_id = $2',
          [taskId, userId]
        );
        
        if (taskResult.rows.length > 0) {
          const task = taskResult.rows[0];
          
          // 如果任务正在执行，先终止
          if (task.status === 'running') {
            await publishingService.updateTaskStatus(taskId, 'failed', '任务已被批量删除');
          }
          
          await publishingService.deleteTask(taskId);
          successCount++;
        } else {
          failCount++;
          errors.push(`任务 #${taskId} 不存在或无权访问`);
        }
      } catch (error: any) {
        failCount++;
        errors.push(`任务 #${taskId} 删除失败: ${error.message}`);
      }
    }

    res.json({
      success: true,
      data: {
        successCount,
        failCount,
        errors
      },
      message: `成功删除 ${successCount} 个任务${failCount > 0 ? `，失败 ${failCount} 个` : ''}`
    });
  } catch (error) {
    console.error('批量删除任务失败:', error);
    res.status(500).json({
      success: false,
      message: '批量删除任务失败'
    });
  }
});

/**
 * 删除所有任务（可选择性删除特定状态的任务）
 */
router.post('/tasks/delete-all', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { status } = req.body; // 可选：只删除特定状态的任务

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const whereConditions = ['user_id = $1'];
      const params: any[] = [userId];
      
      if (status) {
        whereConditions.push('status = $2');
        params.push(status);
      }
      
      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      // 获取所有要删除的任务的文章ID
      const articlesResult = await client.query(
        `SELECT DISTINCT article_id FROM publishing_tasks ${whereClause}`,
        params
      );
      const articleIds = articlesResult.rows.map((row: any) => row.article_id);

      // 先获取要删除的任务ID
      const taskIdsResult = await client.query(
        `SELECT id FROM publishing_tasks ${whereClause}`,
        params
      );
      const taskIds = taskIdsResult.rows.map(row => row.id);

      let deletedCount = 0;

      if (taskIds.length > 0) {
        // 删除任务日志
        await client.query(
          `DELETE FROM publishing_logs WHERE task_id = ANY($1)`,
          [taskIds]
        );

        // 删除任务
        const result = await client.query(
          `DELETE FROM publishing_tasks ${whereClause}`,
          params
        );
        deletedCount = result.rowCount || 0;

        // 恢复所有相关文章的可见状态
        if (articleIds.length > 0) {
          await client.query(
            `UPDATE articles 
             SET publishing_status = NULL 
             WHERE id = ANY($1) AND user_id = $2`,
            [articleIds, userId]
          );
          
          console.log(`✅ 已恢复 ${articleIds.length} 篇文章的可见状态`);
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          deletedCount
        },
        message: `成功删除 ${deletedCount} 个任务`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('删除所有任务失败:', error);
    res.status(500).json({
      success: false,
      message: '删除所有任务失败'
    });
  }
});

/**
 * 启动批次执行
 * 在所有任务创建完成后调用此 API 来触发批次执行
 */
router.post('/batches/:batchId/start', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { batchId } = req.params;
    
    // 验证批次所有权
    const batchCheck = await pool.query(
      'SELECT id FROM publishing_tasks WHERE batch_id = $1 AND user_id = $2 LIMIT 1',
      [batchId, userId]
    );
    
    if (batchCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '批次不存在或无权访问'
      });
    }
    
    // 检查是否有用户的其他任务正在执行
    const runningTasksResult = await pool.query(
      `SELECT COUNT(*) as count FROM publishing_tasks 
       WHERE user_id = $1 AND status = 'running'`,
      [userId]
    );
    const runningCount = parseInt(runningTasksResult.rows[0].count);
    
    if (runningCount > 0) {
      // 有任务正在执行，批次会被 TaskScheduler 自动调度
      console.log(`⏳ 用户 #${userId} 有 ${runningCount} 个任务正在执行，批次 ${batchId} 将排队等待`);
      return res.json({
        success: true,
        message: `批次已创建，当前有 ${runningCount} 个任务正在执行，将在完成后自动开始`,
        queued: true
      });
    }
    
    const { batchExecutor } = require('../services/BatchExecutor');
    
    // 异步执行批次，不阻塞响应
    batchExecutor.executeBatch(batchId).catch((error: any) => {
      console.error(`批次 ${batchId} 执行失败:`, error);
    });
    
    console.log(`🚀 批次 ${batchId} 已开始执行`);
    
    res.json({
      success: true,
      message: '批次已开始执行',
      queued: false
    });
  } catch (error) {
    console.error('启动批次失败:', error);
    res.status(500).json({
      success: false,
      message: '启动批次失败'
    });
  }
});

/**
 * 停止批次（取消批次中所有待处理任务，终止运行中任务）
 */
router.post('/batches/:batchId/stop', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { batchId } = req.params;
    
    // 验证批次所有权（检查批次中的任务是否属于当前用户）
    const batchCheck = await pool.query(
      'SELECT id FROM publishing_tasks WHERE batch_id = $1 AND user_id = $2 LIMIT 1',
      [batchId, userId]
    );
    
    if (batchCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '批次不存在或无权访问'
      });
    }
    
    const { batchExecutor } = require('../services/BatchExecutor');
    
    const result = await batchExecutor.stopBatch(batchId);
    
    const messages = [];
    if (result.cancelledCount > 0) {
      messages.push(`取消了 ${result.cancelledCount} 个待处理任务`);
    }
    if (result.terminatedCount > 0) {
      messages.push(`终止了 ${result.terminatedCount} 个运行中任务`);
    }
    
    res.json({
      success: true,
      data: result,
      message: `成功停止批次${messages.length > 0 ? '，' + messages.join('，') : ''}`
    });
  } catch (error) {
    console.error('停止批次失败:', error);
    res.status(500).json({
      success: false,
      message: '停止批次失败'
    });
  }
});

/**
 * 删除批次（删除批次中所有任务）
 */
router.delete('/batches/:batchId', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { batchId } = req.params;
    
    // 验证批次所有权
    const batchCheck = await pool.query(
      'SELECT id FROM publishing_tasks WHERE batch_id = $1 AND user_id = $2 LIMIT 1',
      [batchId, userId]
    );
    
    if (batchCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '批次不存在或无权访问'
      });
    }
    
    const { batchExecutor } = require('../services/BatchExecutor');
    
    const result = await batchExecutor.deleteBatch(batchId);
    
    res.json({
      success: true,
      data: result,
      message: `成功删除批次，删除了 ${result.deletedCount} 个任务`
    });
  } catch (error) {
    console.error('删除批次失败:', error);
    res.status(500).json({
      success: false,
      message: '删除批次失败'
    });
  }
});

/**
 * 获取批次信息
 */
router.get('/batches/:batchId', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { batchId } = req.params;
    
    // 验证批次所有权
    const batchCheck = await pool.query(
      'SELECT id FROM publishing_tasks WHERE batch_id = $1 AND user_id = $2 LIMIT 1',
      [batchId, userId]
    );
    
    if (batchCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '批次不存在或无权访问'
      });
    }
    
    const { batchExecutor } = require('../services/BatchExecutor');
    
    const info = await batchExecutor.getBatchInfo(batchId);
    
    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    console.error('获取批次信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取批次信息失败'
    });
  }
});

/**
 * 综合修复：修复所有文章和任务状态问题
 */
router.post('/comprehensive-fix', async (req, res) => {
  const userId = getCurrentTenantId(req);
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔧 开始综合修复...');
    
    const results: any = {
      nullIsPublished: [],
      publishedWithNull: [],
      releasedArticles: []
    };
    
    // 1. 修复 is_published 为 NULL 且未发布的文章
    console.log('1️⃣  修复 is_published 为 NULL 且未发布的文章...');
    const fix1 = await client.query(`
      UPDATE articles
      SET is_published = false
      WHERE is_published IS NULL AND published_at IS NULL AND user_id = $1
      RETURNING id, keyword
    `, [userId]);
    results.nullIsPublished = fix1.rows;
    console.log(`   ✅ 修复 ${fix1.rows.length} 篇文章`);
    
    // 2. 修复 is_published 为 NULL 但已发布的文章
    console.log('2️⃣  修复 is_published 为 NULL 但已发布的文章...');
    const fix2 = await client.query(`
      UPDATE articles
      SET is_published = true
      WHERE is_published IS NULL AND published_at IS NOT NULL AND user_id = $1
      RETURNING id, keyword
    `, [userId]);
    results.publishedWithNull = fix2.rows;
    console.log(`   ✅ 修复 ${fix2.rows.length} 篇文章`);
    
    // 3. 释放被锁定但没有活跃任务的文章
    console.log('3️⃣  释放被锁定但没有活跃任务的文章...');
    const fix3 = await client.query(`
      UPDATE articles
      SET publishing_status = NULL
      WHERE id IN (
        SELECT a.id
        FROM articles a
        LEFT JOIN publishing_tasks pt ON a.id = pt.article_id AND pt.status IN ('pending', 'running')
        WHERE a.publishing_status = 'pending' AND a.user_id = $1
        GROUP BY a.id
        HAVING COUNT(pt.id) = 0
      )
      RETURNING id, keyword
    `, [userId]);
    results.releasedArticles = fix3.rows;
    console.log(`   ✅ 释放 ${fix3.rows.length} 篇文章`);
    
    await client.query('COMMIT');
    
    const totalFixed = fix1.rows.length + fix2.rows.length + fix3.rows.length;
    console.log(`✅ 综合修复完成，共修复 ${totalFixed} 篇文章`);
    
    res.json({
      success: true,
      data: results,
      message: `综合修复完成，共修复 ${totalFixed} 篇文章`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('综合修复失败:', error);
    res.status(500).json({
      success: false,
      message: '综合修复失败'
    });
  } finally {
    client.release();
  }
});

/**
 * 修复被锁定的文章
 * 释放所有没有活跃任务的被锁定文章
 */
router.post('/fix-stuck-articles', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    console.log('🔧 开始修复被锁定的文章...');
    
    // 1. 查找所有被锁定的文章（仅当前用户）
    const lockedArticlesResult = await pool.query(`
      SELECT id, keyword, publishing_status
      FROM articles
      WHERE publishing_status = 'pending' AND user_id = $1
      ORDER BY id
    `, [userId]);

    const lockedArticles = lockedArticlesResult.rows;
    console.log(`找到 ${lockedArticles.length} 篇被锁定的文章`);

    if (lockedArticles.length === 0) {
      return res.json({
        success: true,
        data: {
          lockedCount: 0,
          releasedCount: 0,
          articles: []
        },
        message: '没有被锁定的文章'
      });
    }

    // 2. 检查每篇文章是否有活跃任务
    const articlesToRelease = [];
    
    for (const article of lockedArticles) {
      const tasksResult = await pool.query(`
        SELECT id, status
        FROM publishing_tasks
        WHERE article_id = $1 AND user_id = $2 AND status IN ('pending', 'running')
      `, [article.id, userId]);

      if (tasksResult.rows.length === 0) {
        // 没有活跃任务，应该释放
        articlesToRelease.push(article);
        console.log(`文章 #${article.id} (${article.keyword}) 没有活跃任务，将释放`);
      }
    }

    if (articlesToRelease.length === 0) {
      return res.json({
        success: true,
        data: {
          lockedCount: lockedArticles.length,
          releasedCount: 0,
          articles: []
        },
        message: '所有被锁定的文章都有活跃任务'
      });
    }

    // 3. 释放文章
    const articleIds = articlesToRelease.map(a => a.id);
    const result = await pool.query(`
      UPDATE articles
      SET publishing_status = NULL
      WHERE id = ANY($1) AND user_id = $2
      RETURNING id, keyword
    `, [articleIds, userId]);

    console.log(`✅ 成功释放 ${result.rows.length} 篇文章`);

    res.json({
      success: true,
      data: {
        lockedCount: lockedArticles.length,
        releasedCount: result.rows.length,
        articles: result.rows
      },
      message: `成功释放 ${result.rows.length} 篇文章`
    });
  } catch (error) {
    console.error('修复被锁定文章失败:', error);
    res.status(500).json({
      success: false,
      message: '修复失败'
    });
  }
});

export default router;
