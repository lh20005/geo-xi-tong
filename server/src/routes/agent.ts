/**
 * 代理商 API 路由
 * 处理代理商申请、状态查询、微信绑定等
 */

import express from 'express';
import { authenticate } from '../middleware/adminAuth';
import { agentService } from '../services/AgentService';
import { commissionService } from '../services/CommissionService';
import { wechatAuthService } from '../services/WechatAuthService';
import { profitSharingService } from '../services/ProfitSharingService';

const router = express.Router();

/**
 * 申请成为代理商（自动激活）
 * POST /api/agent/apply
 */
router.post('/apply', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const agent = await agentService.applyAgent(userId);

    res.json({
      success: true,
      data: agent,
      message: '恭喜！您已成功成为代理商'
    });
  } catch (error: any) {
    console.error('[Agent] 申请代理商失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '申请失败'
    });
  }
});

/**
 * 获取代理商状态
 * GET /api/agent/status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const agent = await agentService.getAgentByUserId(userId);

    res.json({
      success: true,
      data: {
        isAgent: !!agent,
        agent: agent || null
      }
    });
  } catch (error: any) {
    console.error('[Agent] 获取代理商状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取状态失败'
    });
  }
});

/**
 * 获取代理商统计数据
 * GET /api/agent/stats
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const agent = await agentService.getAgentByUserId(userId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '您还不是代理商'
      });
    }

    const stats = await agentService.getAgentStats(agent.id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('[Agent] 获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取统计失败'
    });
  }
});

/**
 * 获取佣金列表
 * GET /api/agent/commissions
 */
router.get('/commissions', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { status, startDate, endDate, page, pageSize } = req.query;

    const agent = await agentService.getAgentByUserId(userId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '您还不是代理商'
      });
    }

    const result = await commissionService.listCommissions(agent.id, {
      status: status as any,
      startDate: startDate as string,
      endDate: endDate as string,
      page: parseInt(page as string) || 1,
      pageSize: parseInt(pageSize as string) || 10
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[Agent] 获取佣金列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取佣金列表失败'
    });
  }
});

/**
 * 获取绑定码（用于小程序绑定）
 * GET /api/agent/bindWechat/code
 */
router.get('/bindWechat/code', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const agent = await agentService.getAgentByUserId(userId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '您还不是代理商'
      });
    }

    const { bindCode, expiresIn } = wechatAuthService.generateBindCode(agent.id);

    res.json({
      success: true,
      data: {
        bindCode,
        expiresIn
      }
    });
  } catch (error: any) {
    console.error('[Agent] 生成绑定码失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '生成绑定码失败'
    });
  }
});

/**
 * 获取小程序码（用于扫码绑定）
 * GET /api/agent/bindWechat/qrcode
 * 可选参数 env: release(正式版) | trial(体验版) | develop(开发版)
 */
router.get('/bindWechat/qrcode', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const envVersion = (req.query.env as 'release' | 'trial' | 'develop') || 'release';

    const agent = await agentService.getAgentByUserId(userId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '您还不是代理商'
      });
    }

    const { bindCode, qrCodeBase64, expiresIn } = await wechatAuthService.generateMiniProgramQRCode(agent.id, envVersion);

    res.json({
      success: true,
      data: {
        bindCode,
        qrCodeBase64,
        expiresIn
      }
    });
  } catch (error: any) {
    console.error('[Agent] 生成小程序码失败:', error);
    // 降级：返回绑定码
    try {
      const agent = await agentService.getAgentByUserId((req as any).user.userId);
      if (agent) {
        const { bindCode, expiresIn } = wechatAuthService.generateBindCode(agent.id);
        return res.json({
          success: true,
          data: {
            bindCode,
            qrCodeBase64: null,  // 没有二维码，前端显示绑定码
            expiresIn
          },
          message: '小程序码生成失败，请使用绑定码'
        });
      }
    } catch (e) {
      // ignore
    }
    res.status(500).json({
      success: false,
      message: error.message || '生成小程序码失败'
    });
  }
});

/**
 * 检查绑定状态（前端轮询）
 * GET /api/agent/bindWechat/status
 */
router.get('/bindWechat/status', authenticate, async (req, res) => {
  try {
    const { bindCode } = req.query;

    if (!bindCode) {
      return res.status(400).json({
        success: false,
        message: '缺少绑定码'
      });
    }

    const status = wechatAuthService.checkBindStatus(bindCode as string);

    // 如果绑定成功，完成绑定流程
    if (status.status === 'success' && status.openid) {
      const userId = (req as any).user.userId;
      const agent = await agentService.getAgentByUserId(userId);
      
      if (agent) {
        // 确认绑定
        const result = wechatAuthService.confirmBind(bindCode as string);
        if (result) {
          // 更新代理商微信绑定信息
          await agentService.bindWechatAccount(agent.id, result.openid, result.nickname);

          // 添加为分账接收方
          const receiverResult = await profitSharingService.addReceiver(result.openid);
          if (receiverResult.success) {
            await agentService.markReceiverAdded(agent.id, true);
          }
        }
      }
    }

    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    console.error('[Agent] 检查绑定状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '检查状态失败'
    });
  }
});

/**
 * 小程序端调用：提交绑定
 * POST /api/agent/bindWechat/submit
 * 无需认证，小程序直接调用
 */
router.post('/bindWechat/submit', async (req, res) => {
  try {
    const { bindCode, code } = req.body;

    if (!bindCode || !code) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    const result = await wechatAuthService.submitBind(bindCode, code);

    res.json({
      success: result.success,
      message: result.message
    });
  } catch (error: any) {
    console.error('[Agent] 小程序绑定失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '绑定失败'
    });
  }
});

/**
 * 解绑微信账户
 * POST /api/agent/bindWechat/unbind
 */
router.post('/bindWechat/unbind', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const agent = await agentService.getAgentByUserId(userId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '您还不是代理商'
      });
    }

    if (!agent.wechatOpenid) {
      return res.status(400).json({
        success: false,
        message: '未绑定微信账户'
      });
    }

    // 检查是否有待结算佣金
    const stats = await agentService.getAgentStats(agent.id);
    if (stats.pendingEarnings > 0) {
      return res.status(400).json({
        success: false,
        message: '您有待结算佣金，无法解绑微信账户'
      });
    }

    // 从分账接收方中删除
    if (agent.receiverAdded) {
      await profitSharingService.deleteReceiver(agent.wechatOpenid);
    }

    // 解绑微信
    await agentService.unbindWechatAccount(agent.id);

    res.json({
      success: true,
      message: '微信账户已解绑'
    });
  } catch (error: any) {
    console.error('[Agent] 解绑微信失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '解绑失败'
    });
  }
});

export default router;
