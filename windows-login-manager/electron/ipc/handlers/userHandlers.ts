/**
 * 用户模块 IPC 处理器（本地 PostgreSQL）
 * 处理用户信息的本地同步和查询
 * 解决用户信息缓存不一致的问题
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { getPool } from '../../database/postgres';

export interface UserInfo {
  id: number;
  username: string;
  email?: string;
  role: string;
  invitationCode?: string;
  isTempPassword?: boolean;
}

/**
 * 注册用户相关 IPC 处理器
 */
export function registerUserHandlers(): void {
  log.info('Registering user IPC handlers (PostgreSQL)...');

  // 同步用户信息到本地数据库（UPSERT）
  ipcMain.handle('user:sync', async (_event, userData: UserInfo) => {
    try {
      log.info(`IPC: user:sync - user_id: ${userData.id}, username: ${userData.username}`);
      const pool = getPool();

      const query = `
        INSERT INTO users (id, username, email, role, invitation_code, is_temp_password, synced_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          invitation_code = EXCLUDED.invitation_code,
          is_temp_password = EXCLUDED.is_temp_password,
          synced_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `;

      const result = await pool.query(query, [
        userData.id,
        userData.username,
        userData.email || null,
        userData.role,
        userData.invitationCode || null,
        userData.isTempPassword || false,
      ]);

      log.info(`User synced successfully: ${userData.username}`);
      return { success: true, data: result.rows[0] };
    } catch (error: any) {
      log.error('IPC: user:sync failed:', error);
      return { success: false, error: error.message || '同步用户信息失败' };
    }
  });

  // 根据 ID 获取用户信息
  ipcMain.handle('user:getById', async (_event, userId: number) => {
    try {
      log.info(`IPC: user:getById - ${userId}`);
      const pool = getPool();

      const query = 'SELECT * FROM users WHERE id = $1';
      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return { success: false, error: '用户不存在' };
      }

      return { success: true, data: result.rows[0] };
    } catch (error: any) {
      log.error('IPC: user:getById failed:', error);
      return { success: false, error: error.message || '获取用户信息失败' };
    }
  });

  // 根据用户名获取用户信息
  ipcMain.handle('user:getByUsername', async (_event, username: string) => {
    try {
      log.info(`IPC: user:getByUsername - ${username}`);
      const pool = getPool();

      const query = 'SELECT * FROM users WHERE username = $1';
      const result = await pool.query(query, [username]);

      if (result.rows.length === 0) {
        return { success: false, error: '用户不存在' };
      }

      return { success: true, data: result.rows[0] };
    } catch (error: any) {
      log.error('IPC: user:getByUsername failed:', error);
      return { success: false, error: error.message || '获取用户信息失败' };
    }
  });

  // 获取所有用户（管理员功能）
  ipcMain.handle('user:getAll', async () => {
    try {
      log.info('IPC: user:getAll');
      const pool = getPool();

      const query = 'SELECT * FROM users ORDER BY created_at DESC';
      const result = await pool.query(query);

      return { success: true, data: result.rows };
    } catch (error: any) {
      log.error('IPC: user:getAll failed:', error);
      return { success: false, error: error.message || '获取用户列表失败' };
    }
  });

  // 清除所有用户信息（退出登录时使用）
  ipcMain.handle('user:clearAll', async () => {
    try {
      log.info('IPC: user:clearAll');
      const pool = getPool();

      const query = 'DELETE FROM users';
      await pool.query(query);

      log.info('All users cleared');
      return { success: true };
    } catch (error: any) {
      log.error('IPC: user:clearAll failed:', error);
      return { success: false, error: error.message || '清除用户信息失败' };
    }
  });

  // 检查用户是否存在
  ipcMain.handle('user:exists', async (_event, userId: number) => {
    try {
      log.info(`IPC: user:exists - ${userId}`);
      const pool = getPool();

      const query = 'SELECT 1 FROM users WHERE id = $1';
      const result = await pool.query(query, [userId]);

      return { success: true, data: { exists: result.rows.length > 0 } };
    } catch (error: any) {
      log.error('IPC: user:exists failed:', error);
      return { success: false, error: error.message || '检查用户失败' };
    }
  });

  log.info('User IPC handlers registered (PostgreSQL)');
}

/**
 * 清理用户相关资源
 */
export function cleanupUserHandlers(): void {
  log.info('Cleaning up user IPC handlers...');
  
  ipcMain.removeHandler('user:sync');
  ipcMain.removeHandler('user:getById');
  ipcMain.removeHandler('user:getByUsername');
  ipcMain.removeHandler('user:getAll');
  ipcMain.removeHandler('user:clearAll');
  ipcMain.removeHandler('user:exists');
  
  log.info('User IPC handlers cleaned up');
}
