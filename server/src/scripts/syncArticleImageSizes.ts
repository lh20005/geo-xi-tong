/**
 * 同步文章图片大小脚本
 * 从文件系统读取实际图片大小，更新到 articles.image_size_bytes
 */

import { pool } from '../db/database';
import * as fs from 'fs';
import * as path from 'path';

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

async function syncArticleImageSizes() {
  console.log('[同步] 开始同步文章图片大小...');
  
  try {
    // 获取所有有图片但 image_size_bytes 为 0 的文章
    const result = await pool.query(`
      SELECT id, image_url 
      FROM articles 
      WHERE image_url IS NOT NULL 
        AND image_url != '' 
        AND image_size_bytes = 0
    `);
    
    console.log(`[同步] 找到 ${result.rows.length} 篇需要更新的文章`);
    
    let updated = 0;
    let notFound = 0;
    
    for (const row of result.rows) {
      const imageUrl = row.image_url;
      const filePath = path.join(UPLOAD_DIR, imageUrl);
      
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          const sizeBytes = stats.size;
          
          await pool.query(
            'UPDATE articles SET image_size_bytes = $1 WHERE id = $2',
            [sizeBytes, row.id]
          );
          
          updated++;
          console.log(`[同步] 文章 ${row.id}: ${sizeBytes} 字节`);
        } else {
          notFound++;
          console.log(`[同步] 文章 ${row.id}: 文件不存在 - ${imageUrl}`);
        }
      } catch (err: any) {
        console.error(`[同步] 文章 ${row.id} 处理失败:`, err.message);
      }
    }
    
    console.log(`[同步] 完成！更新 ${updated} 篇，文件不存在 ${notFound} 篇`);
    
    // 同步用户存储使用
    console.log('[同步] 同步用户存储使用...');
    const users = await pool.query('SELECT DISTINCT user_id FROM articles WHERE image_size_bytes > 0');
    
    for (const user of users.rows) {
      await pool.query('SELECT sync_user_storage_usage($1)', [user.user_id]);
      console.log(`[同步] 用户 ${user.user_id} 存储已同步`);
    }
    
    console.log('[同步] 全部完成！');
    
  } catch (error) {
    console.error('[同步] 错误:', error);
  } finally {
    await pool.end();
  }
}

// 运行脚本
syncArticleImageSizes();
