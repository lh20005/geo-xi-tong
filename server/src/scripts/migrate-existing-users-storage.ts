#!/usr/bin/env node
/**
 * 为现有用户迁移存储数据
 * 
 * 此脚本扫描所有现有用户，计算他们当前的存储使用量，
 * 并初始化存储跟踪记录
 */

import { pool } from '../db/database';
import { storageService } from '../services/StorageService';
import * as fs from 'fs';
import * as path from 'path';

interface UserStorageData {
  userId: number;
  username: string;
  imageCount: number;
  imageBytes: number;
  documentCount: number;
  documentBytes: number;
  articleCount: number;
  articleBytes: number;
  totalBytes: number;
  quotaBytes: number;
}

async function calculateUserStorage(userId: number): Promise<Omit<UserStorageData, 'userId' | 'username' | 'quotaBytes'>> {
  // 计算图片存储 - images 表使用 size 列，通过 album_id 关联
  const imageResult = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size
     FROM images
     WHERE album_id IN (
       SELECT id FROM albums WHERE user_id = $1
     )`,
    [userId]
  );

  // 计算文档存储 - knowledge_documents 表使用 file_size 列
  const documentResult = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size
     FROM knowledge_documents
     WHERE knowledge_base_id IN (SELECT id FROM knowledge_bases WHERE user_id = $1)`,
    [userId]
  );

  // 计算文章存储 - articles 表有 user_id 和 content
  const articleResult = await pool.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(LENGTH(content)), 0) as total_size
     FROM articles
     WHERE user_id = $1`,
    [userId]
  );

  const imageCount = parseInt(imageResult.rows[0].count);
  const imageBytes = parseInt(imageResult.rows[0].total_size);
  const documentCount = parseInt(documentResult.rows[0].count);
  const documentBytes = parseInt(documentResult.rows[0].total_size);
  const articleCount = parseInt(articleResult.rows[0].count);
  const articleBytes = parseInt(articleResult.rows[0].total_size);

  return {
    imageCount,
    imageBytes,
    documentCount,
    documentBytes,
    articleCount,
    articleBytes,
    totalBytes: imageBytes + documentBytes + articleBytes
  };
}

async function getUserQuota(userId: number, userRole: string): Promise<number> {
  // 管理员获得 1GB 存储
  if (userRole === 'admin') {
    return 1073741824; // 1GB in bytes
  }

  // 获取用户当前订阅的存储配额
  const result = await pool.query(
    `SELECT 
      COALESCE(pf.feature_value, 10485760) as quota_bytes
     FROM users u
     LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
     LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
     LEFT JOIN plan_features pf ON sp.id = pf.plan_id AND pf.feature_code = 'storage_space'
     WHERE u.id = $1
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return 10485760; // 默认 10MB
  }

  const quotaBytes = parseInt(result.rows[0].quota_bytes);
  return quotaBytes === -1 ? -1 : quotaBytes;
}

async function migrateExistingUsers() {
  console.log('[StorageMigration] 开始迁移现有用户存储数据...');
  
  try {
    // 获取所有用户
    const usersResult = await pool.query(
      'SELECT id, username, role FROM users ORDER BY id'
    );

    const users = usersResult.rows;
    console.log(`[StorageMigration] 找到 ${users.length} 个用户`);

    const migrationData: UserStorageData[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        console.log(`[StorageMigration] 处理用户: ${user.username} (ID: ${user.id})`);

        // 计算当前存储使用量
        const storageData = await calculateUserStorage(user.id);
        
        // 获取配额
        const quotaBytes = await getUserQuota(user.id, user.role);

        // 检查是否已存在记录
        const existingResult = await pool.query(
          'SELECT user_id FROM user_storage_usage WHERE user_id = $1',
          [user.id]
        );

        if (existingResult.rows.length > 0) {
          console.log(`  - 用户已有存储记录，更新数据...`);
          // 更新现有记录 - 不更新 total_storage_bytes，它是生成列
          await pool.query(
            `UPDATE user_storage_usage SET
              image_storage_bytes = $1,
              document_storage_bytes = $2,
              article_storage_bytes = $3,
              image_count = $4,
              document_count = $5,
              article_count = $6,
              storage_quota_bytes = $7,
              last_updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $8`,
            [
              storageData.imageBytes,
              storageData.documentBytes,
              storageData.articleBytes,
              storageData.imageCount,
              storageData.documentCount,
              storageData.articleCount,
              quotaBytes,
              user.id
            ]
          );
        } else {
          console.log(`  - 创建新存储记录...`);
          // 创建新记录 - 不插入 total_storage_bytes，它是生成列
          await pool.query(
            `INSERT INTO user_storage_usage (
              user_id, image_storage_bytes, document_storage_bytes, article_storage_bytes,
              image_count, document_count, article_count,
              storage_quota_bytes, purchased_storage_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
            [
              user.id,
              storageData.imageBytes,
              storageData.documentBytes,
              storageData.articleBytes,
              storageData.imageCount,
              storageData.documentCount,
              storageData.articleCount,
              quotaBytes
            ]
          );
        }

        migrationData.push({
          userId: user.id,
          username: user.username,
          ...storageData,
          quotaBytes
        });

        console.log(`  ✓ 成功: 图片=${storageData.imageCount}, 文档=${storageData.documentCount}, 文章=${storageData.articleCount}, 总计=${(storageData.totalBytes / 1024 / 1024).toFixed(2)}MB`);
        successCount++;
      } catch (error) {
        console.error(`  ✗ 用户 ${user.username} 迁移失败:`, error);
        errorCount++;
      }
    }

    // 生成报告
    console.log('\n[StorageMigration] 迁移完成!');
    console.log(`成功: ${successCount}, 失败: ${errorCount}`);
    console.log('\n存储使用统计:');
    
    const totalImages = migrationData.reduce((sum, d) => sum + d.imageCount, 0);
    const totalDocs = migrationData.reduce((sum, d) => sum + d.documentCount, 0);
    const totalArticles = migrationData.reduce((sum, d) => sum + d.articleCount, 0);
    const totalBytes = migrationData.reduce((sum, d) => sum + d.totalBytes, 0);

    console.log(`  总图片: ${totalImages}`);
    console.log(`  总文档: ${totalDocs}`);
    console.log(`  总文章: ${totalArticles}`);
    console.log(`  总存储: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

    // 保存详细报告
    const reportPath = path.join(__dirname, '../../migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(migrationData, null, 2));
    console.log(`\n详细报告已保存到: ${reportPath}`);

  } catch (error) {
    console.error('[StorageMigration] 迁移失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 运行脚本
migrateExistingUsers();
