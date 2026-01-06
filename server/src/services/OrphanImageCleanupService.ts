/**
 * 孤儿图片清理服务
 * 定期清理已软删除且不再被文章引用的图片文件
 */

import { pool } from '../db/database';
import * as fs from 'fs';
import * as path from 'path';

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

export interface CleanupResult {
  scannedCount: number;
  deletedCount: number;
  freedBytes: number;
  errors: string[];
}

export class OrphanImageCleanupService {
  private static instance: OrphanImageCleanupService;

  private constructor() {}

  public static getInstance(): OrphanImageCleanupService {
    if (!OrphanImageCleanupService.instance) {
      OrphanImageCleanupService.instance = new OrphanImageCleanupService();
    }
    return OrphanImageCleanupService.instance;
  }

  /**
   * 清理孤儿图片
   * @param minAgeHours 最小软删除时间（小时），默认24小时
   */
  async cleanupOrphanImages(minAgeHours: number = 24): Promise<CleanupResult> {
    console.log(`[孤儿清理] 开始清理孤儿图片（最小年龄: ${minAgeHours} 小时）...`);
    
    const result: CleanupResult = {
      scannedCount: 0,
      deletedCount: 0,
      freedBytes: 0,
      errors: []
    };

    try {
      // 获取可清理的孤儿图片
      const orphansResult = await pool.query(
        'SELECT * FROM get_orphan_images_to_cleanup($1)',
        [minAgeHours]
      );

      result.scannedCount = orphansResult.rows.length;
      console.log(`[孤儿清理] 找到 ${result.scannedCount} 个可清理的孤儿图片`);

      for (const orphan of orphansResult.rows) {
        try {
          const filePath = path.join(UPLOAD_DIR, orphan.filepath);
          
          // 再次检查是否被文章引用（双重确认）
          const refCheck = await pool.query(
            'SELECT is_image_referenced($1) as is_ref',
            [orphan.filepath]
          );
          
          if (refCheck.rows[0]?.is_ref) {
            console.log(`[孤儿清理] 跳过图片 ${orphan.id}（仍被文章引用）`);
            continue;
          }

          // 删除物理文件
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            result.freedBytes += orphan.size;
            console.log(`[孤儿清理] 删除文件: ${orphan.filepath} (${orphan.size} 字节)`);
          }

          // 硬删除数据库记录
          await pool.query('DELETE FROM images WHERE id = $1', [orphan.id]);
          result.deletedCount++;

        } catch (err: any) {
          const errorMsg = `图片 ${orphan.id} 清理失败: ${err.message}`;
          console.error(`[孤儿清理] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      console.log(`[孤儿清理] 完成！删除 ${result.deletedCount} 个文件，释放 ${this.formatBytes(result.freedBytes)}`);

    } catch (error: any) {
      console.error('[孤儿清理] 错误:', error);
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * 清理文章删除后不再被引用的图片
   * 当文章被删除时调用
   */
  async cleanupAfterArticleDelete(imageUrl: string): Promise<boolean> {
    if (!imageUrl) return false;

    try {
      // 检查图片是否还被其他文章引用
      const refCheck = await pool.query(
        'SELECT is_image_referenced($1) as is_ref',
        [imageUrl]
      );

      if (refCheck.rows[0]?.is_ref) {
        // 仍被其他文章引用，不清理
        return false;
      }

      // 检查图片是否已软删除（is_orphan = true）
      const imageResult = await pool.query(
        'SELECT id, size, deleted_at, is_orphan FROM images WHERE filepath = $1',
        [imageUrl]
      );

      if (imageResult.rows.length === 0) {
        // 图片记录不存在，尝试直接删除文件
        const filePath = path.join(UPLOAD_DIR, imageUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[孤儿清理] 删除无记录的孤儿文件: ${imageUrl}`);
          return true;
        }
        return false;
      }

      const image = imageResult.rows[0];

      // 只清理已软删除的孤儿图片
      if (image.deleted_at && image.is_orphan) {
        const filePath = path.join(UPLOAD_DIR, imageUrl);
        
        // 删除物理文件
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        // 硬删除数据库记录
        await pool.query('DELETE FROM images WHERE id = $1', [image.id]);
        
        console.log(`[孤儿清理] 文章删除后清理孤儿图片: ${imageUrl}`);
        return true;
      }

      return false;

    } catch (error: any) {
      console.error(`[孤儿清理] 清理图片失败 ${imageUrl}:`, error.message);
      return false;
    }
  }

  /**
   * 获取孤儿图片统计
   */
  async getOrphanStats(): Promise<{
    totalOrphans: number;
    totalSize: number;
    oldestOrphan: Date | null;
  }> {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COALESCE(SUM(size), 0) as total_size,
          MIN(deleted_at) as oldest
        FROM images
        WHERE deleted_at IS NOT NULL AND is_orphan = TRUE
      `);

      const row = result.rows[0];
      return {
        totalOrphans: parseInt(row.total) || 0,
        totalSize: parseInt(row.total_size) || 0,
        oldestOrphan: row.oldest ? new Date(row.oldest) : null
      };

    } catch (error: any) {
      console.error('[孤儿清理] 获取统计失败:', error);
      return { totalOrphans: 0, totalSize: 0, oldestOrphan: null };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const orphanImageCleanupService = OrphanImageCleanupService.getInstance();
