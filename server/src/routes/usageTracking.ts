import express from 'express';
import { usageTrackingService } from '../services/UsageTrackingService';
import { quotaAlertService } from '../services/QuotaAlertService';
import { authenticate } from '../middleware/adminAuth';
import { FeatureCode } from '../config/features';

const router = express.Router();

// 所有路由都需要认证
router.use(authenticate);

/**
 * 获取用户配额概览
 * GET /api/usage/quota-overview
 */
router.get('/quota-overview', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const overview = await usageTrackingService.getUserQuotaOverview(userId);
    
    res.json({
      success: true,
      data: overview
    });
  } catch (error: any) {
    console.error('获取配额概览失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取配额概览失败'
    });
  }
});

/**
 * 检查单个功能配额
 * GET /api/usage/check-quota/:featureCode
 */
router.get('/check-quota/:featureCode', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const featureCode = req.params.featureCode as FeatureCode;
    
    const quota = await usageTrackingService.checkQuota(userId, featureCode);
    
    res.json({
      success: true,
      data: quota
    });
  } catch (error: any) {
    console.error('检查配额失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '检查配额失败'
    });
  }
});

/**
 * 获取使用记录
 * GET /api/usage/records
 */
router.get('/records', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const featureCode = req.query.feature_code as FeatureCode | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    
    const result = await usageTrackingService.getUserUsageRecords(
      userId,
      featureCode,
      page,
      pageSize
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('获取使用记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取使用记录失败'
    });
  }
});

/**
 * 获取使用统计
 * GET /api/usage/statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const featureCode = req.query.feature_code as FeatureCode;
    const startDate = req.query.start_date 
      ? new Date(req.query.start_date as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 默认30天前
    const endDate = req.query.end_date 
      ? new Date(req.query.end_date as string)
      : new Date(); // 默认今天
    
    if (!featureCode) {
      return res.status(400).json({
        success: false,
        message: '缺少功能代码参数'
      });
    }
    
    const statistics = await usageTrackingService.getUsageStatistics(
      userId,
      featureCode,
      startDate,
      endDate
    );
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error: any) {
    console.error('获取使用统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取使用统计失败'
    });
  }
});

/**
 * 获取配额预警
 * GET /api/usage/alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    
    const result = await quotaAlertService.getUserAlerts(userId, page, pageSize);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('获取配额预警失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取配额预警失败'
    });
  }
});

/**
 * 获取未读预警
 * GET /api/usage/alerts/unsent
 */
router.get('/alerts/unsent', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const alerts = await quotaAlertService.getUnsentAlerts(userId);
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error: any) {
    console.error('获取未读预警失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取未读预警失败'
    });
  }
});

/**
 * 标记预警为已读
 * PUT /api/usage/alerts/:id/mark-sent
 */
router.put('/alerts/:id/mark-sent', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const alertId = parseInt(req.params.id);
    
    if (isNaN(alertId)) {
      return res.status(400).json({
        success: false,
        message: '无效的预警ID'
      });
    }
    
    // ✅ 安全修复：验证预警是否属于当前用户
    await quotaAlertService.markAsSent(alertId, userId);
    
    res.json({
      success: true,
      message: '预警已标记为已读'
    });
  } catch (error: any) {
    console.error('标记预警失败:', error);
    
    // 返回适当的错误状态码
    const statusCode = error.message === '无权操作此预警' ? 403 : 500;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || '标记预警失败'
    });
  }
});

/**
 * 获取预警统计
 * GET /api/usage/alerts/statistics
 */
router.get('/alerts/statistics', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const statistics = await quotaAlertService.getAlertStatistics(userId);
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error: any) {
    console.error('获取预警统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取预警统计失败'
    });
  }
});

export default router;
