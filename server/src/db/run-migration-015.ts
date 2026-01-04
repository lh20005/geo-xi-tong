import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('开始执行迁移 015: 添加 duration_days 字段...');
    
    await client.query('BEGIN');
    
    // 读取并执行迁移 SQL
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '015_add_duration_days_to_plans.sql'),
      'utf8'
    );
    
    await client.query(migrationSQL);
    
    // 记录迁移
    await client.query(
      `INSERT INTO schema_migrations (version, name, executed_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (version) DO NOTHING`,
      ['015', 'add_duration_days_to_plans']
    );
    
    await client.query('COMMIT');
    
    console.log('✅ 迁移 015 执行成功！');
    console.log('已添加 duration_days 字段到 subscription_plans 表');
    
    // 验证字段是否添加成功
    const result = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'subscription_plans' 
      AND column_name = 'duration_days'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ 字段验证成功:', result.rows[0]);
    } else {
      console.log('⚠️  警告: 字段可能未正确添加');
    }
    
    // 显示现有套餐的 duration_days 值
    const plansResult = await client.query(`
      SELECT plan_code, plan_name, billing_cycle, duration_days 
      FROM subscription_plans 
      ORDER BY display_order
    `);
    
    console.log('\n现有套餐的有效期设置:');
    plansResult.rows.forEach(plan => {
      console.log(`  - ${plan.plan_name} (${plan.plan_code}): ${plan.duration_days}天 [${plan.billing_cycle}]`);
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
