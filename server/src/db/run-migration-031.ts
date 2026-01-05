import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('开始执行迁移 031: 订阅周期配额重置系统...\n');
    
    // 读取迁移文件
    const migrationPath = path.join(__dirname, 'migrations', '031_subscription_cycle_quota_reset.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // 执行迁移
    await client.query(migrationSQL);
    
    console.log('\n✅ 迁移 031 执行成功！');
    console.log('\n配额重置系统已升级为订阅周期模式：');
    console.log('- 月度套餐：配额在每月订阅日重置');
    console.log('- 年度套餐：配额在每年订阅日重置');
    console.log('- 每个用户有独立的重置周期');
    
    // 验证迁移结果
    console.log('\n验证迁移结果...');
    
    // 检查字段是否添加成功
    const columnsResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_subscriptions'
        AND column_name IN ('quota_reset_anchor', 'quota_cycle_type')
      ORDER BY column_name
    `);
    
    console.log('\n新增字段：');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // 检查函数是否创建成功
    const functionsResult = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN (
          'get_user_quota_period',
          'get_next_quota_reset_time',
          'get_quota_reset_description',
          'set_quota_cycle_on_subscription'
        )
      ORDER BY routine_name
    `);
    
    console.log('\n新增函数：');
    functionsResult.rows.forEach(row => {
      console.log(`  - ${row.routine_name} (${row.routine_type})`);
    });
    
    // 检查触发器是否创建成功
    const triggersResult = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name = 'trigger_set_quota_cycle'
    `);
    
    console.log('\n新增触发器：');
    triggersResult.rows.forEach(row => {
      console.log(`  - ${row.trigger_name} on ${row.event_object_table}`);
    });
    
    // 显示现有用户的配额周期信息
    const usersResult = await client.query(`
      SELECT 
        u.username,
        sp.plan_name,
        sp.billing_cycle,
        us.quota_cycle_type,
        us.quota_reset_anchor,
        get_quota_reset_description(u.id) as reset_description,
        get_next_quota_reset_time(u.id) as next_reset_time
      FROM users u
      JOIN user_subscriptions us ON us.user_id = u.id
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE us.status = 'active'
        AND us.end_date > CURRENT_TIMESTAMP
      ORDER BY u.username
      LIMIT 10
    `);
    
    if (usersResult.rows.length > 0) {
      console.log('\n现有用户配额周期（前10个）：');
      usersResult.rows.forEach(row => {
        console.log(`\n  用户: ${row.username}`);
        console.log(`  套餐: ${row.plan_name} (${row.billing_cycle})`);
        console.log(`  配额周期: ${row.quota_cycle_type}`);
        console.log(`  重置锚点: ${row.quota_reset_anchor}`);
        console.log(`  重置规则: ${row.reset_description}`);
        console.log(`  下次重置: ${row.next_reset_time}`);
      });
    } else {
      console.log('\n当前没有活跃用户订阅');
    }
    
    console.log('\n✅ 验证完成！');
    
  } catch (error) {
    console.error('❌ 迁移执行失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行迁移
runMigration().catch(error => {
  console.error('迁移脚本执行失败:', error);
  process.exit(1);
});
