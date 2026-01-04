import { pool } from '../db/database';

/**
 * 修复所有用户的存储同步问题
 * 
 * 问题：当用户首次上传文件时，如果存储事务记录失败或被跳过，
 * 会导致 user_storage_usage 表中的使用量与实际文件不一致。
 * 
 * 解决方案：扫描所有用户的实际文件，重新计算并同步存储使用量。
 */
async function fixAllUsersStorageSync() {
  console.log('=== 修复所有用户存储同步问题 ===\n');

  const client = await pool.connect();
  let fixedCount = 0;
  let errorCount = 0;
  
  try {
    // 获取所有有文件但存储记录不一致的用户
    const usersResult = await client.query(`
      SELECT DISTINCT u.id, u.username
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM albums a WHERE a.user_id = u.id
      ) OR EXISTS (
        SELECT 1 FROM knowledge_bases kb WHERE kb.user_id = u.id
      )
      ORDER BY u.id
    `);

    console.log(`找到 ${usersResult.rows.length} 个有文件的用户\n`);

    for (const user of usersResult.rows) {
      try {
        await client.query('BEGIN');

        // 计算实际图片使用量
        const imagesResult = await client.query(
          `SELECT 
            COUNT(*) as count,
            COALESCE(SUM(i.size), 0) as total_size
           FROM images i
           JOIN albums a ON i.album_id = a.id
           WHERE a.user_id = $1`,
          [user.id]
        );

        const imageCount = parseInt(imagesResult.rows[0].count);
        const imageTotalSize = Number(imagesResult.rows[0].total_size);

        // 计算实际文档使用量
        const docsResult = await client.query(
          `SELECT 
            COUNT(*) as count,
            COALESCE(SUM(kd.file_size), 0) as total_size
           FROM knowledge_documents kd
           JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id
           WHERE kb.user_id = $1`,
          [user.id]
        );

        const docCount = parseInt(docsResult.rows[0].count);
        const docTotalSize = Number(docsResult.rows[0].total_size);

        // 获取当前记录的使用量
        const currentResult = await client.query(
          `SELECT image_storage_bytes, document_storage_bytes, image_count, document_count
           FROM user_storage_usage
           WHERE user_id = $1`,
          [user.id]
        );

        if (currentResult.rows.length === 0) {
          // 初始化存储记录
          await client.query('SELECT initialize_user_storage($1)', [user.id]);
        }

        const current = currentResult.rows[0] || {
          image_storage_bytes: 0,
          document_storage_bytes: 0,
          image_count: 0,
          document_count: 0
        };

        // 检查是否需要修复
        const needsFix = 
          Number(current.image_storage_bytes) !== imageTotalSize ||
          Number(current.document_storage_bytes) !== docTotalSize ||
          current.image_count !== imageCount ||
          current.document_count !== docCount;

        if (needsFix) {
          console.log(`🔧 修复用户: ${user.username} (ID: ${user.id})`);
          console.log(`   图片: ${current.image_count} → ${imageCount} 个, ${current.image_storage_bytes} → ${imageTotalSize} bytes`);
          console.log(`   文档: ${current.document_count} → ${docCount} 个, ${current.document_storage_bytes} → ${docTotalSize} bytes`);

          // 更新存储使用记录
          await client.query(
            `UPDATE user_storage_usage
             SET 
               image_storage_bytes = $1,
               image_count = $2,
               document_storage_bytes = $3,
               document_count = $4,
               last_updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $5`,
            [imageTotalSize, imageCount, docTotalSize, docCount, user.id]
          );

          fixedCount++;
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ 修复用户 ${user.username} 失败:`, error);
        errorCount++;
      }
    }

    console.log('\n=== 修复完成 ===');
    console.log(`✅ 成功修复: ${fixedCount} 个用户`);
    if (errorCount > 0) {
      console.log(`❌ 失败: ${errorCount} 个用户`);
    }

  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

fixAllUsersStorageSync();
