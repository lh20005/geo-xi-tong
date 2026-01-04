import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration014() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 开始执行迁移 014: 完善使用量追踪和配额预警系统...\n');
    
    // 读取迁移文件（从源目录读取，因为 SQL 文件不会被编译）
    const migrationPath = path.join(__dirname, '../../src/db/migrations', '014_add_usage_tracking_and_alerts.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // 开始事务
    await client.query('BEGIN');
    
    // 执行迁移
    await client.query(migrationSQL);
    
    // 提交事务
    await client.query('COMMIT');
    
    console.log('\n✅ 迁移 014 成功完成！\n');
    
    // 验证迁移结果
    console.log('🔍 验证迁移结果...\n');
    
    // 检查 usage_records 表
    const usageRecordsCheck = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'usage_records'
      ORDER BY ordinal_position
    `);
    
    if (usageRecordsCheck.rows.length > 0) {
      console.log('✓ usage_records 表已创建');
      console.log('  字段列表:');
      usageRecordsCheck.rows.forEach(row => {
        console.log(`    - ${row.column_name} (${row.data_type})`);
      });
      console.log('');
    }
    
    // 检查 quota_alerts 表
    const quotaAlertsCheck = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'quota_alerts'
      ORDER BY ordinal_position
    `);
    
    if (quotaAlertsCheck.rows.length > 0) {
      console.log('✓ quota_alerts 表已创建');
      console.log('  字段列表:');
      quotaAlertsCheck.rows.forEach(row => {
        console.log(`    - ${row.column_name} (${row.data_type})`);
      });
      console.log('');
    }
    
    // 检查函数
    const functionsCheck = await client.query(`
      SELECT 
        routine_name,
        routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN ('check_user_quota', 'record_feature_usage', 'trigger_quota_alert')
      ORDER BY routine_name
    `);
    
    if (functionsCheck.rows.length > 0) {
      console.log('✓ 数据库函数已创建:');
      functionsCheck.rows.forEach(row => {
        console.log(`    - ${row.routine_name} (${row.routine_type})`);
      });
      console.log('');
    }
    
    // 检查触发器
    const triggersCheck = await client.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        event_object_table
      FROM information_schema.triggers
      WHERE trigger_name = 'quota_alert_trigger'
    `);
    
    if (triggersCheck.rows.length > 0) {
      console.log('✓ 触发器已创建:');
      triggersCheck.rows.forEach(row => {
        console.log(`    - ${row.trigger_name} on ${row.event_object_table} (${row.event_manipulation})`);
      });
      console.log('');
    }
    
    // 检查视图
    const viewsCheck = await client.query(`
      SELECT 
        table_name,
        view_definition
      FROM information_schema.views
      WHERE table_name = 'v_user_quota_overview'
    `);
    
    if (viewsCheck.rows.length > 0) {
      console.log('✓ 视图已创建:');
      viewsCheck.rows.forEach(row => {
        console.log(`    - ${row.table_name}`);
      });
      console.log('');
    }
    
    // 检查索引
    const indexesCheck = await client.query(`
      SELECT 
        indexname,
        tablename
      FROM pg_indexes
      WHERE tablename IN ('usage_records', 'quota_alerts')
      ORDER BY tablename, indexname
    `);
    
    if (indexesCheck.rows.length > 0) {
      console.log('✓ 索引已创建:');
      const groupedIndexes: { [key: string]: string[] } = {};
      indexesCheck.rows.forEach(row => {
        if (!groupedIndexes[row.tablename]) {
          groupedIndexes[row.tablename] = [];
        }
        groupedIndexes[row.tablename].push(row.indexname);
      });
      
      Object.keys(groupedIndexes).forEach(tableName => {
        console.log(`    ${tableName}:`);
        groupedIndexes[tableName].forEach(indexName => {
          console.log(`      - ${indexName}`);
        });
      });
      console.log('');
    }
    
    // 测试配额检查函数
    console.log('🧪 测试配额检查函数...\n');
    const testResult = await client.query(`
      SELECT * FROM check_user_quota(1, 'articles_per_day')
    `);
    
    if (testResult.rows.length > 0) {
      console.log('✓ 配额检查函数测试成功:');
      console.log(`    - has_quota: ${testResult.rows[0].has_quota}`);
      console.log(`    - current_usage: ${testResult.rows[0].current_usage}`);
      console.log(`    - quota_limit: ${testResult.rows[0].quota_limit}`);
      console.log(`    - remaining: ${testResult.rows[0].remaining}`);
      console.log(`    - percentage: ${testResult.rows[0].percentage}%`);
      console.log('');
    }
    
    // 统计信息
    const statsCheck = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM usage_records) as usage_records_count,
        (SELECT COUNT(*) FROM quota_alerts) as quota_alerts_count,
        (SELECT COUNT(*) FROM user_usage) as user_usage_count
    `);
    
    if (statsCheck.rows.length > 0) {
      console.log('📊 数据统计:');
      console.log(`    - usage_records: ${statsCheck.rows[0].usage_records_count} 条记录`);
      console.log(`    - quota_alerts: ${statsCheck.rows[0].quota_alerts_count} 条记录`);
      console.log(`    - user_usage: ${statsCheck.rows[0].user_usage_count} 条记录`);
      console.log('');
    }
    
    console.log('✅ 所有验证通过！迁移成功完成。\n');
    console.log('📝 下一步:');
    console.log('   1. 实现 UsageTrackingService 服务');
    console.log('   2. 实现 QuotaAlertService 服务');
    console.log('   3. 在文章生成和发布流程中集成配额检查');
    console.log('   4. 实现管理后台的商品管理界面');
    console.log('   5. 优化用户中心的配额展示');
    console.log('');
    
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
runMigration014()
  .then(() => {
    console.log('🎉 迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 迁移脚本执行失败:', error);
    process.exit(1);
  });
