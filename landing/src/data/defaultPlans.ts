/**
 * 默认套餐数据（静态兜底）
 * 
 * 优化策略：
 * 1. 首屏立即显示静态数据，无需等待 API
 * 2. 后台静默获取最新数据，有更新时平滑替换
 * 3. 价格等敏感信息从 API 获取后覆盖
 * 
 * 注意：此数据仅用于首屏展示，实际购买以 API 返回为准
 */

export interface DefaultPlan {
  id: number;
  plan_name: string;
  plan_code: string;
  price: number;
  billing_cycle: string;
  description: string;
  features: {
    feature_code: string;
    feature_name: string;
    feature_value: number;
    feature_unit: string;
  }[];
}

export const DEFAULT_PLANS: DefaultPlan[] = [
  {
    id: 1,
    plan_code: 'free',
    plan_name: '体验版',
    price: 0,
    billing_cycle: 'monthly',
    description: '免费体验套餐',
    features: [
      { feature_code: 'articles_per_month', feature_name: '每月文章数', feature_value: 10, feature_unit: '篇' },
      { feature_code: 'keyword_distillation', feature_name: '关键词蒸馏', feature_value: 5, feature_unit: '次' },
      { feature_code: 'platform_accounts', feature_name: '平台账号数', feature_value: 3, feature_unit: '个' },
      { feature_code: 'publish_per_month', feature_name: '每月发布数', feature_value: 20, feature_unit: '次' },
      { feature_code: 'storage_space', feature_name: '存储空间', feature_value: 100, feature_unit: 'MB' },
    ]
  },
  {
    id: 2,
    plan_code: 'professional',
    plan_name: '专业版',
    price: 99,
    billing_cycle: 'monthly',
    description: '专业版套餐',
    features: [
      { feature_code: 'articles_per_month', feature_name: '每月文章数', feature_value: 100, feature_unit: '篇' },
      { feature_code: 'keyword_distillation', feature_name: '关键词蒸馏', feature_value: 50, feature_unit: '次' },
      { feature_code: 'platform_accounts', feature_name: '平台账号数', feature_value: 10, feature_unit: '个' },
      { feature_code: 'publish_per_month', feature_name: '每月发布数', feature_value: 200, feature_unit: '次' },
      { feature_code: 'storage_space', feature_name: '存储空间', feature_value: 1024, feature_unit: 'MB' },
    ]
  },
  {
    id: 3,
    plan_code: 'enterprise',
    plan_name: '企业版',
    price: 299,
    billing_cycle: 'monthly',
    description: '企业版套餐',
    features: [
      { feature_code: 'articles_per_month', feature_name: '每月文章数', feature_value: -1, feature_unit: '篇' },
      { feature_code: 'keyword_distillation', feature_name: '关键词蒸馏', feature_value: -1, feature_unit: '次' },
      { feature_code: 'platform_accounts', feature_name: '平台账号数', feature_value: -1, feature_unit: '个' },
      { feature_code: 'publish_per_month', feature_name: '每月发布数', feature_value: -1, feature_unit: '次' },
      { feature_code: 'storage_space', feature_name: '存储空间', feature_value: -1, feature_unit: 'MB' },
    ]
  },
  {
    id: 4,
    plan_code: 'jlb',
    plan_name: '加量包',
    price: 29,
    billing_cycle: 'monthly',
    description: '额外配额加量包',
    features: [
      { feature_code: 'articles_per_month', feature_name: '每月生成文章数', feature_value: 100, feature_unit: '篇' },
    ]
  }
];

// 本地存储 key
const PLANS_CACHE_KEY = 'geo_plans_cache';
const PLANS_CACHE_TIMESTAMP_KEY = 'geo_plans_cache_ts';
const CACHE_DURATION = 30 * 60 * 1000; // 30分钟

/**
 * 从本地存储获取缓存的套餐数据
 */
export function getCachedPlans(): DefaultPlan[] | null {
  try {
    const cached = localStorage.getItem(PLANS_CACHE_KEY);
    const timestamp = localStorage.getItem(PLANS_CACHE_TIMESTAMP_KEY);
    
    if (cached && timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age < CACHE_DURATION) {
        return JSON.parse(cached);
      }
    }
  } catch (e) {
    console.warn('读取套餐缓存失败:', e);
  }
  return null;
}

/**
 * 缓存套餐数据到本地存储
 */
export function cachePlans(plans: DefaultPlan[]): void {
  try {
    localStorage.setItem(PLANS_CACHE_KEY, JSON.stringify(plans));
    localStorage.setItem(PLANS_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (e) {
    console.warn('缓存套餐数据失败:', e);
  }
}

/**
 * 获取初始套餐数据（优先本地缓存，其次静态数据）
 */
export function getInitialPlans(): DefaultPlan[] {
  return getCachedPlans() || DEFAULT_PLANS;
}
