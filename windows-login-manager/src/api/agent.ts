/**
 * 代理商 API 客户端
 */

import { apiClient } from './client';

// 代理商状态
export type AgentStatus = 'active' | 'suspended';

// 佣金状态
export type CommissionStatus = 'pending' | 'settled' | 'cancelled' | 'refunded';

// 代理商信息
export interface Agent {
  id: number;
  userId: number;
  status: AgentStatus;
  commissionRate: number;
  wechatOpenid?: string;
  wechatNickname?: string;
  wechatBindtime?: string;
  receiverAdded: boolean;
  totalEarnings: number;
  settledEarnings: number;
  pendingEarnings: number;
  createdAt: string;
  updatedAt: string;
}

// 代理商统计
export interface AgentStats {
  totalEarnings: number;
  settledEarnings: number;
  pendingEarnings: number;
  totalInvites: number;
  paidInvites: number;
  commissionCount: number;
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
  settleDate: string;
  settledAt?: string;
  failReason?: string;
  createdAt: string;
  orderNo?: string;
  username?: string;
  planName?: string;
}

// 分页结果
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 申请成为代理商
 */
export async function applyAgent(): Promise<Agent> {
  const response = await apiClient.post('/agent/apply', {});
  return response.data.data;
}

/**
 * 获取代理商状态
 */
export async function getAgentStatus(): Promise<{ isAgent: boolean; agent: Agent | null }> {
  const response = await apiClient.get('/agent/status');
  return response.data.data;
}

/**
 * 获取代理商统计数据
 */
export async function getAgentStats(): Promise<AgentStats> {
  const response = await apiClient.get('/agent/stats');
  return response.data.data;
}

/**
 * 获取佣金列表
 */
export async function getCommissions(params: {
  status?: CommissionStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<Commission>> {
  const response = await apiClient.get('/agent/commissions', { params });
  return response.data.data;
}

/**
 * 获取绑定码（用于小程序绑定）
 */
export async function getBindCode(): Promise<{
  bindCode: string;
  expiresIn: number;
}> {
  const response = await apiClient.get('/agent/bindWechat/code');
  return response.data.data;
}

/**
 * 获取小程序码（用于扫码绑定）
 */
export async function getBindQRCode(): Promise<{
  bindCode: string;
  qrCodeBase64: string | null;
  expiresIn: number;
}> {
  const response = await apiClient.get('/agent/bindWechat/qrcode');
  return response.data.data;
}

/**
 * 检查绑定状态
 */
export async function checkBindStatus(bindCode: string): Promise<{
  status: 'pending' | 'success' | 'expired';
  openid?: string;
  nickname?: string;
}> {
  const response = await apiClient.get('/agent/bindWechat/status', { params: { bindCode } });
  return response.data.data;
}

/**
 * 解绑微信账户
 */
export async function unbindWechat(): Promise<void> {
  await apiClient.post('/agent/bindWechat/unbind', {});
}
