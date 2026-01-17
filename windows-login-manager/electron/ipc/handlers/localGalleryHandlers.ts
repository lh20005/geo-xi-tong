/**
 * 本地图库 IPC 处理器
 * 处理图库的本地 CRUD 操作
 * Requirements: Phase 6 - PostgreSQL 迁移
 */

import { ipcMain, app } from 'electron';
import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs';
import { serviceFactory } from '../../services/ServiceFactory';
import { storageManager } from '../../storage/manager';

/**
 * 注册本地图库相关 IPC 处理器
 */
export function registerLocalGalleryHandlers(): void {
  log.info('Registering local gallery IPC handlers (PostgreSQL)...');

  // 创建相册
  ipcMain.handle('gallery:createAlbum', async (_event, params: any) => {
    try {
      log.info('IPC: gallery:createAlbum');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const albumService = serviceFactory.getAlbumService();

      const album = await albumService.create(params);

      // 创建相册目录
      const userDataPath = app.getPath('userData');
      const albumPath = path.join(userDataPath, 'gallery', album.id.toString());
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

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const albumService = serviceFactory.getAlbumService();

      const albums = await albumService.findAllWithStats();
      return { success: true, data: albums };
    } catch (error: any) {
      log.error('IPC: gallery:findAlbums failed:', error);
      return { success: false, error: error.message || '获取相册列表失败' };
    }
  });

  // 获取相册详情
  ipcMain.handle('gallery:getAlbum', async (_event, albumId: number) => {
    try {
      log.info(`IPC: gallery:getAlbum - ${albumId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const albumService = serviceFactory.getAlbumService();
      
      const album = await albumService.findByIdWithStats(albumId);
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
  ipcMain.handle('gallery:updateAlbum', async (_event, albumId: number, params: { name?: string; description?: string }) => {
    try {
      log.info(`IPC: gallery:updateAlbum - ${albumId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const albumService = serviceFactory.getAlbumService();
      
      const album = await albumService.update(albumId, params);
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
  ipcMain.handle('gallery:deleteAlbum', async (_event, albumId: number) => {
    try {
      log.info(`IPC: gallery:deleteAlbum - ${albumId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 删除相册目录
      const userDataPath = app.getPath('userData');
      const albumPath = path.join(userDataPath, 'gallery', String(albumId));
      if (fs.existsSync(albumPath)) {
        fs.rmSync(albumPath, { recursive: true, force: true });
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const albumService = serviceFactory.getAlbumService();

      await albumService.delete(albumId);
      return { success: true };
    } catch (error: any) {
      log.error('IPC: gallery:deleteAlbum failed:', error);
      return { success: false, error: error.message || '删除相册失败' };
    }
  });

  // 上传图片
  ipcMain.handle('gallery:uploadImage', async (_event, albumId: number, files: Array<{
    name: string;
    path: string;
    type: string;
    buffer?: number[]; // 可选的 buffer 数据
  }>) => {
    log.info(`========== 🔥 图片上传 IPC 被调用 ==========`);
    log.info(`📋 参数: albumId=${albumId}, files数量=${files?.length || 0}`);
    
    try {
      log.info(`========== 图片上传开始 ==========`);
      log.info(`IPC: gallery:uploadImage - Album: ${albumId}, files: ${files.length}`);
      log.info(`Files info:`, files.map(f => ({ name: f.name, type: f.type, hasBuffer: !!f.buffer, bufferLength: f.buffer?.length, path: f.path })));
      log.info(`========== 🔥 图片上传 IPC 被调用 ==========`);
      log.info(`📋 参数: albumId=${albumId}, files数量=${files?.length || 0}`);
      
      const user = await storageManager.getUser();
      if (!user) {
        log.error('❌ 用户未登录');
        return { success: false, error: '用户未登录' };
      }
      log.info(`✅ 用户已登录: User ID=${user.id}, Username=${user.username}`);

      // 设置用户 ID 并获取服务
      log.info(`🔧 设置 ServiceFactory userId=${user.id}`);
      serviceFactory.setUserId(user.id);
      
      log.info(`🔧 获取 AlbumService...`);
      const albumService = serviceFactory.getAlbumService();
      log.info(`🔧 获取 ImageService...`);
      const imageService = serviceFactory.getImageService();
      log.info(`✅ Services 获取成功`);

      log.info(`🔍 查询相册: albumId=${albumId}`);
      const album = await albumService.findById(albumId);
      if (!album) {
        log.error(`❌ 相册不存在: ${albumId}`);
        return { success: false, error: '相册不存在' };
      }
      log.info(`✅ 相册找到:`, album);

      // 获取相册存储目录
      const userDataPath = app.getPath('userData');
      log.info(`User data path: ${userDataPath}`);
      const albumPath = path.join(userDataPath, 'gallery', String(albumId));
      log.info(`Album path: ${albumPath}`);
      
      // 确保目录存在
      if (!fs.existsSync(albumPath)) {
        fs.mkdirSync(albumPath, { recursive: true });
      }

      const uploadedImages: any[] = [];

      for (const file of files) {
        try {
          log.info(`========== 处理文件: ${file.name} ==========`);
          let content: Buffer;
          
          // 如果有 buffer 数据，使用 buffer；否则从路径读取
          if (file.buffer && file.buffer.length > 0) {
            content = Buffer.from(file.buffer);
            log.info(`Using buffer data for ${file.name}, size: ${content.length}`);
          } else if (file.path && fs.existsSync(file.path)) {
            content = fs.readFileSync(file.path);
            log.info(`Reading from path ${file.path}, size: ${content.length}`);
          } else {
            log.error(`No valid data source for ${file.name}, buffer: ${!!file.buffer}, path exists: ${file.path && fs.existsSync(file.path)}`);
            continue;
          }
          
          // 生成新文件名
          const ext = path.extname(file.name);
          const baseName = path.basename(file.name, ext);
          const newFileName = `${baseName}-${Date.now()}${ext}`;
          const destPath = path.join(albumPath, newFileName);
          
          log.info(`Saving to: ${destPath}`);
          
          // 复制文件到相册目录
          fs.writeFileSync(destPath, content);
          log.info(`File saved successfully: ${destPath}`);

          // 创建图片记录
          log.info(`Creating image record in database...`);
          const image = await imageService.createImage({
            album_id: albumId,
            filename: file.name,
            filepath: destPath,
            mime_type: file.type,
            size: content.length
          });

          log.info(`Image record created successfully: ${image.id}`);
          uploadedImages.push(image);
        } catch (err: any) {
          log.error(`Failed to upload image ${file.name}:`, err);
          log.error(`Error stack:`, err.stack);
        }
      }

      log.info(`========== 上传完成 ==========`);
      log.info(`Upload complete: ${uploadedImages.length} images uploaded`);
      return { 
        success: true, 
        data: { 
          uploadedCount: uploadedImages.length,
          images: uploadedImages 
        } 
      };
    } catch (error: any) {
      log.error('========== 图片上传失败 ==========');
      log.error('IPC: gallery:uploadImage failed:', error);
      log.error('Error stack:', error.stack);
      return { success: false, error: error.message || '上传图片失败' };
    }
  });

  // 获取相册图片列表
  ipcMain.handle('gallery:findImages', async (_event, albumId: number) => {
    try {
      log.info(`IPC: gallery:findImages - ${albumId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const imageService = serviceFactory.getImageService();
      
      const images = await imageService.findByAlbum(albumId);
      return { success: true, data: images };
    } catch (error: any) {
      log.error('IPC: gallery:findImages failed:', error);
      return { success: false, error: error.message || '获取图片列表失败' };
    }
  });

  // 获取图片详情
  ipcMain.handle('gallery:getImage', async (_event, imageId: number) => {
    try {
      log.info(`IPC: gallery:getImage - ${imageId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const imageService = serviceFactory.getImageService();
      
      const image = await imageService.findById(imageId);
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
  ipcMain.handle('gallery:deleteImage', async (_event, imageId: number) => {
    try {
      log.info(`IPC: gallery:deleteImage - ${imageId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const imageService = serviceFactory.getImageService();
      
      await imageService.delete(imageId);
      return { success: true };
    } catch (error: any) {
      log.error('IPC: gallery:deleteImage failed:', error);
      return { success: false, error: error.message || '删除图片失败' };
    }
  });

  // 批量删除图片
  ipcMain.handle('gallery:deleteImages', async (_event, imageIds: number[]) => {
    try {
      log.info(`IPC: gallery:deleteImages - ${imageIds.length} images`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const imageService = serviceFactory.getImageService();
      
      const deletedCount = await imageService.deleteMany(imageIds);

      return { success: true, data: { deletedCount } };
    } catch (error: any) {
      log.error('IPC: gallery:deleteImages failed:', error);
      return { success: false, error: error.message || '批量删除图片失败' };
    }
  });

  // 移动图片到其他相册
  ipcMain.handle('gallery:moveImage', async (_event, imageId: number, targetAlbumId: number) => {
    try {
      log.info(`IPC: gallery:moveImage - ${imageId} -> ${targetAlbumId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const imageService = serviceFactory.getImageService();
      const albumService = serviceFactory.getAlbumService();
      
      const image = await imageService.findById(imageId);
      if (!image) {
        return { success: false, error: '图片不存在' };
      }

      const targetAlbum = await albumService.findById(targetAlbumId);
      if (!targetAlbum) {
        return { success: false, error: '目标相册不存在' };
      }

      // 移动物理文件
      if (image.filepath && fs.existsSync(image.filepath)) {
        const userDataPath = app.getPath('userData');
        const targetPath = path.join(userDataPath, 'gallery', String(targetAlbumId));
        
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }

        const newFilePath = path.join(targetPath, path.basename(image.filepath));
        fs.renameSync(image.filepath, newFilePath);

        // 更新数据库记录
        await imageService.update(imageId, {
          album_id: targetAlbumId,
          filepath: newFilePath
        });
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

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const albumService = serviceFactory.getAlbumService();

      const stats = await albumService.getStats();
      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: gallery:getStats failed:', error);
      return { success: false, error: error.message || '获取统计失败' };
    }
  });

  // 读取图片文件（返回 base64）
  ipcMain.handle('gallery:readImageFile', async (_event, imageId: number) => {
    try {
      log.info(`IPC: gallery:readImageFile - ${imageId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const imageService = serviceFactory.getImageService();
      
      const image = await imageService.findById(imageId);
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

  log.info('Local gallery IPC handlers registered (PostgreSQL)');
}
