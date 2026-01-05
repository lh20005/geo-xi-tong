import express, { Request, Response } from 'express';
import { storageService } from '../../services/StorageService';
import { storageQuotaService } from '../../services/StorageQuotaService';
import { authenticate, requireAdmin } from '../../middleware/adminAuth';
import { pool } from '../../db/database';

const router = express.Router();

// 所有路由都需要管理员认证
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/admin/storage/users
 * 获取所有用户的存储使用情况
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

    // 获取用户存储信息
    const result = await pool.query(
      `SELECT 
        u.id as "userId",
        u.username,
        u.email,
        u.role,
        s.image_storage_bytes as "imageStorageBytes",
        s.document_storage_bytes as "documentStorageBytes",
        s.article_storage_bytes as "articleStorageBytes",
        s.total_storage_bytes as "totalStorageBytes",
        s.image_count as "imageCount",
        s.document_count as "documentCount",
        s.article_count as "articleCount",
        s.storage_quota_bytes as "storageQuotaBytes",
        s.purchased_storage_bytes as "purchasedStorageBytes",
        s.last_updated_at as "lastUpdatedAt"
      FROM users u
      LEFT JOIN user_storage_usage s ON u.id = s.user_id
      ORDER BY s.total_storage_bytes DESC NULLS LAST
      LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    // 获取总数
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count);

    // 计算每个用户的使用百分比和可用空间
    const users = result.rows.map(user => {
      const effectiveQuota = user.storageQuotaBytes + user.purchasedStorageBytes;
      return {
        ...user,
        effectiveQuotaBytes: effectiveQuota,
        availableBytes: effectiveQuota === -1 ? -1 : Math.max(0, effectiveQuota - user.totalStorageBytes),
        usagePercentage: effectiveQuota === -1 ? 0 : 
          Math.round((user.totalStorageBytes / effectiveQuota) * 100 * 100) / 100
      };
    });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (error) {
    console.error('[Admin Storage API] 获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户存储列表失败'
    });
  }
});

/**
 * GET /api/admin/storage/breakdown/:userId
 * 获取指定用户的存储明细
 */
router.get('/breakdown/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户ID'
      });
    }

    const breakdown = await storageService.getStorageBreakdown(userId);

    res.json({
      success: true,
      data: breakdown
    });
  } catch (error) {
    console.error('[Admin Storage API] 获取用户明细失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户存储明细失败'
    });
  }
});

/**
 * PUT /api/admin/storage/quota/:userId
 * 更新用户的存储配额
 */
router.put('/quota/:userId', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const userId = parseInt(req.params.userId);
    const { quotaBytes, reason } = req.body;
    const adminId = (req as any).user.userId;

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户ID'
      });
    }

    if (quotaBytes === undefined || quotaBytes === null) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: quotaBytes'
      });
    }

    // ✅ 安全修复：使用事务确保配额更新和日志记录的原子性
    await client.query('BEGIN');

    // 获取旧配额
    const oldUsage = await storageService.getUserStorageUsage(userId);
    const oldQuota = oldUsage.storageQuotaBytes;

    // 更新配额
    await storageService.updateStorageQuota(userId, quotaBytes);

    // 记录配额修改日志（确保表存在）
    try {
      await client.query(
        `INSERT INTO admin_quota_modifications (
          admin_id, user_id, feature_type, 
          old_quota, new_quota, reason
        ) VALUES ($1, $2, 'storage_space', $3, $4, $5)`,
        [adminId, userId, oldQuota, quotaBytes, reason || '管理员手动调整']
      );
    } catch (logError: any) {
      // 如果日志表不存在，记录警告但不影响主流程
      if (logError.code === '42P01') {
        console.warn('[Admin Storage API] admin_quota_modifications 表不存在，跳过日志记录');
      } else {
        throw logError;
      }
    }

    await client.query('COMMIT');

    console.log(`[Admin Storage API] 管理员 ${adminId} 更新用户 ${userId} 配额: ${oldQuota} -> ${quotaBytes}`);

    res.json({
      success: true,
      message: '配额更新成功',
      data: {
        userId,
        oldQuotaBytes: oldQuota,
        newQuotaBytes: quotaBytes
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Admin Storage API] 更新配额失败:', error);
    res.status(500).json({
      success: false,
      message: '更新配额失败'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/storage/stats
 * 获取系统存储统计
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // 获取总体统计
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as "totalUsers",
        SUM(total_storage_bytes) as "totalStorageUsed",
        AVG(total_storage_bytes) as "avgStoragePerUser",
        SUM(CASE WHEN storage_quota_bytes != -1 THEN storage_quota_bytes + purchased_storage_bytes ELSE 0 END) as "totalQuotaAllocated"
      FROM user_storage_usage`
    );

    // 获取资源类型分布
    const distributionResult = await pool.query(
      `SELECT 
        SUM(image_storage_bytes) as "totalImageBytes",
        SUM(document_storage_bytes) as "totalDocumentBytes",
        SUM(article_storage_bytes) as "totalArticleBytes",
        SUM(image_count) as "totalImages",
        SUM(document_count) as "totalDocuments",
        SUM(article_count) as "totalArticles"
      FROM user_storage_usage`
    );

    // 获取配额超限用户数
    const overQuotaResult = await pool.query(
      `SELECT COUNT(*) as "overQuotaUsers"
      FROM user_storage_usage
      WHERE storage_quota_bytes != -1 
        AND total_storage_bytes >= (storage_quota_bytes + purchased_storage_bytes)`
    );

    // 获取接近配额用户数（>80%）
    const nearQuotaResult = await pool.query(
      `SELECT COUNT(*) as "nearQuotaUsers"
      FROM user_storage_usage
      WHERE storage_quota_bytes != -1 
        AND total_storage_bytes >= (storage_quota_bytes + purchased_storage_bytes) * 0.8
        AND total_storage_bytes < (storage_quota_bytes + purchased_storage_bytes)`
    );

    const stats = statsResult.rows[0];
    const distribution = distributionResult.rows[0];
    const overQuota = overQuotaResult.rows[0];
    const nearQuota = nearQuotaResult.rows[0];

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers: parseInt(stats.totalUsers),
          totalStorageUsed: parseInt(stats.totalStorageUsed) || 0,
          avgStoragePerUser: parseFloat(stats.avgStoragePerUser) || 0,
          totalQuotaAllocated: parseInt(stats.totalQuotaAllocated) || 0
        },
        distribution: {
          images: {
            totalBytes: parseInt(distribution.totalImageBytes) || 0,
            count: parseInt(distribution.totalImages) || 0
          },
          documents: {
            totalBytes: parseInt(distribution.totalDocumentBytes) || 0,
            count: parseInt(distribution.totalDocuments) || 0
          },
          articles: {
            totalBytes: parseInt(distribution.totalArticleBytes) || 0,
            count: parseInt(distribution.totalArticles) || 0
          }
        },
        alerts: {
          overQuotaUsers: parseInt(overQuota.overQuotaUsers),
          nearQuotaUsers: parseInt(nearQuota.nearQuotaUsers)
        }
      }
    });
  } catch (error) {
    console.error('[Admin Storage API] 获取统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取存储统计失败'
    });
  }
});

/**
 * POST /api/admin/storage/reconcile/:userId
 * 触发用户存储对账
 */
router.post('/reconcile/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户ID'
      });
    }

    const result = await storageService.reconcileStorage(userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Admin Storage API] 对账失败:', error);
    res.status(500).json({
      success: false,
      message: '存储对账失败'
    });
  }
});

export default router;
