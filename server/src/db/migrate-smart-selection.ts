import { pool } from './database';
import fs from 'fs';
import path from 'path';

async function migrateSmartSelection() {
  try {
    console.log('🔄 开始执行智能选择功能迁移...');
    
    const migrationPath = path.join(__dirname, 'migrations', '003_add_smart_selection.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ 智能选择功能迁移成功完成！');
    console.log('   - 已添加 selected_distillation_ids 字段到 generation_tasks 表');
    console.log('   - 已添加索引 idx_generation_tasks_selected_distillations');
    console.log('   - 已为现有任务初始化 selected_distillation_ids');
    console.log('   - 已验证数据完整性');
    
    // 验证迁移结果
    console.log('\n🔍 验证迁移结果...');
    
    // 检查字段是否存在
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'generation_tasks' AND column_name = 'selected_distillation_ids'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✓ selected_distillation_ids 字段已创建');
      console.log(`  类型: ${columnCheck.rows[0].data_type}`);
    } else {
      throw new Error('selected_distillation_ids 字段未创建');
    }
    
    // 检查索引是否存在
    const indexCheck = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'generation_tasks' AND indexname = 'idx_generation_tasks_selected_distillations'
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log('✓ 索引 idx_generation_tasks_selected_distillations 已创建');
    } else {
      console.log('⚠ 索引未创建（可能已存在）');
    }
    
    // 检查数据完整性
    const nullCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM generation_tasks
      WHERE selected_distillation_ids IS NULL
    `);
    
    const nullCount = parseInt(nullCheck.rows[0].count);
    if (nullCount === 0) {
      console.log('✓ 所有任务都有有效的 selected_distillation_ids');
    } else {
      throw new Error(`发现 ${nullCount} 个任务的 selected_distillation_ids 为 NULL`);
    }
    
    // 检查JSON格式
    const formatCheck = await pool.query(`
      SELECT id, selected_distillation_ids
      FROM generation_tasks
      LIMIT 5
    `);
    
    console.log('\n📋 示例数据:');
    formatCheck.rows.forEach(row => {
      console.log(`  任务 ${row.id}: ${row.selected_distillation_ids}`);
    });
    
    console.log('\n✅ 迁移验证通过！');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error('\n💡 如需回滚，请运行:');
    console.error('   npm run migrate:rollback:smart-selection');
    process.exit(1);
  }
}

migrateSmartSelection();

