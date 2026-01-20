/**
 * 知识库状态管理
 * 使用本地 API（SQLite + 文件系统）存储知识库数据
 */

import { create } from 'zustand';
import { localKnowledgeApi, type LocalKnowledgeBase, type LocalKnowledgeDocument, type CreateKnowledgeBaseParams } from '../api';

interface KnowledgeStats {
  totalBases: number;
  totalDocuments: number;
  totalSize: number;
}

type UploadFile = {
  name: string;
  type: string;
  size?: number;
  path?: string;
  buffer?: number[];
};

interface KnowledgeState {
  // 数据
  knowledgeBases: LocalKnowledgeBase[];
  currentKnowledgeBase: LocalKnowledgeBase | null;
  documents: LocalKnowledgeDocument[];
  currentDocument: LocalKnowledgeDocument | null;
  stats: KnowledgeStats | null;
  searchResults: LocalKnowledgeDocument[];
  
  // 状态
  loading: boolean;
  uploading: boolean;
  parsing: boolean;
  error: string | null;
  
  // 操作
  fetchKnowledgeBases: () => Promise<void>;
  fetchKnowledgeBase: (id: string) => Promise<void>;
  createKnowledgeBase: (params: CreateKnowledgeBaseParams) => Promise<LocalKnowledgeBase | null>;
  updateKnowledgeBase: (id: string, params: Partial<CreateKnowledgeBaseParams>) => Promise<boolean>;
  deleteKnowledgeBase: (id: string) => Promise<boolean>;
  
  // 文档操作
  uploadDocuments: (kbId: string, files: UploadFile[]) => Promise<boolean>;
  fetchDocuments: (kbId: string) => Promise<void>;
  fetchDocument: (docId: string) => Promise<void>;
  deleteDocument: (docId: string) => Promise<boolean>;
  searchDocuments: (kbId: string, query: string) => Promise<void>;
  parseFile: (filePath: string) => Promise<string | null>;
  
  fetchStats: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  knowledgeBases: [],
  currentKnowledgeBase: null,
  documents: [],
  currentDocument: null,
  stats: null,
  searchResults: [],
  loading: false,
  uploading: false,
  parsing: false,
  error: null,
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  ...initialState,
  
  fetchKnowledgeBases: async () => {
    set({ loading: true, error: null });
    try {
      const result = await localKnowledgeApi.findAll();
      if (result.success) {
        set({ knowledgeBases: result.data || [], loading: false });
      } else {
        set({ error: result.error || '获取知识库列表失败', loading: false });
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '获取知识库列表失败'), loading: false });
    }
  },
  
  fetchKnowledgeBase: async (id) => {
    set({ loading: true, error: null });
    try {
      const result = await localKnowledgeApi.findById(id);
      if (result.success) {
        set({ currentKnowledgeBase: result.data, loading: false });
      } else {
        set({ error: result.error || '获取知识库详情失败', loading: false });
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '获取知识库详情失败'), loading: false });
    }
  },
  
  createKnowledgeBase: async (params) => {
    set({ loading: true, error: null });
    try {
      const result = await localKnowledgeApi.create(params);
      if (result.success) {
        await get().fetchKnowledgeBases();
        set({ loading: false });
        return result.data;
      } else {
        set({ error: result.error || '创建知识库失败', loading: false });
        return null;
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '创建知识库失败'), loading: false });
      return null;
    }
  },
  
  updateKnowledgeBase: async (id, params) => {
    set({ loading: true, error: null });
    try {
      const result = await localKnowledgeApi.update(id, params);
      if (result.success) {
        if (get().currentKnowledgeBase?.id === id) {
          set({ currentKnowledgeBase: result.data });
        }
        await get().fetchKnowledgeBases();
        set({ loading: false });
        return true;
      } else {
        set({ error: result.error || '更新知识库失败', loading: false });
        return false;
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '更新知识库失败'), loading: false });
      return false;
    }
  },
  
  deleteKnowledgeBase: async (id) => {
    set({ loading: true, error: null });
    try {
      const result = await localKnowledgeApi.delete(id);
      if (result.success) {
        await get().fetchKnowledgeBases();
        set({ loading: false });
        return true;
      } else {
        set({ error: result.error || '删除知识库失败', loading: false });
        return false;
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '删除知识库失败'), loading: false });
      return false;
    }
  },
  
  // 文档操作
  uploadDocuments: async (kbId, files) => {
    set({ uploading: true, error: null });
    try {
      const result = await localKnowledgeApi.upload(kbId, files);
      if (result.success) {
        await get().fetchDocuments(kbId);
        set({ uploading: false });
        return true;
      } else {
        set({ error: result.error || '上传文档失败', uploading: false });
        return false;
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '上传文档失败'), uploading: false });
      return false;
    }
  },
  
  fetchDocuments: async (kbId) => {
    set({ loading: true, error: null });
    try {
      const result = await localKnowledgeApi.getDocuments(kbId);
      if (result.success) {
        set({ documents: result.data || [], loading: false });
      } else {
        set({ error: result.error || '获取文档列表失败', loading: false });
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '获取文档列表失败'), loading: false });
    }
  },
  
  fetchDocument: async (docId) => {
    set({ loading: true, error: null });
    try {
      const result = await localKnowledgeApi.getDocument(docId);
      if (result.success) {
        set({ currentDocument: result.data, loading: false });
      } else {
        set({ error: result.error || '获取文档详情失败', loading: false });
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '获取文档详情失败'), loading: false });
    }
  },
  
  deleteDocument: async (docId) => {
    set({ loading: true, error: null });
    try {
      const result = await localKnowledgeApi.deleteDocument(docId);
      if (result.success) {
        // 从当前文档列表中移除
        set(state => ({
          documents: state.documents.filter(d => d.id !== docId),
          loading: false,
        }));
        return true;
      } else {
        set({ error: result.error || '删除文档失败', loading: false });
        return false;
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '删除文档失败'), loading: false });
      return false;
    }
  },
  
  searchDocuments: async (kbId, query) => {
    set({ loading: true, error: null });
    try {
      const result = await localKnowledgeApi.search(kbId, query);
      if (result.success) {
        set({ searchResults: result.data || [], loading: false });
      } else {
        set({ error: result.error || '搜索文档失败', loading: false });
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '搜索文档失败'), loading: false });
    }
  },
  
  parseFile: async (filePath) => {
    set({ parsing: true, error: null });
    try {
      const result = await localKnowledgeApi.parse(filePath);
      set({ parsing: false });
      if (result.success) {
        return result.data?.content || null;
      } else {
        set({ error: result.error || '解析文件失败' });
        return null;
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '解析文件失败'), parsing: false });
      return null;
    }
  },
  
  fetchStats: async () => {
    try {
      const result = await localKnowledgeApi.getStats();
      if (result.success) {
        set({ stats: result.data });
      }
    } catch (error: unknown) {
      console.error('获取知识库统计失败:', error);
    }
  },
  
  clearError: () => set({ error: null }),
  
  reset: () => set(initialState),
}));
