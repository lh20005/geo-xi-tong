/**
 * 本地图库 IPC 处理器
 * 处理图库的本地 CRUD 操作
 * Requirements: Phase 6 - 注册 IPC 处理器
 */

import { ipcMain, app } from 'electron';
import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs';
import { galleryService, CreateAlbumParams } from '../../services';
import { storageManager } from '../../storage/manager';

/**
 * 注册本地图库相关 IPC 处理器
 */
export function registerLocalGalleryHandlers(): void {
  log.info('Registering local gallery IPC handlers...');

  // 创建相册
  ipcMain.handle('gallery:createAlbum', async (_event, params: Omit<CreateAlbumParams, 'user_id'>) => {
    try {
      log.info('IPC: gallery:createAlbum');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const album = galleryService.createAlbum({
        ...params,
        user_id: user.id
      });

      // 创建相册目录
      const userDataPath = app.getPath('userData');
      const albumPath = path.join(userDataPath, 'gallery', album.id);
      if (!fs.existsSync(albumPath)) {
        fs.mkdirSync(albumPath, { recursive: true });
      }

      return { success: true, data: album };
    } catch (error: any) {
      log.error('IPC: gallery:createAlbum failed:', error);
      return { success: false, error: error.message || '创建相册失败' };
    }
  });

  // 获取所有相册
  ipcMain.handle('gallery:findAlbums', async () => {
    try {
      log.info('IPC: gallery:findAlbums');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const albums = galleryService.findAlbumsWithStats(user.id);
      return { success: true, data: albums };
    } catch (error: any) {
      log.error('IPC: gallery:findAlbums failed:', error);
      return { success: false, error: error.message || '获取相册列表失败' };
    }
  });

  // 获取相册详情
  ipcMain.handle('gallery:getAlbum', async (_event, albumId: string) => {
    try {
      log.info(`IPC: gallery:getAlbum - ${albumId}`);
      
      const album = galleryService.getAlbumWithStats(albumId);
      if (!album) {
        return { success: false, error: '相册不存在' };
      }

      return { success: true, data: album };
    } catch (error: any) {
      log.error('IPC: gallery:getAlbum failed:', error);
      return { success: false, error: error.message || '获取相册失败' };
    }
  });

  // 更新相册
  ipcMain.handle('gallery:updateAlbum', async (_event, albumId: string, params: { name?: string; description?: string }) => {
    try {
      log.info(`IPC: gallery:updateAlbum - ${albumId}`);
      
      const album = galleryService.updateAlbum(albumId, params.name || '');
      if (!album) {
        return { success: false, error: '相册不存在' };
      }

      return { success: true, data: album };
    } catch (error: any) {
      log.error('IPC: gallery:updateAlbum failed:', error);
      return { success: false, error: error.message || '更新相册失败' };
    }
  });

  // 删除相册
  ipcMain.handle('gallery:deleteAlbum', async (_event, albumId: string) => {
    try {
      log.info(`IPC: gallery:deleteAlbum - ${albumId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 删除相册目录
      const userDataPath = app.getPath('userData');
      const albumPath = path.join(userDataPath, 'gallery', albumId);
      if (fs.existsSync(albumPath)) {
        fs.rmSync(albumPath, { recursive: true, force: true });
      }

      const success = galleryService.deleteAlbum(albumId, user.id);
      return { success };
    } catch (error: any) {
      log.error('IPC: gallery:deleteAlbum failed:', error);
      return { success: false, error: error.message || '删除相册失败' };
    }
  });

  // 上传图片
  ipcMain.handle('gallery:uploadImage', async (_event, albumId: string, files: Array<{
    name: string;
    path: string;
    type: string;
  }>) => {
    try {
      log.info(`IPC: gallery:uploadImage - Album: ${albumId}, files: ${files.length}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const album = galleryService.findAlbumById(albumId);
      if (!album) {
        return { success: false, error: '相册不存在' };
      }

      // 获取相册存储目录
      const userDataPath = app.getPath('userData');
      const albumPath = path.join(userDataPath, 'gallery', albumId);
      
      // 确保目录存在
      if (!fs.existsSync(albumPath)) {
        fs.mkdirSync(albumPath, { recursive: true });
      }

      const uploadedImages: any[] = [];

      for (const file of files) {
        try {
          // 读取文件内容
          const content = fs.readFileSync(file.path);
          
          // 生成新文件名
          const ext = path.extname(file.name);
          const baseName = path.basename(file.name, ext);
          const newFileName = `${baseName}-${Date.now()}${ext}`;
          const destPath = path.join(albumPath, newFileName);
          
          // 复制文件到相册目录
          fs.writeFileSync(destPath, content);
          
          // 获取图片尺寸（简单实现）
          // TODO: 使用 sharp 或其他库获取实际尺寸
          const width = 0;
          const height = 0;

          // 创建图片记录
          const image = galleryService.uploadImage({
            user_id: user.id,
            album_id: albumId,
            filename: file.name,
            filepath: destPath,
            mime_type: file.type,
            size: content.length
          });

          uploadedImages.push(image);
        } catch (err: any) {
          log.error(`Failed to upload image ${file.name}:`, err);
        }
      }

      return { 
        success: true, 
        data: { 
          uploadedCount: uploadedImages.length,
          images: uploadedImages 
        } 
      };
    } catch (error: any) {
      log.error('IPC: gallery:uploadImage failed:', error);
      return { success: false, error: error.message || '上传图片失败' };
    }
  });

  // 获取相册图片列表
  ipcMain.handle('gallery:findImages', async (_event, albumId: string) => {
    try {
      log.info(`IPC: gallery:findImages - ${albumId}`);
      
      const images = galleryService.findImagesByAlbum(albumId);
      return { success: true, data: images };
    } catch (error: any) {
      log.error('IPC: gallery:findImages failed:', error);
      return { success: false, error: error.message || '获取图片列表失败' };
    }
  });

  // 获取图片详情
  ipcMain.handle('gallery:getImage', async (_event, imageId: string) => {
    try {
      log.info(`IPC: gallery:getImage - ${imageId}`);
      
      const image = galleryService.findImageById(imageId);
      if (!image) {
        return { success: false, error: '图片不存在' };
      }

      return { success: true, data: image };
    } catch (error: any) {
      log.error('IPC: gallery:getImage failed:', error);
      return { success: false, error: error.message || '获取图片失败' };
    }
  });

  // 删除图片
  ipcMain.handle('gallery:deleteImage', async (_event, imageId: string) => {
    try {
      log.info(`IPC: gallery:deleteImage - ${imageId}`);
      
      const result = galleryService.deleteImage(imageId);
      return { success: result.success, data: result };
    } catch (error: any) {
      log.error('IPC: gallery:deleteImage failed:', error);
      return { success: false, error: error.message || '删除图片失败' };
    }
  });

  // 批量删除图片
  ipcMain.handle('gallery:deleteImages', async (_event, imageIds: string[]) => {
    try {
      log.info(`IPC: gallery:deleteImages - ${imageIds.length} images`);
      
      let deletedCount = 0;
      for (const imageId of imageIds) {
        const result = galleryService.deleteImage(imageId);
        if (result.success) {
          deletedCount++;
        }
      }

      return { success: true, data: { deletedCount } };
    } catch (error: any) {
      log.error('IPC: gallery:deleteImages failed:', error);
      return { success: false, error: error.message || '批量删除图片失败' };
    }
  });

  // 移动图片到其他相册
  ipcMain.handle('gallery:moveImage', async (_event, imageId: string, targetAlbumId: string) => {
    try {
      log.info(`IPC: gallery:moveImage - ${imageId} -> ${targetAlbumId}`);
      
      const image = galleryService.findImageById(imageId);
      if (!image) {
        return { success: false, error: '图片不存在' };
      }

      const targetAlbum = galleryService.findAlbumById(targetAlbumId);
      if (!targetAlbum) {
        return { success: false, error: '目标相册不存在' };
      }

      // 移动物理文件
      if (image.filepath && fs.existsSync(image.filepath)) {
        const userDataPath = app.getPath('userData');
        const targetPath = path.join(userDataPath, 'gallery', targetAlbumId);
        
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }

        const newFilePath = path.join(targetPath, path.basename(image.filepath));
        fs.renameSync(image.filepath, newFilePath);

        // 更新数据库记录 - 使用 db 直接更新
        const db = galleryService['db'];
        db.prepare(`
          UPDATE images SET album_id = ?, filepath = ?, updated_at = ? WHERE id = ?
        `).run(targetAlbumId, newFilePath, new Date().toISOString(), imageId);
      }

      return { success: true };
    } catch (error: any) {
      log.error('IPC: gallery:moveImage failed:', error);
      return { success: false, error: error.message || '移动图片失败' };
    }
  });

  // 获取图库统计
  ipcMain.handle('gallery:getStats', async () => {
    try {
      log.info('IPC: gallery:getStats');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const stats = galleryService.getStats(user.id);
      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: gallery:getStats failed:', error);
      return { success: false, error: error.message || '获取统计失败' };
    }
  });

  // 读取图片文件（返回 base64）
  ipcMain.handle('gallery:readImageFile', async (_event, imageId: string) => {
    try {
      log.info(`IPC: gallery:readImageFile - ${imageId}`);
      
      const image = galleryService.findImageById(imageId);
      if (!image || !image.filepath) {
        return { success: false, error: '图片不存在' };
      }

      if (!fs.existsSync(image.filepath)) {
        return { success: false, error: '图片文件不存在' };
      }

      const content = fs.readFileSync(image.filepath);
      const base64 = content.toString('base64');
      const mimeType = image.mime_type || 'image/jpeg';

      return { 
        success: true, 
        data: { 
          base64,
          mimeType,
          dataUrl: `data:${mimeType};base64,${base64}`
        } 
      };
    } catch (error: any) {
      log.error('IPC: gallery:readImageFile failed:', error);
      return { success: false, error: error.message || '读取图片失败' };
    }
  });

  log.info('Local gallery IPC handlers registered');
}
