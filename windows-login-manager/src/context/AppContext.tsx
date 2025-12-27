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

interface UserInfo {
  id: number;
  username: string;
  email?: string;
  role: string;
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
  user: UserInfo | null;
  isLoading: boolean;
  error: string | null;
  refreshAccounts: () => Promise<void>;
  deleteAccount: (accountId: number) => Promise<void>;
  updateConfig: (config: AppConfig) => Promise<void>;
  setUser: (user: UserInfo | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化加载数据
  useEffect(() => {
    loadInitialData();
  }, []);

  // 监听WebSocket账号事件
  useEffect(() => {
    console.log('Setting up WebSocket account event listener...');
    
    const cleanup = ipcBridge.onAccountEvent((event: any) => {
      console.log('Received account event:', event.type, event.data);
      
      switch (event.type) {
        case 'account.created':
          // 添加新账号到列表
          setAccounts((prev) => {
            // 检查是否已存在（避免重复）
            if (prev.some(a => a.id === event.data.id)) {
              return prev;
            }
            return [...prev, event.data];
          });
          break;
          
        case 'account.updated':
          // 更新现有账号
          setAccounts((prev) =>
            prev.map((a) => (a.id === event.data.id ? event.data : a))
          );
          break;
          
        case 'account.deleted':
          // 删除账号
          setAccounts((prev) => prev.filter((a) => a.id !== event.data.id));
          break;
      }
    });
    
    // 清理函数
    return () => {
      console.log('Cleaning up WebSocket account event listener');
      cleanup();
    };
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
      const result = await ipcBridge.deleteAccount(accountId);
      
      if (!result.success) {
        throw new Error(result.error || '删除失败');
      }
      
      // 后端删除成功，更新本地状态
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
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
    user,
    isLoading,
    error,
    refreshAccounts,
    deleteAccount,
    updateConfig,
    setUser,
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
