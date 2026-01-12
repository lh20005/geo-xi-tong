import express from 'express';
import jwt from 'jsonwebtoken';
import { publishingService } from '../services/PublishingService';
import { pool } from '../db/database';
import { logBroadcaster } from '../services/LogBroadcaster';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JwtPayload {
  userId: number;
  username: string;
  role?: string;
}

/**
 * 实时日志流（SSE）
 * 这个路由单独处理认证，因为 EventSource 不支持自定义 headers
 * 必须通过 URL 查询参数传递 token
 */
router.get('/tasks/:id/logs/stream', async (req, res) => {
  // 从 URL 查询参数获取 token
  const token = req.query.token as string;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌'
    });
  }

  // 验证 token
  let userId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    userId = decoded.userId;
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '令牌无效或已过期'
    });
  }

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
    console.error('[SSE] 发送历史日志失败:', error);
  }

  // 客户端断开连接时清理
  req.on('close', () => {
    logBroadcaster.removeClient(taskId, res);
    res.end();
  });
});

export default router;
