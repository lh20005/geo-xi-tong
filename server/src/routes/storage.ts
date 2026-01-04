import express, { Request, Response } from 'express';
import { storageService } from '../services/StorageService';
import { storageQuotaService } from '../services/StorageQuotaService';
import { storageAlertService } from '../services/StorageAlertService';
import { authenticate } from '../middleware/adminAuth';

const router = express.Router();

// 所有路由都需要认证
router.use(authenticate);

/**
 * GET /api/storage/usage
 * 获取当前存储使用情况
 */
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const usage = await storageService.getUserStorageUsage(userId);

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('[Storage API] 获取使用情况失败:', error);
    res.status(500).json({
      success: false,
      message: '获取存储使用情况失败'
    });
  }
});

/**
 * GET /api/storage/breakdown
 * 获取存储明细（按资源类型）
 */
router.get('/breakdown', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const breakdown = await storageService.getStorageBreakdown(userId);

    res.json({
      success: true,
      data: breakdown
    });
  } catch (error) {
    console.error('[Storage API] 获取存储明细失败:', error);
    res.status(500).json({
      success: false,
      message: '获取存储明细失败'
    });
  }
});

/**
 * POST /api/storage/check-quota
 * 检查文件上传是否允许
 */
router.post('/check-quota', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { fileSizeBytes, resourceType } = req.body;

    if (!fileSizeBytes || !resourceType) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: fileSizeBytes, resourceType'
      });
    }

    // 验证文件大小
    const sizeValidation = await storageQuotaService.validateFileSize(
      resourceType,
      fileSizeBytes
    );

    if (!sizeValidation.valid) {
      return res.status(413).json({
        success: false,
        message: sizeValidation.reason,
        data: {
          allowed: false,
          reason: sizeValidation.reason,
          maxSizeBytes: sizeValidation.maxSizeBytes
        }
      });
    }

    // 检查配额
    const quotaCheck = await storageQuotaService.checkQuota(userId, fileSizeBytes);

    if (!quotaCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: quotaCheck.reason,
        data: quotaCheck
      });
    }

    res.json({
      success: true,
      data: quotaCheck
    });
  } catch (error) {
    console.error('[Storage API] 检查配额失败:', error);
    res.status(500).json({
      success: false,
      message: '检查配额失败'
    });
  }
});

/**
 * GET /api/storage/history
 * 获取存储使用历史
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: startDate, endDate'
      });
    }

    const history = await storageService.getStorageHistory(
      userId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('[Storage API] 获取历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取存储历史失败'
    });
  }
});

/**
 * GET /api/storage/transactions
 * 获取存储事务日志
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

    const { pool } = require('../db/database');
    
    // 获取事务记录
    const result = await pool.query(
      `SELECT 
        id,
        resource_type as "resourceType",
        resource_id as "resourceId",
        operation,
        size_bytes as "sizeBytes",
        metadata,
        created_at as "createdAt"
      FROM storage_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset]
    );

    // 获取总数
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM storage_transactions WHERE user_id = $1',
      [userId]
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        transactions: result.rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (error) {
    console.error('[Storage API] 获取事务日志失败:', error);
    res.status(500).json({
      success: false,
      message: '获取事务日志失败'
    });
  }
});

/**
 * GET /api/storage/alerts
 * 获取待处理的警报
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const alerts = await storageAlertService.getPendingAlerts(userId);

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('[Storage API] 获取警报失败:', error);
    res.status(500).json({
      success: false,
      message: '获取警报失败'
    });
  }
});

/**
 * GET /api/storage/growth-rate
 * 计算存储增长率
 */
router.get('/growth-rate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { period = 'daily' } = req.query; // daily, weekly, monthly

    const { pool } = require('../db/database');
    
    let daysBack = 7;
    if (period === 'weekly') daysBack = 7;
    else if (period === 'monthly') daysBack = 30;
    else daysBack = 1;

    // 获取历史数据
    const result = await pool.query(
      `SELECT 
        snapshot_date as date,
        total_storage_bytes as "totalBytes",
        image_storage_bytes as "imageBytes",
        document_storage_bytes as "documentBytes",
        article_storage_bytes as "articleBytes"
      FROM storage_usage_history
      WHERE user_id = $1 
        AND snapshot_date >= CURRENT_DATE - INTERVAL '${daysBack + 1} days'
      ORDER BY snapshot_date ASC`,
      [userId]
    );

    if (result.rows.length < 2) {
      return res.json({
        success: true,
        data: {
          growthRate: 0,
          growthBytes: 0,
          period,
          message: '数据不足，无法计算增长率'
        }
      });
    }

    const oldest = result.rows[0];
    const newest = result.rows[result.rows.length - 1];
    
    const growthBytes = newest.totalBytes - oldest.totalBytes;
    const growthRate = oldest.totalBytes > 0 
      ? ((growthBytes / oldest.totalBytes) * 100).toFixed(2)
      : 0;

    // 找出增长最快的资源类型
    const imageGrowth = newest.imageBytes - oldest.imageBytes;
    const documentGrowth = newest.documentBytes - oldest.documentBytes;
    const articleGrowth = newest.articleBytes - oldest.articleBytes;

    let fastestGrowingType = 'none';
    let fastestGrowthBytes = 0;

    if (imageGrowth > documentGrowth && imageGrowth > articleGrowth) {
      fastestGrowingType = 'image';
      fastestGrowthBytes = imageGrowth;
    } else if (documentGrowth > articleGrowth) {
      fastestGrowingType = 'document';
      fastestGrowthBytes = documentGrowth;
    } else if (articleGrowth > 0) {
      fastestGrowingType = 'article';
      fastestGrowthBytes = articleGrowth;
    }

    res.json({
      success: true,
      data: {
        period,
        daysAnalyzed: result.rows.length - 1,
        growthBytes,
        growthRate: parseFloat(growthRate as string),
        fastestGrowingType,
        fastestGrowthBytes,
        breakdown: {
          imageGrowth,
          documentGrowth,
          articleGrowth
        },
        startDate: oldest.date,
        endDate: newest.date
      }
    });
  } catch (error) {
    console.error('[Storage API] 计算增长率失败:', error);
    res.status(500).json({
      success: false,
      message: '计算增长率失败'
    });
  }
});

/**
 * GET /api/storage/export
 * 导出存储历史为 CSV
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: startDate, endDate'
      });
    }

    const history = await storageService.getStorageHistory(
      userId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    // 生成 CSV
    const csvHeader = 'Date,Total (MB),Images (MB),Documents (MB),Articles (MB)\n';
    const csvRows = history.map(entry => {
      const date = new Date(entry.date).toISOString().split('T')[0];
      const total = (entry.totalBytes / 1024 / 1024).toFixed(2);
      const images = (entry.imageBytes / 1024 / 1024).toFixed(2);
      const documents = (entry.documentBytes / 1024 / 1024).toFixed(2);
      const articles = (entry.articleBytes / 1024 / 1024).toFixed(2);
      return `${date},${total},${images},${documents},${articles}`;
    }).join('\n');

    const csv = csvHeader + csvRows;

    // 设置响应头
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="storage-history-${startDate}-${endDate}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('[Storage API] 导出失败:', error);
    res.status(500).json({
      success: false,
      message: '导出存储历史失败'
    });
  }
});

export default router;
