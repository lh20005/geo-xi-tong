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

interface DiscountEligibility {
  eligible: boolean;
  reason?: string;
  invitedByAgent: boolean;
  isFirstPurchase: boolean;
  discountUsed: boolean;
  plans: PlanDiscountInfo[];
}

interface UseDiscountEligibilityResult {
  loading: boolean;
  error: string | null;
  eligibility: DiscountEligibility | null;
  refresh: () => Promise<void>;
  getDiscountedPrice: (planId: number) => { originalPrice: number; discountedPrice: number; hasDiscount: boolean } | null;
}

/**
 * 折扣资格检查 Hook
 * 用于检查当前用户是否有资格享受代理商折扣
 */
export function useDiscountEligibility(): UseDiscountEligibilityResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<DiscountEligibility | null>(null);

  const fetchEligibility = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    
    // 未登录用户不检查折扣资格
    if (!token) {
      setEligibility(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${config.apiUrl}/subscription/discount-check`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setEligibility(response.data.data);
      } else {
        setError(response.data.message || '检查折扣资格失败');
      }
    } catch (err: any) {
      console.error('检查折扣资格失败:', err);
      // 401 错误表示未登录或 token 过期，不显示错误
      if (err.response?.status !== 401) {
        setError(err.response?.data?.message || '检查折扣资格失败');
      }
      setEligibility(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取指定套餐的折扣价格
  const getDiscountedPrice = useCallback((planId: number) => {
    if (!eligibility?.plans) return null;
    
    const plan = eligibility.plans.find(p => p.planId === planId);
    if (!plan) return null;

    return {
      originalPrice: plan.originalPrice,
      discountedPrice: plan.discountedPrice,
      hasDiscount: plan.hasDiscount
    };
  }, [eligibility]);

  useEffect(() => {
    fetchEligibility();
  }, [fetchEligibility]);

  return {
    loading,
    error,
    eligibility,
    refresh: fetchEligibility,
    getDiscountedPrice
  };
}

export type { PlanDiscountInfo, DiscountEligibility };
