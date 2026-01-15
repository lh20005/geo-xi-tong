import express from 'express';
import { quotaService } from '../services/QuotaService';
import { quotaReservationService } from '../services/QuotaReservationService';
import { getCurrentTenantId, requireTenantContext } from '../middleware/tenantContext';

const router = express.Router();

/**
 * 配额管理路由
 */

// ==================== 配额预扣减 API（新增） ====================

/**
 * 预扣减配额
 * POST /api/quota/reserve
 * 
 * Request Body:
 * {
 *   quotaType: 'article_generation' | 'publish' | 'knowledge_upload' | 'image_upload',
 *   amount?: number,        // 预扣减数量，默认 1
 *   clientId?: string,      // 客户端标识（用于多设备识别）
 *   taskInfo?: object       // 可选的任务信息
 * }
 */
router.post('/reserve', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { quotaType, amount, clientId, taskInfo } = req.body;

    if (!quotaType) {
      return res.status(400).json({
        success: false,
        error: '缺少配额类型',
        errorCode: 'MISSING_QUOTA_TYPE'
      });
    }

    const result = await quotaReservationService.reserve({
      userId,
      quotaType,
      amount: amount || 1,
      clientId,
      taskInfo
    });

    if (!result.success) {
      const statusCode = result.errorCode === 'INSUFFICIENT_QUOTA' ? 403 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('配额预扣减失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 确认消费配额
 * POST /api/quota/confirm
 * 
 * Request Body:
 * {
 *   reservationId: 'uuid-xxx',
 *   result?: object         // 可选的执行结果
 * }
 */
router.post('/confirm', requireTenantContext, async (req, res) => {
  try {
    const { reservationId, result } = req.body;

    if (!reservationId) {
      return res.status(400).json({
        success: false,
        error: '缺少预留 ID',
        errorCode: 'MISSING_RESERVATION_ID'
      });
    }

    const confirmResult = await quotaReservationService.confirm({
      reservationId,
      result
    });

    if (!confirmResult.success) {
      const statusCode = confirmResult.errorCode === 'RESERVATION_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(confirmResult);
    }

    res.json(confirmResult);
  } catch (error) {
    console.error('配额确认失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 释放预留配额
 * POST /api/quota/release
 * 
 * Request Body:
 * {
 *   reservationId: 'uuid-xxx',
 *   reason?: string,        // 失败原因
 *   errorCode?: string      // 错误码
 * }
 */
router.post('/release', requireTenantContext, async (req, res) => {
  try {
    const { reservationId, reason, errorCode } = req.body;

    if (!reservationId) {
      return res.status(400).json({
        success: false,
        error: '缺少预留 ID',
        errorCode: 'MISSING_RESERVATION_ID'
      });
    }

    const releaseResult = await quotaReservationService.release({
      reservationId,
      reason,
      errorCode
    });

    if (!releaseResult.success) {
      return res.status(400).json(releaseResult);
    }

    res.json(releaseResult);
  } catch (error) {
    console.error('配额释放失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 获取用户配额信息（包含预留）
 * GET /api/quota/info
 */
router.get('/info', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const quotaInfo = await quotaReservationService.getQuotaInfo(userId);
    res.json(quotaInfo);
  } catch (error) {
    console.error('获取配额信息失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 获取用户的预留记录
 * GET /api/quota/reservations
 */
router.get('/reservations', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { status } = req.query;
    const reservations = await quotaReservationService.getUserReservations(
      userId,
      status as string | undefined
    );
    res.json({ reservations });
  } catch (error) {
    console.error('获取预留记录失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

// ==================== 原有配额 API ====================

/**
 * 获取当前用户的配额使用情况
 * GET /api/quota
 */
router.get('/', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const summary = await quotaService.getQuotaSummary(userId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('获取配额信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配额信息失败'
    });
  }
});

/**
 * 检查特定资源的配额
 * GET /api/quota/check/:resourceType
 */
router.get('/check/:resourceType', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const resourceType = req.params.resourceType as any;
    const count = parseInt(req.query.count as string) || 1;

    const result = await quotaService.checkQuota(userId, resourceType, count);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('检查配额失败:', error);
    res.status(500).json({
      success: false,
      message: '检查配额失败'
    });
  }
});

/**
 * 获取用户当前套餐信息
 * GET /api/quota/plan
 */
router.get('/plan', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const plan = await quotaService.getUserPlan(userId);
    const quotas = await quotaService.getUserQuotas(userId);

    res.json({
      success: true,
      data: {
        plan,
        quotas
      }
    });
  } catch (error) {
    console.error('获取套餐信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取套餐信息失败'
    });
  }
});

export default router;
