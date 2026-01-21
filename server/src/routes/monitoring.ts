/**
 * 监控 API 路由
 * 提供健康检查和监控状态查询接口
 */

import { Router, Request, Response } from 'express';
import { monitoringService } from '../services/MonitoringService';
import { authenticate, requireAdmin } from '../middleware/adminAuth';
import { pool } from '../db/database';

const router = Router();

/**
 * 健康检查端点（公开）
 * GET /api/monitoring/health
 * 
 * 用于 PM2 watchdog 和负载均衡器健康检查
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await monitoringService.getHealthStatus();
    
    // 根据健康状态返回不同的 HTTP 状态码
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      status: health.status,
      uptime: health.uptime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed'
    });
  }
});

/**
 * 详细健康状态（需要管理员权限）
 * GET /api/monitoring/status
 */
router.get('/status', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const health = await monitoringService.getHealthStatus();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({
      error: '获取监控状态失败',
      message: error.message
    });
  }
});

/**
 * 检查佣金结算异常（需要管理员权限）
 * GET /api/monitoring/commission-anomalies
 */
router.get('/commission-anomalies', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await monitoringService.checkCommissionAnomalies();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      error: '检查佣金异常失败',
      message: error.message
    });
  }
});

/**
 * 获取最近的监控事件（需要管理员权限）
 * GET /api/monitoring/events
 */
router.get('/events', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const eventType = req.query.type as string | undefined;
    const severity = req.query.severity as string | undefined;
    
    const events = await monitoringService.getServiceEventHistory(
      limit,
      eventType as any,
      severity as any
    );
    
    res.json({
      events,
      total: events.length
    });
  } catch (error: any) {
    res.status(500).json({
      error: '获取监控事件失败',
      message: error.message
    });
  }
});

/**
 * 获取内存中的最近事件（需要管理员权限）
 * GET /api/monitoring/recent-events
 */
router.get('/recent-events', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const events = monitoringService.getRecentEvents(limit);
    
    res.json({
      events,
      total: events.length
    });
  } catch (error: any) {
    res.status(500).json({
      error: '获取最近事件失败',
      message: error.message
    });
  }
});

/**
 * 获取佣金统计汇总（需要管理员权限）
 * GET /api/monitoring/commission-stats
 */
router.get('/commission-stats', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    // 获取各状态佣金统计
    const statsResult = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(commission_amount), 0) as total_amount
      FROM commission_records
      GROUP BY status
    `);

    // 获取今日佣金
    const todayResult = await pool.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(commission_amount), 0) as total_amount
      FROM commission_records
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    // 获取本月佣金
    const monthResult = await pool.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(commission_amount), 0) as total_amount
      FROM commission_records
      WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    // 获取待结算佣金（按结算日期分组）
    const pendingByDateResult = await pool.query(`
      SELECT 
        settle_date,
        COUNT(*) as count,
        COALESCE(SUM(commission_amount), 0) as total_amount
      FROM commission_records
      WHERE status = 'pending'
      GROUP BY settle_date
      ORDER BY settle_date ASC
      LIMIT 7
    `);

    // 获取分账处理中的记录数
    const processingResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM profit_sharing_records
      WHERE status = 'processing'
    `);

    // 构建统计数据
    const statsByStatus: Record<string, { count: number; amount: number }> = {};
    for (const row of statsResult.rows) {
      statsByStatus[row.status] = {
        count: parseInt(row.count),
        amount: parseFloat(row.total_amount)
      };
    }

    res.json({
      success: true,
      data: {
        byStatus: statsByStatus,
        today: {
          count: parseInt(todayResult.rows[0]?.count || '0'),
          amount: parseFloat(todayResult.rows[0]?.total_amount || '0')
        },
        month: {
          count: parseInt(monthResult.rows[0]?.count || '0'),
          amount: parseFloat(monthResult.rows[0]?.total_amount || '0')
        },
        pendingByDate: pendingByDateResult.rows.map(row => ({
          date: row.settle_date,
          count: parseInt(row.count),
          amount: parseFloat(row.total_amount)
        })),
        processingProfitSharing: parseInt(processingResult.rows[0]?.count || '0')
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: '获取佣金统计失败',
      message: error.message
    });
  }
});

/**
 * 获取佣金记录列表（需要管理员权限）
 * GET /api/monitoring/commissions
 */
router.get('/commissions', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string | undefined;
    const agentId = req.query.agentId ? parseInt(req.query.agentId as string) : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (agentId) {
      conditions.push(`c.agent_id = $${paramIndex}`);
      params.push(agentId);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`c.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`c.created_at <= $${paramIndex}`);
      params.push(endDate + ' 23:59:59');
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM commission_records c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取列表
    const listParams = [...params, pageSize, offset];
    const result = await pool.query(
      `SELECT 
        c.*,
        o.order_no,
        o.amount as order_total_amount,
        u.username as invited_username,
        au.username as agent_username,
        sp.plan_name,
        psr.status as profit_sharing_status,
        psr.out_order_no as profit_sharing_order_no
       FROM commission_records c
       JOIN orders o ON c.order_id = o.id
       JOIN users u ON c.invited_user_id = u.id
       JOIN agents a ON c.agent_id = a.id
       JOIN users au ON a.user_id = au.id
       LEFT JOIN subscription_plans sp ON o.plan_id = sp.id
       LEFT JOIN profit_sharing_records psr ON c.id = psr.commission_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      listParams
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        agentId: row.agent_id,
        agentUsername: row.agent_username,
        orderId: row.order_id,
        orderNo: row.order_no,
        orderTotalAmount: parseFloat(row.order_total_amount),
        invitedUserId: row.invited_user_id,
        invitedUsername: row.invited_username,
        planName: row.plan_name,
        orderAmount: parseFloat(row.order_amount),
        commissionRate: parseFloat(row.commission_rate),
        commissionAmount: parseFloat(row.commission_amount),
        status: row.status,
        settleDate: row.settle_date,
        settledAt: row.settled_at,
        failReason: row.fail_reason,
        profitSharingStatus: row.profit_sharing_status,
        profitSharingOrderNo: row.profit_sharing_order_no,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      pagination: {
        page,
        pageSize,
        total
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: '获取佣金记录失败',
      message: error.message
    });
  }
});

/**
 * 获取定时任务状态（需要管理员权限）
 * GET /api/monitoring/scheduler-status
 */
router.get('/scheduler-status', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    // 获取最近的任务执行记录
    const taskEventsResult = await pool.query(`
      SELECT 
        event_type,
        message,
        details,
        created_at
      FROM service_events
      WHERE event_type IN ('task_start', 'task_complete', 'task_error')
      ORDER BY created_at DESC
      LIMIT 20
    `);

    // 获取各定时任务的最后执行时间
    const lastExecutionResult = await pool.query(`
      SELECT DISTINCT ON (message)
        message,
        event_type,
        details,
        created_at
      FROM service_events
      WHERE event_type IN ('task_complete', 'task_error')
      ORDER BY message, created_at DESC
    `);

    // 定时任务配置
    const scheduledTasks = [
      { name: '订单超时关闭任务', schedule: '每5分钟', description: '关闭超时未支付订单' },
      { name: '配额重置任务', schedule: '每小时', description: '检查并重置用户配额' },
      { name: '订阅到期检查任务', schedule: '每天09:00', description: '检查即将到期订阅' },
      { name: '佣金结算任务', schedule: '每天02:00', description: 'T+1佣金结算' },
      { name: '分账结果查询任务', schedule: '每小时30分', description: '查询分账处理结果' },
      { name: '代理商异常检测任务', schedule: '每6小时', description: '检测异常代理商' },
      { name: '佣金结算异常监控任务', schedule: '每30分钟', description: '监控佣金异常' },
      { name: '服务事件清理任务', schedule: '每天04:00', description: '清理过期事件记录' }
    ];

    // 合并最后执行信息
    const tasksWithStatus = scheduledTasks.map(task => {
      const lastExec = lastExecutionResult.rows.find(
        row => row.message.includes(task.name)
      );
      return {
        ...task,
        lastExecution: lastExec ? {
          time: lastExec.created_at,
          status: lastExec.event_type === 'task_complete' ? 'success' : 'error',
          result: lastExec.details?.result || lastExec.details?.error
        } : null
      };
    });

    res.json({
      success: true,
      data: {
        tasks: tasksWithStatus,
        recentEvents: taskEventsResult.rows.map(row => ({
          type: row.event_type,
          message: row.message,
          details: row.details,
          time: row.created_at
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: '获取定时任务状态失败',
      message: error.message
    });
  }
});

/**
 * 获取代理商列表（用于筛选）
 * GET /api/monitoring/agents
 */
router.get('/agents', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.id,
        u.username,
        a.status,
        a.commission_rate
      FROM agents a
      JOIN users u ON a.user_id = u.id
      ORDER BY u.username
    `);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        username: row.username,
        status: row.status,
        commissionRate: parseFloat(row.commission_rate)
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: '获取代理商列表失败',
      message: error.message
    });
  }
});

export default router;
