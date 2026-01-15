/**
 * 发布分析路由
 * 
 * 用于记录和查询发布统计数据。
 * 
 * API:
 * - POST /api/analytics/publish-report - 记录单条发布结果
 * - POST /api/analytics/publish-report/batch - 批量记录发布结果
 * - GET /api/admin/analytics/overview - 获取总览统计（管理员）
 * - GET /api/admin/analytics/platforms - 获取平台统计（管理员）
 * - GET /api/admin/analytics/platform/:platform - 获取平台详情（管理员）
 * - GET /api/admin/analytics/errors - 获取错误列表（管理员）
 * - GET /api/admin/analytics/users - 获取用户统计（管理员）
 */

import { Router } from 'express';
import { analyticsService, PublishReport } from '../services/AnalyticsService';
import { authenticate, requireAdmin } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

export const analyticsRouter = Router();

// ==================== 用户端 API ====================
// 用于 Windows 端上报发布结果

/**
 * 记录单条发布结果
 * POST /api/analytics/publish-report
 */
analyticsRouter.post('/publish-report', authenticate, setTenantContext, requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const report: PublishReport = req.body;

    // 验证必填字段
    if (!report.taskId || !report.platform || !report.status || report.duration === undefined) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REPORT',
        message: '缺少必填字段: taskId, platform, status, duration'
      });
    }

    // 验证 status 值
    if (report.status !== 'success' && report.status !== 'failed') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATUS',
        message: 'status 必须是 success 或 failed'
      });
    }

    await analyticsService.recordPublishReport(userId, report);

    res.json({
      success: true,
      message: '记录成功'
    });
  } catch (error: any) {
    console.error('记录发布结果错误:', error);
    res.status(500).json({
      success: false,
      error: 'RECORD_FAILED',
      message: '记录失败',
      details: error.message
    });
  }
});

/**
 * 批量记录发布结果
 * POST /api/analytics/publish-report/batch
 */
analyticsRouter.post('/publish-report/batch', authenticate, setTenantContext, requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { reports } = req.body;

    if (!Array.isArray(reports) || reports.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REPORTS',
        message: 'reports 必须是非空数组'
      });
    }

    // 验证每条记录
    for (let i = 0; i < reports.length; i++) {
      const report = reports[i];
      if (!report.taskId || !report.platform || !report.status || report.duration === undefined) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REPORT',
          message: `第 ${i + 1} 条记录缺少必填字段`
        });
      }
      if (report.status !== 'success' && report.status !== 'failed') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_STATUS',
          message: `第 ${i + 1} 条记录的 status 无效`
        });
      }
    }

    const count = await analyticsService.recordPublishReportBatch(userId, reports);

    res.json({
      success: true,
      message: `成功记录 ${count} 条`,
      count
    });
  } catch (error: any) {
    console.error('批量记录发布结果错误:', error);
    res.status(500).json({
      success: false,
      error: 'RECORD_FAILED',
      message: '记录失败',
      details: error.message
    });
  }
});

// ==================== 管理员 API ====================
// 用于管理员查看发布分析数据

/**
 * 解析日期范围参数
 */
function parseDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);
  
  return { start, end };
}

/**
 * 获取总览统计
 * GET /api/admin/analytics/overview
 */
analyticsRouter.get('/admin/overview', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = parseDateRange(startDate as string, endDate as string);

    const overview = await analyticsService.getOverviewStats(start, end);
    const platformStats = await analyticsService.getPlatformStats(start, end);
    const errorStats = await analyticsService.getErrorStats(start, end);
    const dailyTrend = await analyticsService.getDailyTrend(start, end);

    res.json({
      success: true,
      dateRange: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      },
      overview,
      platformStats,
      errorStats,
      dailyTrend
    });
  } catch (error: any) {
    console.error('获取总览统计错误:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: '获取统计失败',
      details: error.message
    });
  }
});

/**
 * 获取平台统计
 * GET /api/admin/analytics/platforms
 */
analyticsRouter.get('/admin/platforms', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = parseDateRange(startDate as string, endDate as string);

    const platformStats = await analyticsService.getPlatformStats(start, end);

    res.json({
      success: true,
      dateRange: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      },
      platforms: platformStats
    });
  } catch (error: any) {
    console.error('获取平台统计错误:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: '获取统计失败',
      details: error.message
    });
  }
});

/**
 * 获取平台详情
 * GET /api/admin/analytics/platform/:platform
 */
analyticsRouter.get('/admin/platform/:platform', authenticate, requireAdmin, async (req, res) => {
  try {
    const { platform } = req.params;
    const { startDate, endDate } = req.query;
    const { start, end } = parseDateRange(startDate as string, endDate as string);

    if (!platform) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PLATFORM',
        message: '缺少平台参数'
      });
    }

    const detail = await analyticsService.getPlatformDetail(platform, start, end);

    res.json({
      success: true,
      dateRange: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      },
      ...detail
    });
  } catch (error: any) {
    console.error('获取平台详情错误:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: '获取详情失败',
      details: error.message
    });
  }
});

/**
 * 获取错误列表
 * GET /api/admin/analytics/errors
 */
analyticsRouter.get('/admin/errors', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, platform, errorCode, page, pageSize } = req.query;
    const { start, end } = parseDateRange(startDate as string, endDate as string);

    const result = await analyticsService.getErrorList(start, end, {
      platform: platform as string,
      errorCode: errorCode as string,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 20
    });

    res.json({
      success: true,
      dateRange: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      },
      ...result
    });
  } catch (error: any) {
    console.error('获取错误列表错误:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: '获取错误列表失败',
      details: error.message
    });
  }
});

/**
 * 获取用户统计
 * GET /api/admin/analytics/users
 */
analyticsRouter.get('/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, sortBy, page, pageSize } = req.query;
    const { start, end } = parseDateRange(startDate as string, endDate as string);

    const result = await analyticsService.getUserStats(start, end, {
      sortBy: sortBy as 'total' | 'success_rate' | 'avg_duration',
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 20
    });

    res.json({
      success: true,
      dateRange: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      },
      ...result
    });
  } catch (error: any) {
    console.error('获取用户统计错误:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: '获取用户统计失败',
      details: error.message
    });
  }
});
