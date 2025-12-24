import express from 'express';
import { authenticate } from '../middleware/adminAuth';
import { invitationService } from '../services/InvitationService';

const router = express.Router();

/**
 * 获取邀请统计（需要认证）
 * GET /api/invitations/stats
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const stats = await invitationService.getInvitationStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('[Invitation] 获取统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取邀请统计失败'
    });
  }
});

/**
 * 验证邀请码（公开接口）
 * POST /api/invitations/validate
 */
router.post('/validate', async (req, res) => {
  try {
    const { invitationCode } = req.body;

    if (!invitationCode) {
      return res.status(400).json({
        success: false,
        message: '邀请码不能为空'
      });
    }

    const result = await invitationService.validateCode(invitationCode);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[Invitation] 验证邀请码失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '验证邀请码失败'
    });
  }
});

export default router;
