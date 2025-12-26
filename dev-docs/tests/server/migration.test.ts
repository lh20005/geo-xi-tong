/**
 * 数据库迁移测试
 * 测试迁移脚本可以成功执行和回滚
 */

import { pool } from '../../database';
import fs from 'fs';
import path from 'path';

describe('Database Migration Tests', () => {
  const migrationPath = path.join(__dirname, '../001_create_security_tables.sql');
  const rollbackPath = path.join(__dirname, '../rollback_001.sql');

  // 测试前清理
  beforeAll(async () => {
    const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');
    await pool.query(rollbackSql);
  });

  // 测试后清理
  afterAll(async () => {
    await pool.end();
  });

  test('迁移脚本可以成功执行', async () => {
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // 执行迁移不应抛出错误
    await expect(pool.query(migrationSql)).resolves.not.toThrow();
  });

  test('所有表都正确创建', async () => {
    const tables = ['audit_logs', 'security_events', 'config_history', 'password_history', 'login_attempts'];
    
    for (const tableName of tables) {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [tableName]
      );
      
      expect(result.rows[0].exists).toBe(true);
    }
  });

  test('所有索引都正确创建', async () => {
    const indexes = [
      'idx_audit_admin_id',
      'idx_audit_action',
      'idx_audit_created_at',
      'idx_security_type',
      'idx_security_severity',
      'idx_config_key',
      'idx_password_history_user_id',
      'idx_login_attempts_username'
    ];
    
    for (const indexName of indexes) {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname = $1
        )`,
        [indexName]
      );
      
      expect(result.rows[0].exists).toBe(true);
    }
  });

  test('refresh_tokens表增强字段已添加', async () => {
    const columns = ['ip_address', 'user_agent', 'last_used_at'];
    
    for (const columnName of columns) {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'refresh_tokens'
          AND column_name = $1
        )`,
        [columnName]
      );
      
      expect(result.rows[0].exists).toBe(true);
    }
  });

  test('回滚脚本可以成功执行', async () => {
    const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');
    
    // 执行回滚不应抛出错误
    await expect(pool.query(rollbackSql)).resolves.not.toThrow();
    
    // 验证表已删除
    const tables = ['audit_logs', 'security_events', 'config_history', 'password_history', 'login_attempts'];
    
    for (const tableName of tables) {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [tableName]
      );
      
      expect(result.rows[0].exists).toBe(false);
    }
  });
});
