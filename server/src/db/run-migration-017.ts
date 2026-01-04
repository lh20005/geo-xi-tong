import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('开始执行迁移 017: 添加存储空间管理系统...');
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'migrations', '017_add_storage_management.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行迁移
    await client.query(sql);
    
    console.log('✅ 迁移 017 执行成功！');
    
    // 验证表是否创建成功
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('user_storage_usage', 'storage_usage_history', 'storage_transactions')
      ORDER BY table_name
    `);
    
    console.log('\n已创建的表:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // 检查存储功能是否添加到套餐
    const features = await client.query(`
      SELECT sp.plan_name, pf.feature_name, pf.feature_value, pf.feature_unit
      FROM plan_features pf
      JOIN subscription_plans sp ON sp.id = pf.plan_id
      WHERE pf.feature_code = 'storage_space'
      ORDER BY sp.display_order
    `);
    
    console.log('\n套餐存储配额:');
    features.rows.forEach(row => {
      const value = row.feature_value === -1 
        ? '无限制' 
        : `${(row.feature_value / 1024 / 1024).toFixed(0)} MB`;
      console.log(`  - ${row.plan_name}: ${value}`);
    });
    
    // 检查用户存储记录初始化
    const userCount = await client.query(`
      SELECT COUNT(*) as count FROM user_storage_usage
    `);
    
    console.log(`\n已初始化 ${userCount.rows[0].count} 个用户的存储记录`);
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
