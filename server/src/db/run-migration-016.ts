import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('开始执行迁移 016: 将每日配额改为每月配额...');
    
    await client.query('BEGIN');
    
    // 读取并执行迁移 SQL
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '016_change_daily_to_monthly_quotas.sql'),
      'utf8'
    );
    
    await client.query(migrationSQL);
    
    // 记录迁移
    await client.query(
      `INSERT INTO schema_migrations (version, name, executed_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (version) DO NOTHING`,
      ['016', 'change_daily_to_monthly_quotas']
    );
    
    await client.query('COMMIT');
    
    console.log('✅ 迁移 016 执行成功！');
    console.log('已将每日配额改为每月配额');
    
    // 验证更新结果
    const result = await client.query(`
      SELECT 
        feature_code, 
        feature_name, 
        COUNT(*) as count,
        SUM(feature_value) as total_value
      FROM plan_features 
      WHERE feature_code IN ('articles_per_month', 'publish_per_month')
      GROUP BY feature_code, feature_name
      ORDER BY feature_code
    `);
    
    console.log('\n更新后的功能配额:');
    result.rows.forEach(row => {
      console.log(`  - ${row.feature_name} (${row.feature_code}): ${row.count}个套餐, 总配额值: ${row.total_value}`);
    });
    
    // 显示各套餐的新配额
    const plansResult = await client.query(`
      SELECT 
        sp.plan_name,
        pf.feature_code,
        pf.feature_name,
        pf.feature_value,
        pf.feature_unit
      FROM plan_features pf
      JOIN subscription_plans sp ON sp.id = pf.plan_id
      WHERE pf.feature_code IN ('articles_per_month', 'publish_per_month')
      ORDER BY sp.display_order, pf.feature_code
    `);
    
    console.log('\n各套餐的每月配额:');
    let currentPlan = '';
    plansResult.rows.forEach(row => {
      if (row.plan_name !== currentPlan) {
        console.log(`\n${row.plan_name}:`);
        currentPlan = row.plan_name;
      }
      const value = row.feature_value === -1 ? '不限' : `${row.feature_value}${row.feature_unit}`;
      console.log(`  - ${row.feature_name}: ${value}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
