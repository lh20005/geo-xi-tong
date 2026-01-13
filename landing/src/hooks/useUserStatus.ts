import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { config } from '../config/env';

interface PlanDiscountInfo {
  planId: number;
  planName: string;
  planCode: string;
  originalPrice: number;
  discountRate: number;
  discountedPrice: number;
  hasDiscount: boolean;
}

interface UserPlan {
  id: number;
  plan_code: string;
  plan_name: string;
  price: number;
  billing_cycle: string;
  description?: string;
}

interface UserSubscription {
  id: number;
  user_id: number;
  plan_id: number;
  status: string;
  start_date: string;
  end_date: string;
  plan: UserPlan;
  plan_code: string;
  plan_name: string;
}

interface DiscountInfo {
  eligible: boolean;
  reason?: string;
  invitedByAgent: boolean;
  isFirstPurchase: boolean;
  discountUsed: boolean;
  plans: PlanDiscountInfo[];
}

interface UserStatus {
  subscription: UserSubscription | null;
  discount: DiscountInfo;
}

// 基础套餐等级顺序
const PLAN_LEVEL_ORDER = ['free', 'professional', 'enterprise'];

/**
 * 用户状态 Hook（合并版）
 * 一次请求获取订阅状态和折扣资格，减少 API 调用
 */
export function useUserStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);

  const fetchUserStatus = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    
    // 未登录用户不获取状态
    if (!token) {
      setUserStatus(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${config.apiUrl}/subscription/user-status`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setUserStatus(response.data.data);
      } else {
        setError(response.data.message || '获取用户状态失败');
      }
    } catch (err: any) {
      console.error('获取用户状态失败:', err);
      if (err.response?.status !== 401) {
        setError(err.response?.data?.message || '获取用户状态失败');
      }
      setUserStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取指定套餐的折扣价格
  const getDiscountedPrice = useCallback((planId: number) => {
    if (!userStatus?.discount?.plans) return null;
    
    const plan = userStatus.discount.plans.find(p => p.planId === planId);
    if (!plan) return null;

    return {
      originalPrice: plan.originalPrice,
      discountedPrice: plan.discountedPrice,
      hasDiscount: plan.hasDiscount
    };
  }, [userStatus]);

  // 判断是否为加量包类型
  const isAddonPlan = useCallback((planCode: string): boolean => {
    if (!planCode) return false;
    const lowerCode = planCode.toLowerCase();
    return lowerCode.includes('pack') || 
           lowerCode.includes('addon') || 
           lowerCode.includes('quota') ||
           lowerCode.includes('加量');
  }, []);

  // 判断用户是否已拥有某个套餐等级或更高
  const hasAccessTo = useCallback((targetPlanCode: string): boolean => {
    if (!userStatus?.subscription?.plan?.plan_code) return false;
    
    const userPlanCode = userStatus.subscription.plan.plan_code.toLowerCase();
    const targetCode = targetPlanCode.toLowerCase();
    
    if (isAddonPlan(targetCode)) return false;
    if (isAddonPlan(userPlanCode)) return false;
    
    const userLevel = PLAN_LEVEL_ORDER.indexOf(userPlanCode);
    const targetLevel = PLAN_LEVEL_ORDER.indexOf(targetCode);
    
    if (userLevel === -1 || targetLevel === -1) return false;
    
    return userLevel >= targetLevel;
  }, [userStatus, isAddonPlan]);

  useEffect(() => {
    fetchUserStatus();
  }, [fetchUserStatus]);

  return {
    loading,
    error,
    userStatus,
    subscription: userStatus?.subscription || null,
    discount: userStatus?.discount || null,
    userPlanCode: userStatus?.subscription?.plan?.plan_code || null,
    refresh: fetchUserStatus,
    getDiscountedPrice,
    hasAccessTo,
    isAddonPlan
  };
}

export type { UserStatus, UserSubscription, DiscountInfo, PlanDiscountInfo };
