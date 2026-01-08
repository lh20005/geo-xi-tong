/**
 * 代理商服务
 * 处理代理商申请、状态管理、统计等业务逻辑
 */

import { pool } from '../db/database';
import {
  Agent,
  AgentRow,
  AgentStatus,
  AgentStats,
  AgentFilters,
  AgentDetail,
  AgentListResult
} from '../types/agent';

export class AgentService {
  private static instance: AgentService;

  private constructor() {}

  public static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  /**
   * 将数据库行转换为 Agent 对象
   */
  private rowToAgent(row: AgentRow): Agent {
    return {
      id: row.id,
      userId: row.user_id,
      status: row.status,
      commissionRate: parseFloat(row.commission_rate),
      wechatOpenid: row.wechat_openid,
      wechatNickname: row.wechat_nickname,
      wechatBindtime: row.wechat_bindtime,
      receiverAdded: row.receiver_added,
      totalEarnings: parseFloat(row.total_earnings),
      settledEarnings: parseFloat(row.settled_earnings),
      pendingEarnings: parseFloat(row.pending_earnings),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 申请成为代理商（自动激活，无需审核）
   */
  async applyAgent(userId: number): Promise<Agent> {
    // 检查是否已经是代理商
    const existing = await this.getAgentByUserId(userId);
    if (existing) {
      throw new Error('您已经是代理商');
    }

    // 获取用户的邀请码（代理商使用用户注册时的邀请码）
    const userResult = await pool.query(
      'SELECT invitation_code FROM users WHERE id = $1',
      [userId]
    );
    const userInvitationCode = userResult.rows[0]?.invitation_code;

    // 创建代理商记录，默认状态为 active，佣金比例 30%
    // 不再使用专用邀请码，使用用户的邀请码
    const result = await pool.query<AgentRow>(
      `INSERT INTO agents (user_id, status, commission_rate)
       VALUES ($1, 'active', 0.30)
       RETURNING *`,
      [userId]
    );

    // 记录审计日志
    await this.logAudit(result.rows[0].id, 'apply', userId, null, {
      status: 'active',
      commissionRate: 0.30,
      invitationCode: userInvitationCode
    });

    console.log(`[AgentService] 用户 ${userId} 成功申请成为代理商，使用邀请码: ${userInvitationCode}`);
    return this.rowToAgent(result.rows[0]);
  }

  /**
   * 根据用户ID获取代理商信息
   */
  async getAgentByUserId(userId: number): Promise<Agent | null> {
    const result = await pool.query<AgentRow>(
      'SELECT * FROM agents WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToAgent(result.rows[0]);
  }

  /**
   * 根据代理商ID获取代理商信息
   */
  async getAgentById(agentId: number): Promise<Agent | null> {
    const result = await pool.query<AgentRow>(
      'SELECT * FROM agents WHERE id = $1',
      [agentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToAgent(result.rows[0]);
  }

  /**
   * 更新代理商状态（管理员操作：暂停/恢复）
   */
  async updateAgentStatus(
    agentId: number,
    status: AgentStatus,
    operatorId: number
  ): Promise<Agent> {
    const agent = await this.getAgentById(agentId);
    if (!agent) {
      throw new Error('代理商不存在');
    }

    const oldStatus = agent.status;

    const result = await pool.query<AgentRow>(
      `UPDATE agents 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, agentId]
    );

    // 记录审计日志
    await this.logAudit(agentId, status === 'suspended' ? 'suspend' : 'resume', operatorId, 
      { status: oldStatus }, 
      { status }
    );

    console.log(`[AgentService] 代理商 ${agentId} 状态更新: ${oldStatus} -> ${status}`);
    return this.rowToAgent(result.rows[0]);
  }

  /**
   * 绑定微信账户
   */
  async bindWechatAccount(
    agentId: number,
    openid: string,
    nickname?: string
  ): Promise<Agent> {
    const agent = await this.getAgentById(agentId);
    if (!agent) {
      throw new Error('代理商不存在');
    }

    const oldOpenid = agent.wechatOpenid;

    const result = await pool.query<AgentRow>(
      `UPDATE agents 
       SET wechat_openid = $1, 
           wechat_nickname = $2, 
           wechat_bindtime = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [openid, nickname || null, agentId]
    );

    // 记录审计日志
    await this.logAudit(agentId, oldOpenid ? 'rebindWechat' : 'bindWechat', agent.userId,
      { wechatOpenid: oldOpenid },
      { wechatOpenid: openid, wechatNickname: nickname }
    );

    console.log(`[AgentService] 代理商 ${agentId} 绑定微信: ${openid}`);
    return this.rowToAgent(result.rows[0]);
  }

  /**
   * 解绑微信账户
   */
  async unbindWechatAccount(agentId: number): Promise<Agent> {
    const agent = await this.getAgentById(agentId);
    if (!agent) {
      throw new Error('代理商不存在');
    }

    if (!agent.wechatOpenid) {
      throw new Error('未绑定微信账户');
    }

    const oldOpenid = agent.wechatOpenid;

    const result = await pool.query<AgentRow>(
      `UPDATE agents 
       SET wechat_openid = NULL, 
           wechat_nickname = NULL, 
           wechat_bindtime = NULL,
           receiver_added = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [agentId]
    );

    // 记录审计日志
    await this.logAudit(agentId, 'unbindWechat', agent.userId,
      { wechatOpenid: oldOpenid },
      { wechatOpenid: null }
    );

    console.log(`[AgentService] 代理商 ${agentId} 解绑微信`);
    return this.rowToAgent(result.rows[0]);
  }

  /**
   * 标记已添加为分账接收方
   */
  async markReceiverAdded(agentId: number, added: boolean = true): Promise<void> {
    await pool.query(
      `UPDATE agents 
       SET receiver_added = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [added, agentId]
    );
  }

  /**
   * 获取代理商统计数据
   */
  async getAgentStats(agentId: number): Promise<AgentStats> {
    const agent = await this.getAgentById(agentId);
    if (!agent) {
      throw new Error('代理商不存在');
    }

    // 获取用户的邀请码（代理商使用用户注册时的邀请码）
    const userResult = await pool.query(
      'SELECT invitation_code FROM users WHERE id = $1',
      [agent.userId]
    );
    const invitationCode = userResult.rows[0]?.invitation_code;

    // 统计邀请用户数（使用用户的邀请码）
    const inviteResult = await pool.query(
      `SELECT 
        COUNT(*) as total_invites,
        COUNT(CASE WHEN us.id IS NOT NULL THEN 1 END) as paid_invites
       FROM users u
       LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
       WHERE u.invited_by_code = $1`,
      [invitationCode]
    );

    // 统计佣金记录数
    const commissionResult = await pool.query(
      'SELECT COUNT(*) as count FROM commission_records WHERE agent_id = $1',
      [agentId]
    );

    return {
      totalEarnings: agent.totalEarnings,
      settledEarnings: agent.settledEarnings,
      pendingEarnings: agent.pendingEarnings,
      totalInvites: parseInt(inviteResult.rows[0].total_invites) || 0,
      paidInvites: parseInt(inviteResult.rows[0].paid_invites) || 0,
      commissionCount: parseInt(commissionResult.rows[0].count) || 0
    };
  }

  /**
   * 获取代理商列表（管理员）
   */
  async listAgents(filters: AgentFilters): Promise<AgentListResult> {
    const { status, search, page = 1, pageSize = 10 } = filters;
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`a.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(u.username ILIKE $${paramIndex} OR u.invitation_code ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total 
       FROM agents a
       JOIN users u ON a.user_id = u.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取列表（使用用户的邀请码，不是代理商专用邀请码）
    params.push(pageSize, offset);
    const result = await pool.query(
      `SELECT 
        a.*,
        u.username,
        u.invitation_code,
        (SELECT COUNT(*) FROM users WHERE invited_by_code = u.invitation_code) as invited_users_count,
        (SELECT COUNT(*) FROM users iu 
         JOIN user_subscriptions us ON iu.id = us.user_id AND us.status = 'active'
         WHERE iu.invited_by_code = u.invitation_code) as paid_users_count
       FROM agents a
       JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    const agents: AgentDetail[] = result.rows.map(row => ({
      ...this.rowToAgent(row),
      username: row.username,
      invitationCode: row.invitation_code,
      invitedUsers: parseInt(row.invited_users_count) || 0,
      paidUsers: parseInt(row.paid_users_count) || 0
    }));

    return {
      agents,
      total,
      page,
      pageSize
    };
  }

  /**
   * 调整佣金比例（管理员）
   */
  async updateCommissionRate(
    agentId: number,
    rate: number,
    operatorId: number
  ): Promise<Agent> {
    if (rate < 0 || rate > 0.30) {
      throw new Error('佣金比例必须在 0-30% 之间');
    }

    const agent = await this.getAgentById(agentId);
    if (!agent) {
      throw new Error('代理商不存在');
    }

    const oldRate = agent.commissionRate;

    const result = await pool.query<AgentRow>(
      `UPDATE agents 
       SET commission_rate = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [rate, agentId]
    );

    // 记录审计日志
    await this.logAudit(agentId, 'rateChange', operatorId,
      { commissionRate: oldRate },
      { commissionRate: rate }
    );

    console.log(`[AgentService] 代理商 ${agentId} 佣金比例更新: ${oldRate} -> ${rate}`);
    return this.rowToAgent(result.rows[0]);
  }

  /**
   * 删除代理商（管理员）
   */
  async deleteAgent(agentId: number, operatorId: number): Promise<void> {
    const agent = await this.getAgentById(agentId);
    if (!agent) {
      throw new Error('代理商不存在');
    }

    // 检查是否有待结算佣金
    const pendingResult = await pool.query(
      `SELECT COUNT(*) as count FROM commission_records 
       WHERE agent_id = $1 AND status = 'pending'`,
      [agentId]
    );

    if (parseInt(pendingResult.rows[0].count) > 0) {
      throw new Error('该代理商有待结算佣金，无法删除');
    }

    // 记录审计日志（在删除前）
    await this.logAudit(agentId, 'delete', operatorId,
      { agent },
      null
    );

    // 删除代理商（级联删除佣金记录）
    await pool.query('DELETE FROM agents WHERE id = $1', [agentId]);

    console.log(`[AgentService] 代理商 ${agentId} 已删除`);
  }

  /**
   * 根据邀请码获取代理商（使用用户的邀请码）
   */
  async getAgentByInvitationCode(invitationCode: string): Promise<Agent | null> {
    const result = await pool.query<AgentRow>(
      `SELECT a.* FROM agents a
       JOIN users u ON a.user_id = u.id
       WHERE u.invitation_code = $1 AND a.status = 'active'`,
      [invitationCode]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToAgent(result.rows[0]);
  }

  /**
   * 获取代理商详情（包含用户信息）
   */
  async getAgentDetail(agentId: number): Promise<AgentDetail | null> {
    const result = await pool.query(
      `SELECT 
        a.*,
        u.username,
        u.invitation_code,
        (SELECT COUNT(*) FROM users WHERE invited_by_code = u.invitation_code) as invited_users_count,
        (SELECT COUNT(*) FROM users iu 
         JOIN user_subscriptions us ON iu.id = us.user_id AND us.status = 'active'
         WHERE iu.invited_by_code = u.invitation_code) as paid_users_count
       FROM agents a
       JOIN users u ON a.user_id = u.id
       WHERE a.id = $1`,
      [agentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...this.rowToAgent(row),
      username: row.username,
      invitationCode: row.invitation_code,
      invitedUsers: parseInt(row.invited_users_count) || 0,
      paidUsers: parseInt(row.paid_users_count) || 0
    };
  }

  /**
   * 记录审计日志
   */
  private async logAudit(
    agentId: number,
    actionType: string,
    operatorId: number,
    oldValue: any,
    newValue: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO agent_audit_logs 
         (agent_id, action_type, operator_id, old_value, new_value, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          agentId,
          actionType,
          operatorId,
          oldValue ? JSON.stringify(oldValue) : null,
          newValue ? JSON.stringify(newValue) : null,
          ipAddress,
          userAgent
        ]
      );
    } catch (error) {
      console.error('[AgentService] 记录审计日志失败:', error);
    }
  }

  /**
   * 检测异常分账行为
   * 返回需要暂停的代理商列表
   */
  async detectAnomalies(): Promise<Array<{
    agentId: number;
    reason: string;
    details: any;
  }>> {
    const anomalies: Array<{ agentId: number; reason: string; details: any }> = [];

    try {
      // 1. 检测短时间内大量佣金（1小时内超过10笔）
      const highFrequencyResult = await pool.query(`
        SELECT agent_id, COUNT(*) as count, SUM(amount) as total
        FROM commission_records
        WHERE created_at > NOW() - INTERVAL '1 hour'
        GROUP BY agent_id
        HAVING COUNT(*) > 10
      `);

      for (const row of highFrequencyResult.rows) {
        anomalies.push({
          agentId: row.agent_id,
          reason: '短时间内佣金记录异常频繁',
          details: {
            count: parseInt(row.count),
            totalAmount: parseInt(row.total),
            period: '1小时'
          }
        });
      }

      // 2. 检测单日佣金金额异常（超过5000元）
      const highAmountResult = await pool.query(`
        SELECT agent_id, SUM(amount) as total, COUNT(*) as count
        FROM commission_records
        WHERE created_at >= CURRENT_DATE
          AND status IN ('pending', 'processing', 'settled')
        GROUP BY agent_id
        HAVING SUM(amount) > 500000
      `);

      for (const row of highAmountResult.rows) {
        // 避免重复
        if (!anomalies.find(a => a.agentId === row.agent_id)) {
          anomalies.push({
            agentId: row.agent_id,
            reason: '单日佣金金额异常',
            details: {
              totalAmount: parseInt(row.total) / 100,
              count: parseInt(row.count),
              threshold: 5000
            }
          });
        }
      }

      // 3. 检测邀请用户付费率异常高（付费率超过80%且付费用户超过5人）
      const highConversionResult = await pool.query(`
        SELECT a.id as agent_id, a.invited_users, a.paid_users,
               CASE WHEN a.invited_users > 0 
                    THEN a.paid_users::float / a.invited_users 
                    ELSE 0 END as conversion_rate
        FROM agents a
        WHERE a.status = 'active'
          AND a.invited_users > 5
          AND a.paid_users > 5
          AND (a.paid_users::float / a.invited_users) > 0.8
      `);

      for (const row of highConversionResult.rows) {
        if (!anomalies.find(a => a.agentId === row.agent_id)) {
          anomalies.push({
            agentId: row.agent_id,
            reason: '邀请用户付费转化率异常',
            details: {
              invitedUsers: row.invited_users,
              paidUsers: row.paid_users,
              conversionRate: (parseFloat(row.conversion_rate) * 100).toFixed(1) + '%'
            }
          });
        }
      }

      return anomalies;
    } catch (error) {
      console.error('[AgentService] 异常检测失败:', error);
      return [];
    }
  }

  /**
   * 自动暂停异常代理商
   */
  async suspendAnomalousAgents(): Promise<number> {
    const anomalies = await this.detectAnomalies();
    let suspendedCount = 0;

    for (const anomaly of anomalies) {
      try {
        const agent = await this.getAgentById(anomaly.agentId);
        if (agent && agent.status === 'active') {
          // 暂停代理商
          await pool.query(
            `UPDATE agents SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [anomaly.agentId]
          );

          // 记录审计日志
          await this.logAudit(
            anomaly.agentId,
            'autoSuspend',
            0, // 系统操作
            { status: 'active' },
            { status: 'suspended', reason: anomaly.reason, details: anomaly.details }
          );

          console.log(`[AgentService] 自动暂停异常代理商 ${anomaly.agentId}: ${anomaly.reason}`);
          suspendedCount++;
        }
      } catch (error) {
        console.error(`[AgentService] 暂停代理商 ${anomaly.agentId} 失败:`, error);
      }
    }

    return suspendedCount;
  }
}

export const agentService = AgentService.getInstance();
