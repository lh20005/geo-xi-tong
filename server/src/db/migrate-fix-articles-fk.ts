import { pool } from './database';

/**
 * 修复articles表的distillation_id外键约束
 * 添加ON DELETE SET NULL，允许删除被文章引用的distillation记录
 */
async function migrateFixArticlesFk() {
  const client = await pool.connect();
  
  try {
    console.log('开始修复articles表的distillation_id外键约束...');
    
    await client.query('BEGIN');
    
    // 1. 查找现有的外键约束
    console.log('步骤1: 查找现有的外键约束...');
    const constraintResult = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'articles'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%distillation%'
    `);
    
    if (constraintResult.rows.length > 0) {
      const constraintName = constraintResult.rows[0].constraint_name;
      console.log(`✓ 找到约束: ${constraintName}`);
      
      // 2. 删除旧的外键约束
      console.log('步骤2: 删除旧的外键约束...');
      await client.query(`ALTER TABLE articles DROP CONSTRAINT ${constraintName}`);
      console.log('✓ 旧约束已删除');
    } else {
      console.log('⚠ 未找到现有约束，可能是首次运行');
    }
    
    // 3. 添加新的外键约束，带ON DELETE SET NULL
    console.log('步骤3: 添加新的外键约束...');
    await client.query(`
      ALTER TABLE articles 
      ADD CONSTRAINT articles_distillation_id_fkey 
      FOREIGN KEY (distillation_id) 
      REFERENCES distillations(id) 
      ON DELETE SET NULL
    `);
    console.log('✓ 新约束已添加');
    
    await client.query('COMMIT');
    
    console.log('✓ articles表的distillation_id外键约束修复完成');
    
    // 验证迁移
    const verifyResult = await client.query(`
      SELECT 
        tc.constraint_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc 
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.table_name = 'articles'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name LIKE '%distillation%'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✓ 验证成功：');
      console.log(`  约束名称: ${verifyResult.rows[0].constraint_name}`);
      console.log(`  删除规则: ${verifyResult.rows[0].delete_rule}`);
      
      if (verifyResult.rows[0].delete_rule === 'SET NULL') {
        console.log('✓ 删除规则正确设置为 SET NULL');
      } else {
        console.log(`⚠ 警告：删除规则为 ${verifyResult.rows[0].delete_rule}，预期为 SET NULL`);
      }
    } else {
      console.log('⚠ 警告：未找到外键约束');
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
migrateFixArticlesFk()
  .then(() => {
    console.log('迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  });
