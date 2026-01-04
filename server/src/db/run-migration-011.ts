import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 运行迁移 011：为 publishing_records 表添加 user_id 字段
 * 这是一个关键的安全修复，确保用户数据隔离
 */
async function runMigration011() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 开始执行迁移 011：添加 user_id 到 publishing_records...\n');
    
    // 读取迁移文件
    const migrationPath = path.join(__dirname, 'migrations', '011_add_user_id_to_publishing_records.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // 执行迁移
    await client.query('BEGIN');
    
    console.log('1️⃣  添加 user_id 字段...');
    await client.query(`
      ALTER TABLE publishing_records 
      ADD COLUMN IF NOT EXISTS user_id INTEGER
    `);
    
    console.log('2️⃣  从 articles 表填充 user_id...');
    const result1 = await client.query(`
      UPDATE publishing_records pr
      SET user_id = a.user_id
      FROM articles a
      WHERE pr.article_id = a.id
      AND pr.user_id IS NULL
    `);
    console.log(`   ✅ 更新了 ${result1.rowCount} 条记录`);
    
    console.log('3️⃣  从 platform_accounts 表填充剩余的 user_id...');
    const result2 = await client.query(`
      UPDATE publishing_records pr
      SET user_id = pa.user_id
      FROM platform_accounts pa
      WHERE pr.account_id = pa.id
      AND pr.user_id IS NULL
    `);
    console.log(`   ✅ 更新了 ${result2.rowCount} 条记录`);
    
    // 检查是否还有 NULL 值
    const nullCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM publishing_records 
      WHERE user_id IS NULL
    `);
    
    if (parseInt(nullCheck.rows[0].count) > 0) {
      console.log(`⚠️  警告：仍有 ${nullCheck.rows[0].count} 条记录的 user_id 为 NULL`);
      console.log('   这些记录可能是孤立数据，将被删除...');
      
      const deleteResult = await client.query(`
        DELETE FROM publishing_records 
        WHERE user_id IS NULL
      `);
      console.log(`   ✅ 删除了 ${deleteResult.rowCount} 条孤立记录`);
    }
    
    console.log('4️⃣  设置 user_id 为 NOT NULL...');
    await client.query(`
      ALTER TABLE publishing_records 
      ALTER COLUMN user_id SET NOT NULL
    `);
    
    console.log('5️⃣  添加外键约束...');
    await client.query(`
      ALTER TABLE publishing_records 
      DROP CONSTRAINT IF EXISTS fk_publishing_records_user
    `);
    await client.query(`
      ALTER TABLE publishing_records 
      ADD CONSTRAINT fk_publishing_records_user 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    `);
    
    console.log('6️⃣  创建索引...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_publishing_records_user_id 
      ON publishing_records(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_publishing_records_user_platform 
      ON publishing_records(user_id, platform_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_publishing_records_user_article 
      ON publishing_records(user_id, article_id)
    `);
    
    await client.query('COMMIT');
    
    console.log('\n✅ 迁移 011 执行成功！');
    console.log('📊 publishing_records 表现在已经支持用户隔离');
    
    // 验证迁移
    console.log('\n🔍 验证迁移结果...');
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT user_id) as unique_users
      FROM publishing_records
    `);
    
    console.log(`   总记录数: ${verifyResult.rows[0].total_records}`);
    console.log(`   涉及用户数: ${verifyResult.rows[0].unique_users}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行迁移
runMigration011().catch(error => {
  console.error('执行迁移时发生错误:', error);
  process.exit(1);
});
