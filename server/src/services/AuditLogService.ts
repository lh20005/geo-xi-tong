import { pool } from '../db/database';

/**
 * 审计日志服务
 * 记录所有管理员的敏感操作
 */
export class AuditLogService {
  /**
   * 记录管理员操作日志
   */
  async logAction(
    adminId: number,
    action: string,
    targetType: string | null,
    targetId: string | null,
    details: any,
    ipAddress?: string,
    userAgent?: string
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
          details ? JSON.stringify(details) : null,
          ipAddress || null,
          userAgent || null,
        ]
      );

      console.log(`[AUDIT] Admin ${adminId} performed ${action} on ${targetType}${targetId ? ` (${targetId})` : ''}`);
    } catch (error) {
      console.error('Failed to log admin action:', error);
      // 不抛出错误，避免影响主业务流程
    }
  }

  /**
   * 查询审计日志
   */
  async queryLogs(filters: {
    adminId?: number;
    action?: string;
    targetType?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const {
      adminId,
      action,
      targetType,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = filters;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (adminId) {
      conditions.push(`al.admin_id = $${paramIndex++}`);
      values.push(adminId);
    }

    if (action) {
      conditions.push(`al.action = $${paramIndex++}`);
      values.push(action);
    }

    if (targetType) {
      conditions.push(`al.target_type = $${paramIndex++}`);
      values.push(targetType);
    }

    if (startDate) {
      conditions.push(`al.created_at >= $${paramIndex++}`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`al.created_at <= $${paramIndex++}`);
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // 获取日志列表
    const offset = (page - 1) * pageSize;
    const query = `
      SELECT 
        al.*,
        u.username as admin_username
      FROM audit_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    values.push(pageSize, offset);
    const result = await pool.query(query, values);

    return {
      logs: result.rows,
      total
    };
  }

  /**
   * 导出审计日志
   */
  async exportLogs(
    filters: {
      adminId?: number;
      action?: string;
      targetType?: string;
      startDate?: Date;
      endDate?: Date;
    },
    format: 'json' | 'csv'
  ): Promise<string> {
    const { logs } = await this.queryLogs({ ...filters, page: 1, pageSize: 10000 });

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    } else {
      // CSV格式
      const headers = ['ID', 'Admin ID', 'Admin Username', 'Action', 'Target Type', 'Target ID', 'Details', 'IP Address', 'Created At'];
      const rows = logs.map(log => [
        log.id,
        log.admin_id,
        log.admin_username || '',
        log.action,
        log.target_type || '',
        log.target_id || '',
        log.details || '',
        log.ip_address || '',
        log.created_at
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      return csv;
    }
  }

  /**
   * 记录管理员操作日志（兼容旧方法）
   */
  static async logAdminAction(params: {
    adminId: number;
    actionType: string;
    resourceType: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const instance = new AuditLogService();
    await instance.logAction(
      params.adminId,
      params.actionType,
      params.resourceType,
      params.resourceId || null,
      params.details,
      params.ipAddress,
      params.userAgent
    );
  }

  /**
   * 获取管理员操作日志（兼容旧方法）
   */
  static async getAdminLogs(params: {
    adminId?: number;
    actionType?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const instance = new AuditLogService();
    const { logs } = await instance.queryLogs({
      adminId: params.adminId,
      action: params.actionType,
      targetType: params.resourceType,
      startDate: params.startDate,
      endDate: params.endDate,
      page: params.offset ? Math.floor(params.offset / (params.limit || 50)) + 1 : 1,
      pageSize: params.limit || 50
    });
    return logs;
  }

  /**
   * 获取管理员操作统计
   */
  static async getAdminActionStats(params: {
    adminId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any> {
    const { adminId, startDate, endDate } = params;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (adminId) {
      conditions.push(`admin_id = $${paramIndex++}`);
      values.push(adminId);
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
      SELECT 
        action,
        target_type,
        COUNT(*) as count
      FROM audit_logs
      ${whereClause}
      GROUP BY action, target_type
      ORDER BY count DESC
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }
}

// 导出单例实例
export const auditLogService = new AuditLogService();
