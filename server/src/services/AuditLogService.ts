/**
 * 审计日志服务
 * 负责记录和查询所有敏感操作的审计日志
 */

import { pool } from '../db/database';

export interface AuditLogEntry {
  id: number;
  adminId: number;
  action: string;
  targetType: 'user' | 'config' | 'system' | null;
  targetId: number | null;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditLogFilters {
  adminId?: number;
  action?: string;
  targetType?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface AuditLogQueryResult {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export class AuditLogService {
  private static instance: AuditLogService;

  private constructor() {}

  public static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }

  /**
   * 记录操作日志
   * 立即持久化到数据库
   */
  async logAction(
    adminId: number,
    action: string,
    targetType: 'user' | 'config' | 'system' | null,
    targetId: number | null,
    details: Record<string, any>,
    ipAddress: string,
    userAgent: string | null = null
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO audit_logs 
         (admin_id, action, target_type, target_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          adminId,
          action,
          targetType,
          targetId,
          JSON.stringify(details),
          ipAddress,
          userAgent
        ]
      );

      console.log(`[AuditLog] 记录操作: ${action} by admin ${adminId}`);
    } catch (error) {
      console.error('[AuditLog] 记录日志失败:', error);
      // 不抛出错误,避免影响主业务流程
    }
  }

  /**
   * 查询日志
   * 支持多种筛选条件和分页
   */
  async queryLogs(filters: AuditLogFilters = {}): Promise<AuditLogQueryResult> {
    const {
      adminId,
      action,
      targetType,
      startDate,
      endDate,
      page = 1,
      pageSize = 20
    } = filters;

    // 构建WHERE条件
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (adminId !== undefined) {
      conditions.push(`admin_id = $${paramIndex++}`);
      params.push(adminId);
    }

    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }

    if (targetType) {
      conditions.push(`target_type = $${paramIndex++}`);
      params.push(targetType);
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // 计算偏移量
    const offset = (page - 1) * pageSize;

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // 查询数据
    const dataQuery = `
      SELECT 
        id,
        admin_id as "adminId",
        action,
        target_type as "targetType",
        target_id as "targetId",
        details,
        ip_address as "ipAddress",
        user_agent as "userAgent",
        created_at as "createdAt"
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(pageSize, offset);
    const dataResult = await pool.query(dataQuery, params);

    return {
      logs: dataResult.rows.map(row => ({
        ...row,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
      })),
      total,
      page,
      pageSize
    };
  }

  /**
   * 导出日志
   * 支持JSON和CSV格式
   */
  async exportLogs(filters: AuditLogFilters, format: 'json' | 'csv'): Promise<string> {
    // 获取所有匹配的日志(不分页)
    const result = await this.queryLogs({
      ...filters,
      page: 1,
      pageSize: 10000 // 最多导出10000条
    });

    if (format === 'json') {
      return JSON.stringify(result.logs, null, 2);
    }

    // CSV格式
    const headers = ['ID', 'Admin ID', 'Action', 'Target Type', 'Target ID', 'IP Address', 'Created At'];
    const rows = result.logs.map(log => [
      log.id,
      log.adminId,
      log.action,
      log.targetType || '',
      log.targetId || '',
      log.ipAddress,
      log.createdAt.toISOString()
    ]);

    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ];

    return csvLines.join('\n');
  }

  /**
   * 获取操作统计
   * 按操作类型统计数量
   */
  async getActionStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ action: string; count: number }>> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const query = `
      SELECT action, COUNT(*) as count
      FROM audit_logs
      ${whereClause}
      GROUP BY action
      ORDER BY count DESC
    `;

    const result = await pool.query(query, params);
    return result.rows.map(row => ({
      action: row.action,
      count: parseInt(row.count)
    }));
  }

  /**
   * 获取管理员操作统计
   * 按管理员统计操作数量
   */
  async getAdminStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ adminId: number; username: string; count: number }>> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`a.created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`a.created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        a.admin_id as "adminId",
        u.username,
        COUNT(*) as count
      FROM audit_logs a
      LEFT JOIN users u ON a.admin_id = u.id
      ${whereClause}
      GROUP BY a.admin_id, u.username
      ORDER BY count DESC
    `;

    const result = await pool.query(query, params);
    return result.rows.map(row => ({
      adminId: row.adminId,
      username: row.username,
      count: parseInt(row.count)
    }));
  }

  /**
   * 清理旧日志
   * 删除指定天数之前的日志
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await pool.query(
      'DELETE FROM audit_logs WHERE created_at < $1',
      [cutoffDate]
    );

    const deletedCount = result.rowCount || 0;
    console.log(`[AuditLog] 清理旧日志: 删除了 ${deletedCount} 条记录`);

    return deletedCount;
  }
}

export const auditLogService = AuditLogService.getInstance();
