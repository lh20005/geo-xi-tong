/**
 * 修复存储同步问题
 * 扫描所有图片和文档，确保存储使用记录正确
 */

import { pool } from '../db/database';

async function fixStorageSyncIssue() {
  console.log('=== 修复存储同步问题 ===\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 找出所有用户的实际图片使用量
    console.log('1. 扫描所有用户的实际图片使用量...');
    const imageUsageResult = await client.query(`
      SELECT 
        a.user_id,
        COUNT(i.id) as actual_image_count,
        COALESCE(SUM(i.size), 0) as actual_image_bytes
      FROM albums a
      LEFT JOIN images i ON a.id = i.album_id
      GROUP BY a.user_id
    `);

    // 2. 找出所有用户的实际文档使用量
    console.log('2. 扫描所有用户的实际文档使用量...');
    const documentUsageResult = await client.query(`
      SELECT 
        kb.user_id,
        COUNT(kd.id) as actual_document_count,
        COALESCE(SUM(kd.file_size), 0) as actual_document_bytes
      FROM knowledge_bases kb
      LEFT JOIN knowledge_documents kd ON kb.id = kd.knowledge_base_id
      GROUP BY kb.user_id
    `);

    // 3. 创建用户使用量映射
    const userUsage = new Map();

    for (const row of imageUsageResult.rows) {
      const userId = row.user_id;
      if (!userUsage.has(userId)) {
        userUsage.set(userId, {
          imageCount: 0,
          imageBytes: 0,
          documentCount: 0,
          documentBytes: 0
        });
      }
      userUsage.get(userId).imageCount = parseInt(row.actual_image_count);
      userUsage.get(userId).imageBytes = parseInt(row.actual_image_bytes);
    }

    for (const row of documentUsageResult.rows) {
      const userId = row.user_id;
      if (!userUsage.has(userId)) {
        userUsage.set(userId, {
          imageCount: 0,
          imageBytes: 0,
          documentCount: 0,
          documentBytes: 0
        });
      }
      userUsage.get(userId).documentCount = parseInt(row.actual_document_count);
      userUsage.get(userId).documentBytes = parseInt(row.actual_document_bytes);
    }

    // 4. 对比并修复每个用户的存储记录
    console.log('\n3. 对比并修复存储记录...\n');
    
    for (const [userId, actual] of userUsage.entries()) {
      // 获取当前记录的使用量
      const currentResult = await client.query(
        `SELECT 
          image_count,
          image_storage_bytes,
          document_count,
          document_storage_bytes
        FROM user_storage_usage
        WHERE user_id = $1`,
        [userId]
      );

      if (currentResult.rows.length === 0) {
        console.log(`用户 ${userId}: 没有存储记录，跳过`);
        continue;
      }

      const current = currentResult.rows[0];
      const currentImageCount = parseInt(current.image_count);
      const currentImageBytes = parseInt(current.image_storage_bytes);
      const currentDocumentCount = parseInt(current.document_count);
      const currentDocumentBytes = parseInt(current.document_storage_bytes);

      // 检查是否需要修复
      const needsFix = 
        currentImageCount !== actual.imageCount ||
        currentImageBytes !== actual.imageBytes ||
        currentDocumentCount !== actual.documentCount ||
        currentDocumentBytes !== actual.documentBytes;

      if (needsFix) {
        console.log(`用户 ${userId} 需要修复:`);
        console.log(`  图片: ${currentImageCount} 个 (${currentImageBytes} bytes) -> ${actual.imageCount} 个 (${actual.imageBytes} bytes)`);
        console.log(`  文档: ${currentDocumentCount} 个 (${currentDocumentBytes} bytes) -> ${actual.documentCount} 个 (${actual.documentBytes} bytes)`);

        // 直接更新存储使用记录
        await client.query(
          `UPDATE user_storage_usage
           SET 
             image_count = $1,
             image_storage_bytes = $2,
             document_count = $3,
             document_storage_bytes = $4,
             last_updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $5`,
          [
            actual.imageCount,
            actual.imageBytes,
            actual.documentCount,
            actual.documentBytes,
            userId
          ]
        );

        console.log(`  ✅ 已修复`);
      } else {
        console.log(`用户 ${userId}: ✅ 数据一致，无需修复`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ 所有用户的存储记录已修复');

    // 5. 验证修复结果
    console.log('\n4. 验证修复结果...\n');
    const verifyResult = await pool.query(`
      SELECT 
        u.id,
        u.username,
        s.image_count,
        s.image_storage_bytes,
        s.document_count,
        s.document_storage_bytes,
        s.total_storage_bytes,
        s.storage_quota_bytes,
        s.purchased_storage_bytes,
        (s.storage_quota_bytes + s.purchased_storage_bytes - s.total_storage_bytes) as available_bytes
      FROM users u
      JOIN user_storage_usage s ON u.id = s.user_id
      WHERE s.total_storage_bytes > 0
      ORDER BY u.id
    `);

    for (const row of verifyResult.rows) {
      console.log(`用户: ${row.username} (ID: ${row.id})`);
      console.log(`  图片: ${row.image_count} 个, ${row.image_storage_bytes} bytes`);
      console.log(`  文档: ${row.document_count} 个, ${row.document_storage_bytes} bytes`);
      console.log(`  总计: ${row.total_storage_bytes} bytes`);
      console.log(`  配额: ${row.storage_quota_bytes} + ${row.purchased_storage_bytes} bytes`);
      console.log(`  可用: ${row.available_bytes} bytes\n`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('修复失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixStorageSyncIssue();
