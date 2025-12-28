import { Router } from 'express';
import { pool } from '../db/database';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const galleryRouter = Router();

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

// 获取所有相册
galleryRouter.get('/albums', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        a.id, 
        a.name, 
        a.created_at,
        COUNT(i.id) as image_count,
        (SELECT filepath FROM images WHERE album_id = a.id ORDER BY created_at ASC LIMIT 1) as cover_image
       FROM albums a
       LEFT JOIN images i ON a.id = i.album_id
       GROUP BY a.id
       ORDER BY a.created_at DESC`
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
    const validatedData = createAlbumSchema.parse(req.body);
    const files = req.files as Express.Multer.File[];
    
    // 开始事务
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // 插入相册
      const albumResult = await client.query(
        'INSERT INTO albums (name) VALUES ($1) RETURNING id, name, created_at',
        [validatedData.name]
      );
      
      const album = albumResult.rows[0];
      
      // 插入图片（如果有）
      if (files && files.length > 0) {
        for (const file of files) {
          const decodedFilename = decodeFilename(file.originalname);
          console.log('[Gallery DB] 保存文件名到数据库:', decodedFilename);
          await client.query(
            'INSERT INTO images (album_id, filename, filepath, mime_type, size) VALUES ($1, $2, $3, $4, $5)',
            [album.id, decodedFilename, file.filename, file.mimetype, file.size]
          );
        }
      }
      
      await client.query('COMMIT');
      
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

// 获取相册详情
galleryRouter.get('/albums/:id', async (req, res) => {
  try {
    const albumId = parseInt(req.params.id);
    if (isNaN(albumId) || albumId <= 0) {
      return res.status(400).json({ error: '无效的相册ID' });
    }
    
    // 获取相册信息
    const albumResult = await pool.query(
      'SELECT id, name, created_at FROM albums WHERE id = $1',
      [albumId]
    );
    
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: '相册不存在' });
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

// 更新相册名称
galleryRouter.patch('/albums/:id', async (req, res) => {
  try {
    const albumId = parseInt(req.params.id);
    if (isNaN(albumId) || albumId <= 0) {
      return res.status(400).json({ error: '无效的相册ID' });
    }
    
    const validatedData = updateAlbumSchema.parse(req.body);
    
    // 检查相册是否存在
    const checkResult = await pool.query('SELECT id FROM albums WHERE id = $1', [albumId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '相册不存在' });
    }
    
    // 更新相册名称
    const result = await pool.query(
      'UPDATE albums SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, updated_at',
      [validatedData.name, albumId]
    );
    
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '数据验证失败', details: error.errors });
    }
    console.error('更新相册错误:', error);
    res.status(500).json({ error: '更新相册失败', details: error.message });
  }
});

// 删除相册
galleryRouter.delete('/albums/:id', async (req, res) => {
  try {
    const albumId = parseInt(req.params.id);
    if (isNaN(albumId) || albumId <= 0) {
      return res.status(400).json({ error: '无效的相册ID' });
    }
    
    // 检查相册是否存在
    const checkResult = await pool.query('SELECT id FROM albums WHERE id = $1', [albumId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '相册不存在' });
    }
    
    // 获取所有图片文件路径
    const imagesResult = await pool.query('SELECT filepath FROM images WHERE album_id = $1', [albumId]);
    const deletedImages = imagesResult.rows.length;
    
    // 删除相册（级联删除图片记录）
    await pool.query('DELETE FROM albums WHERE id = $1', [albumId]);
    
    // 删除文件系统中的图片文件
    imagesResult.rows.forEach(row => {
      const filePath = path.join(uploadDir, row.filepath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    
    res.json({
      success: true,
      deletedImages
    });
  } catch (error: any) {
    console.error('删除相册错误:', error);
    res.status(500).json({ error: '删除相册失败', details: error.message });
  }
});

// 上传图片到相册
galleryRouter.post('/albums/:albumId/images', upload.array('images', 20), async (req, res) => {
  try {
    const albumId = parseInt(req.params.albumId);
    if (isNaN(albumId) || albumId <= 0) {
      return res.status(400).json({ error: '无效的相册ID' });
    }
    
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请选择要上传的图片' });
    }
    
    // 检查相册是否存在
    const checkResult = await pool.query('SELECT id FROM albums WHERE id = $1', [albumId]);
    if (checkResult.rows.length === 0) {
      // 删除已上传的文件
      files.forEach(file => {
        const filePath = path.join(uploadDir, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      return res.status(404).json({ error: '相册不存在' });
    }
    
    // 插入图片记录
    const uploadedImages = [];
    for (const file of files) {
      const decodedFilename = decodeFilename(file.originalname);
      const result = await pool.query(
        'INSERT INTO images (album_id, filename, filepath, mime_type, size) VALUES ($1, $2, $3, $4, $5) RETURNING id, filename, created_at',
        [albumId, decodedFilename, file.filename, file.mimetype, file.size]
      );
      uploadedImages.push(result.rows[0]);
    }
    
    res.json({
      uploadedCount: uploadedImages.length,
      images: uploadedImages
    });
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

// 删除图片
galleryRouter.delete('/images/:id', async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    if (isNaN(imageId) || imageId <= 0) {
      return res.status(400).json({ error: '无效的图片ID' });
    }
    
    // 获取图片信息
    const imageResult = await pool.query('SELECT filepath FROM images WHERE id = $1', [imageId]);
    if (imageResult.rows.length === 0) {
      return res.status(404).json({ error: '图片不存在' });
    }
    
    const filepath = imageResult.rows[0].filepath;
    
    // 删除数据库记录
    await pool.query('DELETE FROM images WHERE id = $1', [imageId]);
    
    // 删除文件系统中的文件
    const fullPath = path.join(uploadDir, filepath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('删除图片错误:', error);
    res.status(500).json({ error: '删除图片失败', details: error.message });
  }
});
