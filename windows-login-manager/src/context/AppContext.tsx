import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import ipcBridge from '../services/ipc';

interface Account {
  id: number;
  platform_id: string;
  account_name: string;
  real_username?: string;
  is_default: boolean;
  status: 'active' | 'inactive' | 'expired';
  created_at: Date;
  updated_at: Date;
}

interface AppConfig {
  serverUrl: string;
  autoSync: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  theme: 'light' | 'dark' | 'system';
}

interface AppContextType {
  accounts: Account[];
  config: AppConfig | null;
  isLoading: boolean;
  error: string | null;
  refreshAccounts: () => Promise<void>;
  deleteAccount: (accountId: number) => Promise<void>;
  setDefaultAccount: (platformId: string, accountId: number) => Promise<void>;
  updateConfig: (config: AppConfig) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化加载数据
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 加载配置
      const configData = await ipcBridge.getConfig();
      setConfig(configData);

      // 加载账号
      const accountsData = await ipcBridge.getAccounts();
      setAccounts(accountsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAccounts = async () => {
    try {
      setError(null);
      const accountsData = await ipcBridge.refreshAccounts();
      setAccounts(accountsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh accounts');
      throw err;
    }
  };

  const deleteAccount = async (accountId: number) => {
    try {
      setError(null);
      await ipcBridge.deleteAccount(accountId);
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      throw err;
    }
  };

  const setDefaultAccount = async (platformId: string, accountId: number) => {
    try {
      setError(null);
      await ipcBridge.setDefaultAccount(platformId, accountId);
      
      // 更新本地状态
      setAccounts((prev) =>
        prev.map((a) => ({
          ...a,
          is_default: a.platform_id === platformId ? a.id === accountId : a.is_default,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default account');
      throw err;
    }
  };

  const updateConfig = async (newConfig: AppConfig) => {
    try {
      setError(null);
      await ipcBridge.setConfig(newConfig);
      setConfig(newConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update config');
      throw err;
    }
  };

  const value: AppContextType = {
    accounts,
    config,
    isLoading,
    error,
    refreshAccounts,
    deleteAccount,
    setDefaultAccount,
    updateConfig,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
