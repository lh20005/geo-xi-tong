/**
 * 迁移文件生成器
 * 
 * 功能：
 * - 自动生成新的迁移文件
 * - 自动分配版本号
 * - 提供模板
 * 
 * 使用：npm run db:create -- add_email_to_users
 */

import fs from 'fs';
import path from 'path';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 获取下一个版本号
 */
function getNextVersion(): string {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    return '001';
  }
  
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  if (files.length === 0) {
    return '001';
  }
  
  const lastFile = files[files.length - 1];
  const match = lastFile.match(/^(\d{3})/);
  
  if (!match) {
    return '001';
  }
  
  const lastVersion = parseInt(match[1], 10);
  const nextVersion = lastVersion + 1;
  
  return nextVersion.toString().padStart(3, '0');
}

/**
 * 生成迁移文件模板
 */
function generateTemplate(name: string): string {
  const formattedName = name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
  
  return `-- ==================== UP ====================
-- ${name.replace(/_/g, ' ')}
-- 
-- 描述：在此添加变更描述
-- 作者：[你的名字]
-- 日期：${new Date().toISOString().split('T')[0]}

-- 示例：添加新列
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 示例：创建新表
-- CREATE TABLE IF NOT EXISTS example (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- 示例：创建索引
-- CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 在此编写你的 UP 迁移 SQL


-- ==================== DOWN ====================
-- 回滚 ${name.replace(/_/g, ' ')}
-- 
-- 注意：DOWN 部分应该完全撤销 UP 部分的变更

-- 示例：删除列
-- ALTER TABLE users DROP COLUMN IF EXISTS email;

-- 示例：删除表
-- DROP TABLE IF EXISTS example;

-- 示例：删除索引
-- DROP INDEX IF EXISTS idx_users_email;

-- 在此编写你的 DOWN 回滚 SQL

`;
}

/**
 * 主函数
 */
function createMigration() {
  try {
    // 获取迁移名称
    const args = process.argv.slice(2);
    const name = args[0];
    
    if (!name) {
      log('\n✗ 错误：请提供迁移名称', 'red');
      log('\n使用方法:', 'yellow');
      log('  npm run db:create -- add_email_to_users', 'gray');
      log('  npm run db:create -- create_orders_table', 'gray');
      process.exit(1);
    }
    
    // 验证名称格式
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      log('\n✗ 错误：迁移名称只能包含字母、数字和下划线', 'red');
      process.exit(1);
    }
    
    log('\n📝 创建新迁移文件...', 'blue');
    log('='.repeat(50), 'gray');
    
    // 获取版本号
    const version = getNextVersion();
    log(`✓ 版本号: ${version}`, 'gray');
    
    // 生成文件名
    const filename = `${version}_${name}.sql`;
    log(`✓ 文件名: ${filename}`, 'gray');
    
    // 生成文件路径
    const migrationsDir = path.join(__dirname, 'migrations');
    const filepath = path.join(migrationsDir, filename);
    
    // 检查文件是否已存在
    if (fs.existsSync(filepath)) {
      log(`\n✗ 错误：文件已存在: ${filename}`, 'red');
      process.exit(1);
    }
    
    // 生成模板内容
    const content = generateTemplate(name);
    
    // 写入文件
    fs.writeFileSync(filepath, content, 'utf-8');
    
    log('\n' + '='.repeat(50), 'gray');
    log('✓ 迁移文件创建成功！', 'green');
    log(`\n文件位置: ${filepath}`, 'blue');
    log('\n下一步:', 'yellow');
    log('  1. 编辑迁移文件，填写 UP 和 DOWN SQL', 'gray');
    log('  2. 运行 npm run db:migrate 执行迁移', 'gray');
    log('  3. 运行 npm run db:status 查看状态', 'gray');
    log('');
    
  } catch (error) {
    log('\n✗ 创建失败', 'red');
    console.error(error);
    process.exit(1);
  }
}

// 执行创建
if (require.main === module) {
  createMigration();
}

export { createMigration };
