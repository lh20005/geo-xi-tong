/**
 * 平台账号 API（本地IPC调用）
 * 改造说明：平台账号已迁移到Windows端本地SQLite存储，使用IPC通信
 */

export interface Account {
  id: string; // UUID格式
  user_id: number;
  platform: string;
  platform_id: string | null;
  account_name: string | null;
  real_username: string | null;
  credentials: string | null; // 加密存储
  cookies: string | null; // 加密存储
  status: string; // 'active', 'inactive', 'expired', 'error'
  is_default: number; // 0 or 1
  error_message: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DecryptedAccount extends Omit<Account, 'credentials' | 'cookies'> {
  credentials: any | null;
  cookies: any[] | null;
}

export interface CreateAccountInput {
  user_id: number;
  platform: string;
  platform_id?: string;
  account_name?: string;
  real_username?: string;
  credentials?: any;
  cookies?: any[];
  status?: string;
  is_default?: boolean;
}

export interface UpdateAccountInput {
  account_name?: string;
  real_username?: string;
  credentials?: any;
  cookies?: any[];
  status?: string;
  is_default?: boolean;
  error_message?: string;
}

export interface AccountStats {
  total: number;
  active: number;
  inactive: number;
  byPlatform: Array<{
    platform: string;
    count: number;
    active: number;
  }>;
}

/**
 * 检查是否在Electron环境中
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electron !== undefined;
}

/**
 * 获取所有账号（本地IPC）
 */
export async function getAccounts(userId?: number): Promise<Account[]> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  return await window.electron.invoke('get-accounts', userId);
}

/**
 * 获取账号详情（本地IPC）
 */
export async function getAccountById(accountId: string, includeCredentials: boolean = false): Promise<Account | DecryptedAccount> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('account:getById', accountId, includeCredentials);
  
  if (!result.success) {
    throw new Error(result.error || '获取账号详情失败');
  }
  
  return result.data;
}

/**
 * 根据平台ID获取账号（本地IPC）
 */
export async function getAccountsByPlatform(userId: number, platformId: string): Promise<Account[]> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('account:getByPlatform', userId, platformId);
  
  if (!result.success) {
    throw new Error(result.error || '获取账号列表失败');
  }
  
  return result.data;
}

/**
 * 创建账号（本地IPC）
 * 注意：通常账号在登录成功后自动创建，这个接口主要用于手动添加
 */
export async function createAccount(input: CreateAccountInput): Promise<Account> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('account:create', input);
  
  if (!result.success) {
    throw new Error(result.error || '创建账号失败');
  }
  
  return result.data;
}

/**
 * 更新账号（本地IPC）
 */
export async function updateAccount(accountId: string, data: UpdateAccountInput): Promise<Account> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('account:update', accountId, data);
  
  if (!result.success) {
    throw new Error(result.error || '更新账号失败');
  }
  
  return result.data;
}

/**
 * 删除账号（本地IPC）
 */
export async function deleteAccount(accountId: string, userId?: number): Promise<void> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('delete-account', accountId, userId);
  
  if (!result.success) {
    throw new Error(result.error || '删除账号失败');
  }
}

/**
 * 设置默认账号（本地IPC）
 */
export async function setDefaultAccount(platformId: string, accountId: string, userId?: number): Promise<void> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('set-default-account', platformId, accountId, userId);
  
  if (!result.success) {
    throw new Error(result.error || '设置默认账号失败');
  }
}

/**
 * 获取默认账号（本地IPC）
 */
export async function getDefaultAccount(userId: number, platform: string): Promise<Account | null> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('account:getDefault', userId, platform);
  
  if (!result.success) {
    throw new Error(result.error || '获取默认账号失败');
  }
  
  return result.data;
}

/**
 * 获取活跃账号（本地IPC）
 */
export async function getActiveAccounts(userId: number): Promise<Account[]> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('account:getActive', userId);
  
  if (!result.success) {
    throw new Error(result.error || '获取活跃账号失败');
  }
  
  return result.data;
}

/**
 * 获取账号统计（本地IPC）
 */
export async function getAccountStats(userId: number): Promise<AccountStats> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('account:getStats', userId);
  
  if (!result.success) {
    throw new Error(result.error || '获取统计数据失败');
  }
  
  return result.data;
}

/**
 * 更新账号Cookies（本地IPC）
 */
export async function updateAccountCookies(accountId: string, cookies: any[]): Promise<void> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('account:updateCookies', accountId, cookies);
  
  if (!result.success) {
    throw new Error(result.error || 'Cookies更新失败');
  }
}

/**
 * 更新账号状态（本地IPC）
 */
export async function updateAccountStatus(accountId: string, status: string, errorMessage?: string): Promise<void> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  const result = await window.electron.invoke('account:updateStatus', accountId, status, errorMessage);
  
  if (!result.success) {
    throw new Error(result.error || '状态更新失败');
  }
}

/**
 * 刷新账号列表（本地IPC）
 */
export async function refreshAccounts(userId?: number): Promise<Account[]> {
  if (!isElectron()) {
    throw new Error('账号管理功能仅在桌面应用中可用');
  }

  return await window.electron.invoke('refresh-accounts', userId);
}
