import { pool } from '../db/database';
import { redisClient } from '../db/redis';

/**
 * 异常检测服务
 * 检测可疑的支付行为和配额使用模式
 */
export class AnomalyDetectionService {
  /**
   * 记录支付失败
   */
  static async recordPaymentFailure(userId: number, orderNo: string): Promise<void> {
    const key = `payment:failures:${userId}`;
    const now = Date.now();

    try {
      // 记录失败时间戳（新版 Redis 客户端语法）
      await redisClient.zAdd(key, { score: now, value: orderNo });
      
      // 设置过期时间（1小时）
      await redisClient.expire(key, 3600);

      // 检查是否异常
      await this.checkPaymentFailures(userId);
    } catch (error) {
      console.error('记录支付失败时出错:', error);
    }
  }

  /**
   * 检查支付失败次数
   */
  static async checkPaymentFailures(userId: number): Promise<void> {
    const key = `payment:failures:${userId}`;
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1小时前

    try {
      // 获取1小时内的失败次数（新版 Redis 客户端语法）
      const failures = await redisClient.zCount(key, oneHourAgo, now);

      if (typeof failures === 'number' && failures >= 5) {
        // 触发告警
        await this.triggerAlert({
          type: 'payment_failures',
          userId,
          severity: 'high',
          message: `用户 ${userId} 在1小时内支付失败 ${failures} 次`,
          details: { failures, timeWindow: '1h' },
        });

        // 临时锁定用户支付功能（可选）
        await redisClient.setEx(`payment:locked:${userId}`, 3600, '1');
      }
    } catch (error) {
      console.error('检查支付失败时出错:', error);
    }
  }

  /**
   * 检查配额使用异常
   */
  static async checkQuotaUsageAnomaly(
    userId: number,
    featureCode: string,
    usageCount: number
  ): Promise<void> {
    const key = `quota:usage:${userId}:${featureCode}`;
    const now = Date.now();

    try {
      // 记录使用时间戳（新版 Redis 客户端语法）
      await redisClient.zAdd(key, { score: now, value: now.toString() });
      await redisClient.expire(key, 3600);

      // 获取最近1小时的使用次数
      const oneHourAgo = now - 3600000;
      const recentUsage = await redisClient.zCount(key, oneHourAgo, now);

      // 获取用户配额限制（考虑自定义配额）
      const quotaResult = await pool.query(
        `SELECT pf.feature_value, us.custom_quotas
         FROM user_subscriptions us
         JOIN plan_features pf ON us.plan_id = pf.plan_id
         WHERE us.user_id = $1 
         AND us.status = 'active'
         AND pf.feature_code = $2`,
        [userId, featureCode]
      );

      if (quotaResult.rows.length > 0 && typeof recentUsage === 'number') {
        const row = quotaResult.rows[0];
        const customQuotas = row.custom_quotas || {};
        // 优先使用自定义配额，如果没有则使用套餐默认配额
        const quota = customQuotas[featureCode] !== undefined 
          ? customQuotas[featureCode] 
          : row.feature_value;

        // 如果1小时内使用量超过配额的80%，触发告警
        if (quota !== -1 && recentUsage > quota * 0.8) {
          await this.triggerAlert({
            type: 'quota_usage_spike',
            userId,
            severity: 'medium',
            message: `用户 ${userId} 的 ${featureCode} 使用量异常`,
            details: {
              featureCode,
              recentUsage,
              quota,
              percentage: Math.round((recentUsage / quota) * 100),
            },
          });
        }
      }
    } catch (error) {
      console.error('检查配额使用异常时出错:', error);
    }
  }

  /**
   * 检查短时间内大量订单创建
   */
  static async checkOrderCreationSpike(userId: number): Promise<void> {
    const key = `orders:created:${userId}`;
    const now = Date.now();
    const fiveMinutesAgo = now - 300000; // 5分钟前

    try {
      // 记录订单创建时间（新版 Redis 客户端语法）
      await redisClient.zAdd(key, { score: now, value: now.toString() });
      await redisClient.expire(key, 3600);

      // 获取5分钟内创建的订单数
      const recentOrders = await redisClient.zCount(key, fiveMinutesAgo, now);

      if (typeof recentOrders === 'number' && recentOrders >= 10) {
        await this.triggerAlert({
          type: 'order_creation_spike',
          userId,
          severity: 'high',
          message: `用户 ${userId} 在5分钟内创建了 ${recentOrders} 个订单`,
          details: { recentOrders, timeWindow: '5m' },
        });

        // 临时限制订单创建（可选）
        await redisClient.setex(`order:locked:${userId}`, 300, '1');
      }
    } catch (error) {
      console.error('检查订单创建异常时出错:', error);
    }
  }

  /**
   * 触发安全告警
   */
  static async triggerAlert(alert: {
    type: string;
    userId: number;
    severity: 'low' | 'medium' | 'high';
    message: string;
    details?: any;
  }): Promise<void> {
    const { type, userId, severity, message, details } = alert;

    console.warn(`🚨 [SECURITY ALERT] ${severity.toUpperCase()}: ${message}`);
    console.warn(`   Type: ${type}, User: ${userId}`);
    if (details) {
      console.warn(`   Details:`, JSON.stringify(details));
    }

    // 记录到数据库
    try {
      await pool.query(
        `INSERT INTO security_alerts (user_id, alert_type, severity, message, details, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [userId, type, severity, message, details ? JSON.stringify(details) : null]
      );
    } catch (error) {
      console.error('记录安全告警失败:', error);
    }

    // TODO: 发送通知给管理员
    // - 邮件通知
    // - 短信通知
    // - WebSocket 实时推送
    // - 钉钉/企业微信机器人
  }

  /**
   * 获取安全告警列表
   */
  static async getAlerts(params: {
    userId?: number;
    alertType?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const {
      userId,
      alertType,
      severity,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = params;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(userId);
    }

    if (alertType) {
      conditions.push(`alert_type = $${paramIndex++}`);
      values.push(alertType);
    }

    if (severity) {
      conditions.push(`severity = $${paramIndex++}`);
      values.push(severity);
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM security_alerts
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    values.push(limit, offset);

    try {
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('获取安全告警失败:', error);
      return [];
    }
  }
}
