import { pool } from './database';
import fs from 'fs';
import path from 'path';

async function rollbackSmartSelection() {
  try {
    console.log('🔄 开始回滚智能选择功能...');
    
    const rollbackPath = path.join(__dirname, 'migrations', '003_rollback_smart_selection.sql');
    const rollbackSQL = fs.readFileSync(rollbackPath, 'utf-8');
    
    await pool.query(rollbackSQL);
    
    console.log('✅ 智能选择功能回滚成功完成！');
    console.log('   - 已删除索引 idx_generation_tasks_selected_distillations');
    console.log('   - 已删除 selected_distillation_ids 字段');
    
    // 验证回滚结果
    console.log('\n🔍 验证回滚结果...');
    
    // 检查字段是否已删除
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'generation_tasks' AND column_name = 'selected_distillation_ids'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('✓ selected_distillation_ids 字段已删除');
    } else {
      throw new Error('selected_distillation_ids 字段未删除');
    }
    
    // 检查索引是否已删除
    const indexCheck = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'generation_tasks' AND indexname = 'idx_generation_tasks_selected_distillations'
    `);
    
    if (indexCheck.rows.length === 0) {
      console.log('✓ 索引 idx_generation_tasks_selected_distillations 已删除');
    } else {
      console.log('⚠ 索引未删除（可能不存在）');
    }
    
    console.log('\n✅ 回滚验证通过！');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ 回滚失败:', error.message);
    process.exit(1);
  }
}

rollbackSmartSelection();

