/**
 * 数据同步服务
 * 
 * 用于 Windows 端数据备份和恢复。
 * 
 * 功能：
 * - 上传数据快照（自动清理旧快照）
 * - 下载数据快照（更新过期时间）
 * - 获取快照列表
 * - 删除快照
 * - 清理过期快照
 * 
 * 限制：
 * - 每用户最多 3 个快照
 * - 单个快照最大 100MB
 * - 90 天未下载自动过期
 */

import { pool } from '../db/database';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// 常量配置
const MAX_SNAPSHOTS_PER_USER = 3;
const MAX_SNAPSHOT_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const EXPIRE_DAYS = 90;

// 快照存储目录
const SNAPSHOTS_DIR = path.join(__dirname, '../../uploads/snapshots');

/**
 * 快照元数据接口
 */
export interface SnapshotMetadata {
  version: string;
  articleCount?: number;
  accountCount?: number;
  knowledgeCount?: number;
  imageCount?: number;
  createdAt: string;
  clientId?: string;
  [key: string]: any;
}

/**
 * 快照信息接口
 */
export interface SnapshotInfo {
  id: string;
  metadata: SnapshotMetadata;
  fileSize: number;
  checksum: string;
  uploadedAt: string;
  lastDownloadedAt: string | null;
  expiresAt: string;
  isExpiringSoon: boolean;  // 7 天内过期
}

/**
 * 上传结果接口
 */
export interface UploadResult {
  snapshotId: number;  // ✅ 修复：SERIAL -> number
  uploadedAt: string;
  deletedOldSnapshots: number;
  remainingSnapshots: number;
}

/**
 * 数据同步服务
 */
export class SyncService {
  private static instance: SyncService;

  private constructor() {
    // 确保快照目录存在
    this.ensureSnapshotsDir();
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
   * 确保快照目录存在
   */
  private ensureSnapshotsDir(): void {
    if (!fs.existsSync(SNAPSHOTS_DIR)) {
      fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
      console.log(`[SyncService] 创建快照目录: ${SNAPSHOTS_DIR}`);
    }
  }

  /**
   * 计算文件 SHA-256 校验和
   */
  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * 生成快照文件路径
   */
  private generateFilePath(userId: number, snapshotId: number): string {  // ✅ 修复：SERIAL -> number
    const userDir = path.join(SNAPSHOTS_DIR, String(userId));
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    return path.join(userDir, `${snapshotId}.snapshot`);
  }

  /**
   * 上传数据快照
   * 
   * @param userId 用户 ID
   * @param fileBuffer 文件内容
   * @param checksum 客户端计算的校验和
   * @param metadata 快照元数据
   * @returns 上传结果
   */
  async uploadSnapshot(
    userId: number,
    fileBuffer: Buffer,
    checksum: string,
    metadata: SnapshotMetadata
  ): Promise<UploadResult> {
    // 1. 验证文件大小
    if (fileBuffer.length > MAX_SNAPSHOT_SIZE_BYTES) {
      throw new Error(`快照文件超过 ${MAX_SNAPSHOT_SIZE_BYTES / 1024 / 1024}MB 限制`);
    }

    // 2. 验证校验和
    const calculatedChecksum = this.calculateChecksum(fileBuffer);
    if (calculatedChecksum !== checksum) {
      throw new Error('文件校验和不匹配，文件可能已损坏');
    }

    // 3. 计算过期时间
    const expiresAt = new Date(Date.now() + EXPIRE_DAYS * 24 * 60 * 60 * 1000);

    // 4. 保存数据库记录（先插入获取 SERIAL ID）
    let snapshotId: number;
    let relativeFilePath: string;
    
    try {
      const insertResult = await pool.query(
        `INSERT INTO sync_snapshots 
         (user_id, file_path, file_size, checksum, metadata, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [userId, 'temp', fileBuffer.length, checksum, JSON.stringify(metadata), expiresAt]
      );
      
      snapshotId = insertResult.rows[0].id;
      
      // 5. 生成文件路径并保存文件
      const filePath = this.generateFilePath(userId, snapshotId);
      relativeFilePath = path.relative(SNAPSHOTS_DIR, filePath);
      fs.writeFileSync(filePath, fileBuffer);
      
      // 6. 更新文件路径
      await pool.query(
        `UPDATE sync_snapshots SET file_path = $1 WHERE id = $2`,
        [relativeFilePath, snapshotId]
      );
    } catch (error) {
      // 如果失败，尝试清理
      throw error;
    }

    // 7. 清理旧快照
    const deletedCount = await this.cleanupOldSnapshots(userId);

    // 8. 获取剩余快照数量
    const remainingCount = await this.getSnapshotCount(userId);

    console.log(`[SyncService] 用户 ${userId} 上传快照成功: ${snapshotId}, 删除旧快照: ${deletedCount}, 剩余: ${remainingCount}`);

    return {
      snapshotId,
      uploadedAt: new Date().toISOString(),
      deletedOldSnapshots: deletedCount,
      remainingSnapshots: remainingCount
    };
  }

  /**
   * 清理用户的旧快照（保留最新的 N 个）
   */
  private async cleanupOldSnapshots(userId: number): Promise<number> {
    // 获取需要删除的快照
    const result = await pool.query(
      `SELECT id, file_path
       FROM sync_snapshots
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       OFFSET $2`,
      [userId, MAX_SNAPSHOTS_PER_USER]
    );

    if (result.rows.length === 0) {
      return 0;
    }

    // 删除文件和数据库记录
    for (const row of result.rows) {
      const fullPath = path.join(SNAPSHOTS_DIR, row.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      
      await pool.query(
        `UPDATE sync_snapshots SET status = 'deleted' WHERE id = $1`,
        [row.id]
      );
    }

    return result.rows.length;
  }

  /**
   * 获取用户快照数量
   */
  private async getSnapshotCount(userId: number): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*)::INTEGER as count FROM sync_snapshots WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    return result.rows[0].count;
  }

  /**
   * 获取用户的快照列表
   */
  async getSnapshots(userId: number): Promise<{
    snapshots: SnapshotInfo[];
    maxSnapshots: number;
    maxSizeBytes: number;
  }> {
    const result = await pool.query(
      `SELECT id, metadata, file_size, checksum, created_at, last_downloaded_at, expires_at
       FROM sync_snapshots
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC`,
      [userId]
    );

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const snapshots: SnapshotInfo[] = result.rows.map(row => ({
      id: row.id,
      metadata: row.metadata,
      fileSize: parseInt(row.file_size),
      checksum: row.checksum,
      uploadedAt: row.created_at.toISOString(),
      lastDownloadedAt: row.last_downloaded_at?.toISOString() || null,
      expiresAt: row.expires_at.toISOString(),
      isExpiringSoon: new Date(row.expires_at).getTime() - now < sevenDaysMs
    }));

    return {
      snapshots,
      maxSnapshots: MAX_SNAPSHOTS_PER_USER,
      maxSizeBytes: MAX_SNAPSHOT_SIZE_BYTES
    };
  }

  /**
   * 下载快照
   * 
   * 下载后自动更新 last_downloaded_at 和重置过期时间
   */
  async downloadSnapshot(snapshotId: number, userId: number): Promise<{  // ✅ 修复：SERIAL -> number
    buffer: Buffer;
    checksum: string;
    metadata: SnapshotMetadata;
  }> {
    // 获取快照信息
    const result = await pool.query(
      `SELECT file_path, checksum, metadata
       FROM sync_snapshots
       WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [snapshotId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('快照不存在或无权访问');
    }

    const { file_path, checksum, metadata } = result.rows[0];
    const fullPath = path.join(SNAPSHOTS_DIR, file_path);

    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      throw new Error('快照文件不存在');
    }

    // 读取文件
    const buffer = fs.readFileSync(fullPath);

    // 更新下载时间和过期时间
    const newExpiresAt = new Date(Date.now() + EXPIRE_DAYS * 24 * 60 * 60 * 1000);
    await pool.query(
      `UPDATE sync_snapshots
       SET last_downloaded_at = NOW(), expires_at = $1
       WHERE id = $2`,
      [newExpiresAt, snapshotId]
    );

    console.log(`[SyncService] 用户 ${userId} 下载快照: ${snapshotId}`);

    return {
      buffer,
      checksum,
      metadata
    };
  }

  /**
   * 删除快照
   */
  async deleteSnapshot(snapshotId: number, userId: number): Promise<boolean> {  // ✅ 修复：SERIAL -> number
    // 获取快照信息
    const result = await pool.query(
      `SELECT file_path
       FROM sync_snapshots
       WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [snapshotId, userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const { file_path } = result.rows[0];
    const fullPath = path.join(SNAPSHOTS_DIR, file_path);

    // 删除文件
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // 更新数据库状态
    await pool.query(
      `UPDATE sync_snapshots SET status = 'deleted' WHERE id = $1`,
      [snapshotId]
    );

    console.log(`[SyncService] 用户 ${userId} 删除快照: ${snapshotId}`);

    return true;
  }

  /**
   * 清理所有过期快照（定时任务调用）
   */
  async cleanupExpiredSnapshots(): Promise<number> {
    // 获取过期的快照
    const result = await pool.query(
      `SELECT id, file_path, user_id
       FROM sync_snapshots
       WHERE status = 'active' AND expires_at < NOW()`
    );

    if (result.rows.length === 0) {
      return 0;
    }

    // 删除文件和更新状态
    for (const row of result.rows) {
      const fullPath = path.join(SNAPSHOTS_DIR, row.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      
      await pool.query(
        `UPDATE sync_snapshots SET status = 'expired' WHERE id = $1`,
        [row.id]
      );
      
      console.log(`[SyncService] 清理过期快照: ${row.id} (用户: ${row.user_id})`);
    }

    return result.rows.length;
  }

  /**
   * 获取快照详情
   */
  async getSnapshotDetail(snapshotId: number, userId: number): Promise<SnapshotInfo | null> {  // ✅ 修复：SERIAL -> number
    const result = await pool.query(
      `SELECT id, metadata, file_size, checksum, created_at, last_downloaded_at, expires_at
       FROM sync_snapshots
       WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [snapshotId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    return {
      id: row.id,
      metadata: row.metadata,
      fileSize: parseInt(row.file_size),
      checksum: row.checksum,
      uploadedAt: row.created_at.toISOString(),
      lastDownloadedAt: row.last_downloaded_at?.toISOString() || null,
      expiresAt: row.expires_at.toISOString(),
      isExpiringSoon: new Date(row.expires_at).getTime() - now < sevenDaysMs
    };
  }
}

// 导出单例实例
export const syncService = SyncService.getInstance();
