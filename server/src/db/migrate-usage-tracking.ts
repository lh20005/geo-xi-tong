import { pool } from './database';
import fs from 'fs';
import path from 'path';

async function migrateUsageTracking() {
  try {
    console.log('🔄 开始执行使用追踪功能迁移...');
    
    const migrationPath = path.join(__dirname, 'migrations', '002_add_usage_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ 使用追踪功能迁移成功完成！');
    console.log('   - 已添加 usage_count 字段到 distillations 表');
    console.log('   - 已创建 distillation_usage 表');
    console.log('   - 已创建所有必要的索引');
    console.log('   - 已为现有蒸馏结果初始化 usage_count');
    console.log('   - 已根据现有文章记录重新计算 usage_count');
    
    // 验证迁移结果
    console.log('\n🔍 验证迁移结果...');
    
    // 检查usage_count字段
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'distillations' AND column_name = 'usage_count'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('   ✓ usage_count 字段已成功添加');
    } else {
      console.log('   ✗ usage_count 字段未找到');
    }
    
    // 检查distillation_usage表
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_name = 'distillation_usage'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('   ✓ distillation_usage 表已成功创建');
    } else {
      console.log('   ✗ distillation_usage 表未找到');
    }
    
    // 检查索引
    const indexCheck = await pool.query(`
      SELECT indexname 
      FROM pg_indexes
      WHERE tablename IN ('distillations', 'distillation_usage')
      AND indexname LIKE '%usage%'
    `);
    
    console.log(`   ✓ 已创建 ${indexCheck.rows.length} 个索引`);
    
    // 检查数据一致性
    const consistencyCheck = await pool.query(`
      SELECT d.id, d.keyword, d.usage_count, COUNT(a.id) as actual_count
      FROM distillations d
      LEFT JOIN articles a ON d.id = a.distillation_id
      GROUP BY d.id, d.keyword, d.usage_count
      HAVING d.usage_count != COUNT(a.id)
    `);
    
    if (consistencyCheck.rows.length === 0) {
      console.log('   ✓ 数据一致性检查通过');
    } else {
      console.log(`   ⚠ 发现 ${consistencyCheck.rows.length} 条数据不一致`);
      console.log('   提示：可以使用修复工具重新计算');
    }
    
    console.log('\n✅ 迁移验证完成！');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ 数据库迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrateUsageTracking();
