/**
 * 图片服务类（PostgreSQL 版本）
 * 
 * 功能：
 * - 管理用户的图片
 * - 处理图片引用计数
 * - 软删除和孤儿文件管理
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import log from 'electron-log';

/**
 * 图片接口
 */
export interface Image {
  id: number;
  user_id: number;
  album_id?: number;
  filename: string;
  filepath: string;
  mime_type: string;
  size: number;
  usage_count: number;
  deleted_at?: Date;
  is_orphan: boolean;
  reference_count: number;
  created_at: Date;
}

/**
 * 创建图片输入
 */
export interface CreateImageInput {
  album_id?: number;
  filename: string;
  filepath: string;
  mime_type: string;
  size: number;
}

/**
 * 更新图片输入
 */
export interface UpdateImageInput {
  album_id?: number;
  filename?: string;
  filepath?: string;
}

/**
 * 图片服务类
 */
export class ImageServicePostgres extends BaseServicePostgres<Image> {
  constructor() {
    super('images', 'ImageService');
  }

  /**
   * 创建图片
   */
  async createImage(input: CreateImageInput): Promise<Image> {
    return await this.create({
      ...input,
      usage_count: 0,
      is_orphan: false,
      reference_count: 0
    });
  }

  /**
   * 更新图片
   */
  async updateImage(id: number, input: UpdateImageInput): Promise<Image> {
    return await this.update(id, input);
  }

  /**
   * 删除图片（软删除）
   */
  async deleteImage(id: number): Promise<void> {
    this.validateUserId();

    try {
      await this.pool.query(
        'UPDATE images SET deleted_at = NOW() WHERE id = $1 AND user_id = $2',
        [id, this.userId]
      );

      log.info(`ImageService: 软删除图片成功, ID: ${id}`);
    } catch (error) {
      log.error('ImageService: deleteImage 失败:', error);
      throw error;
    }
  }

  /**
   * 永久删除图片
   */
  async permanentDelete(id: number): Promise<void> {
    await this.delete(id);
  }

  /**
   * 根据相册 ID 获取图片
   */
  async getByAlbumId(albumId: number): Promise<Image[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM images 
         WHERE user_id = $1 AND album_id = $2 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [this.userId, albumId]
      );

      return result.rows as Image[];
    } catch (error) {
      log.error('ImageService: getByAlbumId 失败:', error);
      throw error;
    }
  }

  /**
   * 根据相册 ID 获取图片（别名方法）
   */
  async findByAlbum(albumId: number): Promise<Image[]> {
    return await this.getByAlbumId(albumId);
  }

  /**
   * 增加图片引用计数
   */
  async incrementReference(id: number): Promise<void> {
    this.validateUserId();

    try {
      await this.pool.query(
        `UPDATE images 
         SET reference_count = reference_count + 1, usage_count = usage_count + 1
         WHERE id = $1 AND user_id = $2`,
        [id, this.userId]
      );

      log.info(`ImageService: 增加引用计数, ID: ${id}`);
    } catch (error) {
      log.error('ImageService: incrementReference 失败:', error);
      throw error;
    }
  }

  /**
   * 减少图片引用计数
   */
  async decrementReference(id: number): Promise<void> {
    this.validateUserId();

    try {
      await this.pool.query(
        `UPDATE images 
         SET reference_count = GREATEST(reference_count - 1, 0)
         WHERE id = $1 AND user_id = $2`,
        [id, this.userId]
      );

      log.info(`ImageService: 减少引用计数, ID: ${id}`);
    } catch (error) {
      log.error('ImageService: decrementReference 失败:', error);
      throw error;
    }
  }

  /**
   * 检查图片是否被引用
   */
  async isReferenced(id: number): Promise<boolean> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT reference_count FROM images WHERE id = $1 AND user_id = $2',
        [id, this.userId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      return result.rows[0].reference_count > 0;
    } catch (error) {
      log.error('ImageService: isReferenced 失败:', error);
      throw error;
    }
  }

  /**
   * 标记为孤儿文件
   */
  async markAsOrphan(id: number): Promise<void> {
    this.validateUserId();

    try {
      await this.pool.query(
        'UPDATE images SET is_orphan = TRUE WHERE id = $1 AND user_id = $2',
        [id, this.userId]
      );

      log.info(`ImageService: 标记为孤儿文件, ID: ${id}`);
    } catch (error) {
      log.error('ImageService: markAsOrphan 失败:', error);
      throw error;
    }
  }

  /**
   * 获取孤儿文件
   */
  async getOrphans(): Promise<Image[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM images WHERE user_id = $1 AND is_orphan = TRUE ORDER BY created_at DESC',
        [this.userId]
      );

      return result.rows as Image[];
    } catch (error) {
      log.error('ImageService: getOrphans 失败:', error);
      throw error;
    }
  }

  /**
   * 获取已删除的图片
   */
  async getDeleted(): Promise<Image[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM images WHERE user_id = $1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC',
        [this.userId]
      );

      return result.rows as Image[];
    } catch (error) {
      log.error('ImageService: getDeleted 失败:', error);
      throw error;
    }
  }

  /**
   * 获取图片统计
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    deleted: number;
    orphans: number;
    totalSize: number;
  }> {
    this.validateUserId();

    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size FROM images WHERE user_id = $1',
        [this.userId]
      );

      const activeResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM images WHERE user_id = $1 AND deleted_at IS NULL',
        [this.userId]
      );

      const deletedResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM images WHERE user_id = $1 AND deleted_at IS NOT NULL',
        [this.userId]
      );

      const orphansResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM images WHERE user_id = $1 AND is_orphan = TRUE',
        [this.userId]
      );

      return {
        total: parseInt(totalResult.rows[0].count),
        active: parseInt(activeResult.rows[0].count),
        deleted: parseInt(deletedResult.rows[0].count),
        orphans: parseInt(orphansResult.rows[0].count),
        totalSize: parseInt(totalResult.rows[0].total_size)
      };
    } catch (error) {
      log.error('ImageService: getStats 失败:', error);
      throw error;
    }
  }
}
