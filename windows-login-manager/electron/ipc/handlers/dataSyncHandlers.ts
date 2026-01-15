/**
 * 数据同步 IPC 处理器
 * 处理本地数据与服务器的同步
 * Requirements: Phase 6 - 注册 IPC 处理器
 */

import { ipcMain, app } from 'electron';
import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { apiClient } from '../../api/client';
import { storageManager } from '../../storage/manager';
import { sqliteManager, getDb } from '../../database/sqlite';
import { encrypt, decrypt } from '../../utils/encryption';

/**
 * 注册数据同步相关 IPC 处理器
 */
export function registerDataSyncHandlers(): void {
  log.info('Registering data sync IPC handlers...');

  // 创建数据备份（上传到服务器）
  ipcMain.handle('sync:backup', async () => {
    try {
      log.info('IPC: sync:backup');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 获取数据库路径
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'geo-data.db');
      
      if (!fs.existsSync(dbPath)) {
        return { success: false, error: '本地数据库不存在' };
      }

      // 读取数据库文件
      const dbContent = fs.readFileSync(dbPath);
      
      // 加密数据库内容
      const encryptedContent = encrypt(dbContent.toString('base64'));
      
      // 计算校验和
      const checksum = crypto.createHash('sha256').update(dbContent).digest('hex');
      
      // 获取元数据
      const db = getDb();
      const metadata = {
        version: '1.0.0',
        articleCount: db.prepare('SELECT COUNT(*) as count FROM articles').get() as { count: number },
        accountCount: db.prepare('SELECT COUNT(*) as count FROM platform_accounts').get() as { count: number },
        createdAt: new Date().toISOString()
      };

      // 上传到服务器
      const result = await apiClient.uploadSnapshot(
        Buffer.from(encryptedContent, 'utf-8'),
        checksum,
        {
          version: metadata.version,
          articleCount: metadata.articleCount.count,
          accountCount: metadata.accountCount.count,
          createdAt: metadata.createdAt
        }
      );

      return { 
        success: true, 
        data: {
          snapshotId: result.snapshotId,
          uploadedAt: result.uploadedAt,
          deletedOldSnapshots: result.deletedOldSnapshots,
          remainingSnapshots: result.remainingSnapshots
        }
      };
    } catch (error: any) {
      log.error('IPC: sync:backup failed:', error);
      return { success: false, error: error.message || '备份失败' };
    }
  });

  // 恢复数据（从服务器下载）
  ipcMain.handle('sync:restore', async (_event, snapshotId: string) => {
    try {
      log.info(`IPC: sync:restore - ${snapshotId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 从服务器下载快照
      const encryptedContent = await apiClient.downloadSnapshot(snapshotId);
      
      // 解密内容
      const decryptedBase64 = decrypt(encryptedContent.toString('utf-8'));
      const dbContent = Buffer.from(decryptedBase64, 'base64');
      
      // 获取数据库路径
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'geo-data.db');
      const backupPath = path.join(userDataPath, `geo-data-backup-${Date.now()}.db`);
      
      // 备份当前数据库
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
        log.info(`Current database backed up to ${backupPath}`);
      }

      // 关闭当前数据库连接
      sqliteManager.close();

      // 写入新数据库
      fs.writeFileSync(dbPath, dbContent);
      
      // 重新初始化数据库
      await sqliteManager.initialize();

      return { 
        success: true, 
        data: {
          restoredAt: new Date().toISOString(),
          backupPath
        }
      };
    } catch (error: any) {
      log.error('IPC: sync:restore failed:', error);
      return { success: false, error: error.message || '恢复失败' };
    }
  });

  // 获取快照列表
  ipcMain.handle('sync:getSnapshots', async () => {
    try {
      log.info('IPC: sync:getSnapshots');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const result = await apiClient.getSnapshots();
      
      // 标记即将过期的快照（7 天内）
      const snapshots = result.snapshots.map((snap: any) => ({
        ...snap,
        isExpiringSoon: new Date(snap.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
      }));

      return { 
        success: true, 
        data: {
          snapshots,
          maxSnapshots: result.maxSnapshots,
          maxSizeBytes: result.maxSizeBytes
        }
      };
    } catch (error: any) {
      log.error('IPC: sync:getSnapshots failed:', error);
      return { success: false, error: error.message || '获取快照列表失败' };
    }
  });

  // 删除快照
  ipcMain.handle('sync:deleteSnapshot', async (_event, snapshotId: string) => {
    try {
      log.info(`IPC: sync:deleteSnapshot - ${snapshotId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      await apiClient.deleteSnapshot(snapshotId);
      return { success: true };
    } catch (error: any) {
      log.error('IPC: sync:deleteSnapshot failed:', error);
      return { success: false, error: error.message || '删除快照失败' };
    }
  });

  // 导出本地数据（不上传，仅导出到本地文件）
  ipcMain.handle('sync:exportLocal', async (_event, exportPath?: string) => {
    try {
      log.info('IPC: sync:exportLocal');
      
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'geo-data.db');
      
      if (!fs.existsSync(dbPath)) {
        return { success: false, error: '本地数据库不存在' };
      }

      // 默认导出路径
      const defaultExportPath = path.join(
        app.getPath('documents'),
        `geo-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
      );
      const targetPath = exportPath || defaultExportPath;

      // 复制数据库文件
      fs.copyFileSync(dbPath, targetPath);

      return { 
        success: true, 
        data: { 
          exportPath: targetPath,
          exportedAt: new Date().toISOString()
        }
      };
    } catch (error: any) {
      log.error('IPC: sync:exportLocal failed:', error);
      return { success: false, error: error.message || '导出失败' };
    }
  });

  // 导入本地数据（从本地文件导入）
  ipcMain.handle('sync:importLocal', async (_event, importPath: string) => {
    try {
      log.info(`IPC: sync:importLocal - ${importPath}`);
      
      if (!fs.existsSync(importPath)) {
        return { success: false, error: '导入文件不存在' };
      }

      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'geo-data.db');
      const backupPath = path.join(userDataPath, `geo-data-backup-${Date.now()}.db`);
      
      // 备份当前数据库
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
        log.info(`Current database backed up to ${backupPath}`);
      }

      // 关闭当前数据库连接
      sqliteManager.close();

      // 复制导入文件
      fs.copyFileSync(importPath, dbPath);
      
      // 重新初始化数据库
      await sqliteManager.initialize();

      return { 
        success: true, 
        data: {
          importedAt: new Date().toISOString(),
          backupPath
        }
      };
    } catch (error: any) {
      log.error('IPC: sync:importLocal failed:', error);
      return { success: false, error: error.message || '导入失败' };
    }
  });

  // 获取本地数据统计
  ipcMain.handle('sync:getLocalStats', async () => {
    try {
      log.info('IPC: sync:getLocalStats');
      
      const db = getDb();
      
      const stats = {
        articles: (db.prepare('SELECT COUNT(*) as count FROM articles').get() as { count: number }).count,
        accounts: (db.prepare('SELECT COUNT(*) as count FROM platform_accounts').get() as { count: number }).count,
        tasks: (db.prepare('SELECT COUNT(*) as count FROM publishing_tasks').get() as { count: number }).count,
        knowledgeBases: (db.prepare('SELECT COUNT(*) as count FROM knowledge_bases').get() as { count: number }).count,
        albums: (db.prepare('SELECT COUNT(*) as count FROM gallery_albums').get() as { count: number }).count,
        images: (db.prepare('SELECT COUNT(*) as count FROM gallery_images').get() as { count: number }).count
      };

      // 获取数据库文件大小
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'geo-data.db');
      let dbSize = 0;
      if (fs.existsSync(dbPath)) {
        dbSize = fs.statSync(dbPath).size;
      }

      return { 
        success: true, 
        data: {
          ...stats,
          dbSizeBytes: dbSize,
          dbSizeMB: (dbSize / 1024 / 1024).toFixed(2)
        }
      };
    } catch (error: any) {
      log.error('IPC: sync:getLocalStats failed:', error);
      return { success: false, error: error.message || '获取统计失败' };
    }
  });

  log.info('Data sync IPC handlers registered');
}
