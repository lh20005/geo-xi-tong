import axios from 'axios';
import { config } from '../config/env';

const API_URL = config.apiUrl;

export interface SubscriptionFeature {
  feature_code: string;
  feature_name: string;
  feature_value: number;
  current_usage: number;
  usage_percentage: number;
}

export interface SubscriptionDetail {
  subscription_id: number;
  plan_id: number;
  plan_code: string;
  plan_name: string;
  price: number;
  status: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  is_paused: boolean;
  paused_at: string | null;
  pause_reason: string | null;
  is_gift: boolean;
  custom_quotas: Record<string, number> | null;
  features: SubscriptionFeature[];
}

export interface AdjustmentHistory {
  id: number;
  user_id: number;
  username: string;
  adjustment_type: string;
  adjustment_type_label: string;
  old_plan_name: string | null;
  new_plan_name: string | null;
  old_end_date: string | null;
  new_end_date: string | null;
  days_added: number | null;
  quota_adjustments: any;
  reason: string | null;
  admin_note: string | null;
  admin_username: string;
  created_at: string;
}

/**
 * 获取用户订阅详情
 */
export const getUserSubscriptionDetail = async (userId: number): Promise<SubscriptionDetail> => {
  const token = localStorage.getItem('auth_token');
  const response = await axios.get(`${API_URL}/admin/user-subscriptions/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.data;
};

/**
 * 升级套餐
 */
export const upgradePlan = async (
  userId: number,
  newPlanId: number,
  reason: string
): Promise<void> => {
  const token = localStorage.getItem('auth_token');
  await axios.post(
    `${API_URL}/admin/user-subscriptions/${userId}/upgrade`,
    { newPlanId, reason },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

/**
 * 延期订阅
 */
export const extendSubscription = async (
  userId: number,
  daysToAdd: number,
  reason: string
): Promise<void> => {
  const token = localStorage.getItem('auth_token');
  await axios.post(
    `${API_URL}/admin/user-subscriptions/${userId}/extend`,
    { daysToAdd, reason },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

/**
 * 调整配额
 */
export const adjustQuota = async (
  userId: number,
  featureCode: string,
  newValue: number,
  isPermanent: boolean,
  reason: string
): Promise<void> => {
  const token = localStorage.getItem('auth_token');
  await axios.post(
    `${API_URL}/admin/user-subscriptions/${userId}/adjust-quota`,
    { featureCode, newValue, isPermanent, reason },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

/**
 * 重置配额
 */
export const resetQuota = async (
  userId: number,
  featureCode: string,
  reason: string
): Promise<void> => {
  const token = localStorage.getItem('auth_token');
  await axios.post(
    `${API_URL}/admin/user-subscriptions/${userId}/reset-quota`,
    { featureCode, reason },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

/**
 * 暂停订阅
 */
export const pauseSubscription = async (userId: number, reason: string): Promise<void> => {
  const token = localStorage.getItem('auth_token');
  await axios.post(
    `${API_URL}/admin/user-subscriptions/${userId}/pause`,
    { reason },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

/**
 * 恢复订阅
 */
export const resumeSubscription = async (userId: number, reason: string): Promise<void> => {
  const token = localStorage.getItem('auth_token');
  await axios.post(
    `${API_URL}/admin/user-subscriptions/${userId}/resume`,
    { reason },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

/**
 * 取消订阅
 */
export const cancelSubscription = async (
  userId: number,
  immediate: boolean,
  reason: string
): Promise<void> => {
  const token = localStorage.getItem('auth_token');
  await axios.post(
    `${API_URL}/admin/user-subscriptions/${userId}/cancel`,
    { immediate, reason },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

/**
 * 赠送套餐
 */
export const giftSubscription = async (
  userId: number,
  planId: number,
  durationDays: number,
  reason: string
): Promise<void> => {
  const token = localStorage.getItem('auth_token');
  await axios.post(
    `${API_URL}/admin/user-subscriptions/${userId}/gift`,
    { planId, durationDays, reason },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

/**
 * 获取调整历史
 */
export const getAdjustmentHistory = async (
  userId: number,
  page: number = 1,
  pageSize: number = 20
): Promise<{ history: AdjustmentHistory[]; total: number; totalPages: number }> => {
  const token = localStorage.getItem('auth_token');
  const response = await axios.get(`${API_URL}/admin/user-subscriptions/${userId}/history`, {
    params: { page, pageSize },
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    history: response.data.data,
    total: response.data.pagination.total,
    totalPages: response.data.pagination.totalPages,
  };
};
