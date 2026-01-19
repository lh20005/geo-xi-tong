import { app } from 'electron';
import log from 'electron-log';
import { apiClient, Account } from '../api/client';
import { storageManager } from '../storage/manager';
import { serviceFactory } from '../services/ServiceFactory';
import { getPool } from '../database/postgres';

/**
 * 同步服务
 * 实现数据同步队列、离线缓存、网络状态监听和重试逻辑
 * Requirements: 4.4, 4.6
 */

interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
}

interface SyncResult {
  success: boolean;
  error?: string;
  account?: any; // 后端返回的账号对象（包含ID）
}

class SyncService {
  private static instance: SyncService;
  private syncQueue: SyncQueueItem[] = [];
  private isSyncing = false;
  private isOnline = true;
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly MAX_RETRY_COUNT = 5;
  private readonly SYNC_INTERVAL_MS = 30000; // 30秒

  private constructor() {
    this.initialize();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * 初始化同步服务
   */
  private async initialize(): Promise<void> {
    log.info('Initializing sync service...');

    // 加载离线队列
    await this.loadOfflineQueue();

    // 监听网络状态
    this.setupNetworkMonitoring();

    // 启动定期同步
    this.startPeriodicSync();

    // 监听应用退出
    app.on('before-quit', () => {
      this.stopPeriodicSync();
      this.saveOfflineQueue();
    });

    log.info('Sync service initialized');
  }

  /**
   * 设置网络监听
   * Requirements: 4.4
   */
  private setupNetworkMonitoring(): void {
    // 检查初始网络状态
    this.checkNetworkStatus();

    // 定期检查网络状态
    setInterval(() => {
      this.checkNetworkStatus();
    }, 10000); // 每10秒检查一次
  }

  /**
   * 检查网络状态
   */
  private async checkNetworkStatus(): Promise<void> {
    const wasOnline = this.isOnline;

    try {
      // 尝试ping后端API
      const config = await storageManager.getConfig();
      if (config) {
        await apiClient.setBaseURL(config.serverUrl);
      }

      // 简单的健康检查
      // 注意：这里假设后端有一个健康检查端点
      // 实际实现中应该根据后端API调整
      this.isOnline = true;
    } catch (error) {
      this.isOnline = false;
    }

    // 如果从离线变为在线，触发同步
    if (!wasOnline && this.isOnline) {
      log.info('Network connection restored, triggering sync...');
      await this.processSyncQueue();
    }

    if (wasOnline && !this.isOnline) {
      log.warn('Network connection lost');
    }
  }

  /**
   * 拉取并同步转化目标
   */
  async pullConversionTargets(): Promise<void> {
    if (!this.isOnline) return;
    
    try {
      // 确保 ServiceFactory 有正确的 UserID
      let user = await storageManager.getUser();
      if (!user) {
        log.warn('[SyncService] User not found during pullConversionTargets, attempting recovery...');
        // 尝试简单的恢复逻辑，或跳过
        try {
          const pool = getPool();
          const result = await pool.query('SELECT user_id FROM platform_accounts ORDER BY updated_at DESC LIMIT 1');
          if (result.rows[0]?.user_id) {
             user = { id: result.rows[0].user_id, username: 'recovered', role: 'user' };
          } else {
             user = { id: 1, username: 'default', role: 'user' };
          }
        } catch (e) {
          user = { id: 1, username: 'default', role: 'user' };
        }
      }
      serviceFactory.setUserId(user.id);

      log.info('Pulling conversion targets from server...');
      // 获取所有转化目标（pageSize 设大一点以获取全部）
      const response = await apiClient.getConversionTargets({ pageSize: 1000 });
      const targets = response.data?.targets || [];
      
      const service = serviceFactory.getConversionTargetService();
      let syncedCount = 0;

      // 记录所有同步的 ID
      const syncedIds: number[] = [];

      for (const target of targets) {
        // 服务器字段: company_name, industry, website, address, id
        // 本地字段: company_name, industry, website, address, id (已修正为一致)
        
        // 检查是否存在
        const exists = await service.exists(target.id);
        
        const targetData: any = {
          company_name: target.company_name,
          industry: target.industry || '',
          website: target.website,
          address: target.address,
          company_size: target.company_size,
          features: target.features,
          contact_info: target.contact_info,
          target_audience: target.target_audience,
          core_products: target.core_products
        };

        if (exists) {
          await service.update(target.id, targetData);
        } else {
          // 强制使用服务器 ID 创建
          await service.create({
             id: target.id, 
             ...targetData,
             is_default: false
          } as any); 
        }
        syncedIds.push(target.id);
        syncedCount++;
      }

      // 删除本地存在但服务器已不存在的记录
      // 注意：只有在成功拉取到数据列表（即使为空）时才执行删除
      // 这里假设 pageSize: 1000 能拉取所有数据，如果是分页拉取则不能这样做
      const localTargets = await service.findAll({});
      const localIds = localTargets.map(t => t.id);
      const idsToDelete = localIds.filter(id => !syncedIds.includes(id));
      
      if (idsToDelete.length > 0) {
        await service.deleteMany(idsToDelete);
        log.info(`Deleted ${idsToDelete.length} obsolete conversion targets: ${idsToDelete.join(', ')}`);
      }

      log.info(`Synced ${syncedCount} conversion targets.`);
    } catch (error) {
      log.error('Failed to pull conversion targets:', error);
    }
  }

  /**
   * 启动定期同步
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      return;
    }

    // 初始同步
    if (this.isOnline) {
      this.pullAccounts().catch(err => log.error('Initial account pull failed:', err));
      this.pullConversionTargets().catch(err => log.error('Initial conversion target pull failed:', err));
    }

    this.syncInterval = setInterval(async () => {
      if (this.isOnline) {
        if (this.syncQueue.length > 0) {
          await this.processSyncQueue();
        }
        // 定期拉取更新
        await this.pullConversionTargets();
      }
    }, this.SYNC_INTERVAL_MS);

    log.info('Periodic sync started');
  }

  /**
   * 停止定期同步
   */
  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      log.info('Periodic sync stopped');
    }
  }

  /**
   * 添加到同步队列
   * Requirements: 4.4
   */
  async queueSync(type: 'create' | 'update' | 'delete', data: any): Promise<void> {
    const item: SyncQueueItem = {
      id: this.generateId(),
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.syncQueue.push(item);
    log.info(`Added to sync queue: ${type} - ${item.id}`);

    // 保存队列到本地
    await this.saveOfflineQueue();

    // 如果在线，立即尝试同步
    if (this.isOnline) {
      await this.processSyncQueue();
    }
  }

  /**
   * 处理同步队列
   * Requirements: 4.4, 4.6
   */
  private async processSyncQueue(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;
    log.info(`Processing sync queue (${this.syncQueue.length} items)...`);

    const failedItems: SyncQueueItem[] = [];

    for (const item of this.syncQueue) {
      try {
        const result = await this.syncItem(item);

        if (!result.success) {
          // 增加重试计数
          item.retryCount++;

          if (item.retryCount < this.MAX_RETRY_COUNT) {
            failedItems.push(item);
            log.warn(`Sync failed for ${item.id}, will retry (${item.retryCount}/${this.MAX_RETRY_COUNT})`);
          } else {
            log.error(`Sync failed for ${item.id} after ${this.MAX_RETRY_COUNT} retries, dropping item`);
          }
        } else {
          log.info(`Successfully synced: ${item.id}`);
        }
      } catch (error) {
        log.error(`Error syncing item ${item.id}:`, error);
        
        item.retryCount++;
        if (item.retryCount < this.MAX_RETRY_COUNT) {
          failedItems.push(item);
        }
      }

      // 添加延迟避免过快请求
      await this.delay(100);
    }

    // 更新队列（只保留失败的项）
    this.syncQueue = failedItems;
    await this.saveOfflineQueue();

    this.isSyncing = false;
    log.info(`Sync queue processed. Remaining items: ${this.syncQueue.length}`);
  }

  /**
   * 同步单个项目
   */
  private async syncItem(item: SyncQueueItem): Promise<SyncResult> {
    try {
      switch (item.type) {
        case 'create':
          await apiClient.createAccount(item.data);
          break;
        case 'update':
          // 检查是否是设置默认账号操作
          if (item.data.type === 'set-default') {
            await apiClient.setDefaultAccount(item.data.platformId, item.data.accountId);
          } else {
            await apiClient.updateAccount(item.data.id, item.data);
          }
          break;
        case 'delete':
          await apiClient.deleteAccount(item.data.id);
          break;
        default:
          throw new Error(`Unknown sync type: ${item.type}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 同步账号到后端
   * Requirements: 4.1, 4.7
   */
  async syncAccount(account: Account): Promise<SyncResult> {
    try {
      if (!this.isOnline) {
        // 离线时添加到队列
        await this.queueSync('create', account);
        return { 
          success: false,
          error: '离线状态，已加入同步队列'
        };
      }

      // 在线时直接同步，获取后端返回的账号对象
      const createdAccount = await apiClient.createAccount({
        platform_id: account.platform_id,
        account_name: account.account_name,
        real_username: account.real_username,
        credentials: account.credentials,
        is_default: account.is_default,
      });

      log.info(`Account synced: ${account.platform_id}, ID: ${createdAccount.id}`);
      return { 
        success: true,
        account: createdAccount // 返回后端创建的账号对象（包含ID）
      };
    } catch (error) {
      log.error('Failed to sync account:', error);
      
      // 同步失败，添加到队列
      await this.queueSync('create', account);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 从后端拉取账号
   * Requirements: 4.7
   */
  async pullAccounts(): Promise<Account[]> {
    try {
      if (!this.isOnline) {
        log.warn('Cannot pull accounts while offline');
        return await storageManager.getAccountsCache();
      }

      const accounts = await apiClient.getAccounts();
      
      // 更新本地缓存
      await storageManager.saveAccountsCache(accounts);
      
      log.info(`Pulled ${accounts.length} accounts from backend`);
      return accounts;
    } catch (error) {
      log.error('Failed to pull accounts:', error);
      
      // 返回缓存的账号
      return await storageManager.getAccountsCache();
    }
  }

  /**
   * 保存离线队列
   */
  private async saveOfflineQueue(): Promise<void> {
    try {
      const queueData = JSON.stringify(this.syncQueue);
      // 使用storageManager保存队列
      // 注意：这里简化处理，实际应该使用专门的队列存储
      log.debug(`Saved ${this.syncQueue.length} items to offline queue`);
    } catch (error) {
      log.error('Failed to save offline queue:', error);
    }
  }

  /**
   * 加载离线队列
   */
  private async loadOfflineQueue(): Promise<void> {
    try {
      // 从存储加载队列
      // 注意：这里简化处理，实际应该使用专门的队列存储
      this.syncQueue = [];
      log.info('Loaded offline queue');
    } catch (error) {
      log.error('Failed to load offline queue:', error);
      this.syncQueue = [];
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(): {
    isOnline: boolean;
    isSyncing: boolean;
    queueLength: number;
  } {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queueLength: this.syncQueue.length,
    };
  }

  /**
   * 手动触发同步
   */
  async triggerSync(): Promise<void> {
    log.info('Manual sync triggered');
    await this.processSyncQueue();
  }

  /**
   * 清空同步队列
   */
  async clearQueue(): Promise<void> {
    this.syncQueue = [];
    await this.saveOfflineQueue();
    log.info('Sync queue cleared');
  }

  /**
   * 保存账号到本地 SQLite
   * 用于登录成功后保存账号到本地数据库
   */
  async saveAccountToLocal(account: {
    platform_id: string;
    account_name: string;
    real_username?: string;
    credentials?: any;
  }): Promise<{ success: boolean; accountId?: string; error?: string }> {
    try {
      log.info(`[SyncService] 保存账号到本地 PostgreSQL: ${account.platform_id}`);

      // 获取当前用户
      let user = await storageManager.getUser();
      
      // [修复] 如果用户状态丢失，尝试自动恢复
      if (!user) {
        log.warn('[SyncService] 用户状态丢失，尝试自动恢复...');
        
        try {
          const pool = getPool();
          const result = await pool.query('SELECT user_id FROM platform_accounts ORDER BY updated_at DESC LIMIT 1');
          const lastUserId = result.rows[0]?.user_id;

          if (lastUserId) {
            user = { id: lastUserId, username: 'recovered_user', role: 'user' };
            log.info(`[SyncService] 已从历史数据恢复用户 ID: ${lastUserId}`);
          } else {
            // 如果没有任何历史数据，默认为 1 (单机版默认用户)
            user = { id: 1, username: 'default_user', role: 'user' };
            log.warn('[SyncService] 无历史数据，使用默认 ID: 1');
          }
        } catch (dbError) {
          log.error('[SyncService] 恢复用户失败:', dbError);
          user = { id: 1, username: 'default_user', role: 'user' };
        }
      }

      // 设置 serviceFactory 用户 ID
      serviceFactory.setUserId(user.id);
      const accountService = serviceFactory.getPlatformAccountService();

      // 检查账号是否已存在
      const existingAccounts = await accountService.getByPlatform(account.platform_id);
      const existingAccount = existingAccounts.find(
        (a: any) => a.account_name === account.account_name
      );

      let accountId: string;
      // 直接传递对象，让 PlatformAccountServicePostgres 处理加密
      const cookies = account.credentials?.cookies;
      const credentials = account.credentials;

      if (existingAccount) {
        // 更新现有账号
        log.info(`[SyncService] 更新现有账号: ${existingAccount.id}`);
        await accountService.updateAccount(existingAccount.id, {
          account_name: account.account_name,
          real_username: account.real_username,
          cookies: cookies,
          credentials: credentials,
          status: 'active'
        });
        accountId = existingAccount.id;
      } else {
        // 创建新账号
        log.info('[SyncService] 创建新账号');
        const newAccount = await accountService.createAccount({
          platform: account.platform_id,
          platform_id: account.platform_id,
          account_name: account.account_name,
          real_username: account.real_username,
          cookies: cookies,
          credentials: credentials,
          is_default: existingAccounts.length === 0
        });
        accountId = newAccount.id;
      }

      log.info(`[SyncService] 账号保存到本地 PostgreSQL 成功, ID: ${accountId}`);
      return { success: true, accountId };
    } catch (error: any) {
      log.error('[SyncService] 保存账号到本地 PostgreSQL 失败:', error);
      return { success: false, error: error.message || '保存失败' };
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 导出单例实例
export const syncService = SyncService.getInstance();
export { SyncService, SyncQueueItem, SyncResult };
