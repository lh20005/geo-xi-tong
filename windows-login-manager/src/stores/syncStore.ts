/**
 * 数据同步状态管理
 * 支持本地导出/导入和云端备份/恢复
 */

import { create } from 'zustand';
import { localSyncApi, type LocalSyncSnapshot } from '../api';

interface LocalStats {
  articleCount: number;
  accountCount: number;
  knowledgeBaseCount: number;
  albumCount: number;
  imageCount: number;
  taskCount: number;
  databaseSize: number;
}

interface SyncState {
  // 数据
  snapshots: LocalSyncSnapshot[];
  localStats: LocalStats | null;
  
  // 状态
  loading: boolean;
  backing: boolean;
  restoring: boolean;
  exporting: boolean;
  importing: boolean;
  error: string | null;
  
  // 云端操作
  backup: () => Promise<{ success: boolean; snapshotId?: string; error?: string }>;
  restore: (snapshotId: string) => Promise<boolean>;
  fetchSnapshots: () => Promise<void>;
  deleteSnapshot: (snapshotId: string) => Promise<boolean>;
  
  // 本地操作
  exportLocal: (exportPath?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  importLocal: (importPath: string) => Promise<boolean>;
  fetchLocalStats: () => Promise<void>;
  
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  snapshots: [],
  localStats: null,
  loading: false,
  backing: false,
  restoring: false,
  exporting: false,
  importing: false,
  error: null,
};

export const useSyncStore = create<SyncState>((set, get) => ({
  ...initialState,
  
  // 云端操作
  backup: async () => {
    set({ backing: true, error: null });
    try {
      const result = await localSyncApi.backup();
      set({ backing: false });
      if (result.success) {
        // 刷新快照列表
        await get().fetchSnapshots();
        return { success: true, snapshotId: result.data?.snapshotId };
      } else {
        set({ error: result.error || '备份失败' });
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      set({ error: error.message || '备份失败', backing: false });
      return { success: false, error: error.message };
    }
  },
  
  restore: async (snapshotId) => {
    set({ restoring: true, error: null });
    try {
      const result = await localSyncApi.restore(snapshotId);
      set({ restoring: false });
      if (result.success) {
        // 刷新本地统计
        await get().fetchLocalStats();
        return true;
      } else {
        set({ error: result.error || '恢复失败' });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '恢复失败', restoring: false });
      return false;
    }
  },
  
  fetchSnapshots: async () => {
    set({ loading: true, error: null });
    try {
      const result = await localSyncApi.getSnapshots();
      if (result.success) {
        set({ snapshots: result.data?.snapshots || [], loading: false });
      } else {
        set({ error: result.error || '获取快照列表失败', loading: false });
      }
    } catch (error: any) {
      set({ error: error.message || '获取快照列表失败', loading: false });
    }
  },
  
  deleteSnapshot: async (snapshotId) => {
    set({ loading: true, error: null });
    try {
      const result = await localSyncApi.deleteSnapshot(snapshotId);
      if (result.success) {
        // 从列表中移除
        set(state => ({
          snapshots: state.snapshots.filter(s => s.id !== snapshotId),
          loading: false,
        }));
        return true;
      } else {
        set({ error: result.error || '删除快照失败', loading: false });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '删除快照失败', loading: false });
      return false;
    }
  },
  
  // 本地操作
  exportLocal: async (exportPath) => {
    set({ exporting: true, error: null });
    try {
      const result = await localSyncApi.exportLocal(exportPath);
      set({ exporting: false });
      if (result.success) {
        return { success: true, path: result.data?.path };
      } else {
        set({ error: result.error || '导出失败' });
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      set({ error: error.message || '导出失败', exporting: false });
      return { success: false, error: error.message };
    }
  },
  
  importLocal: async (importPath) => {
    set({ importing: true, error: null });
    try {
      const result = await localSyncApi.importLocal(importPath);
      set({ importing: false });
      if (result.success) {
        // 刷新本地统计
        await get().fetchLocalStats();
        return true;
      } else {
        set({ error: result.error || '导入失败' });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '导入失败', importing: false });
      return false;
    }
  },
  
  fetchLocalStats: async () => {
    try {
      const result = await localSyncApi.getLocalStats();
      if (result.success) {
        set({ localStats: result.data });
      }
    } catch (error: any) {
      console.error('获取本地统计失败:', error);
    }
  },
  
  clearError: () => set({ error: null }),
  
  reset: () => set(initialState),
}));
