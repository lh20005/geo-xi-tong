import express from 'express';
import { publishingService } from '../services/PublishingService';

const router = express.Router();

/**
 * 创建发布任务
 */
router.post('/tasks', async (req, res) => {
  try {
    const { article_id, account_id, platform_id, config, scheduled_at, scheduled_time } = req.body;

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
      scheduled_at: scheduledTime ? new Date(scheduledTime) : undefined
    });

    // 如果是立即发布（没有scheduled_time），自动触发执行
    if (!scheduledTime) {
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
      message: scheduledTime ? '定时发布任务创建成功' : '发布任务创建成功，正在后台执行'
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

export default router;
