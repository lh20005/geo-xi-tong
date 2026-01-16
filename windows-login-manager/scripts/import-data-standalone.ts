import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 独立数据导入脚本（不依赖 Electron）
 */

async function importData() {
  // 加载配置
  const configPath = path.join(os.homedir(), 'Library/Application Support/ai-geo-system/db-config.json');
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`配置文件不存在: ${configPath}`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // 创建连接池
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password || undefined,
  });

  try {
    console.log('🚀 开始导入数据...\n');

    // 测试连接
    console.log('📡 连接到数据库...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ 数据库连接成功:', testResult.rows[0].now);
    console.log();

    // 1. 导入数据
    console.log('📦 导入测试数据...');
    const projectRoot = path.join(__dirname, '../../..');
    const dataPath = path.join(projectRoot, 'backups/migration-2026-01-16/user_1_data_final.sql');
    
    if (!fs.existsSync(dataPath)) {
      throw new Error(`数据文件不存在: ${dataPath}`);
    }

    const dataSQL = fs.readFileSync(dataPath, 'utf-8');
    
    // 在事务中执行导入
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log('  开始事务...');
      
      // 分割 SQL 语句
      const statements = splitSQL(dataSQL);
      console.log(`  共 ${statements.length} 条 SQL 语句`);
      
      let successCount = 0;
      let skipCount = 0;
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (statement) {
          try {
            await client.query(statement);
            successCount++;
            if ((i + 1) % 500 === 0) {
              console.log(`  已执行 ${i + 1}/${statements.length} 条语句 (成功: ${successCount}, 跳过: ${skipCount})`);
            }
          } catch (error: any) {
            // 忽略重复键错误
            if (error.message && error.message.includes('duplicate key')) {
              skipCount++;
            } else {
              console.error(`  执行失败: ${statement.substring(0, 100)}...`);
              throw error;
            }
          }
        }
      }
      
      await client.query('COMMIT');
      console.log(`  提交事务... (成功: ${successCount}, 跳过: ${skipCount})`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('  事务回滚');
      throw error;
    } finally {
      client.release();
    }
    
    console.log('✅ 数据导入完成\n');

    // 2. 重置序列
    console.log('🔄 重置序列...');
    const tables = [
      'articles',
      'albums',
      'images',
      'knowledge_bases',
      'knowledge_documents',
      'platform_accounts',
      'publishing_tasks',
      'publishing_records',
      'publishing_logs',
      'conversion_targets',
      'distillations',
      'topics',
      'article_settings',
      'distillation_config',
      'image_usage',
      'distillation_usage',
      'topic_usage'
    ];

    for (const table of tables) {
      try {
        // 获取表的最大 ID
        const maxIdResult = await pool.query(`SELECT MAX(id) as max_id FROM ${table}`);
        const maxId = maxIdResult.rows[0].max_id || 0;
        
        if (maxId > 0) {
          // 重置序列
          await pool.query(`SELECT setval('${table}_id_seq', ${maxId}, true)`);
          console.log(`  ✅ ${table.padEnd(25)}: 序列重置为 ${maxId}`);
        } else {
          console.log(`  ⏭️  ${table.padEnd(25)}: 无数据，跳过`);
        }
      } catch (error: any) {
        // 如果表不存在或没有序列，跳过
        if (error.message && (error.message.includes('does not exist') || error.message.includes('relation'))) {
          console.log(`  ⏭️  ${table.padEnd(25)}: 表或序列不存在`);
        } else {
          console.error(`  ❌ ${table.padEnd(25)}: 重置失败 - ${error.message}`);
        }
      }
    }
    
    console.log('✅ 序列重置完成\n');

    // 3. 验证数据
    console.log('🔍 验证数据完整性...\n');
    
    const verifyTables = [
      'articles',
      'albums',
      'images',
      'knowledge_bases',
      'knowledge_documents',
      'platform_accounts',
      'publishing_tasks',
      'publishing_records',
      'publishing_logs',
      'distillations',
      'topics',
      'conversion_targets'
    ];

    console.log('数据统计：');
    let totalRecords = 0;
    for (const table of verifyTables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        totalRecords += count;
        console.log(`  ${table.padEnd(25)}: ${count} 条记录`);
      } catch (error: any) {
        console.log(`  ${table.padEnd(25)}: 查询失败`);
      }
    }

    console.log(`\n  总计: ${totalRecords} 条记录`);

    console.log('\n🎉 数据导入完成！');
    console.log('\n下一步：更新 IPC 处理器，使用新的 PostgreSQL Service 类');

  } catch (error) {
    console.error('\n❌ 数据导入失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * 分割 SQL 语句
 */
function splitSQL(sql: string): string[] {
  // 移除注释
  const lines = sql.split('\n');
  const cleanedLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('--');
  });

  const cleanedSQL = cleanedLines.join('\n');

  // 按分号分割
  return cleanedSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// 执行导入
importData().catch(error => {
  console.error('导入失败:', error);
  process.exit(1);
});
