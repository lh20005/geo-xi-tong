/**
 * 文章状态管理
 * 使用本地 API（SQLite）存储文章数据
 */

import { create } from 'zustand';
import { localArticleApi, type LocalArticle, type CreateArticleParams, type ArticleSearchParams } from '../api';

interface ArticleStats {
  total: number;
  published: number;
  unpublished: number;
}

interface KeywordStat {
  keyword: string;
  count: number;
}

interface ArticleState {
  // 数据
  articles: LocalArticle[];
  currentArticle: LocalArticle | null;
  stats: ArticleStats | null;
  keywordStats: KeywordStat[];
  
  // 分页
  total: number;
  page: number;
  pageSize: number;
  
  // 状态
  loading: boolean;
  error: string | null;
  
  // 操作
  fetchArticles: (params?: { page?: number; pageSize?: number; isPublished?: boolean }) => Promise<void>;
  fetchArticle: (id: string) => Promise<void>;
  createArticle: (params: CreateArticleParams) => Promise<LocalArticle | null>;
  updateArticle: (id: string, params: Partial<CreateArticleParams>) => Promise<boolean>;
  deleteArticle: (id: string) => Promise<boolean>;
  searchArticles: (params: ArticleSearchParams) => Promise<void>;
  deleteBatch: (ids: string[]) => Promise<{ success: boolean; deletedCount: number }>;
  deleteAll: () => Promise<{ success: boolean; deletedCount: number }>;
  fetchStats: () => Promise<void>;
  fetchKeywordStats: () => Promise<void>;
  markAsPublished: (id: string, publishedAt?: string) => Promise<boolean>;
  fetchUnpublished: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  articles: [],
  currentArticle: null,
  stats: null,
  keywordStats: [],
  total: 0,
  page: 1,
  pageSize: 10,
  loading: false,
  error: null,
};

export const useArticleStore = create<ArticleState>((set, get) => ({
  ...initialState,
  
  fetchArticles: async (params) => {
    set({ loading: true, error: null });
    try {
      const result = await localArticleApi.findAll(params);
      if (result.success) {
        set({
          articles: result.data.articles || [],
          total: result.data.total || 0,
          page: params?.page || 1,
          pageSize: params?.pageSize || 10,
          loading: false,
        });
      } else {
        set({ error: result.error || '获取文章列表失败', loading: false });
      }
    } catch (error: any) {
      set({ error: error.message || '获取文章列表失败', loading: false });
    }
  },
  
  fetchArticle: async (id) => {
    set({ loading: true, error: null });
    try {
      const result = await localArticleApi.findById(id);
      if (result.success) {
        set({ currentArticle: result.data, loading: false });
      } else {
        set({ error: result.error || '获取文章详情失败', loading: false });
      }
    } catch (error: any) {
      set({ error: error.message || '获取文章详情失败', loading: false });
    }
  },
  
  createArticle: async (params) => {
    set({ loading: true, error: null });
    try {
      const result = await localArticleApi.create(params);
      if (result.success) {
        // 刷新列表
        await get().fetchArticles({ page: get().page, pageSize: get().pageSize });
        set({ loading: false });
        return result.data;
      } else {
        set({ error: result.error || '创建文章失败', loading: false });
        return null;
      }
    } catch (error: any) {
      set({ error: error.message || '创建文章失败', loading: false });
      return null;
    }
  },
  
  updateArticle: async (id, params) => {
    set({ loading: true, error: null });
    try {
      const result = await localArticleApi.update(id, params);
      if (result.success) {
        // 更新当前文章
        if (get().currentArticle?.id === id) {
          set({ currentArticle: result.data });
        }
        // 刷新列表
        await get().fetchArticles({ page: get().page, pageSize: get().pageSize });
        set({ loading: false });
        return true;
      } else {
        set({ error: result.error || '更新文章失败', loading: false });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '更新文章失败', loading: false });
      return false;
    }
  },
  
  deleteArticle: async (id) => {
    set({ loading: true, error: null });
    try {
      const result = await localArticleApi.delete(id);
      if (result.success) {
        // 刷新列表
        await get().fetchArticles({ page: get().page, pageSize: get().pageSize });
        set({ loading: false });
        return true;
      } else {
        set({ error: result.error || '删除文章失败', loading: false });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '删除文章失败', loading: false });
      return false;
    }
  },
  
  searchArticles: async (params) => {
    set({ loading: true, error: null });
    try {
      const result = await localArticleApi.search(params);
      if (result.success) {
        set({
          articles: result.data.articles || [],
          total: result.data.total || 0,
          page: params.page || 1,
          pageSize: params.pageSize || 10,
          loading: false,
        });
      } else {
        set({ error: result.error || '搜索文章失败', loading: false });
      }
    } catch (error: any) {
      set({ error: error.message || '搜索文章失败', loading: false });
    }
  },
  
  deleteBatch: async (ids) => {
    set({ loading: true, error: null });
    try {
      const result = await localArticleApi.deleteBatch(ids);
      if (result.success) {
        // 刷新列表
        await get().fetchArticles({ page: get().page, pageSize: get().pageSize });
        set({ loading: false });
        return { success: true, deletedCount: result.data?.deletedCount || ids.length };
      } else {
        set({ error: result.error || '批量删除失败', loading: false });
        return { success: false, deletedCount: 0 };
      }
    } catch (error: any) {
      set({ error: error.message || '批量删除失败', loading: false });
      return { success: false, deletedCount: 0 };
    }
  },
  
  deleteAll: async () => {
    set({ loading: true, error: null });
    try {
      const result = await localArticleApi.deleteAll();
      if (result.success) {
        set({ articles: [], total: 0, loading: false });
        return { success: true, deletedCount: result.data?.deletedCount || 0 };
      } else {
        set({ error: result.error || '删除所有文章失败', loading: false });
        return { success: false, deletedCount: 0 };
      }
    } catch (error: any) {
      set({ error: error.message || '删除所有文章失败', loading: false });
      return { success: false, deletedCount: 0 };
    }
  },
  
  fetchStats: async () => {
    try {
      const result = await localArticleApi.getStats();
      if (result.success) {
        set({ stats: result.data });
      }
    } catch (error: any) {
      console.error('获取文章统计失败:', error);
    }
  },
  
  fetchKeywordStats: async () => {
    try {
      const result = await localArticleApi.getKeywordStats();
      if (result.success) {
        set({ keywordStats: result.data?.keywords || [] });
      }
    } catch (error: any) {
      console.error('获取关键词统计失败:', error);
    }
  },
  
  markAsPublished: async (id, publishedAt) => {
    set({ loading: true, error: null });
    try {
      const result = await localArticleApi.markAsPublished(id, publishedAt);
      if (result.success) {
        // 刷新列表
        await get().fetchArticles({ page: get().page, pageSize: get().pageSize });
        set({ loading: false });
        return true;
      } else {
        set({ error: result.error || '标记发布状态失败', loading: false });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '标记发布状态失败', loading: false });
      return false;
    }
  },
  
  fetchUnpublished: async () => {
    set({ loading: true, error: null });
    try {
      const result = await localArticleApi.findUnpublished();
      if (result.success) {
        set({ articles: result.data || [], loading: false });
      } else {
        set({ error: result.error || '获取未发布文章失败', loading: false });
      }
    } catch (error: any) {
      set({ error: error.message || '获取未发布文章失败', loading: false });
    }
  },
  
  clearError: () => set({ error: null }),
  
  reset: () => set(initialState),
}));
