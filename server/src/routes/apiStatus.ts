import { Router } from 'express';
import { systemApiConfigService } from '../services/SystemApiConfigService';
import { authenticate } from '../middleware/adminAuth';

export const apiStatusRouter = Router();

/**
 * 获取当前可用的AI服务状态（普通用户）
 * GET /api/api-status
 */
apiStatusRouter.get('/', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const tenantId = (req as any).user?.tenantId;
    
    // 获取激活的系统配置
    const config = await systemApiConfigService.getActiveConfig();
    
    if (!config) {
      return res.json({
        configured: false,
        message: '系统未配置AI服务，请联系管理员'
      });
    }
    
    // 检查配额
    let quota = null;
    if (tenantId) {
      quota = await systemApiConfigService.checkQuota(tenantId);
    }
    
    res.json({
      configured: true,
      provider: config.provider,
      ollamaModel: config.ollamaModel,
      quota: quota ? {
        monthlyLimit: quota.monthlyLimit,
        monthlyUsed: quota.monthlyUsed,
        monthlyRemaining: quota.monthlyLimit - quota.monthlyUsed,
        dailyLimit: quota.dailyLimit,
        dailyUsed: quota.dailyUsed,
        dailyRemaining: quota.dailyLimit - quota.dailyUsed
      } : null
    });
  } catch (error: any) {
    console.error('获取API状态失败:', error);
    res.status(500).json({
      configured: false,
      message: '获取API状态失败'
    });
  }
});

/**
 * 获取我的使用统计
 * GET /api/api-status/my-usage
 */
apiStatusRouter.get('/my-usage', authenticate, async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '无法获取租户信息'
      });
    }
    
    const stats = await systemApiConfigService.getUsageStats(tenantId, days);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('获取使用统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取使用统计失败'
    });
  }
});
