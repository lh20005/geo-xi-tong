/**
 * 全局数据缓存 Store
 * 
 * 采用 Stale-While-Revalidate 策略：
 * 1. 首次访问：显示 loading，获取数据后缓存
 * 2. 再次访问：立即显示缓存数据（无 loading），后台静默刷新
 * 3. 数据过期：自动在后台重新获取
 * 
 * 优点：
 * - 页面切换无等待感
 * - 数据始终保持最新
 * - 减少不必要的 API 请求
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 缓存项接口
interface CacheItem<T = any> {
  data: T;
  timestamp: number;      // 数据获取时间
  isStale: boolean;       // 是否过期（仍可显示，但需要后台刷新）
}

// 缓存配置
interface CacheConfig {
  staleTime: number;      // 数据变为 stale 的时间（毫秒）
  cacheTime: number;      // 数据完全过期的时间（毫秒）
}

// 默认缓存配置
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  staleTime: 2 * 60 * 1000,    // 2分钟后变为 stale（仍显示，后台刷新）
  cacheTime: 30 * 60 * 1000,   // 30分钟后完全过期（需要重新加载）
};

// 各页面的缓存配置（可自定义）
const PAGE_CACHE_CONFIG: Record<string, Partial<CacheConfig>> = {
  // 高频更新页面（1-2分钟）
  dashboard: { staleTime: 1 * 60 * 1000, cacheTime: 10 * 60 * 1000 },
  publishingTasks: { staleTime: 30 * 1000, cacheTime: 5 * 60 * 1000 },  // 发布任务 30秒
  publishingRecords: { staleTime: 1 * 60 * 1000, cacheTime: 10 * 60 * 1000 },
  
  // 中频更新页面（3-5分钟）
  articles: { staleTime: 3 * 60 * 1000, cacheTime: 30 * 60 * 1000 },
  distillation: { staleTime: 3 * 60 * 1000, cacheTime: 30 * 60 * 1000 },
  distillationResults: { staleTime: 3 * 60 * 1000, cacheTime: 30 * 60 * 1000 },
  topics: { staleTime: 3 * 60 * 1000, cacheTime: 30 * 60 * 1000 },
  articleGeneration: { staleTime: 3 * 60 * 1000, cacheTime: 30 * 60 * 1000 },
  
  // 低频更新页面（5-10分钟）
  platforms: { staleTime: 5 * 60 * 1000, cacheTime: 60 * 60 * 1000 },
  gallery: { staleTime: 5 * 60 * 1000, cacheTime: 30 * 60 * 1000 },
  knowledgeBase: { staleTime: 5 * 60 * 1000, cacheTime: 30 * 60 * 1000 },
  userCenter: { staleTime: 5 * 60 * 1000, cacheTime: 30 * 60 * 1000 },
  conversionTargets: { staleTime: 5 * 60 * 1000, cacheTime: 60 * 60 * 1000 },
  articleSettings: { staleTime: 5 * 60 * 1000, cacheTime: 60 * 60 * 1000 },
  
  // 管理页面（10分钟）
  users: { staleTime: 10 * 60 * 1000, cacheTime: 60 * 60 * 1000 },
  agents: { staleTime: 10 * 60 * 1000, cacheTime: 60 * 60 * 1000 },
  orders: { staleTime: 5 * 60 * 1000, cacheTime: 30 * 60 * 1000 },
  products: { staleTime: 10 * 60 * 1000, cacheTime: 60 * 60 * 1000 },
  permissions: { staleTime: 10 * 60 * 1000, cacheTime: 60 * 60 * 1000 },
  auditLogs: { staleTime: 2 * 60 * 1000, cacheTime: 15 * 60 * 1000 },
  securityDashboard: { staleTime: 2 * 60 * 1000, cacheTime: 15 * 60 * 1000 },
  config: { staleTime: 10 * 60 * 1000, cacheTime: 60 * 60 * 1000 },
};

// Store 状态接口
interface CacheState {
  // 缓存数据存储
  cache: Record<string, CacheItem>;
  
  // 正在获取中的请求（防止重复请求）
  pendingRequests: Record<string, boolean>;
  
  // 获取缓存数据
  getCache: <T>(key: string) => CacheItem<T> | null;
  
  // 设置缓存数据
  setCache: <T>(key: string, data: T) => void;
  
  // 检查数据是否过期
  isStale: (key: string) => boolean;
  
  // 检查数据是否完全过期（需要重新加载）
  isExpired: (key: string) => boolean;
  
  // 标记请求开始
  startRequest: (key: string) => void;
  
  // 标记请求结束
  endRequest: (key: string) => void;
  
  // 检查是否正在请求
  isPending: (key: string) => boolean;
  
  // 清除指定缓存
  clearCache: (key: string) => void;
  
  // 清除所有缓存
  clearAllCache: () => void;
  
  // 使缓存失效（标记为 stale，触发后台刷新）
  invalidateCache: (key: string) => void;
  
  // 批量使缓存失效（支持前缀匹配）
  invalidateCacheByPrefix: (prefix: string) => void;
}

// 获取缓存配置
const getCacheConfig = (key: string): CacheConfig => {
  const pageKey = key.split(':')[0]; // 从 key 中提取页面标识
  const pageConfig = PAGE_CACHE_CONFIG[pageKey] || {};
  return { ...DEFAULT_CACHE_CONFIG, ...pageConfig };
};

export const useCacheStore = create<CacheState>()(
  persist(
    (set, get) => ({
      cache: {},
      pendingRequests: {},
      
      getCache: <T>(key: string): CacheItem<T> | null => {
        const item = get().cache[key];
        if (!item) return null;
        
        const config = getCacheConfig(key);
        const now = Date.now();
        const age = now - item.timestamp;
        
        // 完全过期，返回 null
        if (age > config.cacheTime) {
          return null;
        }
        
        // 返回数据，标记是否 stale
        return {
          ...item,
          isStale: age > config.staleTime,
        } as CacheItem<T>;
      },
      
      setCache: <T>(key: string, data: T) => {
        set((state) => ({
          cache: {
            ...state.cache,
            [key]: {
              data,
              timestamp: Date.now(),
              isStale: false,
            },
          },
        }));
      },
      
      isStale: (key: string) => {
        const item = get().cache[key];
        if (!item) return true;
        
        const config = getCacheConfig(key);
        return Date.now() - item.timestamp > config.staleTime;
      },
      
      isExpired: (key: string) => {
        const item = get().cache[key];
        if (!item) return true;
        
        const config = getCacheConfig(key);
        return Date.now() - item.timestamp > config.cacheTime;
      },
      
      startRequest: (key: string) => {
        set((state) => ({
          pendingRequests: { ...state.pendingRequests, [key]: true },
        }));
      },
      
      endRequest: (key: string) => {
        set((state) => {
          const { [key]: _, ...rest } = state.pendingRequests;
          return { pendingRequests: rest };
        });
      },
      
      isPending: (key: string) => {
        return !!get().pendingRequests[key];
      },
      
      clearCache: (key: string) => {
        set((state) => {
          const { [key]: _, ...rest } = state.cache;
          return { cache: rest };
        });
      },
      
      clearAllCache: () => {
        set({ cache: {}, pendingRequests: {} });
      },
      
      invalidateCache: (key: string) => {
        set((state) => {
          const item = state.cache[key];
          if (!item) return state;
          
          return {
            cache: {
              ...state.cache,
              [key]: { ...item, isStale: true, timestamp: 0 },
            },
          };
        });
      },
      
      invalidateCacheByPrefix: (prefix: string) => {
        set((state) => {
          const newCache = { ...state.cache };
          Object.keys(newCache).forEach((key) => {
            if (key.startsWith(prefix)) {
              newCache[key] = { ...newCache[key], isStale: true, timestamp: 0 };
            }
          });
          return { cache: newCache };
        });
      },
    }),
    {
      name: 'app-cache-storage',
      storage: createJSONStorage(() => localStorage),
      // 只持久化缓存数据，不持久化 pending 状态
      partialize: (state) => ({ cache: state.cache }),
      // 应用启动时清理过期数据
      onRehydrateStorage: () => (state) => {
        if (state) {
          const now = Date.now();
          const cleanedCache: Record<string, CacheItem> = {};
          
          Object.entries(state.cache).forEach(([key, item]) => {
            const config = getCacheConfig(key);
            // 只保留未完全过期的数据
            if (now - item.timestamp < config.cacheTime) {
              cleanedCache[key] = item;
            }
          });
          
          state.cache = cleanedCache;
        }
      },
    }
  )
);

export default useCacheStore;
