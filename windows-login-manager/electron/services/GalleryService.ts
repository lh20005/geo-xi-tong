/**
 * 图库服务
 * 负责相册和图片的本地 CRUD 操作
 * Requirements: Phase 2 - 数据服务层
 */

import { BaseService, PaginationParams, PaginatedResult } from './BaseService';
import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/**
 * 相册接口
 */
export interface Album {
  id: string;
  user_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * 图片接口
 */
export interface Image {
  id: string;
  user_id: number;
  album_id: string | null;
  filename: string;
  filepath: string;
  mime_type: string;
  size: number;
  usage_count: number;
  deleted_at: string | null;
  is_orphan: number;
  reference_count: number;
  created_at: string;
}

/**
 * 图片选择结果
 */
export interface ImageSelectionResult {
  imageId: string;
  filepath: string;
  usageCount: number;
  size: number;
}

/**
 * 创建相册参数
 */
export interface CreateAlbumParams {
  user_id: number;
  name: string;
}

/**
 * 上传图片参数
 */
export interface UploadImageParams {
  user_id: number;
  album_id?: string;
  filename: string;
  filepath: string;
  mime_type: string;
  size: number;
}

/**
 * 图库服务类
 */
class GalleryService extends BaseService<Album> {
  private static instance: GalleryService;
  private storageDir: string;

  private constructor() {
    super('albums', 'GalleryService');
    // 图片存储目录
    this.storageDir = path.join(app.getPath('userData'), 'gallery');
    this.ensureStorageDir();
  }

  static getInstance(): GalleryService {
    if (!GalleryService.instance) {
      GalleryService.instance = new GalleryService();
    }
    return GalleryService.instance;
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      log.info(`GalleryService: Created storage directory: ${this.storageDir}`);
    }
  }

  /**
   * 获取存储目录
   */
  getStorageDir(): string {
    return this.storageDir;
  }

  // ==================== 相册操作 ====================

  /**
   * 创建相册
   */
  createAlbum(params: CreateAlbumParams): Album {
    try {
      const id = this.generateId();
      const now = this.now();

      this.db.prepare(`
        INSERT INTO albums (id, user_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, params.user_id, params.name, now, now);

      log.info(`GalleryService: Created album ${id}`);
      return this.findById(id)!;
    } catch (error) {
      log.error('GalleryService: createAlbum failed:', error);
      throw error;
    }
  }

  /**
   * 更新相册
   */
  updateAlbum(id: string, name: string): Album | null {
    try {
      this.db.prepare(`
        UPDATE albums SET name = ?, updated_at = ? WHERE id = ?
      `).run(name, this.now(), id);

      log.info(`GalleryService: Updated album ${id}`);
      return this.findById(id);
    } catch (error) {
      log.error('GalleryService: updateAlbum failed:', error);
      throw error;
    }
  }

  /**
   * 删除相册（包括所有图片）
   */
  deleteAlbum(id: string, userId?: number): boolean {
    try {
      return this.transaction(() => {
        // 如果提供了 userId，先验证权限
        if (userId !== undefined) {
          const album = this.findById(id);
          if (!album || album.user_id !== userId) {
            return false;
          }
        }
        
        // 获取相册中的所有图片
        const images = this.findImagesByAlbum(id);
        
        // 删除图片文件
        for (const image of images) {
          this.deleteImageFile(image.filepath);
        }
        
        // 删除数据库记录
        this.db.prepare('DELETE FROM images WHERE album_id = ?').run(id);
        const result = this.db.prepare('DELETE FROM albums WHERE id = ?').run(id);
        
        log.info(`GalleryService: Deleted album ${id} with ${images.length} images`);
        return result.changes > 0;
      });
    } catch (error) {
      log.error('GalleryService: deleteAlbum failed:', error);
      throw error;
    }
  }

  /**
   * 获取相册详情（包含图片数量）
   */
  getAlbumWithStats(id: string): (Album & { imageCount: number }) | null {
    try {
      const album = this.findById(id);
      if (!album) return null;

      const countResult = this.db.prepare(
        'SELECT COUNT(*) as count FROM images WHERE album_id = ? AND deleted_at IS NULL'
      ).get(id) as { count: number };

      return { ...album, imageCount: countResult.count };
    } catch (error) {
      log.error('GalleryService: getAlbumWithStats failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户所有相册（带图片数量和封面图）
   * 与服务器端 GET /albums 一致
   */
  findAlbumsWithStats(userId: number): (Album & { imageCount: number; coverImage: string | null })[] {
    try {
      const albums = this.db.prepare(`
        SELECT a.*, 
          (SELECT COUNT(*) FROM images WHERE album_id = a.id AND deleted_at IS NULL) as image_count,
          (SELECT filepath FROM images WHERE album_id = a.id AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1) as cover_image
        FROM albums a
        WHERE a.user_id = ?
        ORDER BY a.created_at DESC
      `).all(userId) as (Album & { image_count: number; cover_image: string | null })[];

      return albums.map(a => ({
        ...a,
        imageCount: a.image_count,
        coverImage: a.cover_image
      }));
    } catch (error) {
      log.error('GalleryService: findAlbumsWithStats failed:', error);
      throw error;
    }
  }

  // ==================== 图片操作 ====================

  /**
   * 上传图片
   */
  uploadImage(params: UploadImageParams): Image {
    try {
      const id = this.generateId();
      const now = this.now();

      this.db.prepare(`
        INSERT INTO images (id, user_id, album_id, filename, filepath, mime_type, size, usage_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        id,
        params.user_id,
        params.album_id || null,
        params.filename,
        params.filepath,
        params.mime_type,
        params.size,
        now
      );

      // 更新相册的更新时间
      if (params.album_id) {
        this.db.prepare('UPDATE albums SET updated_at = ? WHERE id = ?')
          .run(now, params.album_id);
      }

      log.info(`GalleryService: Uploaded image ${id}`);
      return this.findImageById(id)!;
    } catch (error) {
      log.error('GalleryService: uploadImage failed:', error);
      throw error;
    }
  }

  /**
   * 根据 ID 查找图片
   */
  findImageById(id: string): Image | null {
    try {
      const result = this.db.prepare(
        'SELECT * FROM images WHERE id = ?'
      ).get(id) as Image | undefined;
      
      return result || null;
    } catch (error) {
      log.error('GalleryService: findImageById failed:', error);
      throw error;
    }
  }

  /**
   * 查找相册中的所有图片
   */
  findImagesByAlbum(albumId: string): Image[] {
    try {
      return this.db.prepare(
        'SELECT * FROM images WHERE album_id = ? AND deleted_at IS NULL ORDER BY created_at DESC'
      ).all(albumId) as Image[];
    } catch (error) {
      log.error('GalleryService: findImagesByAlbum failed:', error);
      throw error;
    }
  }

  /**
   * 删除图片（使用软删除，与服务器端一致）
   */
  deleteImage(id: string): { success: boolean; filePreserved: boolean } {
    try {
      const image = this.findImageById(id);
      if (!image) return { success: false, filePreserved: false };

      // 检查是否被文章引用（通过 reference_count 判断）
      const isReferenced = (image.reference_count || 0) > 0;

      // 软删除图片记录
      this.db.prepare(`
        UPDATE images SET deleted_at = ?, is_orphan = ? WHERE id = ?
      `).run(this.now(), isReferenced ? 1 : 0, id);

      // 如果未被引用，删除物理文件
      if (!isReferenced) {
        this.deleteImageFile(image.filepath);
      } else {
        log.info(`GalleryService: Soft deleted image ${id}, preserved file (referenced)`);
      }

      // 更新相册的更新时间
      if (image.album_id) {
        this.db.prepare('UPDATE albums SET updated_at = ? WHERE id = ?')
          .run(this.now(), image.album_id);
      }

      log.info(`GalleryService: Deleted image ${id}, filePreserved: ${isReferenced}`);
      return { success: true, filePreserved: isReferenced };
    } catch (error) {
      log.error('GalleryService: deleteImage failed:', error);
      throw error;
    }
  }

  /**
   * 删除图片文件
   */
  private deleteImageFile(filepath: string): void {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        log.info(`GalleryService: Deleted file ${filepath}`);
      }
    } catch (error) {
      log.warn(`GalleryService: Failed to delete file ${filepath}:`, error);
    }
  }

  /**
   * 选择使用次数最少的图片（用于文章生成）
   */
  selectLeastUsedImage(albumId: string): ImageSelectionResult | null {
    try {
      const result = this.db.prepare(`
        SELECT id, filepath, usage_count, size
        FROM images
        WHERE album_id = ? AND deleted_at IS NULL
        ORDER BY usage_count ASC, created_at ASC
        LIMIT 1
      `).get(albumId) as { id: string; filepath: string; usage_count: number; size: number } | undefined;

      if (!result) {
        log.info(`GalleryService: No images in album ${albumId}`);
        return null;
      }

      log.info(`GalleryService: Selected image ${result.id} with usage count ${result.usage_count}`);
      return {
        imageId: result.id,
        filepath: result.filepath,
        usageCount: result.usage_count || 0,
        size: result.size || 0
      };
    } catch (error) {
      log.error('GalleryService: selectLeastUsedImage failed:', error);
      throw error;
    }
  }

  /**
   * 记录图片使用
   */
  recordImageUsage(imageId: string, articleId: string): void {
    try {
      this.transaction(() => {
        // 更新使用次数
        this.db.prepare(`
          UPDATE images SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = ?
        `).run(imageId);

        // 记录使用历史
        this.db.prepare(`
          INSERT OR IGNORE INTO image_usage (image_id, article_id)
          VALUES (?, ?)
        `).run(imageId, articleId);
      });

      log.info(`GalleryService: Recorded usage of image ${imageId} for article ${articleId}`);
    } catch (error) {
      log.error('GalleryService: recordImageUsage failed:', error);
      throw error;
    }
  }

  /**
   * 获取图库统计
   */
  getStats(userId: number): {
    totalAlbums: number;
    totalImages: number;
    totalSize: number;
  } {
    try {
      const albumCount = this.count(userId);

      const imageStats = this.db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size
        FROM images
        WHERE user_id = ? AND deleted_at IS NULL
      `).get(userId) as { count: number; total_size: number };

      return {
        totalAlbums: albumCount,
        totalImages: imageStats.count,
        totalSize: imageStats.total_size
      };
    } catch (error) {
      log.error('GalleryService: getStats failed:', error);
      throw error;
    }
  }

  /**
   * 根据 ID 查找相册（别名方法，兼容旧代码）
   */
  findAlbumById(id: string): Album | null {
    return this.findById(id);
  }
}

export const galleryService = GalleryService.getInstance();
export { GalleryService };
