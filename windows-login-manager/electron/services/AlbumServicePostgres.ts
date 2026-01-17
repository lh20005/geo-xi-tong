/**
 * 相册服务类（PostgreSQL 版本）
 * 
 * 功能：
 * - 管理用户的图片相册
 * - 自动管理 user_id（继承自 BaseServicePostgres）
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { BaseServicePostgres } from './BaseServicePostgres';
import log from 'electron-log';

/**
 * 相册接口
 */
export interface Album {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 创建相册输入
 */
export interface CreateAlbumInput {
  name: string;
  description?: string;
}

/**
 * 更新相册输入
 */
export interface UpdateAlbumInput {
  name?: string;
  description?: string;
}

/**
 * 相册服务类
 */
export class AlbumServicePostgres extends BaseServicePostgres<Album> {
  constructor() {
    super('albums', 'AlbumService');
  }

  /**
   * 创建相册
   */
  async createAlbum(input: CreateAlbumInput): Promise<Album> {
    return await this.create(input);
  }

  /**
   * 更新相册
   */
  async updateAlbum(id: number, input: UpdateAlbumInput): Promise<Album> {
    return await this.update(id, input);
  }

  /**
   * 删除相册
   */
  async deleteAlbum(id: number): Promise<void> {
    await this.delete(id);
  }

  /**
   * 根据名称查找相册
   */
  async findByName(name: string): Promise<Album[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        'SELECT * FROM albums WHERE user_id = $1 AND name = $2 ORDER BY created_at DESC',
        [this.userId, name]
      );

      return result.rows as Album[];
    } catch (error) {
      log.error('AlbumService: findByName 失败:', error);
      throw error;
    }
  }

  /**
   * 搜索相册
   */
  async searchAlbums(searchTerm: string): Promise<Album[]> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM albums 
         WHERE user_id = $1 
         AND (name ILIKE $2 OR description ILIKE $2)
         ORDER BY created_at DESC`,
        [this.userId, `%${searchTerm}%`]
      );

      return result.rows as Album[];
    } catch (error) {
      log.error('AlbumService: searchAlbums 失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有相册（带图片统计和封面图）
   */
  async findAllWithStats(): Promise<Array<Album & { imageCount: number; coverImage: string | null }>> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT a.*, 
          (SELECT COUNT(*) FROM images WHERE album_id = a.id AND deleted_at IS NULL) as image_count,
          (SELECT filepath FROM images WHERE album_id = a.id AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1) as cover_image
         FROM albums a
         WHERE a.user_id = $1
         ORDER BY a.created_at DESC`,
        [this.userId]
      );

      return result.rows.map(row => ({
        ...row,
        imageCount: parseInt(row.image_count || '0'),
        coverImage: row.cover_image
      }));
    } catch (error) {
      log.error('AlbumService: findAllWithStats 失败:', error);
      throw error;
    }
  }

  /**
   * 根据 ID 获取相册（带图片统计）
   */
  async findByIdWithStats(albumId: number): Promise<(Album & { imageCount: number }) | null> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT a.*, COUNT(i.id) as image_count
         FROM albums a
         LEFT JOIN images i ON i.album_id = a.id
         WHERE a.id = $1 AND a.user_id = $2
         GROUP BY a.id`,
        [albumId, this.userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        ...row,
        imageCount: parseInt(row.image_count)
      };
    } catch (error) {
      log.error('AlbumService: findByIdWithStats 失败:', error);
      throw error;
    }
  }

  /**
   * 获取相册统计
   */
  async getStats(): Promise<{
    total: number;
    withImages: number;
    empty: number;
  }> {
    this.validateUserId();

    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM albums WHERE user_id = $1',
        [this.userId]
      );

      const withImagesResult = await this.pool.query(
        `SELECT COUNT(DISTINCT a.id) as count 
         FROM albums a 
         INNER JOIN images i ON i.album_id = a.id 
         WHERE a.user_id = $1`,
        [this.userId]
      );

      const total = parseInt(totalResult.rows[0].count);
      const withImages = parseInt(withImagesResult.rows[0].count);

      return {
        total,
        withImages,
        empty: total - withImages
      };
    } catch (error) {
      log.error('AlbumService: getStats 失败:', error);
      throw error;
    }
  }
}
