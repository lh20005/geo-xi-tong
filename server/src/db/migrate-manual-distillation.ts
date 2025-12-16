import { pool } from './database';

/**
 * 执行手动蒸馏结果支持迁移
 */
async function migrateManualDistillation() {
  const client = await pool.connect();
  
  try {
    console.log('开始执行手动蒸馏结果支持迁移...');
    
    await client.query('BEGIN');
    
    // 1. 删除旧的CHECK约束（如果存在）
    console.log('步骤1: 删除旧的provider约束...');
    await client.query(`
      ALTER TABLE distillations DROP CONSTRAINT IF EXISTS distillations_provider_check
    `);
    console.log('✓ 旧约束已删除');
    
    // 2. 添加新的CHECK约束，允许'manual'值
    console.log('步骤2: 添加新的provider约束...');
    await client.query(`
      ALTER TABLE distillations 
      ADD CONSTRAINT distillations_provider_check 
      CHECK (provider IN ('deepseek', 'gemini', 'ollama', 'manual'))
    `);
    console.log('✓ 新约束已添加');
    
    // 3. 为provider字段创建索引（如果不存在）
    console.log('步骤3: 创建provider索引...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_distillations_provider ON distillations(provider)
    `);
    console.log('✓ 索引已创建');
    
    await client.query('COMMIT');
    
    console.log('✓ 手动蒸馏结果支持迁移完成');
    
    // 验证迁移
    const result = await client.query(`
      SELECT constraint_name, check_clause 
      FROM information_schema.check_constraints 
      WHERE constraint_name = 'distillations_provider_check'
    `);
    
    if (result.rows.length > 0) {
      console.log('✓ 验证成功：provider约束已更新');
      console.log('  约束内容:', result.rows[0].check_clause);
    } else {
      console.log('⚠ 警告：未找到provider约束');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行迁移
migrateManualDistillation()
  .then(() => {
    console.log('迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  });
