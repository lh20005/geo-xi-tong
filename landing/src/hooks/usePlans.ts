/**
 * 套餐数据 Hook（优化版）
 * 
 * 加载策略：
 * 1. 立即返回静态/缓存数据（0ms 首屏）
 * 2. 后台静默获取最新数据
 * 3. 数据更新时平滑替换，无闪烁
 * 
 * 这种模式称为 "Stale-While-Revalidate"
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { config } from '../config/env';
import { 
  DefaultPlan, 
  getInitialPlans, 
  cachePlans 
} from '../data/defaultPlans';

interface Plan extends DefaultPlan {
  // API 可能返回的额外字段
  is_active?: boolean;
  display_order?: number;
  agent_discount_rate?: number;
}

interface UsePlansResult {
  plans: Plan[];
  loading: boolean;      // 是否正在后台加载
  isStale: boolean;      // 当前数据是否为缓存/静态数据
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePlans(): UsePlansResult {
  // 立即使用缓存/静态数据初始化，无需等待
  const [plans, setPlans] = useState<Plan[]>(() => getInitialPlans());
  const [loading, setLoading] = useState(false);
  const [isStale, setIsStale] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchPlans = useCallback(async () => {
    // 防止重复请求
    if (loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${config.apiUrl}/subscription/plans?plan_type=all`,
        { timeout: 10000 } // 10秒超时
      );
      
      if (response.data.success && response.data.data?.length > 0) {
        const freshPlans = response.data.data;
        setPlans(freshPlans);
        setIsStale(false);
        // 缓存到本地存储
        cachePlans(freshPlans);
      }
    } catch (err: any) {
      console.warn('获取套餐列表失败，使用缓存数据:', err.message);
      setError(err.message);
      // 失败时保持当前数据（缓存/静态），不清空
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // 组件挂载时后台获取最新数据
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchPlans();
    }
  }, [fetchPlans]);

  return {
    plans,
    loading,
    isStale,
    error,
    refresh: fetchPlans
  };
}
