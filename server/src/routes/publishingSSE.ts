// [已迁移到 Windows 端] 发布日志 SSE 推送已迁移到 Windows 端本地执行
// 此文件保留仅为避免编译错误，实际功能已不再使用

import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// [已迁移到 Windows 端] 发布日志推送功能已迁移到 Windows 端
router.get('/logs/:taskId', (req, res) => {
  res.status(410).json({
    success: false,
    message: '此功能已迁移到 Windows 端本地执行'
  });
});

export default router;
