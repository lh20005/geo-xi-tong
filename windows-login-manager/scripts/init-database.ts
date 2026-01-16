import { PostgresDatabase } from '../electron/database/postgres';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 数据库初始化脚本
 * 
 * 功能：
 * 1. 连接到 PostgreSQL 数据库
 * 2. 导入函数定义
 * 3. 导入表结构
 * 4. 验证数据库结构
 */

async function initDatabase() {
  const db = PostgresDatabase.getInstance();

  try {
    console.log('🚀 开始初始化数据库...\n');

    // 1. 初始化数据库连接
    console.log('📡 连接到数据库...');
    await db.initialize();
    console.log('✅ 数据库连接成功\n');

    const pool = db.getPool();

    // 2. 导入函数
    console.log('📦 导入函数定义...');
    const functionsPath = path.join(__dirname, '../../backups/migration-2026-01-16/windows_functions_clean.sql');
    
    if (!fs.existsSync(functionsPath)) {
      throw new Error(`函数文件不存在: ${functionsPath}`);
    }

    const functionsSQL = fs.readFileSync(functionsPath, 'utf-8');
    await pool.query(functionsSQL);
    console.log('✅ 函数导入完成\n');

    // 3. 导入表结构
    console.log('📦 导入表结构...');
    const schemaPath = path.join(__dirname, '../../backups/migration-2026-01-16/windows_tables_schema_processed.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema 文件不存在: ${schemaPath}`);
    }

    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');
    
    // 分割 SQL 语句（按分号分割，但要注意函数定义中的分号）
    const statements = splitSQL(schemaSQL);
    
    console.log(`共 ${statements.length} 条 SQL 语句`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          await pool.query(statement);
          if ((i + 1) % 10 === 0) {
            console.log(`  已执行 ${i + 1}/${statements.length} 条语句`);
          }
        } catch (error: any) {
          // 忽略 "already exists" 错误
          if (error.message && error.message.includes('already exists')) {
            console.log(`  跳过已存在的对象: ${statement.substring(0, 50)}...`);
          } else {
            console.error(`  执行失败: ${statement.substring(0, 100)}...`);
            throw error;
          }
        }
      }
    }
    
    console.log('✅ 表结构导入完成\n');

    // 4. 验证数据库结构
    console.log('🔍 验证数据库结构...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log(`\n✅ 数据库表 (${result.rows.length} 个):`);
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });

    // 验证函数
    const functionsResult = await pool.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_type = 'FUNCTION'
      ORDER BY routine_name
    `);

    console.log(`\n✅ 数据库函数 (${functionsResult.rows.length} 个):`);
    functionsResult.rows.forEach((row: any) => {
      console.log(`  - ${row.routine_name}`);
    });

    console.log('\n🎉 数据库初始化完成！');
    console.log('\n下一步：运行 npm run db:import-data 导入测试数据');

  } catch (error) {
    console.error('\n❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    await db.close();
  }
}

/**
 * 分割 SQL 语句
 * 
 * 注意：简单的按分号分割，可能需要更复杂的逻辑来处理函数定义
 */
function splitSQL(sql: string): string[] {
  // 移除注释
  const lines = sql.split('\n');
  const cleanedLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('--');
  });

  const cleanedSQL = cleanedLines.join('\n');

  // 按分号分割，但保留函数定义
  const statements: string[] = [];
  let currentStatement = '';
  let inFunction = false;

  const parts = cleanedSQL.split(';');
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    
    if (!part) continue;

    currentStatement += part + ';';

    // 检查是否在函数定义中
    if (part.toUpperCase().includes('CREATE FUNCTION') || 
        part.toUpperCase().includes('CREATE OR REPLACE FUNCTION')) {
      inFunction = true;
    }

    // 如果遇到 $$ 或 $function$，切换函数状态
    if (part.includes('$$') || part.includes('$function$')) {
      inFunction = !inFunction;
    }

    // 如果不在函数中，且当前语句不为空，添加到结果
    if (!inFunction && currentStatement.trim()) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  // 添加最后一个语句
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  return statements;
}

// 执行初始化
initDatabase().catch(error => {
  console.error('初始化失败:', error);
  process.exit(1);
});
