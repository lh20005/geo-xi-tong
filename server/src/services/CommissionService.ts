/**
 * 佣金服务
 * 处理佣金计算、创建、结算等业务逻辑
 */

import { pool } from '../db/database';
import {
  Commission,
  CommissionRow,
  CommissionStatus,
  CommissionFilters,
  PaginatedResult
} from '../types/agent';
import { agentService } from './AgentService';

export class CommissionService {
  private static instance: CommissionService;

  private constructor() {}

  public static getInstance(): CommissionService {
    if (!CommissionService.instance) {
      CommissionService.instance = new CommissionService();
    }
    return CommissionService.instance;
  }

  /**
   * 将数据库行转换为 Commission 对象
   */
  private rowToCommission(row: CommissionRow): Commission & { orderNo?: string; username?: string; planName?: string } {
    return {
      id: row.id,
      agentId: row.agent_id,
      orderId: row.order_id,
      invitedUserId: row.invited_user_id,
      orderAmount: parseFloat(row.order_amount),
      commissionRate: parseFloat(row.commission_rate),
      commissionAmount: parseFloat(row.commission_amount),
      status: row.status,
      settleDate: row.settle_date,
      settledAt: row.settled_at,
      failReason: row.fail_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      orderNo: row.order_no,
      username: row.username,
      planName: row.plan_name
    };
  }

  /**
   * 计算佣金金额
   * 佣金 = 订单金额 × 佣金比例，精确到分（两位小数）
   */
  calculateCommission(orderAmount: number, commissionRate: number): number {
    return Math.round(orderAmount * commissionRate * 100) / 100;
  }

  /**
   * 创建佣金记录（订单支付成功时调用）
   */
  async createCommission(
    orderId: number,
    agentId: number,
    invitedUserId: number,
    orderAmount: number
  ): Promise<Commission> {
    const agent = await agentService.getAgentById(agentId);
    if (!agent) {
      throw new Error('代理商不存在');
    }

    if (agent.status !== 'active') {
      throw new Error('代理商已被暂停');
    }

    const commissionRate = agent.commissionRate;
    const commissionAmount = this.calculateCommission(orderAmount, commissionRate);

    // 计算 T+1 结算日期
    const settleDate = new Date();
    settleDate.setDate(settleDate.getDate() + 1);
    settleDate.setHours(0, 0, 0, 0);

    const result = await pool.query<CommissionRow>(
      `INSERT INTO commission_records 
       (agent_id, order_id, invited_user_id, order_amount, commission_rate, commission_amount, status, settle_date)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING *`,
      [agentId, orderId, invitedUserId, orderAmount, commissionRate, commissionAmount, settleDate]
    );

    console.log(`[CommissionService] 创建佣金记录: 订单 ${orderId}, 代理商 ${agentId}, 金额 ${commissionAmount}`);
    return this.rowToCommission(result.rows[0]);
  }

  /**
   * 获取佣金记录
   */
  async getCommissionById(commissionId: number): Promise<Commission | null> {
    const result = await pool.query<CommissionRow>(
      'SELECT * FROM commission_records WHERE id = $1',
      [commissionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToCommission(result.rows[0]);
  }

  /**
   * 获取订单的佣金记录
   */
  async getCommissionByOrderId(orderId: number): Promise<Commission | null> {
    const result = await pool.query<CommissionRow>(
      'SELECT * FROM commission_records WHERE order_id = $1',
      [orderId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToCommission(result.rows[0]);
  }

  /**
   * 更新佣金状态
   */
  async updateCommissionStatus(
    commissionId: number,
    status: CommissionStatus,
    failReason?: string
  ): Promise<Commission> {
    const updates: string[] = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [commissionId, status];
    let paramIndex = 3;

    if (status === 'settled') {
      updates.push(`settled_at = CURRENT_TIMESTAMP`);
    }

    if (failReason) {
      updates.push(`fail_reason = $${paramIndex}`);
      params.push(failReason);
      paramIndex++;
    }

    const result = await pool.query<CommissionRow>(
      `UPDATE commission_records 
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('佣金记录不存在');
    }

    console.log(`[CommissionService] 佣金 ${commissionId} 状态更新为 ${status}`);
    return this.rowToCommission(result.rows[0]);
  }

  /**
   * 获取代理商的佣金列表
   */
  async listCommissions(
    agentId: number,
    filters: CommissionFilters
  ): Promise<PaginatedResult<Commission & { orderNo?: string; username?: string; planName?: string }>> {
    const { status, startDate, endDate, page = 1, pageSize = 10 } = filters;
    const offset = (page - 1) * pageSize;
    const conditions: string[] = ['c.agent_id = $1'];
    const params: any[] = [agentId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`c.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`c.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM commission_records c WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取列表
    params.push(pageSize, offset);
    const result = await pool.query<CommissionRow>(
      `SELECT 
        c.*,
        o.order_no,
        u.username,
        sp.plan_name
       FROM commission_records c
       JOIN orders o ON c.order_id = o.id
       JOIN users u ON c.invited_user_id = u.id
       LEFT JOIN subscription_plans sp ON o.plan_id = sp.id
       WHERE ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      data: result.rows.map(row => this.rowToCommission(row)),
      total,
      page,
      pageSize
    };
  }

  /**
   * 获取待结算的佣金列表（用于定时任务）
   * 不在 SQL 中过滤代理商状态，让定时任务在处理时检查
   * 这样代理商绑定微信后可以补发之前的佣金
   */
  async getPendingCommissions(settleDate?: Date): Promise<Commission[]> {
    const targetDate = settleDate || new Date();
    
    const result = await pool.query<CommissionRow>(
      `SELECT c.* FROM commission_records c
       JOIN agents a ON c.agent_id = a.id
       WHERE c.status = 'pending' 
       AND c.settle_date <= $1
       AND a.status = 'active'
       ORDER BY c.created_at ASC`,
      [targetDate]
    );

    return result.rows.map(row => this.rowToCommission(row));
  }

  /**
   * 处理退款（取消或标记佣金）
   */
  async handleRefund(orderId: number, refundAmount: number, isFullRefund: boolean): Promise<void> {
    const commission = await this.getCommissionByOrderId(orderId);
    if (!commission) {
      console.log(`[CommissionService] 订单 ${orderId} 没有关联的佣金记录`);
      return;
    }

    if (commission.status === 'pending') {
      if (isFullRefund) {
        // 全额退款：取消佣金
        await this.updateCommissionStatus(commission.id, 'cancelled', '订单全额退款');
        console.log(`[CommissionService] 佣金 ${commission.id} 已取消（订单全额退款）`);
      } else {
        // 部分退款：按比例调整佣金
        const newOrderAmount = commission.orderAmount - refundAmount;
        const newCommissionAmount = this.calculateCommission(newOrderAmount, commission.commissionRate);
        
        await pool.query(
          `UPDATE commission_records 
           SET order_amount = $1, commission_amount = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [newOrderAmount, newCommissionAmount, commission.id]
        );
        console.log(`[CommissionService] 佣金 ${commission.id} 已调整: ${commission.commissionAmount} -> ${newCommissionAmount}`);
      }
    } else if (commission.status === 'settled') {
      // 已结算的佣金标记为需回退（微信支付不支持个人分账回退）
      await this.updateCommissionStatus(commission.id, 'refunded', '订单退款，佣金已结算无法回退');
      console.log(`[CommissionService] 佣金 ${commission.id} 标记为已退款（已结算无法回退）`);
    }
  }

  /**
   * 批量结算佣金（定时任务调用）
   */
  async batchSettlePendingCommissions(): Promise<{
    total: number;
    success: number;
    failed: number;
    errors: Array<{ commissionId: number; error: string }>;
  }> {
    const pendingCommissions = await this.getPendingCommissions();
    
    const result = {
      total: pendingCommissions.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ commissionId: number; error: string }>
    };

    if (pendingCommissions.length === 0) {
      console.log('[CommissionService] 没有待结算的佣金');
      return result;
    }

    console.log(`[CommissionService] 开始批量结算 ${pendingCommissions.length} 笔佣金`);

    // 这里只是标记状态，实际分账由 ProfitSharingService 处理
    // 返回待处理列表供调用方使用
    return result;
  }

  /**
   * 获取所有佣金列表（管理员）
   */
  async listAllCommissions(
    filters: CommissionFilters & { agentId?: number }
  ): Promise<PaginatedResult<Commission & { orderNo?: string; username?: string; planName?: string; agentUsername?: string }>> {
    const { status, startDate, endDate, agentId, page = 1, pageSize = 10 } = filters;
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (agentId) {
      conditions.push(`c.agent_id = $${paramIndex}`);
      params.push(agentId);
      paramIndex++;
    }

    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`c.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`c.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM commission_records c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取列表
    params.push(pageSize, offset);
    const result = await pool.query(
      `SELECT 
        c.*,
        o.order_no,
        u.username,
        sp.plan_name,
        au.username as agent_username
       FROM commission_records c
       JOIN orders o ON c.order_id = o.id
       JOIN users u ON c.invited_user_id = u.id
       JOIN agents a ON c.agent_id = a.id
       JOIN users au ON a.user_id = au.id
       LEFT JOIN subscription_plans sp ON o.plan_id = sp.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      data: result.rows.map(row => ({
        ...this.rowToCommission(row),
        agentUsername: row.agent_username
      })),
      total,
      page,
      pageSize
    };
  }
}

export const commissionService = CommissionService.getInstance();
