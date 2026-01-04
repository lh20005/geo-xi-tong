import { pool } from '../db/database';

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_usage' 
      ORDER BY ordinal_position
    `);
    
    console.log('user_usage 表结构:');
    result.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
