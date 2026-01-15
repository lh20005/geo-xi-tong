/**
 * 平台账号服务
 * 负责平台账号的本地 CRUD 操作（Cookie 加密存储）
 * Requirements: Phase 2 - 数据服务层
 */

import { BaseService } from './BaseService';
import { encryptObject, tryDecryptObject } from '../utils/encryption';
import log from 'electron-log';

/**
 * 平台账号接口
 */
export interface PlatformAccount {
  id: string;
  user_id: number;
  platform: string;
  platform_id: string | null;
  account_name: string | null;
  real_username: string | null;
  credentials: string | null;  // 加密存储
  cookies: string | null;      // 加密存储
  status: string;
  is_default: number;
  error_message: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 解密后的账号接口
 */
export interface DecryptedPlatformAccount extends Omit<PlatformAccount, 'credentials' | 'cookies'> {
  credentials: any | null;
  cookies: any[] | null;
}

/**
 * 创建账号参数
 */
export interface CreateAccountParams {
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

/**
 * 更新账号参数
 */
export interface UpdateAccountParams {
  account_name?: string;
  real_username?: string;
  credentials?: any;
  cookies?: any[];
  status?: string;
  is_default?: boolean;
  error_message?: string;
}

/**
 * 账号服务类
 */
class AccountService extends BaseService<PlatformAccount> {
  private static instance: AccountService;

  private constructor() {
    super('platform_accounts', 'AccountService');
  }

  static getInstance(): AccountService {
    if (!AccountService.instance) {
      AccountService.instance = new AccountService();
    }
    return AccountService.instance;
  }

  /**
   * 创建账号
   */
  create(params: CreateAccountParams): PlatformAccount {
    try {
      const id = this.generateId();
      const now = this.now();

      // 加密敏感数据
      const encryptedCredentials = params.credentials ? encryptObject(params.credentials) : null;
      const encryptedCookies = params.cookies ? encryptObject(params.cookies) : null;

      this.db.prepare(`
        INSERT INTO platform_accounts (
          id, user_id, platform, platform_id, account_name, real_username,
          credentials, cookies, status, is_default, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        params.user_id,
        params.platform,
        params.platform_id || null,
        params.account_name || null,
        params.real_username || null,
        encryptedCredentials,
        encryptedCookies,
        params.status || 'inactive',
        params.is_default ? 1 : 0,
        now,
        now
      );

      log.info(`AccountService: Created account ${id} for platform ${params.platform}`);
      return this.findById(id)!;
    } catch (error) {
      log.error('AccountService: create failed:', error);
      throw error;
    }
  }

  /**
   * 更新账号
   */
  update(id: string, params: UpdateAccountParams): PlatformAccount | null {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (params.account_name !== undefined) {
        updates.push('account_name = ?');
        values.push(params.account_name);
      }
      if (params.real_username !== undefined) {
        updates.push('real_username = ?');
        values.push(params.real_username);
      }
      if (params.credentials !== undefined) {
        updates.push('credentials = ?');
        values.push(params.credentials ? encryptObject(params.credentials) : null);
      }
      if (params.cookies !== undefined) {
        updates.push('cookies = ?');
        values.push(params.cookies ? encryptObject(params.cookies) : null);
      }
      if (params.status !== undefined) {
        updates.push('status = ?');
        values.push(params.status);
      }
      if (params.is_default !== undefined) {
        updates.push('is_default = ?');
        values.push(params.is_default ? 1 : 0);
      }
      if (params.error_message !== undefined) {
        updates.push('error_message = ?');
        values.push(params.error_message);
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      updates.push('updated_at = ?');
      values.push(this.now());
      values.push(id);

      const sql = `UPDATE platform_accounts SET ${updates.join(', ')} WHERE id = ?`;
      this.db.prepare(sql).run(...values);

      log.info(`AccountService: Updated account ${id}`);
      return this.findById(id);
    } catch (error) {
      log.error('AccountService: update failed:', error);
      throw error;
    }
  }

  /**
   * 获取账号（解密敏感数据）
   */
  getDecrypted(id: string): DecryptedPlatformAccount | null {
    try {
      const account = this.findById(id);
      if (!account) return null;

      return this.decryptAccount(account);
    } catch (error) {
      log.error('AccountService: getDecrypted failed:', error);
      throw error;
    }
  }

  /**
   * 解密账号数据
   */
  private decryptAccount(account: PlatformAccount): DecryptedPlatformAccount {
    return {
      ...account,
      credentials: account.credentials ? tryDecryptObject(account.credentials) : null,
      cookies: account.cookies ? tryDecryptObject(account.cookies) : null
    };
  }

  /**
   * 根据平台查找账号
   */
  findByPlatform(userId: number, platform: string): PlatformAccount[] {
    try {
      return this.db.prepare(
        'SELECT * FROM platform_accounts WHERE user_id = ? AND platform = ? ORDER BY is_default DESC, created_at DESC'
      ).all(userId, platform) as PlatformAccount[];
    } catch (error) {
      log.error('AccountService: findByPlatform failed:', error);
      throw error;
    }
  }

  /**
   * 获取默认账号
   */
  getDefaultAccount(userId: number, platform: string): PlatformAccount | null {
    try {
      const result = this.db.prepare(
        'SELECT * FROM platform_accounts WHERE user_id = ? AND platform = ? AND is_default = 1 LIMIT 1'
      ).get(userId, platform) as PlatformAccount | undefined;

      return result || null;
    } catch (error) {
      log.error('AccountService: getDefaultAccount failed:', error);
      throw error;
    }
  }

  /**
   * 设置默认账号
   */
  setDefaultAccount(userId: number, platform: string, accountId: string): boolean {
    try {
      return this.transaction(() => {
        // 取消该平台其他账号的默认状态
        this.db.prepare(`
          UPDATE platform_accounts 
          SET is_default = 0, updated_at = ?
          WHERE user_id = ? AND platform = ?
        `).run(this.now(), userId, platform);

        // 设置新的默认账号
        const result = this.db.prepare(`
          UPDATE platform_accounts 
          SET is_default = 1, updated_at = ?
          WHERE id = ?
        `).run(this.now(), accountId);

        return result.changes > 0;
      });
    } catch (error) {
      log.error('AccountService: setDefaultAccount failed:', error);
      throw error;
    }
  }

  /**
   * 更新账号状态
   */
  updateStatus(id: string, status: string, errorMessage?: string): boolean {
    try {
      const result = this.db.prepare(`
        UPDATE platform_accounts 
        SET status = ?, error_message = ?, updated_at = ?
        WHERE id = ?
      `).run(status, errorMessage || null, this.now(), id);

      return result.changes > 0;
    } catch (error) {
      log.error('AccountService: updateStatus failed:', error);
      throw error;
    }
  }

  /**
   * 更新 Cookies
   */
  updateCookies(id: string, cookies: any[]): boolean {
    try {
      const encryptedCookies = encryptObject(cookies);
      const result = this.db.prepare(`
        UPDATE platform_accounts 
        SET cookies = ?, status = 'active', updated_at = ?
        WHERE id = ?
      `).run(encryptedCookies, this.now(), id);

      log.info(`AccountService: Updated cookies for account ${id}`);
      return result.changes > 0;
    } catch (error) {
      log.error('AccountService: updateCookies failed:', error);
      throw error;
    }
  }

  /**
   * 记录最后使用时间
   */
  recordLastUsed(id: string): void {
    try {
      this.db.prepare(`
        UPDATE platform_accounts SET last_used_at = ?, updated_at = ? WHERE id = ?
      `).run(this.now(), this.now(), id);
    } catch (error) {
      log.error('AccountService: recordLastUsed failed:', error);
    }
  }

  /**
   * 获取活跃账号
   */
  findActiveAccounts(userId: number): PlatformAccount[] {
    try {
      return this.db.prepare(
        'SELECT * FROM platform_accounts WHERE user_id = ? AND status = ? ORDER BY platform, is_default DESC'
      ).all(userId, 'active') as PlatformAccount[];
    } catch (error) {
      log.error('AccountService: findActiveAccounts failed:', error);
      throw error;
    }
  }

  /**
   * 获取账号统计
   */
  getStats(userId: number): {
    total: number;
    active: number;
    inactive: number;
    byPlatform: { platform: string; count: number; active: number }[];
  } {
    try {
      const total = this.count(userId);

      const activeResult = this.db.prepare(
        'SELECT COUNT(*) as count FROM platform_accounts WHERE user_id = ? AND status = ?'
      ).get(userId, 'active') as { count: number };

      const byPlatform = this.db.prepare(`
        SELECT 
          platform,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
        FROM platform_accounts
        WHERE user_id = ?
        GROUP BY platform
      `).all(userId) as { platform: string; count: number; active: number }[];

      return {
        total,
        active: activeResult.count,
        inactive: total - activeResult.count,
        byPlatform
      };
    } catch (error) {
      log.error('AccountService: getStats failed:', error);
      throw error;
    }
  }

  /**
   * 获取解密后的凭证（用于发布执行）
   */
  getDecryptedCredentials(id: string): { cookies?: any[]; [key: string]: any } | null {
    try {
      const account = this.getDecrypted(id);
      if (!account) return null;

      return {
        cookies: account.cookies || [],
        ...account.credentials
      };
    } catch (error) {
      log.error('AccountService: getDecryptedCredentials failed:', error);
      return null;
    }
  }

  /**
   * 检查账号是否存在（按平台和用户ID）
   */
  existsByPlatform(userId: number, platformId: string, platformUserId: string): boolean {
    try {
      const result = this.db.prepare(
        'SELECT 1 FROM platform_accounts WHERE user_id = ? AND platform = ? AND platform_id = ? LIMIT 1'
      ).get(userId, platformId, platformUserId);
      
      return !!result;
    } catch (error) {
      log.error('AccountService: existsByPlatform failed:', error);
      return false;
    }
  }

  /**
   * 删除账号（带用户权限检查）
   */
  delete(id: string, userId?: number): boolean {
    try {
      let sql = 'DELETE FROM platform_accounts WHERE id = ?';
      const params: any[] = [id];
      
      if (userId !== undefined) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }
      
      const result = this.db.prepare(sql).run(...params);
      
      if (result.changes > 0) {
        log.info(`AccountService: Deleted account ${id}`);
      }
      
      return result.changes > 0;
    } catch (error) {
      log.error('AccountService: delete failed:', error);
      throw error;
    }
  }
}

export const accountService = AccountService.getInstance();
export { AccountService };
