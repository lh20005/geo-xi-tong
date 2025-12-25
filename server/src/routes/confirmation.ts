import express from 'express';
import { authenticate } from '../middleware/adminAuth';
import { initiateConfirmation, verifyConfirmation } from '../middleware/requireConfirmation';

const router = express.Router();

/**
 * 确认令牌路由
 * 用于敏感操作的二次确认
 */

// 生成确认令牌
router.post('/initiate', authenticate, initiateConfirmation);

// 验证确认令牌（不消费）
router.post('/verify', authenticate, verifyConfirmation);

export default router;
