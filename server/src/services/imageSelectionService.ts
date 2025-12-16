import { pool } from '../db/database';

/**
 * 图片选择服务
 * 
 * 功能：实现图片的均衡选择，避免同一张图片被反复使用
 * 
 * 选择策略：
 * 1. 优先选择使用次数最少的图片
 * 2. 如果有多张图片使用次数相同，按创建时间升序选择（先上传的先用）
 * 3. 每次使用后更新usage_count
 */

export interface ImageSelectionResult {
  imageId: number;
  filepath: string;
  usageCount: number;
}

export class ImageSelectionService {
  /**
   * 从指定相册中选择使用次数最少的图片
   * 
   * @param albumId 相册ID
   * @returns 图片信息，如果相册为空则返回null
   */
  async selectLeastUsedImage(albumId: number): Promise<ImageSelectionResult | null> {
    console.log(`[图片选择] 从相册 ${albumId} 中选择使用次数最少的图片...`);
    
    const result = await pool.query(
      `SELECT id, filepath, usage_count
       FROM images
       WHERE album_id = $1
       ORDER BY usage_count ASC, created_at ASC
       LIMIT 1`,
      [albumId]
    );
    
    if (result.rows.length === 0) {
      console.log(`[图片选择] 相册 ${albumId} 中没有图片`);
      return null;
    }
    
    const image = result.rows[0];
    console.log(`[图片选择] 选中图片 ID=${image.id}, 使用次数=${image.usage_count}, 路径=${image.filepath}`);
    
    return {
      imageId: image.id,
      filepath: image.filepath,
      usageCount: image.usage_count || 0
    };
  }
  
  /**
   * 记录图片使用并更新使用次数
   * 
   * @param imageId 图片ID
   * @param articleId 文章ID
   */
  async recordImageUsage(imageId: number, articleId: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. 更新图片的usage_count
      await client.query(
        `UPDATE images 
         SET usage_count = COALESCE(usage_count, 0) + 1 
         WHERE id = $1`,
        [imageId]
      );
      
      // 2. 记录使用历史
      await client.query(
        `INSERT INTO image_usage (image_id, article_id)
         VALUES ($1, $2)
         ON CONFLICT (image_id, article_id) DO NOTHING`,
        [imageId, articleId]
      );
      
      await client.query('COMMIT');
      
      console.log(`[图片使用记录] 图片 ${imageId} 的使用次数已更新，关联文章 ${articleId}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[图片使用记录] 记录失败:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * 获取相册中所有图片的使用统计
   * 
   * @param albumId 相册ID
   * @returns 图片使用统计列表
   */
  async getImageUsageStats(albumId: number): Promise<Array<{
    imageId: number;
    filename: string;
    filepath: string;
    usageCount: number;
    lastUsedAt: string | null;
  }>> {
    const result = await pool.query(
      `SELECT 
        i.id as image_id,
        i.filename,
        i.filepath,
        i.usage_count,
        (SELECT MAX(used_at) FROM image_usage WHERE image_id = i.id) as last_used_at
       FROM images i
       WHERE i.album_id = $1
       ORDER BY i.usage_count ASC, i.created_at ASC`,
      [albumId]
    );
    
    return result.rows.map(row => ({
      imageId: row.image_id,
      filename: row.filename,
      filepath: row.filepath,
      usageCount: row.usage_count || 0,
      lastUsedAt: row.last_used_at
    }));
  }
  
  /**
   * 重置相册中所有图片的使用计数
   * 
   * @param albumId 相册ID
   */
  async resetAlbumUsageCount(albumId: number): Promise<void> {
    await pool.query(
      `UPDATE images 
       SET usage_count = 0 
       WHERE album_id = $1`,
      [albumId]
    );
    
    console.log(`[图片使用重置] 相册 ${albumId} 中所有图片的使用计数已重置`);
  }
}
