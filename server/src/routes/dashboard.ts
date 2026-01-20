import { Router, Request, Response } from 'express';
import { DashboardService } from '../services/DashboardService';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

export const dashboardRouter = Router();
const dashboardService = new DashboardService();

// 应用认证和租户中间件
dashboardRouter.use(authenticate);
dashboardRouter.use(setTenantContext);
dashboardRouter.use(requireTenantContext);

// 获取核心业务指标
dashboardRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const { startDate, endDate } = req.query;
    const metrics = await dashboardService.getMetrics(
      userId,
      startDate as string,
      endDate as string
    );
    res.json(metrics);
  } catch (error) {
    console.error('获取核心指标失败:', error);
    res.status(500).json({ error: '获取核心指标失败' });
  }
});

// 获取内容生产趋势数据
dashboardRouter.get('/trends', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const { startDate, endDate } = req.query;
    const trends = await dashboardService.getTrends(
      userId,
      startDate as string,
      endDate as string
    );
    res.json(trends);
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    res.status(500).json({ error: '获取趋势数据失败' });
  }
});

// 获取发布平台分布
dashboardRouter.get('/platform-distribution', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const { startDate, endDate } = req.query;
    const distribution = await dashboardService.getPlatformDistribution(
      userId,
      startDate as string,
      endDate as string
    );
    res.json(distribution);
  } catch (error) {
    console.error('获取平台分布失败:', error);
    res.status(500).json({ error: '获取平台分布失败' });
  }
});

// 获取发布任务状态分布
dashboardRouter.get('/publishing-status', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const { startDate, endDate } = req.query;
    const status = await dashboardService.getPublishingStatus(
      userId,
      startDate as string,
      endDate as string
    );
    res.json(status);
  } catch (error) {
    console.error('获取发布状态失败:', error);
    res.status(500).json({ error: '获取发布状态失败' });
  }
});

// 获取资源使用效率
dashboardRouter.get('/resource-usage', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const { startDate, endDate } = req.query;
    const usage = await dashboardService.getResourceUsage(
      userId,
      startDate as string,
      endDate as string
    );
    res.json(usage);
  } catch (error) {
    console.error('获取资源使用率失败:', error);
    res.status(500).json({ error: '获取资源使用率失败' });
  }
});

// 获取文章生成任务概览
dashboardRouter.get('/generation-tasks', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const { startDate, endDate } = req.query;
    const tasks = await dashboardService.getGenerationTasks(
      userId,
      startDate as string,
      endDate as string
    );
    res.json(tasks);
  } catch (error) {
    console.error('获取生成任务概览失败:', error);
    res.status(500).json({ error: '获取生成任务概览失败' });
  }
});

// 获取知识库和转化目标使用排行
dashboardRouter.get('/top-resources', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const { startDate, endDate } = req.query;
    const resources = await dashboardService.getTopResources(
      userId,
      startDate as string,
      endDate as string
    );
    res.json(resources);
  } catch (error) {
    console.error('获取资源排行失败:', error);
    res.status(500).json({ error: '获取资源排行失败' });
  }
});

// 获取文章详细统计
dashboardRouter.get('/article-stats', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const stats = await dashboardService.getArticleStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('获取文章统计失败:', error);
    res.status(500).json({ error: '获取文章统计失败' });
  }
});

// 获取关键词分布
dashboardRouter.get('/keyword-distribution', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const distribution = await dashboardService.getKeywordDistribution(userId);
    res.json(distribution);
  } catch (error) {
    console.error('获取关键词分布失败:', error);
    res.status(500).json({ error: '获取关键词分布失败' });
  }
});

// 获取月度对比数据
dashboardRouter.get('/monthly-comparison', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const comparison = await dashboardService.getMonthlyComparison(userId);
    res.json(comparison);
  } catch (error) {
    console.error('获取月度对比失败:', error);
    res.status(500).json({ error: '获取月度对比失败' });
  }
});

// 获取24小时活动分布
dashboardRouter.get('/hourly-activity', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const activity = await dashboardService.getHourlyActivity(userId);
    res.json(activity);
  } catch (error) {
    console.error('获取活动分布失败:', error);
    res.status(500).json({ error: '获取活动分布失败' });
  }
});

// 获取成功率数据
dashboardRouter.get('/success-rates', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const rates = await dashboardService.getSuccessRates(userId);
    res.json(rates);
  } catch (error) {
    console.error('获取成功率失败:', error);
    res.status(500).json({ error: '获取成功率失败' });
  }
});

// 获取发布趋势数据
dashboardRouter.get('/publishing-trend', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const { startDate, endDate } = req.query;
    const trend = await dashboardService.getPublishingTrend(
      userId,
      startDate as string,
      endDate as string
    );
    res.json(trend);
  } catch (error) {
    console.error('获取发布趋势失败:', error);
    res.status(500).json({ error: '获取发布趋势失败' });
  }
});

// 获取内容转化漏斗数据
dashboardRouter.get('/content-funnel', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const { startDate, endDate } = req.query;
    const funnel = await dashboardService.getContentFunnel(
      userId,
      startDate as string,
      endDate as string
    );
    res.json(funnel);
  } catch (error) {
    console.error('获取内容漏斗失败:', error);
    res.status(500).json({ error: '获取内容漏斗失败' });
  }
});

// 获取周环比对比数据
dashboardRouter.get('/weekly-comparison', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const comparison = await dashboardService.getWeeklyComparison(userId);
    res.json(comparison);
  } catch (error) {
    console.error('获取周环比失败:', error);
    res.status(500).json({ error: '获取周环比失败' });
  }
});

// 获取最近发布记录
dashboardRouter.get('/recent-publishing', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const records = await dashboardService.getRecentPublishing(userId);
    res.json(records);
  } catch (error) {
    console.error('获取最近发布失败:', error);
    res.status(500).json({ error: '获取最近发布失败' });
  }
});

// 获取平台发布成功率
dashboardRouter.get('/platform-success-rate', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const rates = await dashboardService.getPlatformSuccessRate(userId);
    res.json(rates);
  } catch (error) {
    console.error('获取平台成功率失败:', error);
    res.status(500).json({ error: '获取平台成功率失败' });
  }
});

// 获取平台账号状态
dashboardRouter.get('/platform-account-status', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentTenantId(req);
    const status = await dashboardService.getPlatformAccountStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('获取平台账号状态失败:', error);
    res.status(500).json({ error: '获取平台账号状态失败' });
  }
});
