import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { config } from '../config/env';

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

interface UseUserSubscriptionResult {
  loading: boolean;
  error: string | null;
  subscription: UserSubscription | null;
  userPlanCode: string | null;
  refresh: () => Promise<void>;
  /**
   * 判断用户是否已拥有某个套餐等级或更高
   * 套餐等级顺序：free < professional < enterprise
   * 加量包（quota_pack）不参与等级比较，始终返回 false
   */
  hasAccessTo: (planCode: string) => boolean;
  /**
   * 判断某个套餐是否为加量包类型
   * 加量包的特征：plan_code 包含 'pack' 或 'addon' 或 'quota'
   */
  isAddonPlan: (planCode: string) => boolean;
}

// 基础套餐等级顺序（不包含加量包）
const PLAN_LEVEL_ORDER = ['free', 'professional', 'enterprise'];

/**
 * 用户订阅状态 Hook
 * 用于获取当前登录用户的订阅信息
 */
export function useUserSubscription(): UseUserSubscriptionResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);

  const fetchSubscription = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    
    // 未登录用户不获取订阅
    if (!token) {
      setSubscription(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${config.apiUrl}/subscription/current`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setSubscription(response.data.data);
      } else {
        setError(response.data.message || '获取订阅信息失败');
      }
    } catch (err: any) {
      console.error('获取订阅信息失败:', err);
      // 401 错误表示未登录或 token 过期，不显示错误
      if (err.response?.status !== 401) {
        setError(err.response?.data?.message || '获取订阅信息失败');
      }
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 判断是否为加量包类型
  const isAddonPlan = useCallback((planCode: string): boolean => {
    if (!planCode) return false;
    const lowerCode = planCode.toLowerCase();
    // 加量包的特征：包含 pack、addon、quota 等关键词
    return lowerCode.includes('pack') || 
           lowerCode.includes('addon') || 
           lowerCode.includes('quota') ||
           lowerCode.includes('加量');
  }, []);

  // 判断用户是否已拥有某个套餐等级或更高
  const hasAccessTo = useCallback((targetPlanCode: string): boolean => {
    // 未登录或无订阅
    if (!subscription?.plan?.plan_code) return false;
    
    const userPlanCode = subscription.plan.plan_code.toLowerCase();
    const targetCode = targetPlanCode.toLowerCase();
    
    // 如果目标是加量包，用户永远没有"拥有"它（加量包始终可以购买）
    if (isAddonPlan(targetCode)) {
      return false;
    }
    
    // 如果用户当前是加量包（理论上不应该，但防御性编程）
    if (isAddonPlan(userPlanCode)) {
      return false;
    }
    
    // 获取用户当前套餐等级
    const userLevel = PLAN_LEVEL_ORDER.indexOf(userPlanCode);
    const targetLevel = PLAN_LEVEL_ORDER.indexOf(targetCode);
    
    // 如果找不到等级（未知套餐），返回 false
    if (userLevel === -1 || targetLevel === -1) {
      return false;
    }
    
    // 用户等级 >= 目标等级，表示已拥有
    return userLevel >= targetLevel;
  }, [subscription, isAddonPlan]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return {
    loading,
    error,
    subscription,
    userPlanCode: subscription?.plan?.plan_code || null,
    refresh: fetchSubscription,
    hasAccessTo,
    isAddonPlan
  };
}

export type { UserSubscription, UserPlan };
