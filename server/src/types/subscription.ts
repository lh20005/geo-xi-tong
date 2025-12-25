/**
 * 订阅系统类型定义
 */

export interface Plan {
  id: number;
  plan_code: string;
  plan_name: string;
  price: number;
  billing_cycle: 'monthly' | 'yearly';
  is_active: boolean;
  display_order: number;
  description?: string;
  features: PlanFeature[];
  created_at: Date;
  updated_at: Date;
}

export interface PlanFeature {
  id: number;
  plan_id: number;
  feature_code: string;
  feature_name: string;
  feature_value: number;  // -1 表示无限制
  feature_unit: string;
}

export interface Subscription {
  id: number;
  user_id: number;
  plan_id: number;
  plan?: Plan;
  status: 'active' | 'expired' | 'cancelled';
  start_date: Date;
  end_date: Date;
  auto_renew: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: number;
  order_no: string;
  user_id: number;
  plan_id: number;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'closed';
  payment_method: 'wechat';
  transaction_id?: string;
  paid_at?: Date;
  expired_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UsageRecord {
  id: number;
  user_id: number;
  feature_code: string;
  usage_count: number;
  period_start: Date;
  period_end: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UsageStats {
  feature_code: string;
  feature_name: string;
  limit: number;
  used: number;
  remaining: number;
  percentage: number;
  unit: string;
  reset_time?: string;
}

export interface ConfigHistory {
  id: number;
  plan_id: number;
  changed_by: number;
  changed_by_name: string;
  change_type: string;
  field_name: string;
  old_value: string;
  new_value: string;
  ip_address: string;
  user_agent: string;
  created_at: Date;
}

// API 请求/响应模型
export interface CreateOrderRequest {
  plan_id: number;
}

export interface CreateOrderResponse {
  success: boolean;
  data: {
    order_no: string;
    amount: number;
    plan_name: string;
    qr_code_url: string;
  };
}

export interface UpdatePlanRequest {
  price?: number;
  features?: {
    feature_code: string;
    feature_value: number;
  }[];
  is_active?: boolean;
  confirmationToken?: string;
}

export interface QuotaCheckResponse {
  success: boolean;
  can_perform: boolean;
  message?: string;
  current_plan?: string;
  upgrade_url?: string;
}
