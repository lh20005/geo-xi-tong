import express from 'express';
import { publishingService } from '../services/PublishingService';
import { pool } from '../db/database';
import { logBroadcaster } from '../services/LogBroadcaster';

const router = express.Router();

/**
 * 创建发布任务
 */
router.post('/tasks', async (req, res) => {
  try {
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

    if (!article_id || !account_id || !platform_id) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: article_id, account_id, platform_id'
      });
    }

    // 兼容前端的 scheduled_time 和 scheduled_at 两种参数名
    const scheduledTime = scheduled_time || scheduled_at;

    const task = await publishingService.createTask({
      article_id,
      account_id,
      platform_id,
      config: config || {},
      scheduled_at: scheduledTime ? new Date(scheduledTime) : undefined,
      batch_id,
      batch_order,
      interval_minutes
    });

    // 标记文章为"发布中"状态（在文章列表中暂时隐藏）
    await pool.query(
      `UPDATE articles 
       SET publishing_status = 'pending' 
       WHERE id = $1`,
      [article_id]
    );
    console.log(`✅ 文章 #${article_id} 已标记为发布中（publishing_status = 'pending'）`);

    // 如果有 batch_id，说明是批次任务，由批次执行器处理
    if (batch_id) {
      console.log(`✅ 批次任务 #${task.id} 已创建 (批次: ${batch_id}, 顺序: ${batch_order})`);
      
      // 如果是批次中的第一个任务（batch_order = 0），触发批次执行
      if (batch_order === 0) {
        const { batchExecutor } = require('../services/BatchExecutor');
        
        // 异步执行批次，不阻塞响应
        batchExecutor.executeBatch(batch_id).catch((error: any) => {
          console.error(`批次 ${batch_id} 执行失败:`, error);
        });
        
        console.log(`🚀 批次 ${batch_id} 已开始执行`);
      }
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
    const { status, platform_id, article_id, page, pageSize } = req.query;

    const result = await publishingService.getTasks({
      status: status as string,
      platform_id: platform_id as string,
      article_id: article_id ? parseInt(article_id as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined
    });

    res.json({
      success: true,
      data: {
        tasks: result.tasks,
        total: result.total
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
    const taskId = parseInt(req.params.id);
    const task = await publishingService.getTaskById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    res.json({
      success: true,
      data: task
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
    const taskId = parseInt(req.params.id);
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
 * 实时日志流（SSE）
 */
router.get('/tasks/:id/logs/stream', async (req, res) => {
  const taskId = parseInt(req.params.id);

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲

  // 发送初始连接成功消息
  res.write(`data: ${JSON.stringify({ 
    level: 'info', 
    message: '日志流已连接', 
    timestamp: new Date().toISOString() 
  })}\n\n`);

  // 添加客户端到广播器
  logBroadcaster.addClient(taskId, res);

  // 发送历史日志
  try {
    const logs = await publishingService.getTaskLogs(taskId);
    for (const log of logs) {
      res.write(`data: ${JSON.stringify({
        level: log.level,
        message: log.message,
        timestamp: log.created_at,
        details: log.details
      })}\n\n`);
    }
  } catch (error) {
    console.error('发送历史日志失败:', error);
  }

  // 客户端断开连接时清理
  req.on('close', () => {
    logBroadcaster.removeClient(taskId, res);
    res.end();
  });
});

/**
 * 取消任务
 */
router.post('/tasks/:id/cancel', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
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
    const taskId = parseInt(req.params.id);
    const originalTask = await publishingService.getTaskById(taskId);

    if (!originalTask) {
      return res.status(404).json({
        success: false,
        message: '原任务不存在'
      });
    }

    // 创建新任务
    const newTask = await publishingService.createTask({
      article_id: originalTask.article_id,
      account_id: originalTask.account_id,
      platform_id: originalTask.platform_id,
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
    const taskId = parseInt(req.params.id);
    const task = await publishingService.getTaskById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

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
    const taskId = parseInt(req.params.id);
    const task = await publishingService.getTaskById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
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
    const taskId = parseInt(req.params.id);
    const task = await publishingService.getTaskById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

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
        const task = await publishingService.getTaskById(taskId);
        
        if (task) {
          // 如果任务正在执行，先终止
          if (task.status === 'running') {
            await publishingService.updateTaskStatus(taskId, 'failed', '任务已被批量删除');
          }
          
          await publishingService.deleteTask(taskId);
          successCount++;
        } else {
          failCount++;
          errors.push(`任务 #${taskId} 不存在`);
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
    const { status } = req.body; // 可选：只删除特定状态的任务

    const result = await publishingService.deleteAllTasks(status);

    res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount
      },
      message: `成功删除 ${result.deletedCount} 个任务`
    });
  } catch (error) {
    console.error('删除所有任务失败:', error);
    res.status(500).json({
      success: false,
      message: '删除所有任务失败'
    });
  }
});

/**
 * 停止批次（取消批次中所有待处理任务，终止运行中任务）
 */
router.post('/batches/:batchId/stop', async (req, res) => {
  try {
    const { batchId } = req.params;
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
    const { batchId } = req.params;
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
    const { batchId } = req.params;
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
      WHERE is_published IS NULL AND published_at IS NULL
      RETURNING id, keyword
    `);
    results.nullIsPublished = fix1.rows;
    console.log(`   ✅ 修复 ${fix1.rows.length} 篇文章`);
    
    // 2. 修复 is_published 为 NULL 但已发布的文章
    console.log('2️⃣  修复 is_published 为 NULL 但已发布的文章...');
    const fix2 = await client.query(`
      UPDATE articles
      SET is_published = true
      WHERE is_published IS NULL AND published_at IS NOT NULL
      RETURNING id, keyword
    `);
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
        WHERE a.publishing_status = 'pending'
        GROUP BY a.id
        HAVING COUNT(pt.id) = 0
      )
      RETURNING id, keyword
    `);
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
    console.log('🔧 开始修复被锁定的文章...');
    
    // 1. 查找所有被锁定的文章
    const lockedArticlesResult = await pool.query(`
      SELECT id, keyword, publishing_status
      FROM articles
      WHERE publishing_status = 'pending'
      ORDER BY id
    `);

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
        WHERE article_id = $1 AND status IN ('pending', 'running')
      `, [article.id]);

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
      WHERE id = ANY($1)
      RETURNING id, keyword
    `, [articleIds]);

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
