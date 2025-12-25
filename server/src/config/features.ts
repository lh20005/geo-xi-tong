/**
 * 功能配额定义
 * 定义系统中所有可配置的功能配额
 */

export const FEATURE_DEFINITIONS = {
  articles_per_day: {
    code: 'articles_per_day',
    name: '每日生成文章数',
    unit: '篇',
    defaultValue: 10,
    description: '每天可生成的文章数量',
    resetPeriod: 'daily' as const
  },
  publish_per_day: {
    code: 'publish_per_day',
    name: '每日发布文章数',
    unit: '篇',
    defaultValue: 20,
    description: '每天可发布的文章数量',
    resetPeriod: 'daily' as const
  },
  platform_accounts: {
    code: 'platform_accounts',
    name: '可管理平台账号数',
    unit: '个',
    defaultValue: 1,
    description: '可同时管理的平台账号数量',
    resetPeriod: 'never' as const
  },
  keyword_distillation: {
    code: 'keyword_distillation',
    name: '关键词蒸馏数',
    unit: '个',
    defaultValue: 50,
    description: '每月可蒸馏的关键词数量',
    resetPeriod: 'monthly' as const
  }
} as const;

export const PLAN_CODES = {
  FREE: 'free',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise'
} as const;

export type FeatureCode = keyof typeof FEATURE_DEFINITIONS;
export type PlanCode = typeof PLAN_CODES[keyof typeof PLAN_CODES];
export type ResetPeriod = 'daily' | 'monthly' | 'never';
