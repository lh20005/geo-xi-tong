/**
 * 诊断存储上传问题
 * 检查为什么第二次上传会提示空间不足
 */

import { pool } from '../db/database';

async function diagnoseStorageIssue() {
  console.log('=== 存储上传问题诊断 ===\n');

  try {
    // 1. 检查所有用户的存储使用情况
    console.log('1. 检查所有用户的存储使用情况:');
    const usersResult = await pool.query(`
      SELECT 
        u.id,
        u.username,
        s.image_storage_bytes,
        s.document_storage_bytes,
        s.article_storage_bytes,
        s.total_storage_bytes,
        s.image_count,
        s.document_count,
        s.article_count,
        s.storage_quota_bytes,
        s.purchased_storage_bytes,
        (s.storage_quota_bytes + s.purchased_storage_bytes) as effective_quota,
        s.last_updated_at
      FROM users u
      LEFT JOIN user_storage_usage s ON u.id = s.user_id
      ORDER BY u.id
    `);

    for (const user of usersResult.rows) {
      console.log(`\n用户: ${user.username} (ID: ${user.id})`);
      if (!user.image_storage_bytes && user.image_storage_bytes !== 0) {
        console.log('  ❌ 没有存储记录');
        continue;
      }

      const calculated = Number(user.image_storage_bytes) + 
                        Number(user.document_storage_bytes) + 
                        Number(user.article_storage_bytes);
      const stored = Number(user.total_storage_bytes);
      const effectiveQuota = Number(user.effective_quota);
      const available = effectiveQuota - stored;

      console.log(`  图片: ${user.image_storage_bytes} bytes (${user.image_count} 个)`);
      console.log(`  文档: ${user.document_storage_bytes} bytes (${user.document_count} 个)`);
      console.log(`  文章: ${user.article_storage_bytes} bytes (${user.article_count} 个)`);
      console.log(`  计算总和: ${calculated} bytes`);
      console.log(`  存储总和: ${stored} bytes`);
      console.log(`  配额: ${user.storage_quota_bytes} + ${user.purchased_storage_bytes} = ${effectiveQuota} bytes`);
      console.log(`  可用: ${available} bytes`);
      console.log(`  最后更新: ${user.last_updated_at}`);

      if (calculated !== stored) {
        console.log(`  ⚠️  不一致! 计算值 (${calculated}) != 存储值 (${stored})`);
      } else {
        console.log(`  ✅ 一致`);
      }
    }

    // 2. 检查最近的存储事务
    console.log('\n\n2. 检查最近的存储事务:');
    const transactionsResult = await pool.query(`
      SELECT 
        t.id,
        t.user_id,
        u.username,
        t.resource_type,
        t.resource_id,
        t.operation,
        t.size_bytes,
        t.created_at
      FROM storage_transactions t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 20
    `);

    for (const tx of transactionsResult.rows) {
      console.log(`\n事务 #${tx.id}:`);
      console.log(`  用户: ${tx.username} (ID: ${tx.user_id})`);
      console.log(`  类型: ${tx.resource_type}`);
      console.log(`  资源ID: ${tx.resource_id}`);
      console.log(`  操作: ${tx.operation}`);
      console.log(`  大小: ${tx.size_bytes} bytes`);
      console.log(`  时间: ${tx.created_at}`);
    }

    // 3. 检查图片记录
    console.log('\n\n3. 检查图片记录:');
    const imagesResult = await pool.query(`
      SELECT 
        i.id,
        i.album_id,
        a.user_id,
        u.username,
        i.filename,
        i.size,
        i.created_at
      FROM images i
      JOIN albums a ON i.album_id = a.id
      JOIN users u ON a.user_id = u.id
      ORDER BY i.created_at DESC
      LIMIT 10
    `);

    for (const img of imagesResult.rows) {
      console.log(`\n图片 #${img.id}:`);
      console.log(`  用户: ${img.username} (ID: ${img.user_id})`);
      console.log(`  相册: ${img.album_id}`);
      console.log(`  文件名: ${img.filename}`);
      console.log(`  大小: ${img.size} bytes`);
      console.log(`  创建时间: ${img.created_at}`);
    }

    // 4. 检查 PostgreSQL 版本和 GENERATED ALWAYS 支持
    console.log('\n\n4. 检查 PostgreSQL 版本:');
    const versionResult = await pool.query('SELECT version()');
    console.log(versionResult.rows[0].version);

    // 5. 测试 GENERATED ALWAYS 列是否正常工作
    console.log('\n\n5. 测试 GENERATED ALWAYS 列:');
    const testResult = await pool.query(`
      SELECT 
        user_id,
        image_storage_bytes,
        document_storage_bytes,
        article_storage_bytes,
        total_storage_bytes,
        (image_storage_bytes + document_storage_bytes + article_storage_bytes) as manual_calculation
      FROM user_storage_usage
      WHERE total_storage_bytes != (image_storage_bytes + document_storage_bytes + article_storage_bytes)
    `);

    if (testResult.rows.length > 0) {
      console.log('⚠️  发现不一致的记录:');
      for (const row of testResult.rows) {
        console.log(`  用户 ${row.user_id}:`);
        console.log(`    存储的 total: ${row.total_storage_bytes}`);
        console.log(`    手动计算: ${row.manual_calculation}`);
      }
    } else {
      console.log('✅ 所有记录的 total_storage_bytes 都与计算值一致');
    }

    // 6. 检查是否有缓存问题
    console.log('\n\n6. 检查 Redis 缓存:');
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    const keys = await redis.keys('storage:user:*');
    console.log(`找到 ${keys.length} 个缓存键`);
    
    for (const key of keys) {
      const value = await redis.get(key);
      if (value) {
        const data = JSON.parse(value);
        console.log(`\n${key}:`);
        console.log(`  totalStorageBytes: ${data.totalStorageBytes}`);
        console.log(`  storageQuotaBytes: ${data.storageQuotaBytes}`);
        console.log(`  availableBytes: ${data.availableBytes}`);
      }
    }

    await redis.quit();

  } catch (error) {
    console.error('诊断失败:', error);
  } finally {
    await pool.end();
  }
}

diagnoseStorageIssue();
