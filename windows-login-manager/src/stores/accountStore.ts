/**
 * 账号状态管理
 * 使用本地 API（SQLite + 加密）存储账号数据
 */

import { create } from 'zustand';
import { localAccountApi, localBrowserApi, type LocalAccount, type CreateAccountParams } from '../api';

interface AccountStats {
  total: number;
  active: number;
  inactive: number;
  expired: number;
  byPlatform: Array<{
    platform: string;
    count: number;
    active: number;
  }>;
}

interface AccountState {
  // 数据
  accounts: LocalAccount[];
  currentAccount: LocalAccount | null;
  stats: AccountStats | null;
  
  // 状态
  loading: boolean;
  checking: boolean;
  error: string | null;
  
  // 操作
  fetchAccounts: () => Promise<void>;
  fetchAccount: (id: string) => Promise<void>;
  fetchByPlatform: (platformId: string) => Promise<LocalAccount[]>;
  createAccount: (params: CreateAccountParams) => Promise<LocalAccount | null>;
  updateAccount: (id: string, params: Partial<CreateAccountParams>) => Promise<boolean>;
  deleteAccount: (id: string) => Promise<boolean>;
  setDefault: (platformId: string, accountId: string) => Promise<boolean>;
  getDefault: (platformId: string) => Promise<LocalAccount | null>;
  updateLoginStatus: (id: string, status: string, errorMessage?: string) => Promise<boolean>;
  saveCookies: (id: string, cookies: any[]) => Promise<boolean>;
  getCookies: (id: string) => Promise<any[] | null>;
  fetchStats: () => Promise<void>;
  
  // 登录检测
  checkLoginStatus: (accountId: string) => Promise<{ isLoggedIn: boolean; message?: string }>;
  checkAllLoginStatus: () => Promise<void>;
  
  // 浏览器操作
  launchBrowser: (options?: { headless?: boolean }) => Promise<boolean>;
  closeBrowser: () => Promise<boolean>;
  
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  accounts: [],
  currentAccount: null,
  stats: null,
  loading: false,
  checking: false,
  error: null,
};

export const useAccountStore = create<AccountState>((set, get) => ({
  ...initialState,
  
  fetchAccounts: async () => {
    set({ loading: true, error: null });
    try {
      const result = await localAccountApi.findAll();
      if (result.success) {
        set({ accounts: result.data || [], loading: false });
      } else {
        set({ error: result.error || '获取账号列表失败', loading: false });
      }
    } catch (error: any) {
      set({ error: error.message || '获取账号列表失败', loading: false });
    }
  },
  
  fetchAccount: async (id) => {
    set({ loading: true, error: null });
    try {
      const result = await localAccountApi.findById(id);
      if (result.success) {
        set({ currentAccount: result.data, loading: false });
      } else {
        set({ error: result.error || '获取账号详情失败', loading: false });
      }
    } catch (error: any) {
      set({ error: error.message || '获取账号详情失败', loading: false });
    }
  },
  
  fetchByPlatform: async (platformId) => {
    try {
      const result = await localAccountApi.findByPlatform(platformId);
      if (result.success) {
        return result.data || [];
      }
      return [];
    } catch (error: any) {
      console.error('获取平台账号失败:', error);
      return [];
    }
  },
  
  createAccount: async (params) => {
    set({ loading: true, error: null });
    try {
      const result = await localAccountApi.create(params);
      if (result.success) {
        await get().fetchAccounts();
        set({ loading: false });
        return result.data;
      } else {
        set({ error: result.error || '创建账号失败', loading: false });
        return null;
      }
    } catch (error: any) {
      set({ error: error.message || '创建账号失败', loading: false });
      return null;
    }
  },
  
  updateAccount: async (id, params) => {
    set({ loading: true, error: null });
    try {
      const result = await localAccountApi.update(id, params);
      if (result.success) {
        if (get().currentAccount?.id === id) {
          set({ currentAccount: result.data });
        }
        await get().fetchAccounts();
        set({ loading: false });
        return true;
      } else {
        set({ error: result.error || '更新账号失败', loading: false });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '更新账号失败', loading: false });
      return false;
    }
  },
  
  deleteAccount: async (id) => {
    set({ loading: true, error: null });
    try {
      const result = await localAccountApi.delete(id);
      if (result.success) {
        await get().fetchAccounts();
        set({ loading: false });
        return true;
      } else {
        set({ error: result.error || '删除账号失败', loading: false });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '删除账号失败', loading: false });
      return false;
    }
  },
  
  setDefault: async (platformId, accountId) => {
    try {
      const result = await localAccountApi.setDefault(platformId, accountId);
      if (result.success) {
        await get().fetchAccounts();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('设置默认账号失败:', error);
      return false;
    }
  },
  
  getDefault: async (platformId) => {
    try {
      const result = await localAccountApi.getDefault(platformId);
      if (result.success) {
        return result.data;
      }
      return null;
    } catch (error: any) {
      console.error('获取默认账号失败:', error);
      return null;
    }
  },
  
  updateLoginStatus: async (id, status, errorMessage) => {
    try {
      const result = await localAccountApi.updateLoginStatus(id, status, errorMessage);
      if (result.success) {
        await get().fetchAccounts();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('更新登录状态失败:', error);
      return false;
    }
  },
  
  saveCookies: async (id, cookies) => {
    try {
      const result = await localAccountApi.saveCookies(id, cookies);
      return result.success;
    } catch (error: any) {
      console.error('保存 Cookie 失败:', error);
      return false;
    }
  },
  
  getCookies: async (id) => {
    try {
      const result = await localAccountApi.getCookies(id);
      if (result.success) {
        return result.data;
      }
      return null;
    } catch (error: any) {
      console.error('获取 Cookie 失败:', error);
      return null;
    }
  },
  
  fetchStats: async () => {
    try {
      const result = await localAccountApi.getStats();
      if (result.success) {
        set({ stats: result.data });
      }
    } catch (error: any) {
      console.error('获取账号统计失败:', error);
    }
  },
  
  // 登录检测
  checkLoginStatus: async (accountId) => {
    set({ checking: true });
    try {
      const result = await localBrowserApi.checkLoginStatus(accountId);
      set({ checking: false });
      if (result.success) {
        // 更新账号状态
        const status = result.data?.isLoggedIn ? 'active' : 'expired';
        await get().updateLoginStatus(accountId, status);
        return { isLoggedIn: result.data?.isLoggedIn || false, message: result.data?.message };
      }
      return { isLoggedIn: false, message: result.error };
    } catch (error: any) {
      set({ checking: false });
      return { isLoggedIn: false, message: error.message };
    }
  },
  
  checkAllLoginStatus: async () => {
    set({ checking: true });
    try {
      const result = await localBrowserApi.checkAllLoginStatus();
      if (result.success) {
        await get().fetchAccounts();
      }
      set({ checking: false });
    } catch (error: any) {
      set({ checking: false });
      console.error('批量检测登录状态失败:', error);
    }
  },
  
  // 浏览器操作
  launchBrowser: async (options) => {
    try {
      const result = await localBrowserApi.launch(options);
      return result.success;
    } catch (error: any) {
      console.error('启动浏览器失败:', error);
      return false;
    }
  },
  
  closeBrowser: async () => {
    try {
      const result = await localBrowserApi.close();
      return result.success;
    } catch (error: any) {
      console.error('关闭浏览器失败:', error);
      return false;
    }
  },
  
  clearError: () => set({ error: null }),
  
  reset: () => set(initialState),
}));
