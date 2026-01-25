/**
 * 监控服务
 * 提供服务健康检查、佣金结算监控、异常告警等功能
 * 
 * 功能：
 * 1. 服务健康检查端点
 * 2. 佣金结算状态监控
 * 3. 定时任务执行状态跟踪
 * 4. 异常告警（日志 + 可扩展的通知渠道）
 * 5. 服务启停记录
 */

import { pool } from '../db/database';
import fs from 'fs';
import path from 'path';

// 监控事件类型
type MonitorEventType = 
  | 'service_start' 
  | 'service_stop' 
  | 'service_crash'
  | 'task_start'
  | 'task_complete'
  | 'task_error'
  | 'commission_settlement_start'
  | 'commission_settlement_complete'
  | 'commission_settlement_error'
  | 'profit_sharing_error'
  | 'health_check_fail'
  | 'anomaly_detected';

// 监控事件严重级别
type SeverityLevel = 'info' | 'warning' | 'error' | 'critical';

interface MonitorEvent {
  type: MonitorEventType;
  severity: SeverityLevel;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastCheck: Date;
  components: {
    database: boolean;
    scheduler: boolean;
    profitSharing: boolean;
  };
  metrics: {
    pendingCommissions: number;
    overdueCommissions: number;
    failedSettlements24h: number;
    processingProfitSharing: number;
  };
}

interface TaskExecutionRecord {
  taskName: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private startTime: Date;
  private taskExecutions: Map<string, TaskExecutionRecord> = new Map();
  private recentEvents: MonitorEvent[] = [];
  private maxRecentEvents = 100;
  private logFilePath: string;

  private constructor() {
    this.startTime = new Date();
    this.logFilePath = process.env.MONITOR_LOG_PATH || '/var/www/geo-system/server/logs/monitor.log';
    
    // 确保日志目录存在
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
      } catch (e) {
        // 如果无法创建目录，使用当前目录
        this.logFilePath = './logs/monitor.log';
        const fallbackDir = './logs';
        if (!fs.existsSync(fallbackDir)) {
          fs.mkdirSync(fallbackDir, { recursive: true });
        }
      }
    }
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * 记录服务启动
   */
  async recordServiceStart(): Promise<void> {
    await this.logEvent({
      type: 'service_start',
      severity: 'info',
      message: 'GEO 系统服务启动',
      details: {
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        env: process.env.NODE_ENV || 'development'
      },
      timestamp: new Date()
    });

    // 记录到数据库
    try {
      await pool.query(`
        INSERT INTO service_events (event_type, severity, message, details)
        VALUES ($1, $2, $3, $4)
      `, ['service_start', 'info', 'GEO 系统服务启动', JSON.stringify({
        nodeVersion: process.version,
        pid: process.pid
      })]);
    } catch (error) {
      console.error('[MonitoringService] 记录服务启动事件到数据库失败:', error);
    }
  }

  /**
   * 记录服务停止
   */
  async recordServiceStop(reason?: string): Promise<void> {
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    
    await this.logEvent({
      type: 'service_stop',
      severity: 'warning',
      message: `GEO 系统服务停止${reason ? `: ${reason}` : ''}`,
      details: {
        uptime,
        uptimeFormatted: this.formatUptime(uptime),
        reason
      },
      timestamp: new Date()
    });

    // 记录到数据库
    try {
      await pool.query(`
        INSERT INTO service_events (event_type, severity, message, details)
        VALUES ($1, $2, $3, $4)
      `, ['service_stop', 'warning', `服务停止: ${reason || '正常关闭'}`, JSON.stringify({
        uptime,
        reason
      })]);
    } catch (error) {
      console.error('[MonitoringService] 记录服务停止事件到数据库失败:', error);
    }
  }

  /**
   * 记录定时任务开始
   */
  async recordTaskStart(taskName: string): Promise<void> {
    const record: TaskExecutionRecord = {
      taskName,
      startTime: new Date(),
      status: 'running'
    };
    this.taskExecutions.set(taskName, record);

    await this.logEvent({
      type: 'task_start',
      severity: 'info',
      message: `定时任务开始: ${taskName}`,
      timestamp: new Date()
    });
  }

  /**
   * 记录定时任务完成
   */
  async recordTaskComplete(taskName: string, result?: string): Promise<void> {
    const record = this.taskExecutions.get(taskName);
    if (record) {
      record.endTime = new Date();
      record.status = 'completed';
      record.result = result;
    }

    await this.logEvent({
      type: 'task_complete',
      severity: 'info',
      message: `定时任务完成: ${taskName}`,
      details: { result },
      timestamp: new Date()
    });
  }

  /**
   * 记录定时任务错误
   */
  async recordTaskError(taskName: string, error: Error | string): Promise<void> {
    const record = this.taskExecutions.get(taskName);
    if (record) {
      record.endTime = new Date();
      record.status = 'failed';
      record.error = error instanceof Error ? error.message : error;
    }

    const errorMessage = error instanceof Error ? error.message : error;
    
    await this.logEvent({
      type: 'task_error',
      severity: 'error',
      message: `定时任务失败: ${taskName}`,
      details: { 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      },
      timestamp: new Date()
    });

    // 记录到数据库
    try {
      await pool.query(`
        INSERT INTO service_events (event_type, severity, message, details)
        VALUES ($1, $2, $3, $4)
      `, ['task_error', 'error', `定时任务失败: ${taskName}`, JSON.stringify({
        error: errorMessage
      })]);
    } catch (dbError) {
      console.error('[MonitoringService] 记录任务错误到数据库失败:', dbError);
    }
  }

  /**
   * 记录佣金结算开始
   */
  recordCommissionSettlementStart(count: number): void {
    this.logEvent({
      type: 'commission_settlement_start',
      severity: 'info',
      message: `佣金结算任务开始，待处理 ${count} 笔`,
      details: { pendingCount: count },
      timestamp: new Date()
    });
  }

  /**
   * 记录佣金结算完成
   */
  async recordCommissionSettlementComplete(
    success: number, 
    failed: number, 
    skipped: number
  ): Promise<void> {
    const severity: SeverityLevel = failed > 0 ? 'warning' : 'info';
    
    await this.logEvent({
      type: 'commission_settlement_complete',
      severity,
      message: `佣金结算完成: 成功 ${success}, 失败 ${failed}, 跳过 ${skipped}`,
      details: { success, failed, skipped },
      timestamp: new Date()
    });

    // 如果有失败的，记录到数据库
    if (failed > 0) {
      try {
        await pool.query(`
          INSERT INTO service_events (event_type, severity, message, details)
          VALUES ($1, $2, $3, $4)
        `, ['commission_settlement_complete', 'warning', 
          `佣金结算有失败: 成功 ${success}, 失败 ${failed}`, 
          JSON.stringify({ success, failed, skipped })
        ]);
      } catch (error) {
        console.error('[MonitoringService] 记录结算结果到数据库失败:', error);
      }
    }
  }

  /**
   * 记录分账错误
   */
  async recordProfitSharingError(
    commissionId: number, 
    error: string, 
    details?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      type: 'profit_sharing_error',
      severity: 'error',
      message: `分账失败: 佣金ID ${commissionId} - ${error}`,
      details: { commissionId, error, ...details },
      timestamp: new Date()
    });

    // 记录到数据库
    try {
      await pool.query(`
        INSERT INTO service_events (event_type, severity, message, details)
        VALUES ($1, $2, $3, $4)
      `, ['profit_sharing_error', 'error', `分账失败: 佣金ID ${commissionId}`, JSON.stringify({
        commissionId,
        error,
        ...details
      })]);
    } catch (dbError) {
      console.error('[MonitoringService] 记录分账错误到数据库失败:', dbError);
    }
  }

  /**
   * 获取健康状态
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    
    // 检查数据库连接
    let dbHealthy = false;
    try {
      await pool.query('SELECT 1');
      dbHealthy = true;
    } catch (error) {
      console.error('[MonitoringService] 数据库健康检查失败:', error);
    }

    // 获取佣金相关指标
    let metrics = {
      pendingCommissions: 0,
      overdueCommissions: 0,
      failedSettlements24h: 0,
      processingProfitSharing: 0
    };

    try {
      // 待结算佣金数
      const pendingResult = await pool.query(
        `SELECT COUNT(*) as count FROM commission_records WHERE status = 'pending'`
      );
      metrics.pendingCommissions = parseInt(pendingResult.rows[0].count);

      // 超期未结算佣金（结算日期超过3天仍为pending）
      const overdueResult = await pool.query(
        `SELECT COUNT(*) as count FROM commission_records 
         WHERE status = 'pending' AND settle_date < CURRENT_DATE - INTERVAL '3 days'`
      );
      metrics.overdueCommissions = parseInt(overdueResult.rows[0].count);

      // 24小时内失败的结算
      const failedResult = await pool.query(
        `SELECT COUNT(*) as count FROM commission_records 
         WHERE status = 'cancelled' AND updated_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'`
      );
      metrics.failedSettlements24h = parseInt(failedResult.rows[0].count);

      // 处理中的分账
      const processingResult = await pool.query(
        `SELECT COUNT(*) as count FROM profit_sharing_records WHERE status = 'processing'`
      );
      metrics.processingProfitSharing = parseInt(processingResult.rows[0].count);
    } catch (error) {
      console.error('[MonitoringService] 获取指标失败:', error);
    }

    // 判断整体健康状态
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!dbHealthy) {
      status = 'unhealthy';
    } else if (metrics.overdueCommissions > 0 || metrics.failedSettlements24h > 5) {
      status = 'degraded';
    }

    return {
      status,
      uptime,
      lastCheck: new Date(),
      components: {
        database: dbHealthy,
        scheduler: true, // 如果服务在运行，调度器就在运行
        profitSharing: dbHealthy // 分账依赖数据库
      },
      metrics
    };
  }

  /**
   * 检查佣金结算异常
   * 用于定时检查是否有异常情况需要告警
   */
  async checkCommissionAnomalies(): Promise<{
    hasAnomalies: boolean;
    anomalies: string[];
  }> {
    const anomalies: string[] = [];

    try {
      // 检查超期未结算的佣金（超过3天）
      const overdueResult = await pool.query(`
        SELECT COUNT(*) as count, 
               COALESCE(SUM(commission_amount), 0) as total_amount
        FROM commission_records 
        WHERE status = 'pending' 
        AND settle_date < CURRENT_DATE - INTERVAL '3 days'
      `);
      
      const overdueCount = parseInt(overdueResult.rows[0].count);
      if (overdueCount > 0) {
        const totalAmount = parseFloat(overdueResult.rows[0].total_amount);
        anomalies.push(`有 ${overdueCount} 笔佣金超过3天未结算，总金额 ${totalAmount.toFixed(2)} 元`);
      }

      // 检查连续失败的分账（同一代理商24小时内失败超过3次）
      const failedAgentsResult = await pool.query(`
        SELECT a.id, u.username, COUNT(*) as fail_count
        FROM commission_records cr
        JOIN agents a ON cr.agent_id = a.id
        JOIN users u ON a.user_id = u.id
        WHERE cr.status = 'cancelled'
        AND cr.updated_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        GROUP BY a.id, u.username
        HAVING COUNT(*) >= 3
      `);

      for (const row of failedAgentsResult.rows) {
        anomalies.push(`代理商 ${row.username} 24小时内有 ${row.fail_count} 次结算失败`);
      }

      // 检查分账处理超时（processing 状态超过2小时）
      const stuckResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM profit_sharing_records
        WHERE status = 'processing'
        AND created_at < CURRENT_TIMESTAMP - INTERVAL '2 hours'
      `);

      const stuckCount = parseInt(stuckResult.rows[0].count);
      if (stuckCount > 0) {
        anomalies.push(`有 ${stuckCount} 笔分账处理超过2小时未完成`);
      }

      // 如果有异常，记录事件
      if (anomalies.length > 0) {
        await this.logEvent({
          type: 'anomaly_detected',
          severity: 'warning',
          message: `检测到 ${anomalies.length} 个佣金结算异常`,
          details: { anomalies },
          timestamp: new Date()
        });

        // 记录到数据库
        await pool.query(`
          INSERT INTO service_events (event_type, severity, message, details)
          VALUES ($1, $2, $3, $4)
        `, ['anomaly_detected', 'warning', `检测到佣金结算异常`, JSON.stringify({ anomalies })]);
      }

    } catch (error) {
      console.error('[MonitoringService] 检查佣金异常失败:', error);
      anomalies.push(`检查过程出错: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      hasAnomalies: anomalies.length > 0,
      anomalies
    };
  }

  /**
   * 获取最近的监控事件
   */
  getRecentEvents(limit: number = 20): MonitorEvent[] {
    return this.recentEvents.slice(-limit);
  }

  /**
   * 获取服务事件历史（从数据库）
   */
  async getServiceEventHistory(
    limit: number = 50,
    eventType?: MonitorEventType,
    severity?: SeverityLevel
  ): Promise<Array<{
    id: number;
    eventType: string;
    severity: string;
    message: string;
    details: any;
    createdAt: Date;
  }>> {
    let query = `
      SELECT id, event_type, severity, message, details, created_at
      FROM service_events
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (eventType) {
      query += ` AND event_type = $${paramIndex}`;
      params.push(eventType);
      paramIndex++;
    }

    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      eventType: row.event_type,
      severity: row.severity,
      message: row.message,
      details: row.details,
      createdAt: row.created_at
    }));
  }

  /**
   * 记录事件到日志文件和内存
   */
  private async logEvent(event: MonitorEvent): Promise<void> {
    // 添加到内存队列
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }

    // 格式化日志消息
    const logLine = this.formatLogLine(event);
    
    // 输出到控制台
    const consoleMethod = event.severity === 'error' || event.severity === 'critical' 
      ? console.error 
      : event.severity === 'warning' 
        ? console.warn 
        : console.log;
    consoleMethod(logLine);

    // 写入日志文件
    try {
      fs.appendFileSync(this.logFilePath, logLine + '\n');
    } catch (error) {
      console.error('[MonitoringService] 写入日志文件失败:', error);
    }

    // 对于任务相关的事件，写入数据库（供前端查询）
    const taskEventTypes = ['task_start', 'task_complete', 'task_error'];
    if (taskEventTypes.includes(event.type)) {
      try {
        await pool.query(`
          INSERT INTO service_events (event_type, severity, message, details)
          VALUES ($1, $2, $3, $4)
        `, [event.type, event.severity, event.message, JSON.stringify(event.details || {})]);
      } catch (dbError) {
        console.error('[MonitoringService] 记录任务事件到数据库失败:', dbError);
      }
    }
  }

  /**
   * 格式化日志行
   */
  private formatLogLine(event: MonitorEvent): string {
    const timestamp = event.timestamp.toISOString();
    const severity = event.severity.toUpperCase().padEnd(8);
    const type = event.type.padEnd(30);
    let line = `[${timestamp}] [${severity}] [${type}] ${event.message}`;
    
    if (event.details && Object.keys(event.details).length > 0) {
      line += ` | ${JSON.stringify(event.details)}`;
    }
    
    return line;
  }

  /**
   * 格式化运行时间
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);

    return parts.join('');
  }
}

export const monitoringService = MonitoringService.getInstance();
