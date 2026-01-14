/**
 * 通用数据缓存 Hook
 * 
 * 实现 Stale-While-Revalidate 策略的 React Hook
 * 
 * 使用方式：
 * const { data, loading, error, refresh } = useCachedData(
 *   'dashboard:main',           // 缓存 key
 *   () => fetchDashboardData(), // 数据获取函数
 *   { deps: [timeRange] }       // 可选配置
 * );
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCacheStore } from '../stores/cacheStore';

interface UseCachedDataOptions<T> {
  // 依赖项变化时重新获取数据
  deps?: any[];
  // 是否在组件挂载时自动获取数据
  autoFetch?: boolean;
  // 数据获取成功回调
  onSuccess?: (data: T) => void;
  // 数据获取失败回调
  onError?: (error: Error) => void;
  // 是否启用缓存（默认 true）
  enableCache?: boolean;
  // 强制刷新（忽略缓存）
  forceRefresh?: boolean;
}

interface UseCachedDataResult<T> {
  // 数据
  data: T | null;
  // 是否正在加载（首次加载，无缓存时）
  loading: boolean;
  // 是否正在后台刷新（有缓存，后台更新时）
  refreshing: boolean;
  // 错误信息
  error: Error | null;
  // 手动刷新函数
  refresh: (force?: boolean) => Promise<void>;
  // 清除缓存
  clearCache: () => void;
  // 数据是否来自缓存
  isFromCache: boolean;
  // 数据是否过期
  isStale: boolean;
}

export function useCachedData<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: UseCachedDataOptions<T> = {}
): UseCachedDataResult<T> {
  const {
    deps = [],
    autoFetch = true,
    onSuccess,
    onError,
    enableCache = true,
    forceRefresh = false,
  } = options;

  const {
    getCache,
    setCache,
    isStale,
    isPending,
    startRequest,
    endRequest,
    clearCache: clearCacheStore,
  } = useCacheStore();

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [dataIsStale, setDataIsStale] = useState(false);

  // 用于追踪组件是否已卸载
  const isMountedRef = useRef(true);
  // 用于追踪当前请求的版本，避免竞态条件
  const requestVersionRef = useRef(0);

  // 获取数据的核心函数
  const fetchData = useCallback(async (force: boolean = false) => {
    // 如果已经有相同的请求在进行中，跳过
    if (isPending(cacheKey) && !force) {
      return;
    }

    const currentVersion = ++requestVersionRef.current;

    // 检查缓存
    if (enableCache && !force) {
      const cached = getCache<T>(cacheKey);
      
      if (cached) {
        // 有缓存数据，立即显示
        setData(cached.data);
        setIsFromCache(true);
        setDataIsStale(cached.isStale);
        setLoading(false);
        
        // 如果数据不是 stale，不需要刷新
        if (!cached.isStale) {
          return;
        }
        
        // 数据是 stale，后台刷新
        setRefreshing(true);
      } else {
        // 无缓存，显示 loading
        setLoading(true);
        setIsFromCache(false);
      }
    } else {
      // 强制刷新或禁用缓存
      if (data) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
    }

    startRequest(cacheKey);
    setError(null);

    try {
      const result = await fetcher();
      
      // 检查组件是否已卸载或请求是否过期
      if (!isMountedRef.current || currentVersion !== requestVersionRef.current) {
        return;
      }

      // 更新缓存
      if (enableCache) {
        setCache(cacheKey, result);
      }

      setData(result);
      setIsFromCache(false);
      setDataIsStale(false);
      onSuccess?.(result);
    } catch (err) {
      if (!isMountedRef.current || currentVersion !== requestVersionRef.current) {
        return;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      
      // 如果有缓存数据，保持显示缓存数据
      // 只有在没有缓存时才清空数据
      if (!isFromCache) {
        // setData(null); // 可选：是否在错误时清空数据
      }
    } finally {
      if (isMountedRef.current && currentVersion === requestVersionRef.current) {
        setLoading(false);
        setRefreshing(false);
        endRequest(cacheKey);
      }
    }
  }, [cacheKey, fetcher, enableCache, getCache, setCache, isPending, startRequest, endRequest, onSuccess, onError, isFromCache, data]);

  // 手动刷新函数
  const refresh = useCallback(async (force: boolean = true) => {
    await fetchData(force);
  }, [fetchData]);

  // 清除缓存函数
  const clearCache = useCallback(() => {
    clearCacheStore(cacheKey);
    setData(null);
    setIsFromCache(false);
    setDataIsStale(false);
  }, [cacheKey, clearCacheStore]);

  // 组件挂载时获取数据
  useEffect(() => {
    isMountedRef.current = true;
    
    if (autoFetch) {
      fetchData(forceRefresh);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [cacheKey, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    refreshing,
    error,
    refresh,
    clearCache,
    isFromCache,
    isStale: dataIsStale,
  };
}

export default useCachedData;
