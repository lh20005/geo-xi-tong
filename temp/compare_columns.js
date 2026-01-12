const fs = require('fs');
const path = require('path');

// 读取本地数据库列信息
const localColsRaw = fs.readFileSync('/tmp/local_cols_simple.txt', 'utf8');
const localCols = new Map();

localColsRaw.trim().split('\n').forEach(line => {
  const [table, col] = line.split('|');
  if (table && col) {
    if (!localCols.has(table)) {
      localCols.set(table, new Set());
    }
    localCols.get(table).add(col);
  }
});

// 从迁移文件提取列定义
const migrationsDir = 'server/src/db/migrations';
const migrationCols = new Map();

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

files.forEach(file => {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const migNum = file.split('_')[0];
  
  // 提取 CREATE TABLE 中的列
  const createTableRegex = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)\s*\(([\s\S]*?)\);/gi;
  let match;
  while ((match = createTableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const tableBody = match[2];
    
    if (!migrationCols.has(tableName)) {
      migrationCols.set(tableName, new Map());
    }
    
    // 解析列定义
    const lines = tableBody.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      // 跳过约束行
      if (trimmed.startsWith('PRIMARY') || trimmed.startsWith('UNIQUE') || 
          trimmed.startsWith('FOREIGN') || trimmed.startsWith('CONSTRAINT') ||
          trimmed.startsWith('CHECK') || trimmed.startsWith('--') ||
          trimmed.startsWith(')') || !trimmed) {
        return;
      }
      
      const colMatch = trimmed.match(/^(\w+)\s+/);
      if (colMatch) {
        const colName = colMatch[1].toLowerCase();
        if (!['primary', 'unique', 'foreign', 'constraint', 'check', 'references'].includes(colName)) {
          migrationCols.get(tableName).set(colName, migNum);
        }
      }
    });
  }
  
  // 提取 ALTER TABLE ADD COLUMN (多种格式)
  // 格式1: ALTER TABLE xxx ADD COLUMN IF NOT EXISTS col_name TYPE
  // 格式2: ALTER TABLE xxx ADD COLUMN col_name TYPE
  // 格式3: ADD COLUMN IF NOT EXISTS col_name TYPE (在多行 ALTER TABLE 中)
  const addColRegex = /ALTER TABLE\s+(\w+)\s+ADD\s+(?:COLUMN\s+)?(?:IF NOT EXISTS\s+)?(\w+)/gi;
  while ((match = addColRegex.exec(content)) !== null) {
    const tableName = match[1];
    const colName = match[2].toLowerCase();
    
    // 跳过约束关键字
    if (['constraint', 'primary', 'unique', 'foreign', 'check', 'index'].includes(colName)) {
      continue;
    }
    
    if (!migrationCols.has(tableName)) {
      migrationCols.set(tableName, new Map());
    }
    migrationCols.get(tableName).set(colName, migNum);
  }
  
  // 提取多行 ALTER TABLE 中的 ADD COLUMN
  // 例如: ALTER TABLE xxx\nADD COLUMN IF NOT EXISTS col1 TYPE,\nADD COLUMN IF NOT EXISTS col2 TYPE;
  const multiLineAlterRegex = /ALTER TABLE\s+(\w+)\s*\n((?:ADD COLUMN[^;]+)+);/gi;
  while ((match = multiLineAlterRegex.exec(content)) !== null) {
    const tableName = match[1];
    const addPart = match[2];
    
    const colMatches = addPart.matchAll(/ADD COLUMN\s+(?:IF NOT EXISTS\s+)?(\w+)/gi);
    for (const colMatch of colMatches) {
      const colName = colMatch[1].toLowerCase();
      if (!['constraint', 'primary', 'unique', 'foreign', 'check', 'index'].includes(colName)) {
        if (!migrationCols.has(tableName)) {
          migrationCols.set(tableName, new Map());
        }
        migrationCols.get(tableName).set(colName, migNum);
      }
    }
  }
});

// 对比
console.log('# 数据库列完整对比报告\n');
console.log(`本地数据库表数: ${localCols.size}`);
console.log(`迁移文件定义表数: ${migrationCols.size}\n`);

let totalLocalCols = 0;
let totalMigrationCols = 0;
let missingCols = [];
let extraCols = [];

// 按表对比
const allTables = new Set([...localCols.keys(), ...migrationCols.keys()]);
const sortedTables = [...allTables].sort();

sortedTables.forEach(table => {
  const localTableCols = localCols.get(table) || new Set();
  const migTableCols = migrationCols.get(table) || new Map();
  
  totalLocalCols += localTableCols.size;
  totalMigrationCols += migTableCols.size;
  
  // 找出本地有但迁移没有的列
  localTableCols.forEach(col => {
    if (!migTableCols.has(col)) {
      missingCols.push({ table, col });
    }
  });
  
  // 找出迁移有但本地没有的列
  migTableCols.forEach((mig, col) => {
    if (!localTableCols.has(col)) {
      extraCols.push({ table, col, migration: mig });
    }
  });
});

console.log(`本地数据库总列数: ${totalLocalCols}`);
console.log(`迁移文件定义总列数: ${totalMigrationCols}\n`);

if (missingCols.length > 0) {
  console.log('## ❌ 本地数据库有但迁移文件缺失的列:\n');
  missingCols.forEach(({ table, col }) => {
    console.log(`- ${table}.${col}`);
  });
  console.log('');
} else {
  console.log('## ✅ 所有本地数据库列都在迁移文件中定义\n');
}

if (extraCols.length > 0) {
  console.log('## ⚠️ 迁移文件有但本地数据库没有的列:\n');
  extraCols.forEach(({ table, col, migration }) => {
    console.log(`- ${table}.${col} (迁移 ${migration})`);
  });
  console.log('');
}

// 详细表对比
console.log('\n## 详细表对比\n');
sortedTables.forEach(table => {
  const localTableCols = localCols.get(table) || new Set();
  const migTableCols = migrationCols.get(table) || new Map();
  
  const localOnly = [...localTableCols].filter(c => !migTableCols.has(c));
  const migOnly = [...migTableCols.keys()].filter(c => !localTableCols.has(c));
  
  if (localOnly.length > 0 || migOnly.length > 0) {
    console.log(`### ${table}`);
    console.log(`本地: ${localTableCols.size} 列, 迁移: ${migTableCols.size} 列`);
    if (localOnly.length > 0) {
      console.log(`缺失: ${localOnly.join(', ')}`);
    }
    if (migOnly.length > 0) {
      console.log(`多余: ${migOnly.join(', ')}`);
    }
    console.log('');
  }
});

// 总结
console.log('\n## 总结\n');
if (missingCols.length === 0) {
  console.log('✅ 迁移文件完整覆盖了本地数据库的所有列');
} else {
  console.log(`❌ 发现 ${missingCols.length} 个缺失的列需要添加到迁移文件`);
}
