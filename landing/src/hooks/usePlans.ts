/**
 * 套餐数据 Hook
 * 
 * 加载策略：从 API 动态获取套餐数据
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { config } from '../config/env';

interface PlanFeature {
  feature_code: string;
  feature_name: string;
  feature_value: number;
  feature_unit: string;
}

interface Plan {
  id: number;
  plan_name: string;
  plan_code: string;
  price: number;
  billing_cycle: string;
  description: string;
  features: PlanFeature[];
  is_active?: boolean;
  display_order?: number;
  agent_discount_rate?: number;
}

interface UsePlansResult {
  plans: Plan[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePlans(): UsePlansResult {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${config.apiUrl}/subscription/plans?plan_type=all`,
        { timeout: 10000 }
      );
      
      if (response.data.success && response.data.data?.length > 0) {
        setPlans(response.data.data);
      }
    } catch (err: any) {
      console.error('获取套餐列表失败:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchPlans();
    }
  }, [fetchPlans]);

  return {
    plans,
    loading,
    error,
    refresh: fetchPlans
  };
}
