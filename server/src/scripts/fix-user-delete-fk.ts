import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixForeignKeys() {
  const client = await pool.connect();
  try {
    console.log('开始修复外键约束...');
    
    // 1. 修复 commission_records 表的 invited_user_id 外键
    await client.query(`
      ALTER TABLE commission_records 
      DROP CONSTRAINT IF EXISTS commission_records_invited_user_id_fkey
    `);
    await client.query(`
      ALTER TABLE commission_records 
      ADD CONSTRAINT commission_records_invited_user_id_fkey 
      FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE
    `);
    console.log('✓ commission_records.invited_user_id 外键已修复');
    
    // 2. 修复 agent_audit_logs 表的 operator_id 外键
    await client.query(`
      ALTER TABLE agent_audit_logs 
      DROP CONSTRAINT IF EXISTS agent_audit_logs_operator_id_fkey
    `);
    await client.query(`
      ALTER TABLE agent_audit_logs 
      ADD CONSTRAINT agent_audit_logs_operator_id_fkey 
      FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log('✓ agent_audit_logs.operator_id 外键已修复');
    
    // 3. 修复 subscription_adjustments 表的 admin_id 外键
    await client.query(`
      ALTER TABLE subscription_adjustments 
      DROP CONSTRAINT IF EXISTS subscription_adjustments_admin_id_fkey
    `);
    await client.query(`
      ALTER TABLE subscription_adjustments 
      ADD CONSTRAINT subscription_adjustments_admin_id_fkey 
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log('✓ subscription_adjustments.admin_id 外键已修复');
    
    console.log('\n所有外键约束修复完成！');
  } catch (error: any) {
    console.error('修复失败:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixForeignKeys();
