/**
 * 发布分析服务
 * 
 * 用于统计发布成功率、追踪常见错误、优化平台适配器。
 * 
 * 功能：
 * - 记录发布结果（单条/批量）
 * - 获取总览统计
 * - 获取平台统计
 * - 获取错误统计
 * - 获取每日趋势
 * - 获取用户统计
 */

import { pool } from '../db/database';
import { redisClient } from '../db/redis';

// 缓存过期时间（5 分钟）
const CACHE_TTL_SECONDS = 5 * 60;

/**
 * 发布报告接口
 */
export interface PublishReport {
  taskId: string;
  platform: string;
  status: 'success' | 'failed';
  duration: number;  // 毫秒
  errorCode?: string;
  errorMessage?: string;
  metadata?: {
    articleLength?: number;
    imageCount?: number;
    retryCount?: number;
    [key: string]: any;
  };
}

/**
 * 总览统计接口
 */
export interface OverviewStats {
  totalPublishes: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  avgDuration: number;
  activeUsers: number;
}

/**
 * 平台统计接口
 */
export interface PlatformStats {
  platform: string;
  total: number;
  success: number;
  failed: number;
  successRate: number;
  avgDuration: number;
}

/**
 * 错误统计接口
 */
export interface ErrorStats {
  errorCode: string;
  count: number;
  percentage: number;
}

/**
 * 每日趋势接口
 */
export interface DailyTrend {
  date: string;
  total: number;
  success: number;
  failed: number;
}

/**
 * 用户统计接口
 */
export interface UserStats {
  userId: number;
  username: string;
  totalPublishes: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  avgDuration: number;
  mostUsedPlatform: string;
}

/**
 * 发布分析服务
 */
export class AnalyticsService {
  private static instance: AnalyticsService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * 生成缓存 key
   */
  private getCacheKey(type: string, params: Record<string, any>): string {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `analytics:${type}:${paramStr}`;
  }

  /**
   * 记录单条发布结果
   */
  async recordPublishReport(userId: number, report: PublishReport): Promise<void> {
    await pool.query(
      `INSERT INTO publish_analytics 
       (task_id, user_id, platform, status, duration, error_code, error_message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        report.taskId,
        userId,
        report.platform,
        report.status,
        report.duration,
        report.errorCode || null,
        report.errorMessage || null,
        JSON.stringify(report.metadata || {})
      ]
    );

    console.log(`[AnalyticsService] 记录发布结果: userId=${userId}, platform=${report.platform}, status=${report.status}`);
  }

  /**
   * 批量记录发布结果
   */
  async recordPublishReportBatch(userId: number, reports: PublishReport[]): Promise<number> {
    if (reports.length === 0) {
      return 0;
    }

    // 构建批量插入语句
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const report of reports) {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`
      );
      values.push(
        report.taskId,
        userId,
        report.platform,
        report.status,
        report.duration,
        report.errorCode || null,
        report.errorMessage || null,
        JSON.stringify(report.metadata || {})
      );
      paramIndex += 8;
    }

    await pool.query(
      `INSERT INTO publish_analytics 
       (task_id, user_id, platform, status, duration, error_code, error_message, metadata)
       VALUES ${placeholders.join(', ')}`,
      values
    );

    console.log(`[AnalyticsService] 批量记录 ${reports.length} 条发布结果: userId=${userId}`);
    return reports.length;
  }

  /**
   * 获取总览统计
   */
  async getOverviewStats(startDate: Date, endDate: Date): Promise<OverviewStats> {
    const cacheKey = this.getCacheKey('overview', {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    });

    // 尝试从缓存获取
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // 缓存失败，继续查询数据库
    }

    const result = await pool.query(
      `SELECT 
        COUNT(*)::INTEGER as total_publishes,
        COUNT(*) FILTER (WHERE status = 'success')::INTEGER as success_count,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as failed_count,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / 
          NULLIF(COUNT(*), 0) * 100, 
          2
        )::NUMERIC as success_rate,
        COALESCE(AVG(duration), 0)::INTEGER as avg_duration,
        COUNT(DISTINCT user_id)::INTEGER as active_users
       FROM publish_analytics
       WHERE created_at BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    const stats: OverviewStats = {
      totalPublishes: result.rows[0].total_publishes,
      successCount: result.rows[0].success_count,
      failedCount: result.rows[0].failed_count,
      successRate: parseFloat(result.rows[0].success_rate) || 0,
      avgDuration: result.rows[0].avg_duration,
      activeUsers: result.rows[0].active_users
    };

    // 缓存结果
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(stats));
    } catch (e) {
      // 缓存失败，忽略
    }

    return stats;
  }

  /**
   * 获取平台统计
   */
  async getPlatformStats(startDate: Date, endDate: Date): Promise<PlatformStats[]> {
    const cacheKey = this.getCacheKey('platform', {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    });

    // 尝试从缓存获取
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // 缓存失败，继续查询数据库
    }

    const result = await pool.query(
      `SELECT * FROM get_platform_stats($1, $2)`,
      [startDate, endDate]
    );

    const stats: PlatformStats[] = result.rows.map(row => ({
      platform: row.platform,
      total: parseInt(row.total_count),
      success: parseInt(row.success_count),
      failed: parseInt(row.failed_count),
      successRate: parseFloat(row.success_rate) || 0,
      avgDuration: row.avg_duration || 0
    }));

    // 缓存结果
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(stats));
    } catch (e) {
      // 缓存失败，忽略
    }

    return stats;
  }

  /**
   * 获取错误统计
   */
  async getErrorStats(startDate: Date, endDate: Date, platform?: string): Promise<ErrorStats[]> {
    const cacheKey = this.getCacheKey('errors', {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      platform: platform || 'all'
    });

    // 尝试从缓存获取
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // 缓存失败，继续查询数据库
    }

    const result = await pool.query(
      `SELECT * FROM get_error_stats($1, $2, $3)`,
      [startDate, endDate, platform || null]
    );

    const stats: ErrorStats[] = result.rows.map(row => ({
      errorCode: row.error_code,
      count: parseInt(row.error_count),
      percentage: parseFloat(row.percentage) || 0
    }));

    // 缓存结果
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(stats));
    } catch (e) {
      // 缓存失败，忽略
    }

    return stats;
  }

  /**
   * 获取每日趋势
   */
  async getDailyTrend(startDate: Date, endDate: Date): Promise<DailyTrend[]> {
    const cacheKey = this.getCacheKey('trend', {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    });

    // 尝试从缓存获取
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // 缓存失败，继续查询数据库
    }

    const result = await pool.query(
      `SELECT * FROM get_daily_trend($1, $2)`,
      [startDate, endDate]
    );

    const trend: DailyTrend[] = result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      total: parseInt(row.total_count),
      success: parseInt(row.success_count),
      failed: parseInt(row.failed_count)
    }));

    // 缓存结果
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(trend));
    } catch (e) {
      // 缓存失败，忽略
    }

    return trend;
  }

  /**
   * 获取平台详细统计
   */
  async getPlatformDetail(
    platform: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    platform: string;
    totalPublishes: number;
    successCount: number;
    failedCount: number;
    successRate: number;
    avgDuration: number;
    errorBreakdown: ErrorStats[];
    hourlyDistribution: Array<{ hour: number; count: number }>;
    recentErrors: Array<{
      taskId: string;
      userId: number;
      username: string;
      errorCode: string;
      errorMessage: string;
      createdAt: string;
    }>;
  }> {
    // 基本统计
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*)::INTEGER as total_publishes,
        COUNT(*) FILTER (WHERE status = 'success')::INTEGER as success_count,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as failed_count,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / 
          NULLIF(COUNT(*), 0) * 100, 
          2
        )::NUMERIC as success_rate,
        COALESCE(AVG(duration), 0)::INTEGER as avg_duration
       FROM publish_analytics
       WHERE platform = $1 AND created_at BETWEEN $2 AND $3`,
      [platform, startDate, endDate]
    );

    // 错误分布
    const errorBreakdown = await this.getErrorStats(startDate, endDate, platform);

    // 小时分布
    const hourlyResult = await pool.query(
      `SELECT 
        EXTRACT(HOUR FROM created_at)::INTEGER as hour,
        COUNT(*)::INTEGER as count
       FROM publish_analytics
       WHERE platform = $1 AND created_at BETWEEN $2 AND $3
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY hour`,
      [platform, startDate, endDate]
    );

    // 最近错误
    const recentErrorsResult = await pool.query(
      `SELECT 
        pa.task_id,
        pa.user_id,
        u.username,
        pa.error_code,
        pa.error_message,
        pa.created_at
       FROM publish_analytics pa
       JOIN users u ON pa.user_id = u.id
       WHERE pa.platform = $1 
         AND pa.status = 'failed'
         AND pa.created_at BETWEEN $2 AND $3
       ORDER BY pa.created_at DESC
       LIMIT 20`,
      [platform, startDate, endDate]
    );

    return {
      platform,
      totalPublishes: statsResult.rows[0].total_publishes,
      successCount: statsResult.rows[0].success_count,
      failedCount: statsResult.rows[0].failed_count,
      successRate: parseFloat(statsResult.rows[0].success_rate) || 0,
      avgDuration: statsResult.rows[0].avg_duration,
      errorBreakdown,
      hourlyDistribution: hourlyResult.rows.map(row => ({
        hour: row.hour,
        count: row.count
      })),
      recentErrors: recentErrorsResult.rows.map(row => ({
        taskId: row.task_id,
        userId: row.user_id,
        username: row.username,
        errorCode: row.error_code || 'UNKNOWN',
        errorMessage: row.error_message || '',
        createdAt: row.created_at.toISOString()
      }))
    };
  }

  /**
   * 获取错误列表（分页）
   */
  async getErrorList(
    startDate: Date,
    endDate: Date,
    options: {
      platform?: string;
      errorCode?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{
    total: number;
    page: number;
    pageSize: number;
    errors: Array<{
      id: number;
      taskId: string;
      userId: number;
      username: string;
      platform: string;
      errorCode: string;
      errorMessage: string;
      duration: number;
      metadata: Record<string, any>;
      createdAt: string;
    }>;
  }> {
    const { platform, errorCode, page = 1, pageSize = 20 } = options;
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    const conditions: string[] = [
      'pa.status = $1',
      'pa.created_at BETWEEN $2 AND $3'
    ];
    const params: any[] = ['failed', startDate, endDate];
    let paramIndex = 4;

    if (platform) {
      conditions.push(`pa.platform = $${paramIndex}`);
      params.push(platform);
      paramIndex++;
    }

    if (errorCode) {
      conditions.push(`pa.error_code = $${paramIndex}`);
      params.push(errorCode);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*)::INTEGER as total
       FROM publish_analytics pa
       WHERE ${whereClause}`,
      params
    );

    // 获取列表
    params.push(pageSize, offset);
    const listResult = await pool.query(
      `SELECT 
        pa.id,
        pa.task_id,
        pa.user_id,
        u.username,
        pa.platform,
        pa.error_code,
        pa.error_message,
        pa.duration,
        pa.metadata,
        pa.created_at
       FROM publish_analytics pa
       JOIN users u ON pa.user_id = u.id
       WHERE ${whereClause}
       ORDER BY pa.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      total: countResult.rows[0].total,
      page,
      pageSize,
      errors: listResult.rows.map(row => ({
        id: row.id,
        taskId: row.task_id,
        userId: row.user_id,
        username: row.username,
        platform: row.platform,
        errorCode: row.error_code || 'UNKNOWN',
        errorMessage: row.error_message || '',
        duration: row.duration,
        metadata: row.metadata || {},
        createdAt: row.created_at.toISOString()
      }))
    };
  }

  /**
   * 获取用户发布统计（分页）
   */
  async getUserStats(
    startDate: Date,
    endDate: Date,
    options: {
      sortBy?: 'total' | 'success_rate' | 'avg_duration';
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{
    total: number;
    users: UserStats[];
  }> {
    const { sortBy = 'total', page = 1, pageSize = 20 } = options;
    const offset = (page - 1) * pageSize;

    // 排序字段映射
    const sortFieldMap: Record<string, string> = {
      total: 'total_publishes DESC',
      success_rate: 'success_rate DESC',
      avg_duration: 'avg_duration ASC'
    };
    const orderBy = sortFieldMap[sortBy] || 'total_publishes DESC';

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id)::INTEGER as total
       FROM publish_analytics
       WHERE created_at BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    // 获取用户统计
    const result = await pool.query(
      `WITH user_stats AS (
        SELECT 
          pa.user_id,
          COUNT(*)::INTEGER as total_publishes,
          COUNT(*) FILTER (WHERE pa.status = 'success')::INTEGER as success_count,
          COUNT(*) FILTER (WHERE pa.status = 'failed')::INTEGER as failed_count,
          ROUND(
            COUNT(*) FILTER (WHERE pa.status = 'success')::NUMERIC / 
            NULLIF(COUNT(*), 0) * 100, 
            2
          )::NUMERIC as success_rate,
          COALESCE(AVG(pa.duration), 0)::INTEGER as avg_duration,
          MODE() WITHIN GROUP (ORDER BY pa.platform) as most_used_platform
        FROM publish_analytics pa
        WHERE pa.created_at BETWEEN $1 AND $2
        GROUP BY pa.user_id
      )
      SELECT 
        us.*,
        u.username
      FROM user_stats us
      JOIN users u ON us.user_id = u.id
      ORDER BY ${orderBy}
      LIMIT $3 OFFSET $4`,
      [startDate, endDate, pageSize, offset]
    );

    return {
      total: countResult.rows[0].total,
      users: result.rows.map(row => ({
        userId: row.user_id,
        username: row.username,
        totalPublishes: row.total_publishes,
        successCount: row.success_count,
        failedCount: row.failed_count,
        successRate: parseFloat(row.success_rate) || 0,
        avgDuration: row.avg_duration,
        mostUsedPlatform: row.most_used_platform || ''
      }))
    };
  }
}

// 导出单例实例
export const analyticsService = AnalyticsService.getInstance();
