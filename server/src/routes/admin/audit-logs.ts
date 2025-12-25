import express from 'express';
import { authenticate, requireAdmin } from '../../middleware/adminAuth';
import { AuditLogService } from '../../services/AuditLogService';

const router = express.Router();

/**
 * 获取审计日志列表
 * GET /api/admin/audit-logs
 */
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      adminId,
      actionType,
      resourceType,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = req.query;

    const logs = await AuditLogService.getAdminLogs({
      adminId: adminId ? parseInt(adminId as string) : undefined,
      actionType: actionType as string,
      resourceType: resourceType as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error('获取审计日志失败:', error);
    res.status(500).json({
      success: false,
      message: '获取审计日志失败',
      error: error.message,
    });
  }
});

/**
 * 获取审计日志统计
 * GET /api/admin/audit-logs/stats
 */
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const { adminId, startDate, endDate } = req.query;

    const stats = await AuditLogService.getAdminActionStats({
      adminId: adminId ? parseInt(adminId as string) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('获取审计统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取审计统计失败',
      error: error.message,
    });
  }
});

export default router;
