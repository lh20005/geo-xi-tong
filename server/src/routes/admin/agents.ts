/**
 * 管理员代理商管理 API 路由
 */

import express from 'express';
import { authenticate, requireAdmin } from '../../middleware/adminAuth';
import { agentService } from '../../services/AgentService';
import { commissionService } from '../../services/CommissionService';
import { profitSharingService } from '../../services/ProfitSharingService';

const router = express.Router();

// 所有路由都需要管理员权限
router.use(authenticate);
router.use(requireAdmin);

/**
 * 获取代理商统计数据
 * GET /api/admin/agents/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { pool } = require('../../db/database');
    
    // 获取代理商总数和活跃数
    const agentCountResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active
      FROM agents
    `);
    
    // 获取佣金统计
    const commissionResult = await pool.query(`
      SELECT 
        COALESCE(SUM(commission_amount), 0) as total,
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0) as pending
      FROM commission_records
    `);
    
    res.json({
      success: true,
      data: {
        totalAgents: parseInt(agentCountResult.rows[0].total),
        activeAgents: parseInt(agentCountResult.rows[0].active),
        totalCommissions: parseFloat(commissionResult.rows[0].total),
        pendingCommissions: parseFloat(commissionResult.rows[0].pending)
      }
    });
  } catch (error: any) {
    console.error('[AdminAgent] 获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取统计数据失败'
    });
  }
});

/**
 * 获取代理商列表
 * GET /api/admin/agents
 */
router.get('/', async (req, res) => {
  try {
    const { status, search, page, pageSize } = req.query;

    const result = await agentService.listAgents({
      status: status as any,
      search: search as string,
      page: parseInt(page as string) || 1,
      pageSize: parseInt(pageSize as string) || 10
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[AdminAgent] 获取代理商列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取列表失败'
    });
  }
});

/**
 * 获取代理商详情
 * GET /api/admin/agents/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);

    if (isNaN(agentId)) {
      return res.status(400).json({
        success: false,
        message: '无效的代理商ID'
      });
    }

    const agent = await agentService.getAgentDetail(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '代理商不存在'
      });
    }

    // 获取统计数据
    const stats = await agentService.getAgentStats(agentId);
    
    // 获取最近的佣金记录
    const commissionsResult = await commissionService.listCommissions(agentId, {
      page: 1,
      pageSize: 20
    });

    res.json({
      success: true,
      data: {
        ...agent,
        stats,
        commissions: commissionsResult.data
      }
    });
  } catch (error: any) {
    console.error('[AdminAgent] 获取代理商详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取详情失败'
    });
  }
});

/**
 * 更新代理商状态（暂停/恢复）
 * PUT /api/admin/agents/:id/status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const { status } = req.body;
    const adminId = (req as any).user.userId;

    if (isNaN(agentId)) {
      return res.status(400).json({
        success: false,
        message: '无效的代理商ID'
      });
    }

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值'
      });
    }

    const agent = await agentService.updateAgentStatus(agentId, status, adminId);

    res.json({
      success: true,
      data: agent,
      message: status === 'suspended' ? '代理商已暂停' : '代理商已恢复'
    });
  } catch (error: any) {
    console.error('[AdminAgent] 更新代理商状态失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '更新状态失败'
    });
  }
});

/**
 * 调整佣金比例
 * PUT /api/admin/agents/:id/rate
 */
router.put('/:id/rate', async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const { rate, commissionRate } = req.body;
    const adminId = (req as any).user.userId;

    if (isNaN(agentId)) {
      return res.status(400).json({
        success: false,
        message: '无效的代理商ID'
      });
    }

    // 支持两种参数名
    const rateNum = parseFloat(commissionRate ?? rate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 0.30) {
      return res.status(400).json({
        success: false,
        message: '佣金比例必须在 0-30% 之间'
      });
    }

    const agent = await agentService.updateCommissionRate(agentId, rateNum, adminId);

    res.json({
      success: true,
      data: agent,
      message: `佣金比例已调整为 ${(rateNum * 100).toFixed(0)}%`
    });
  } catch (error: any) {
    console.error('[AdminAgent] 调整佣金比例失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '调整比例失败'
    });
  }
});

/**
 * 删除代理商
 * DELETE /api/admin/agents/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const adminId = (req as any).user.userId;

    if (isNaN(agentId)) {
      return res.status(400).json({
        success: false,
        message: '无效的代理商ID'
      });
    }

    // 获取代理商信息用于删除分账接收方
    const agent = await agentService.getAgentById(agentId);
    if (agent && agent.wechatOpenid && agent.receiverAdded) {
      try {
        await profitSharingService.deleteReceiver(agent.wechatOpenid);
      } catch (error) {
        console.error('[AdminAgent] 删除分账接收方失败:', error);
      }
    }

    await agentService.deleteAgent(agentId, adminId);

    res.json({
      success: true,
      message: '代理商已删除'
    });
  } catch (error: any) {
    console.error('[AdminAgent] 删除代理商失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '删除失败'
    });
  }
});

/**
 * 获取代理商的佣金记录
 * GET /api/admin/agents/:id/commissions
 */
router.get('/:id/commissions', async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const { status, startDate, endDate, page, pageSize } = req.query;

    if (isNaN(agentId)) {
      return res.status(400).json({
        success: false,
        message: '无效的代理商ID'
      });
    }

    const result = await commissionService.listCommissions(agentId, {
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
    console.error('[AdminAgent] 获取佣金记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取佣金记录失败'
    });
  }
});

/**
 * 获取代理商的邀请用户列表
 * GET /api/admin/agents/:id/invited-users
 */
router.get('/:id/invited-users', async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const { page, pageSize } = req.query;

    if (isNaN(agentId)) {
      return res.status(400).json({
        success: false,
        message: '无效的代理商ID'
      });
    }

    const agent = await agentService.getAgentDetail(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '代理商不存在'
      });
    }

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;
    const offset = (pageNum - 1) * pageSizeNum;

    // 获取邀请用户列表
    const { pool } = require('../../db/database');
    
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users WHERE invited_by_code = $1`,
      [agent.invitationCode]
    );
    const total = parseInt(countResult.rows[0].total);

    const usersResult = await pool.query(
      `SELECT 
        u.id, u.username, u.created_at,
        CASE WHEN us.id IS NOT NULL THEN true ELSE false END as has_subscription,
        sp.plan_name
       FROM users u
       LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE u.invited_by_code = $1
       ORDER BY u.created_at DESC
       LIMIT $2 OFFSET $3`,
      [agent.invitationCode, pageSizeNum, offset]
    );

    res.json({
      success: true,
      data: {
        data: usersResult.rows.map((row: any) => ({
          id: row.id,
          username: row.username,
          createdAt: row.created_at,
          hasSubscription: row.has_subscription,
          planName: row.plan_name
        })),
        total,
        page: pageNum,
        pageSize: pageSizeNum
      }
    });
  } catch (error: any) {
    console.error('[AdminAgent] 获取邀请用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取邀请用户列表失败'
    });
  }
});

/**
 * 获取所有佣金记录（管理员总览）
 * GET /api/admin/agents/commissions/all
 */
router.get('/commissions/all', async (req, res) => {
  try {
    const { status, startDate, endDate, agentId, page, pageSize } = req.query;

    const result = await commissionService.listAllCommissions({
      status: status as any,
      startDate: startDate as string,
      endDate: endDate as string,
      agentId: agentId ? parseInt(agentId as string) : undefined,
      page: parseInt(page as string) || 1,
      pageSize: parseInt(pageSize as string) || 10
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[AdminAgent] 获取所有佣金记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取佣金记录失败'
    });
  }
});

export default router;
