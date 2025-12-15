import { Router } from 'express';
import { pool } from '../db/database';

export const topicRouter = Router();

// 获取指定蒸馏的所有话题
topicRouter.get('/:distillationId', async (req, res) => {
  try {
    const { distillationId } = req.params;
    
    const result = await pool.query(
      `SELECT t.*, d.keyword 
       FROM topics t
       JOIN distillations d ON t.distillation_id = d.id
       WHERE t.distillation_id = $1
       ORDER BY t.id`,
      [distillationId]
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: '获取话题失败' });
  }
});

// 删除话题
topicRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM topics WHERE id = $1', [id]);
    
    res.json({ success: true, message: '话题删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除话题失败' });
  }
});

// 编辑话题
topicRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: '请提供话题内容' });
    }
    
    await pool.query(
      'UPDATE topics SET question = $1 WHERE id = $2',
      [question, id]
    );
    
    res.json({ success: true, message: '话题更新成功' });
  } catch (error) {
    res.status(500).json({ error: '更新话题失败' });
  }
});
