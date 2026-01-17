import { Router } from 'express';
import { TopicSelectionService } from '../services/topicSelectionService';

export const topicRouter = Router();
const topicService = new TopicSelectionService();

/**
 * 获取话题使用统计
 * GET /api/topics/:id/stats
 */
topicRouter.get('/:id/stats', async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);

    if (isNaN(topicId) || topicId <= 0) {
      return res.status(400).json({ error: '无效的话题ID' });
    }

    const stats = await topicService.getTopicUsageStats(topicId);

    if (!stats) {
      return res.status(404).json({ error: '话题不存在' });
    }

    res.json(stats);
  } catch (error: any) {
    console.error('获取话题统计错误:', error);
    res.status(500).json({ 
      error: '获取话题统计失败', 
      details: error.message 
    });
  }
});

/**
 * 获取蒸馏结果的所有话题统计
 * GET /api/topics/distillation/:distillationId/stats
 */
topicRouter.get('/distillation/:distillationId/stats', async (req, res) => {
  try {
    const distillationId = parseInt(req.params.distillationId);

    if (isNaN(distillationId) || distillationId <= 0) {
      return res.status(400).json({ error: '无效的蒸馏结果ID' });
    }

    const topics = await topicService.getDistillationTopicsStats(distillationId);

    res.json({
      distillationId,
      topics,
      total: topics.length
    });
  } catch (error: any) {
    console.error('获取蒸馏结果话题统计错误:', error);
    res.status(500).json({ 
      error: '获取蒸馏结果话题统计失败', 
      details: error.message 
    });
  }
});

/**
 * 修复话题使用计数
 * POST /api/topics/repair-usage-count
 */
topicRouter.post('/repair-usage-count', async (req, res) => {
  try {
    const { topicId } = req.body;

    const result = await topicService.repairTopicUsageCount(topicId);

    res.json({
      success: true,
      message: `修复完成，共修复${result.fixed}条记录`,
      ...result
    });
  } catch (error: any) {
    console.error('修复话题使用计数错误:', error);
    res.status(500).json({ 
      error: '修复话题使用计数失败', 
      details: error.message 
    });
  }
});

/**
 * 更新话题内容
 * PUT /api/topics/:id
 */
topicRouter.put('/:id', async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);
    const { question } = req.body;

    if (isNaN(topicId) || topicId <= 0) {
      return res.status(400).json({ error: '无效的话题ID' });
    }

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: '话题内容不能为空' });
    }

    // 导入pool
    const { pool } = await import('../db/database');

    // 检查话题是否存在
    const checkResult = await pool.query(
      'SELECT id FROM topics WHERE id = $1',
      [topicId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '话题不存在' });
    }

    // 更新话题
    await pool.query(
      'UPDATE topics SET question = $1 WHERE id = $2',
      [question.trim(), topicId]
    );

    res.json({
      success: true,
      message: '话题更新成功'
    });
  } catch (error: any) {
    console.error('更新话题错误:', error);
    res.status(500).json({ 
      error: '更新话题失败', 
      details: error.message 
    });
  }
});

/**
 * 删除单个话题
 * DELETE /api/topics/:id
 */
topicRouter.delete('/:id', async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);

    if (isNaN(topicId) || topicId <= 0) {
      return res.status(400).json({ error: '无效的话题ID' });
    }

    // 导入pool
    const { pool } = await import('../db/database');

    // 检查话题是否存在
    const checkResult = await pool.query(
      'SELECT id FROM topics WHERE id = $1',
      [topicId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '话题不存在' });
    }

    // 删除话题
    await pool.query('DELETE FROM topics WHERE id = $1', [topicId]);

    res.json({
      success: true,
      message: '话题删除成功'
    });
  } catch (error: any) {
    console.error('删除话题错误:', error);
    res.status(500).json({ 
      error: '删除话题失败', 
      details: error.message 
    });
  }
});
