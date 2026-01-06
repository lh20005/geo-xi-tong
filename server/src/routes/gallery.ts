import { Router } from 'express';
import { pool } from '../db/database';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';
import { storageQuotaService } from '../services/StorageQuotaService';
import { storageService } from '../services/StorageService';

export const galleryRouter = Router();

// 所有路由都需要认证和租户上下文
galleryRouter.use(authenticate);
galleryRouter.use(setTenantContext);
galleryRouter.use(requireTenantContext);

// 辅助函数：解码文件名，处理中文乱码
function decodeFilename(filename: string): string {
  try {
    // 尝试从 latin1 转换为 utf8
    return Buffer.from(filename, 'latin1').toString('utf8');
  } catch (error) {
    // 如果转换失败，返回原始文件名
    return filename;
  }
}

// 配置文件上传
const uploadDir = path.join(__dirname, '../../uploads/gallery');

// 确保上传目录存在
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    console.log('[Gallery Upload] 原始文件名 (raw):', file.originalname);
    console.log('[Gallery Upload] 原始文件名 (buffer):', Buffer.from(file.originalname, 'binary'));
    
    // 解码文件名，处理中文乱码
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    console.log('[Gallery Upload] 解码后文件名:', originalname);
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(originalname);
    const basename = path.basename(originalname, ext);
    // 保留原始文件名（去除特殊字符）+ 唯一后缀 + 扩展名
    const safeBasename = basename.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '_');
    const finalFilename = `${uniqueSuffix}-${safeBasename}${ext}`;
    console.log('[Gallery Upload] 最终文件名:', finalFilename);
    
    cb(null, finalFilename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的图片格式，仅支持JPEG、PNG、GIF、WebP'));
    }
  }
});

// Zod验证schemas
const createAlbumSchema = z.object({
  name: z.string().min(1).trim()
});

const updateAlbumSchema = z.object({
  name: z.string().min(1).trim()
});

// 获取所有相册（只获取当前用户的）
galleryRouter.get('/albums', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    
    const result = await pool.query(
      `SELECT 
        a.id, 
        a.name, 
        a.created_at,
        COUNT(i.id) as image_count,
        (SELECT filepath FROM images WHERE album_id = a.id ORDER BY created_at ASC LIMIT 1) as cover_image
       FROM albums a
       LEFT JOIN images i ON a.id = i.album_id
       WHERE a.user_id = $1
       GROUP BY a.id
       ORDER BY a.created_at DESC`,
      [userId]
    );
    
    res.json({ albums: result.rows });
  } catch (error: any) {
    console.error('获取相册列表错误:', error);
    res.status(500).json({ error: '获取相册列表失败', details: error.message });
  }
});

// 创建相册（支持同时上传图片）
galleryRouter.post('/albums', upload.array('images', 20), async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const validatedData = createAlbumSchema.parse(req.body);
    const files = req.files as Express.Multer.File[];
    
    // 开始事务
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // 插入相册（关联到当前用户）
      const albumResult = await client.query(
        'INSERT INTO albums (name, user_id) VALUES ($1, $2) RETURNING id, name, created_at',
        [validatedData.name, userId]
      );
      
      const album = albumResult.rows[0];
      
      // 插入图片（如果有）
      if (files && files.length > 0) {
        for (const file of files) {
          const decodedFilename = decodeFilename(file.originalname);
          console.log('[Gallery DB] 保存文件名到数据库:', decodedFilename);
          
          const imageResult = await client.query(
            'INSERT INTO images (album_id, filename, filepath, mime_type, size) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [album.id, decodedFilename, file.filename, file.mimetype, file.size]
          );
          
          const imageId = imageResult.rows[0].id;
          
          // 记录存储使用
          await client.query(
            'SELECT record_storage_usage($1, $2, $3, $4, $5, $6)',
            [userId, 'image', imageId, 'add', file.size, JSON.stringify({
              filename: decodedFilename,
              mimetype: file.mimetype,
              albumId: album.id
            })]
          );
        }
      }
      
      await client.query('COMMIT');
      
      // 同步用户存储使用统计（在事务外执行）
      if (files && files.length > 0) {
        try {
          await pool.query('SELECT sync_user_storage_usage($1)', [userId]);
        } catch (syncError) {
          console.error('[Gallery] 同步存储使用失败:', syncError);
        }
        
        // 清除缓存
        try {
          await storageService.getUserStorageUsage(userId, true);
        } catch (cacheError) {
          console.error('[Gallery] 清除缓存失败:', cacheError);
        }
      }
      
      res.json({
        id: album.id,
        name: album.name,
        created_at: album.created_at
      });
    } catch (error) {
      await client.query('ROLLBACK');
      // 删除已上传的文件
      if (files && files.length > 0) {
        files.forEach(file => {
          const filePath = path.join(uploadDir, file.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '数据验证失败', details: error.errors });
    }
    console.error('创建相册错误:', error);
    res.status(500).json({ error: error.message || '创建相册失败' });
  }
});

// 获取相册详情（验证所有权）
galleryRouter.get('/albums/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const albumId = parseInt(req.params.id);
    if (isNaN(albumId) || albumId <= 0) {
      return res.status(400).json({ error: '无效的相册ID' });
    }
    
    // 获取相册信息（验证所有权）
    const albumResult = await pool.query(
      'SELECT id, name, created_at FROM albums WHERE id = $1 AND user_id = $2',
      [albumId, userId]
    );
    
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: '相册不存在或无权访问' });
    }
    
    // 获取相册中的所有图片
    const imagesResult = await pool.query(
      'SELECT id, filename, filepath, mime_type, size, created_at FROM images WHERE album_id = $1 ORDER BY created_at ASC',
      [albumId]
    );
    
    res.json({
      ...albumResult.rows[0],
      images: imagesResult.rows
    });
  } catch (error: any) {
    console.error('获取相册详情错误:', error);
    res.status(500).json({ error: '获取相册详情失败', details: error.message });
  }
});

// 更新相册名称（验证所有权）
galleryRouter.patch('/albums/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const albumId = parseInt(req.params.id);
    if (isNaN(albumId) || albumId <= 0) {
      return res.status(400).json({ error: '无效的相册ID' });
    }
    
    const validatedData = updateAlbumSchema.parse(req.body);
    
    // 更新相册名称（验证所有权）
    const result = await pool.query(
      'UPDATE albums SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING id, name, updated_at',
      [validatedData.name, albumId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '相册不存在或无权访问' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '数据验证失败', details: error.errors });
    }
    console.error('更新相册错误:', error);
    res.status(500).json({ error: '更新相册失败', details: error.message });
  }
});

// 删除相册（验证所有权）
galleryRouter.delete('/albums/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const albumId = parseInt(req.params.id);
    if (isNaN(albumId) || albumId <= 0) {
      return res.status(400).json({ error: '无效的相册ID' });
    }
    
    // 获取所有图片信息（验证所有权）
    const imagesResult = await pool.query(
      `SELECT i.id, i.filepath, i.size FROM images i
       JOIN albums a ON i.album_id = a.id
       WHERE a.id = $1 AND a.user_id = $2 AND i.deleted_at IS NULL`,
      [albumId, userId]
    );
    
    if (imagesResult.rows.length === 0) {
      // 检查相册是否存在
      const checkResult = await pool.query(
        'SELECT id FROM albums WHERE id = $1 AND user_id = $2',
        [albumId, userId]
      );
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: '相册不存在或无权访问' });
      }
    }
    
    const totalImages = imagesResult.rows.length;
    
    // 使用事务处理
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      let preservedCount = 0;
      let deletedFileCount = 0;
      
      for (const img of imagesResult.rows) {
        // 检查图片是否被文章引用
        const refResult = await client.query(
          'SELECT is_image_referenced($1) as is_ref',
          [img.filepath]
        );
        const isReferenced = refResult.rows[0]?.is_ref || false;
        
        // 软删除图片记录
        await client.query(
          'UPDATE images SET deleted_at = NOW(), is_orphan = $1 WHERE id = $2',
          [isReferenced, img.id]
        );
        
        if (isReferenced) {
          // 被文章引用，保留文件
          preservedCount++;
          console.log(`[图库删除] 软删除图片 ${img.id}，保留文件（被文章引用）: ${img.filepath}`);
        } else {
          // 未被引用，删除文件
          const filePath = path.join(uploadDir, img.filepath);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFileCount++;
          }
        }
        
        // 更新存储使用（减少图片存储）
        await client.query(
          'SELECT record_storage_usage($1, $2, $3, $4, $5, $6)',
          [userId, 'image', img.id, 'remove', img.size, null]
        );
      }
      
      // 删除相册记录（图片记录保留但已软删除）
      await client.query('DELETE FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
      
      await client.query('COMMIT');
      
      // 同步用户存储使用
      await client.query('SELECT sync_user_storage_usage($1)', [userId]);
      
      console.log(`[图库删除] 相册 ${albumId} 删除完成：软删除 ${totalImages} 张图片，保留 ${preservedCount} 个文件，删除 ${deletedFileCount} 个文件`);
      
      res.json({
        success: true,
        totalImages,
        preservedFiles: preservedCount,
        deletedFiles: deletedFileCount
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('删除相册错误:', error);
    res.status(500).json({ error: '删除相册失败', details: error.message });
  }
});

// 上传图片到相册（验证所有权）
galleryRouter.post('/albums/:albumId/images', upload.array('images', 20), async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const albumId = parseInt(req.params.albumId);
    if (isNaN(albumId) || albumId <= 0) {
      return res.status(400).json({ error: '无效的相册ID' });
    }
    
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请选择要上传的图片' });
    }
    
    // 检查相册是否存在且属于当前用户
    const checkResult = await pool.query(
      'SELECT id FROM albums WHERE id = $1 AND user_id = $2',
      [albumId, userId]
    );
    
    if (checkResult.rows.length === 0) {
      // 删除已上传的文件
      files.forEach(file => {
        const filePath = path.join(uploadDir, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      return res.status(404).json({ error: '相册不存在或无权访问' });
    }
    
    // 计算总文件大小
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    // 检查每个文件的大小限制
    for (const file of files) {
      const sizeValidation = await storageQuotaService.validateFileSize('image', file.size);
      if (!sizeValidation.valid) {
        // 删除已上传的文件
        files.forEach(f => {
          const filePath = path.join(uploadDir, f.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
        return res.status(413).json({ error: sizeValidation.reason });
      }
    }
    
    // 检查存储配额
    const quotaCheck = await storageQuotaService.checkQuota(userId, totalSize);
    if (!quotaCheck.allowed) {
      // 删除已上传的文件
      files.forEach(file => {
        const filePath = path.join(uploadDir, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      return res.status(403).json({ 
        error: '存储空间不足，无法上传图片。请升级套餐以获取更多存储空间。',
        reason: quotaCheck.reason,
        currentUsage: quotaCheck.currentUsageBytes,
        quota: quotaCheck.quotaBytes,
        available: quotaCheck.availableBytes,
        needUpgrade: true
      });
    }
    
    // 使用事务插入图片记录并记录存储使用
    const client = await pool.connect();
    const uploadedImages = [];
    
    try {
      await client.query('BEGIN');
      
      for (const file of files) {
        const decodedFilename = decodeFilename(file.originalname);
        
        // 插入图片记录
        const result = await client.query(
          'INSERT INTO images (album_id, filename, filepath, mime_type, size) VALUES ($1, $2, $3, $4, $5) RETURNING id, filename, created_at',
          [albumId, decodedFilename, file.filename, file.mimetype, file.size]
        );
        
        const imageId = result.rows[0].id;
        
        // 记录存储使用（在同一事务中）
        await client.query(
          'SELECT record_storage_usage($1, $2, $3, $4, $5, $6)',
          [userId, 'image', imageId, 'add', file.size, JSON.stringify({
            filename: decodedFilename,
            mimetype: file.mimetype,
            albumId: albumId
          })]
        );
        
        uploadedImages.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      
      // 同步用户存储使用统计（在事务外执行，避免锁冲突）
      try {
        await pool.query('SELECT sync_user_storage_usage($1)', [userId]);
      } catch (syncError) {
        console.error('[Gallery] 同步存储使用失败:', syncError);
      }
      
      // 清除缓存并推送更新（在事务外，失败不影响主流程）
      try {
        await storageService.getUserStorageUsage(userId, true); // 跳过缓存，刷新数据
      } catch (cacheError) {
        console.error('[Gallery] 清除缓存失败:', cacheError);
      }
      
      res.json({
        uploadedCount: uploadedImages.length,
        images: uploadedImages
      });
    } catch (error) {
      await client.query('ROLLBACK');
      
      // 删除已上传的文件
      files.forEach(file => {
        const filePath = path.join(uploadDir, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('上传图片错误:', error);
    res.status(500).json({ error: error.message || '上传图片失败' });
  }
});

// 获取单张图片
galleryRouter.get('/images/:id', async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    if (isNaN(imageId) || imageId <= 0) {
      return res.status(400).json({ error: '无效的图片ID' });
    }
    
    const result = await pool.query(
      'SELECT id, album_id, filename, filepath, mime_type, size, created_at FROM images WHERE id = $1',
      [imageId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '图片不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('获取图片错误:', error);
    res.status(500).json({ error: '获取图片失败', details: error.message });
  }
});

// 删除图片（使用软删除）
galleryRouter.delete('/images/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const imageId = parseInt(req.params.id);
    if (isNaN(imageId) || imageId <= 0) {
      return res.status(400).json({ error: '无效的图片ID' });
    }
    
    // 获取图片信息并验证所有权
    const imageResult = await pool.query(
      `SELECT i.filepath, i.size, i.album_id, i.deleted_at, a.user_id 
       FROM images i 
       JOIN albums a ON i.album_id = a.id 
       WHERE i.id = $1`,
      [imageId]
    );
    
    if (imageResult.rows.length === 0) {
      return res.status(404).json({ error: '图片不存在' });
    }
    
    const image = imageResult.rows[0];
    
    // 验证所有权
    if (image.user_id !== userId) {
      return res.status(403).json({ error: '无权删除此图片' });
    }
    
    // 检查是否已软删除
    if (image.deleted_at) {
      return res.status(400).json({ error: '图片已删除' });
    }
    
    const filepath = image.filepath;
    const fileSize = image.size;
    
    // 检查图片是否被文章引用
    const referencedResult = await pool.query(
      'SELECT is_image_referenced($1) as is_ref',
      [filepath]
    );
    const isReferenced = referencedResult.rows[0]?.is_ref || false;
    
    // 使用事务处理软删除
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 软删除图片记录
      await client.query(
        'UPDATE images SET deleted_at = NOW(), is_orphan = $1 WHERE id = $2',
        [isReferenced, imageId]
      );
      
      // 记录存储使用减少
      await client.query(
        'SELECT record_storage_usage($1, $2, $3, $4, $5, $6)',
        [userId, 'image', imageId, 'remove', fileSize, null]
      );
      
      await client.query('COMMIT');
      
      // 如果图片未被文章引用，删除物理文件
      if (!isReferenced) {
        const fullPath = path.join(uploadDir, filepath);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
            console.log(`[图片删除] 删除文件: ${filepath}`);
          } catch (error) {
            console.error('[Gallery] 删除文件失败:', error);
          }
        }
      } else {
        console.log(`[图片删除] 软删除图片 ${imageId}，保留文件（被文章引用）: ${filepath}`);
      }
      
      // 同步用户存储使用
      await pool.query('SELECT sync_user_storage_usage($1)', [userId]);
      
      // 清除缓存
      try {
        await storageService.getUserStorageUsage(userId, true);
      } catch (cacheError) {
        console.error('[Gallery] 清除缓存失败:', cacheError);
      }
      
      res.json({ success: true, filePreserved: isReferenced });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('删除图片错误:', error);
    res.status(500).json({ error: '删除图片失败', details: error.message });
  }
});
