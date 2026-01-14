/**
 * 页面数据缓存 Hook
 * 
 * 针对常见页面场景的封装，提供更简洁的 API
 * 
 * 使用示例：
 * 
 * // 基础用法
 * const { data, loading, refresh } = usePageData('articles', fetchArticles);
 * 
 * // 带分页
 * const { data, loading, refresh } = usePageData(
 *   'articles',
 *   () => fetchArticles({ page, pageSize }),
 *   { deps: [page, pageSize] }
 * );
 * 
 * // 带筛选条件
 * const { data, loading, refresh } = usePageData(
 *   'articles',
 *   () => fetchArticles(filters),
 *   { deps: [JSON.stringify(filters)], keyParams: filters }
 * );
 */

import { useMemo } from 'react';
import { useCachedData, type UseCachedDataOptions } from './useCachedData';

interface UsePageDataOptions<T> extends Omit<UseCachedDataOptions<T>, 'deps'> {
  // 依赖项
  deps?: any[];
  // 用于生成缓存 key 的参数（会被序列化）
  keyParams?: Record<string, any>;
  // 是否禁用缓存（某些场景需要每次都获取最新数据）
  noCache?: boolean;
}

/**
 * 页面数据缓存 Hook
 * 
 * @param pageKey 页面标识，如 'articles', 'dashboard', 'platforms'
 * @param fetcher 数据获取函数
 * @param options 配置选项
 */
export function usePageData<T>(
  pageKey: string,
  fetcher: () => Promise<T>,
  options: UsePageDataOptions<T> = {}
) {
  const {
    deps = [],
    keyParams,
    noCache = false,
    ...restOptions
  } = options;

  // 生成缓存 key
  const cacheKey = useMemo(() => {
    if (keyParams) {
      // 将参数序列化为 key 的一部分
      const paramsStr = Object.entries(keyParams)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join('&');
      return paramsStr ? `${pageKey}:${paramsStr}` : pageKey;
    }
    return pageKey;
  }, [pageKey, keyParams]);

  return useCachedData<T>(cacheKey, fetcher, {
    ...restOptions,
    deps,
    enableCache: !noCache,
  });
}

/**
 * 列表页面数据缓存 Hook
 * 
 * 专门针对带分页的列表页面优化
 */
interface UseListDataOptions<T> extends UsePageDataOptions<T> {
  page?: number;
  pageSize?: number;
  filters?: Record<string, any>;
}

export function useListData<T>(
  pageKey: string,
  fetcher: () => Promise<T>,
  options: UseListDataOptions<T> = {}
) {
  const {
    page = 1,
    pageSize = 20,
    filters = {},
    ...restOptions
  } = options;

  // 将分页和筛选条件合并到 keyParams
  const keyParams = useMemo(() => ({
    page,
    pageSize,
    ...filters,
  }), [page, pageSize, filters]);

  return usePageData<T>(pageKey, fetcher, {
    ...restOptions,
    keyParams,
    deps: [page, pageSize, JSON.stringify(filters)],
  });
}

export default usePageData;
