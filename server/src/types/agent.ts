/**
 * 代理商分佣系统类型定义
 */

// 代理商状态（简化：无需审核）
export type AgentStatus = 'active' | 'suspended';

// 佣金状态
export type CommissionStatus = 'pending' | 'settled' | 'cancelled' | 'refunded';

// 分账状态
export type ProfitSharingStatus = 'pending' | 'processing' | 'success' | 'failed';

// 代理商信息
export interface Agent {
  id: number;
  userId: number;
  status: AgentStatus;
  commissionRate: number;  // 默认 0.30 (30%)
  wechatOpenid?: string;
  wechatNickname?: string;
  wechatBindtime?: Date;
  receiverAdded: boolean;
  totalEarnings: number;
  settledEarnings: number;
  pendingEarnings: number;
  createdAt: Date;
  updatedAt: Date;
}

// 数据库行格式（蛇形命名）
export interface AgentRow {
  id: number;
  user_id: number;
  status: AgentStatus;
  commission_rate: string;
  wechat_openid?: string;
  wechat_nickname?: string;
  wechat_bindtime?: Date;
  receiver_added: boolean;
  total_earnings: string;
  settled_earnings: string;
  pending_earnings: string;
  created_at: Date;
  updated_at: Date;
}

// 佣金记录
export interface Commission {
  id: number;
  agentId: number;
  orderId: number;
  invitedUserId: number;
  orderAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: CommissionStatus;
  settleDate: Date;
  settledAt?: Date;
  failReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 佣金记录数据库行格式
export interface CommissionRow {
  id: number;
  agent_id: number;
  order_id: number;
  invited_user_id: number;
  order_amount: string;
  commission_rate: string;
  commission_amount: string;
  status: CommissionStatus;
  settle_date: Date;
  settled_at?: Date;
  fail_reason?: string;
  created_at: Date;
  updated_at: Date;
  // 关联字段
  order_no?: string;
  username?: string;
  plan_name?: string;
}

// 分账记录
export interface ProfitSharingRecord {
  id: number;
  commissionId: number;
  transactionId: string;
  outOrderNo: string;
  wechatOrderId?: string;
  amount: number;  // 分账金额（分）
  status: ProfitSharingStatus;
  failReason?: string;
  requestTime: Date;
  finishTime?: Date;
  createdAt: Date;
}

// 代理商统计数据
export interface AgentStats {
  totalEarnings: number;
  settledEarnings: number;
  pendingEarnings: number;
  totalInvites: number;
  paidInvites: number;
  commissionCount: number;
}

// 代理商列表筛选条件
export interface AgentFilters {
  status?: AgentStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

// 佣金列表筛选条件
export interface CommissionFilters {
  status?: CommissionStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// 分页结果
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 微信分账请求参数
export interface ProfitSharingRequest {
  transactionId: string;  // 微信支付订单号
  outOrderNo: string;     // 商户分账单号
  receivers: ProfitSharingReceiver[];
  unfreezeUnsplit: boolean;  // 是否解冻剩余资金
}

// 分账接收方
export interface ProfitSharingReceiver {
  type: 'PERSONAL_OPENID';  // 个人微信零钱
  account: string;          // OpenID
  amount: number;           // 分账金额（分）
  description: string;      // 分账描述
}

// 添加分账接收方请求
export interface AddReceiverRequest {
  type: 'PERSONAL_OPENID';
  account: string;          // OpenID
  name?: string;            // 姓名（需加密）
  relationType: 'USER';     // 与商户关系：用户
}

// 微信授权结果
export interface WechatAuthResult {
  openid: string;
  nickname?: string;
}

// 代理商申请结果
export interface AgentApplyResult {
  agent: Agent;
  invitationCode: string;
}

// 代理商详情（包含用户信息）
export interface AgentDetail extends Agent {
  username: string;
  invitationCode: string;
  invitedUsersCount: number;
  paidUsersCount: number;
}

// 代理商审计日志
export interface AgentAuditLog {
  id: number;
  agentId: number;
  actionType: string;
  operatorId: number;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
