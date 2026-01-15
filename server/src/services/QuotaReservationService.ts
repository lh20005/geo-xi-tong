/**
 * 配额预扣减服务
 * 实现预扣减 + 确认/释放机制，防止配额竞态条件
 * 
 * 工作流程：
 * 1. Windows 端发起预扣减请求 (reserve)
 * 2. 服务器锁定配额，返回 reservationId
 * 3. Windows 端本地执行任务
 * 4a. 成功：调用确认接口 (confirm)，扣减配额
 * 4b. 失败：调用释放接口 (release)，恢复配额
 */

import { pool } from '../db/database';
import { quotaConsumptionService } from './QuotaConsumptionService';
import { getWebSocketService } from './WebSocketService';

// 配额类型映射到功能代码
const QUOTA_TYPE_TO_FEATURE_CODE: Record<string, string> = {
  'article_generation': 'article_generation',
  'publish': 'publish',
  'knowledge_upload': 'knowledge_upload',
  'image_upload': 'image_upload'
};

// 预留默认过期时间（10 分钟）
const DEFAULT_EXPIRATION_MINUTES = 10;

export interface ReserveParams {
  userId: number;
  quotaType: string;
  amount?: number;
  clientId?: string;
  taskInfo?: {
    taskType?: string;
    platform?: string;
    articleId?: string;
    [key: string]: any;
  };
}

export interface ReserveResult {
  success: boolean;
  reservationId?: string;
  expiresAt?: Date;
  remainingQuota?: number;
  error?: string;
  errorCode?: string;
}

export interface ConfirmParams {
  reservationId: string;
  result?: {
    status?: string;
    publishUrl?: string;
    duration?: number;
    [key: string]: any;
  };
}

export interface ConfirmResult {
  success: boolean;
  consumed?: number;
  remainingQuota?: number;
  error?: string;
  errorCode?: string;
}

export interface ReleaseParams {
  reservationId: string;
  reason?: string;
  errorCode?: string;
}

export interface ReleaseResult {
  success: boolean;
  released?: number;
  remainingQuota?: number;
  error?: string;
}

export interface QuotaInfoResult {
  quotas: {
    [key: string]: {
      used: number;
      limit: number;
      reserved: number;
      available: number;
    };
  };
}

export class QuotaReservationService {
  /**
   * 预扣减配额
   * @param params 预扣减参数
   * @returns 预扣减结果
   */
  async reserve(params: ReserveParams): Promise<ReserveResult> {
    const { userId, quotaType, amount = 1, clientId, taskInfo } = params;

    // 验证配额类型
    if (!QUOTA_TYPE_TO_FEATURE_CODE[quotaType]) {
      return {
        success: false,
        error: '无效的配额类型',
        errorCode: 'INVALID_QUOTA_TYPE'
      };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 检查可用配额（总配额 - 已用 - 已预留）
      const availableResult = await client.query(
        `SELECT get_available_quota_with_reservations($1, $2) as available`,
        [userId, quotaType]
      );
      
      const available = availableResult.rows[0]?.available || 0;

      if (available < amount) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: '配额不足',
          errorCode: 'INSUFFICIENT_QUOTA',
          remainingQuota: available
        };
      }

      // 2. 创建预留记录
      const expiresAt = new Date(Date.now() + DEFAULT_EXPIRATION_MINUTES * 60 * 1000);
      
      const insertResult = await client.query(
        `INSERT INTO quota_reservations (
          user_id, quota_type, amount, status, client_id, task_info, expires_at
        ) VALUES ($1, $2, $3, 'reserved', $4, $5, $6)
        RETURNING id, expires_at`,
        [userId, quotaType, amount, clientId || null, taskInfo ? JSON.stringify(taskInfo) : null, expiresAt]
      );

      const reservation = insertResult.rows[0];

      await client.query('COMMIT');

      // 3. 计算预扣减后的剩余配额
      const remainingQuota = available - amount;

      return {
        success: true,
        reservationId: reservation.id,
        expiresAt: reservation.expires_at,
        remainingQuota
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('配额预扣减失败:', error);
      return {
        success: false,
        error: '配额预扣减失败',
        errorCode: 'RESERVE_FAILED'
      };
    } finally {
      client.release();
    }
  }

  /**
   * 确认消费配额
   * @param params 确认参数
   * @returns 确认结果
   */
  async confirm(params: ConfirmParams): Promise<ConfirmResult> {
    const { reservationId, result } = params;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 查找预留记录
      const reservationResult = await client.query(
        `SELECT * FROM quota_reservations 
         WHERE id = $1 AND status = 'reserved'
         FOR UPDATE`,
        [reservationId]
      );

      if (reservationResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: '预留记录不存在或已处理',
          errorCode: 'RESERVATION_NOT_FOUND'
        };
      }

      const reservation = reservationResult.rows[0];

      // 检查是否已过期
      if (new Date(reservation.expires_at) < new Date()) {
        await client.query(
          `UPDATE quota_reservations SET status = 'expired' WHERE id = $1`,
          [reservationId]
        );
        await client.query('COMMIT');
        return {
          success: false,
          error: '预留已过期',
          errorCode: 'RESERVATION_EXPIRED'
        };
      }

      // 2. 更新预留状态为已确认
      const taskInfoUpdate = result 
        ? { ...reservation.task_info, confirmResult: result }
        : reservation.task_info;

      await client.query(
        `UPDATE quota_reservations 
         SET status = 'confirmed', confirmed_at = NOW(), task_info = $2
         WHERE id = $1`,
        [reservationId, JSON.stringify(taskInfoUpdate)]
      );

      // 3. 扣减实际配额
      const featureCode = QUOTA_TYPE_TO_FEATURE_CODE[reservation.quota_type];
      const consumeResult = await quotaConsumptionService.consumeQuota(
        reservation.user_id,
        featureCode,
        reservation.amount,
        { reservationId, ...result }
      );

      if (!consumeResult.success) {
        // 如果扣减失败，回滚预留状态
        await client.query('ROLLBACK');
        return {
          success: false,
          error: consumeResult.errorMessage || '配额扣减失败',
          errorCode: 'CONSUME_FAILED'
        };
      }

      await client.query('COMMIT');

      // 4. 获取剩余配额
      const remainingResult = await pool.query(
        `SELECT get_available_quota_with_reservations($1, $2) as available`,
        [reservation.user_id, reservation.quota_type]
      );

      // 5. 推送配额更新通知
      try {
        const wsService = getWebSocketService();
        wsService.broadcast(reservation.user_id, 'quota_reservation_confirmed', {
          reservationId,
          quotaType: reservation.quota_type,
          consumed: reservation.amount
        });
      } catch (error) {
        console.error('推送配额确认通知失败:', error);
      }

      return {
        success: true,
        consumed: reservation.amount,
        remainingQuota: remainingResult.rows[0]?.available || 0
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('配额确认失败:', error);
      return {
        success: false,
        error: '配额确认失败',
        errorCode: 'CONFIRM_FAILED'
      };
    } finally {
      client.release();
    }
  }

  /**
   * 释放预留配额
   * @param params 释放参数
   * @returns 释放结果
   */
  async release(params: ReleaseParams): Promise<ReleaseResult> {
    const { reservationId, reason, errorCode } = params;

    try {
      // 1. 查找并更新预留记录
      const result = await pool.query(
        `UPDATE quota_reservations 
         SET status = 'released', 
             released_at = NOW(),
             task_info = COALESCE(task_info, '{}'::jsonb) || $2::jsonb
         WHERE id = $1 AND status = 'reserved'
         RETURNING user_id, quota_type, amount`,
        [reservationId, JSON.stringify({ releaseReason: reason, releaseErrorCode: errorCode })]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          error: '预留记录不存在或已处理'
        };
      }

      const reservation = result.rows[0];

      // 2. 获取释放后的剩余配额
      const remainingResult = await pool.query(
        `SELECT get_available_quota_with_reservations($1, $2) as available`,
        [reservation.user_id, reservation.quota_type]
      );

      // 3. 推送配额更新通知
      try {
        const wsService = getWebSocketService();
        wsService.broadcast(reservation.user_id, 'quota_reservation_released', {
          reservationId,
          quotaType: reservation.quota_type,
          released: reservation.amount,
          reason
        });
      } catch (error) {
        console.error('推送配额释放通知失败:', error);
      }

      return {
        success: true,
        released: reservation.amount,
        remainingQuota: remainingResult.rows[0]?.available || 0
      };
    } catch (error) {
      console.error('配额释放失败:', error);
      return {
        success: false,
        error: '配额释放失败'
      };
    }
  }

  /**
   * 获取用户配额信息（包含预留）
   * @param userId 用户 ID
   * @returns 配额信息
   */
  async getQuotaInfo(userId: number): Promise<QuotaInfoResult> {
    const quotaTypes = Object.keys(QUOTA_TYPE_TO_FEATURE_CODE);
    const quotas: QuotaInfoResult['quotas'] = {};

    for (const quotaType of quotaTypes) {
      // 获取可用配额（已考虑预留）
      const availableResult = await pool.query(
        `SELECT get_available_quota_with_reservations($1, $2) as available`,
        [userId, quotaType]
      );

      // 获取已预留数量
      const reservedResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as reserved
         FROM quota_reservations
         WHERE user_id = $1 AND quota_type = $2 AND status = 'reserved' AND expires_at > NOW()`,
        [userId, quotaType]
      );

      // 获取总配额和已用配额
      const featureCode = QUOTA_TYPE_TO_FEATURE_CODE[quotaType];
      const quotaCheck = await quotaConsumptionService.checkCombinedQuota(userId, featureCode);

      const available = availableResult.rows[0]?.available || 0;
      const reserved = parseInt(reservedResult.rows[0]?.reserved || '0');
      const limit = quotaCheck.baseQuota.limit + quotaCheck.boosterQuota.totalLimit;
      const used = quotaCheck.baseQuota.used + quotaCheck.boosterQuota.totalUsed;

      quotas[quotaType] = {
        used,
        limit,
        reserved,
        available
      };
    }

    return { quotas };
  }

  /**
   * 清理过期的预留记录
   * @returns 清理的记录数
   */
  async cleanupExpiredReservations(): Promise<number> {
    try {
      const result = await pool.query(
        `SELECT cleanup_expired_reservations() as count`
      );
      const count = result.rows[0]?.count || 0;
      
      if (count > 0) {
        console.log(`已清理 ${count} 条过期的配额预留记录`);
      }
      
      return count;
    } catch (error) {
      console.error('清理过期预留失败:', error);
      return 0;
    }
  }

  /**
   * 获取用户的预留记录
   * @param userId 用户 ID
   * @param status 状态筛选
   * @returns 预留记录列表
   */
  async getUserReservations(userId: number, status?: string): Promise<any[]> {
    let query = `
      SELECT id, quota_type, amount, status, client_id, task_info, 
             created_at, expires_at, confirmed_at, released_at
      FROM quota_reservations
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    return result.rows;
  }
}

export const quotaReservationService = new QuotaReservationService();
