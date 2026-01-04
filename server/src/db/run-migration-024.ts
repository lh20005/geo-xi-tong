import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration024() {
  const client = await pool.connect();
  
  try {
    console.log('开始执行迁移 024: 添加企业图库和知识库配额支持...\n');
    
    // 读取迁移文件
    const migrationPath = path.join(__dirname, 'migrations', '024_add_gallery_knowledge_quotas.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // 执行迁移
    await client.query(migrationSQL);
    
    console.log('\n✅ 迁移 024 执行成功！');
    
    // 验证结果
    console.log('\n=== 验证迁移结果 ===\n');
    
    const albumQuotaResult = await client.query(`
      SELECT COUNT(*) as count FROM user_usage WHERE feature_code = 'gallery_albums'
    `);
    console.log(`相册配额记录数: ${albumQuotaResult.rows[0].count}`);
    
    const kbQuotaResult = await client.query(`
      SELECT COUNT(*) as count FROM user_usage WHERE feature_code = 'knowledge_bases'
    `);
    console.log(`知识库配额记录数: ${kbQuotaResult.rows[0].count}`);
    
    const albumRecordResult = await client.query(`
      SELECT COUNT(*) as count FROM usage_records WHERE feature_code = 'gallery_albums'
    `);
    console.log(`相册使用记录数: ${albumRecordResult.rows[0].count}`);
    
    const kbRecordResult = await client.query(`
      SELECT COUNT(*) as count FROM usage_records WHERE feature_code = 'knowledge_bases'
    `);
    console.log(`知识库使用记录数: ${kbRecordResult.rows[0].count}`);
    
    // 显示示例数据
    console.log('\n=== 示例数据 ===\n');
    
    const sampleResult = await client.query(`
      SELECT 
        u.username,
        uu.feature_code,
        uu.usage_count,
        (SELECT COUNT(*) FROM albums WHERE user_id = u.id) as actual_albums,
        (SELECT COUNT(*) FROM knowledge_bases WHERE user_id = u.id) as actual_kbs
      FROM user_usage uu
      JOIN users u ON uu.user_id = u.id
      WHERE uu.feature_code IN ('gallery_albums', 'knowledge_bases')
      ORDER BY u.username, uu.feature_code
      LIMIT 10
    `);
    
    sampleResult.rows.forEach(row => {
      console.log(`用户: ${row.username}`);
      console.log(`  功能: ${row.feature_code}`);
      console.log(`  记录使用量: ${row.usage_count}`);
      if (row.feature_code === 'gallery_albums') {
        console.log(`  实际相册数: ${row.actual_albums}`);
        console.log(`  一致性: ${row.usage_count === parseInt(row.actual_albums) ? '✅' : '❌'}`);
      } else {
        console.log(`  实际知识库数: ${row.actual_kbs}`);
        console.log(`  一致性: ${row.usage_count === parseInt(row.actual_kbs) ? '✅' : '❌'}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration024();
