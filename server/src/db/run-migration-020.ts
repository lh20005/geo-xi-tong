import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration020() {
  const client = await pool.connect();
  
  try {
    console.log('开始执行迁移 020: 将存储空间单位从 bytes 改为 MB...');
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'migrations', '020_update_storage_unit_to_mb.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行迁移
    await client.query(sql);
    
    console.log('✅ 迁移 020 执行成功！');
    
    // 显示更新后的存储空间配额
    const result = await client.query(`
      SELECT 
        sp.plan_name,
        sp.plan_code,
        pf.feature_name,
        pf.feature_value,
        pf.feature_unit,
        CASE 
          WHEN pf.feature_value = -1 THEN '无限制'
          ELSE pf.feature_value || ' ' || pf.feature_unit
        END as display_value
      FROM plan_features pf
      JOIN subscription_plans sp ON pf.plan_id = sp.id
      WHERE pf.feature_code = 'storage_space'
      ORDER BY sp.display_order
    `);
    
    console.log('\n更新后的存储空间配额:');
    console.table(result.rows);
    
  } catch (error) {
    console.error('❌ 迁移 020 执行失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行迁移
runMigration020().catch(console.error);
