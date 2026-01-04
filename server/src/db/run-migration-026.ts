import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration026() {
  const client = await pool.connect();
  
  try {
    console.log('开始执行迁移 026: 更新 check_user_quota 函数...\n');
    
    // 读取迁移文件
    const migrationPath = path.join(__dirname, 'migrations', '026_update_check_user_quota_for_gallery_knowledge.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // 执行迁移
    await client.query(migrationSQL);
    
    console.log('\n✅ 迁移 026 执行成功！');
    
    // 测试函数
    console.log('\n=== 测试更新后的函数 ===\n');
    
    // 测试 check_user_quota
    const testResult = await client.query(`
      SELECT * FROM check_user_quota(1, 'gallery_albums')
    `);
    
    console.log('测试 check_user_quota(1, gallery_albums):');
    console.log('  配额限制:', testResult.rows[0].quota_limit);
    console.log('  当前使用:', testResult.rows[0].current_usage);
    console.log('  剩余配额:', testResult.rows[0].remaining);
    console.log('  有配额:', testResult.rows[0].has_quota);
    console.log('  使用百分比:', testResult.rows[0].percentage + '%');
    
    const testResult2 = await client.query(`
      SELECT * FROM check_user_quota(1, 'knowledge_bases')
    `);
    
    console.log('\n测试 check_user_quota(1, knowledge_bases):');
    console.log('  配额限制:', testResult2.rows[0].quota_limit);
    console.log('  当前使用:', testResult2.rows[0].current_usage);
    console.log('  剩余配额:', testResult2.rows[0].remaining);
    console.log('  有配额:', testResult2.rows[0].has_quota);
    console.log('  使用百分比:', testResult2.rows[0].percentage + '%');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration026();
