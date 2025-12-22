/**
 * 运行头条号登录修复所需的数据库迁移
 * 执行 009 和 010 迁移脚本
 */

import { pool } from '../db/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration(migrationNumber: string, migrationName: string) {
  const migrationFile = path.join(__dirname, '../db/migrations', `${migrationNumber}_${migrationName}.sql`);
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ 迁移文件不存在: ${migrationFile}`);
    return false;
  }

  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log(`\n=== 执行迁移 ${migrationNumber}: ${migrationName} ===`);
  console.log(`文件: ${migrationFile}\n`);

  try {
    // 分割SQL语句并逐个执行
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        // 只显示前100个字符
        const preview = statement.substring(0, 100).replace(/\s+/g, ' ');
        console.log(`执行: ${preview}...`);
        await pool.query(statement);
        console.log('✅ 成功');
      }
    }

    console.log(`\n✅ 迁移 ${migrationNumber} 完成！`);
    return true;

  } catch (error: any) {
    // 检查是否是"已存在"的错误（可以忽略）
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log(`⚠️  迁移 ${migrationNumber} 已经执行过（跳过）`);
      return true;
    }
    
    console.error(`\n❌ 迁移 ${migrationNumber} 失败:`, error.message);
    console.error('详细错误:', error);
    return false;
  }
}

async function runToutiaoMigrations() {
  console.log('=== 头条号登录修复 - 数据库迁移 ===\n');

  try {
    // 执行 009 迁移：添加平台选择器
    const migration009Success = await runMigration('009', 'add_platform_selectors');
    if (!migration009Success) {
      console.error('\n❌ 迁移 009 失败，停止执行');
      process.exit(1);
    }

    // 执行 010 迁移：添加登录成功 URL 模式
    const migration010Success = await runMigration('010', 'fix_platform_login_detection');
    if (!migration010Success) {
      console.error('\n❌ 迁移 010 失败，停止执行');
      process.exit(1);
    }

    console.log('\n=== 所有迁移执行完成 ===');
    console.log('\n新增配置：');
    console.log('1. platforms_config 表添加了 selectors 字段（JSONB）');
    console.log('2. platforms_config 表添加了 login_url 字段');
    console.log('3. 所有平台配置了 username 和 loginSuccess 选择器');
    console.log('4. 所有平台配置了 successUrls 用于 URL 变化检测');
    console.log('\n头条号配置：');
    console.log('- login_url: https://mp.toutiao.com/auth/page/login');
    console.log('- username 选择器: 7 个');
    console.log('- loginSuccess 选择器: 3 个');
    console.log('- successUrls: 2 个 URL 模式');

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ 执行过程中发生错误:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  }
}

// 运行迁移
runToutiaoMigrations();
