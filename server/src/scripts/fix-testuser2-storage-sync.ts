import { pool } from '../db/database';

async function fixStorageSync() {
  console.log('=== 修复 testuser2 存储同步问题 ===\n');

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. 获取用户ID
    const userResult = await client.query(
      'SELECT id, username FROM users WHERE username = $1',
      ['testuser2']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }

    const userId = userResult.rows[0].id;
    console.log(`✅ 用户: ${userResult.rows[0].username} (ID: ${userId})\n`);

    // 2. 计算实际图片使用量
    const imagesResult = await client.query(
      `SELECT 
        i.id, i.filename, i.size, a.name as album_name
       FROM images i
       JOIN albums a ON i.album_id = a.id
       WHERE a.user_id = $1`,
      [userId]
    );

    const imageCount = imagesResult.rows.length;
    const imageTotalSize = imagesResult.rows.reduce((sum, img) => sum + Number(img.size), 0);

    console.log('📊 实际图片统计:');
    console.log(`   数量: ${imageCount}`);
    console.log(`   总大小: ${imageTotalSize} bytes`);
    if (imageCount > 0) {
      console.log('   文件列表:');
      imagesResult.rows.forEach(img => {
        console.log(`     - ${img.filename} (${img.size} bytes) - ${img.album_name}`);
      });
    }
    console.log();

    // 3. 计算实际文档使用量
    const docsResult = await client.query(
      `SELECT 
        kd.id, kd.filename, kd.file_size, kb.name as kb_name
       FROM knowledge_documents kd
       JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id
       WHERE kb.user_id = $1`,
      [userId]
    );

    const docCount = docsResult.rows.length;
    const docTotalSize = docsResult.rows.reduce((sum, doc) => sum + Number(doc.file_size || 0), 0);

    console.log('📚 实际文档统计:');
    console.log(`   数量: ${docCount}`);
    console.log(`   总大小: ${docTotalSize} bytes`);
    if (docCount > 0) {
      console.log('   文件列表:');
      docsResult.rows.forEach(doc => {
        console.log(`     - ${doc.filename} (${doc.file_size} bytes) - ${doc.kb_name}`);
      });
    }
    console.log();

    // 4. 更新存储使用记录（不更新 total_storage_bytes，它是生成列）
    const totalSize = imageTotalSize + docTotalSize;
    
    console.log('🔧 更新存储使用记录...');
    await client.query(
      `UPDATE user_storage_usage
       SET 
         image_storage_bytes = $1,
         image_count = $2,
         document_storage_bytes = $3,
         document_count = $4,
         last_updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $5`,
      [imageTotalSize, imageCount, docTotalSize, docCount, userId]
    );

    console.log('✅ 存储记录已更新');
    console.log(`   图片: ${imageCount} 个, ${imageTotalSize} bytes`);
    console.log(`   文档: ${docCount} 个, ${docTotalSize} bytes`);
    console.log(`   总计: ${totalSize} bytes\n`);

    // 5. 为每个图片创建存储事务记录（如果不存在）
    console.log('📝 创建存储事务记录...');
    for (const img of imagesResult.rows) {
      // 检查是否已有事务记录
      const txCheck = await client.query(
        `SELECT id FROM storage_transactions 
         WHERE user_id = $1 AND resource_type = 'image' AND resource_id = $2`,
        [userId, img.id]
      );

      if (txCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO storage_transactions 
           (user_id, resource_type, resource_id, operation, size_bytes, metadata)
           VALUES ($1, 'image', $2, 'add', $3, $4)`,
          [userId, img.id, img.size, JSON.stringify({
            filename: img.filename,
            albumName: img.album_name,
            retroactive: true
          })]
        );
        console.log(`   ✅ 创建图片事务: ${img.filename}`);
      }
    }

    // 6. 为每个文档创建存储事务记录（如果不存在）
    for (const doc of docsResult.rows) {
      const txCheck = await client.query(
        `SELECT id FROM storage_transactions 
         WHERE user_id = $1 AND resource_type = 'document' AND resource_id = $2`,
        [userId, doc.id]
      );

      if (txCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO storage_transactions 
           (user_id, resource_type, resource_id, operation, size_bytes, metadata)
           VALUES ($1, 'document', $2, 'add', $3, $4)`,
          [userId, doc.id, doc.file_size, JSON.stringify({
            filename: doc.filename,
            knowledgeBaseName: doc.kb_name,
            retroactive: true
          })]
        );
        console.log(`   ✅ 创建文档事务: ${doc.filename}`);
      }
    }

    await client.query('COMMIT');
    
    console.log('\n✅ 修复完成！');
    console.log('现在用户可以正常上传文件了。');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

fixStorageSync();
