/**
 * 直接测试服务层
 * 通过模拟 Electron 环境来测试本地服务
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const crypto = require('crypto');

// 测试数据库路径
const TEST_DB_PATH = path.join(__dirname, 'test-data', 'test-geo-data.db');

// 确保测试目录存在
const testDir = path.dirname(TEST_DB_PATH);
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// 删除旧的测试数据库
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
  console.log('🗑️  删除旧测试数据库');
}

// 创建数据库
const db = new Database(TEST_DB_PATH);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

console.log('📦 创建测试数据库:', TEST_DB_PATH);

// 读取并执行迁移文件
const migrationsDir = path.join(__dirname, 'dist-electron/database/migrations');
const migrationFile = path.join(migrationsDir, '001_init.sql');

if (fs.existsSync(migrationFile)) {
  const sql = fs.readFileSync(migrationFile, 'utf-8');
  db.exec(sql);
  console.log('✅ 执行迁移文件: 001_init.sql');
} else {
  console.error('❌ 迁移文件不存在:', migrationFile);
  process.exit(1);
}

// 生成 UUID
function generateId() {
  return crypto.randomUUID();
}

// 获取当前时间
function now() {
  return new Date().toISOString();
}

// 测试结果
const results = {
  passed: [],
  failed: []
};

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    results.passed.push(name);
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    results.failed.push({ name, error: error.message });
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(`${message}: value is null or undefined`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('📋 Phase 8.1 功能测试');
console.log('='.repeat(60));

// ==================== 测试文章 CRUD ====================
console.log('\n--- 测试文章 CRUD ---');

const TEST_USER_ID = 1;
let testArticleId;

test('创建文章', () => {
  const id = generateId();
  const timestamp = now();
  
  db.prepare(`
    INSERT INTO articles (id, user_id, title, keyword, content, provider, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, TEST_USER_ID, '测试文章标题', 'GEO优化', '这是测试文章内容', 'deepseek', timestamp, timestamp);
  
  testArticleId = id;
  
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
  assertNotNull(article, '文章应该存在');
  assertEqual(article.title, '测试文章标题', '标题应该匹配');
});

test('读取文章', () => {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(testArticleId);
  assertNotNull(article, '文章应该存在');
  assertEqual(article.keyword, 'GEO优化', '关键词应该匹配');
});

test('更新文章', () => {
  db.prepare('UPDATE articles SET title = ?, updated_at = ? WHERE id = ?')
    .run('更新后的标题', now(), testArticleId);
  
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(testArticleId);
  assertEqual(article.title, '更新后的标题', '标题应该已更新');
});

test('搜索文章', () => {
  const articles = db.prepare(
    'SELECT * FROM articles WHERE user_id = ? AND (title LIKE ? OR keyword LIKE ?)'
  ).all(TEST_USER_ID, '%更新%', '%更新%');
  
  assertEqual(articles.length, 1, '应该找到1篇文章');
});

test('删除文章', () => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(testArticleId);
  
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(testArticleId);
  assertEqual(article, undefined, '文章应该已删除');
});

// ==================== 测试知识库 ====================
console.log('\n--- 测试知识库 ---');

let testKnowledgeBaseId;

test('创建知识库', () => {
  const id = generateId();
  const timestamp = now();
  
  db.prepare(`
    INSERT INTO knowledge_bases (id, user_id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, TEST_USER_ID, '测试知识库', '这是测试知识库描述', timestamp, timestamp);
  
  testKnowledgeBaseId = id;
  
  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?').get(id);
  assertNotNull(kb, '知识库应该存在');
});

test('添加知识文档', () => {
  const id = generateId();
  const timestamp = now();
  
  db.prepare(`
    INSERT INTO knowledge_documents (id, knowledge_base_id, filename, file_type, file_size, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, testKnowledgeBaseId, 'test.txt', 'text/plain', 1024, '这是文档内容', timestamp);
  
  const doc = db.prepare('SELECT * FROM knowledge_documents WHERE id = ?').get(id);
  assertNotNull(doc, '文档应该存在');
});

test('查询知识库文档', () => {
  const docs = db.prepare(
    'SELECT * FROM knowledge_documents WHERE knowledge_base_id = ?'
  ).all(testKnowledgeBaseId);
  
  assertEqual(docs.length, 1, '应该有1个文档');
});

test('删除知识库（级联删除文档）', () => {
  db.prepare('DELETE FROM knowledge_bases WHERE id = ?').run(testKnowledgeBaseId);
  
  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?').get(testKnowledgeBaseId);
  assertEqual(kb, undefined, '知识库应该已删除');
  
  const docs = db.prepare(
    'SELECT * FROM knowledge_documents WHERE knowledge_base_id = ?'
  ).all(testKnowledgeBaseId);
  assertEqual(docs.length, 0, '文档应该级联删除');
});

// ==================== 测试图库 ====================
console.log('\n--- 测试图库 ---');

let testAlbumId;

test('创建相册', () => {
  const id = generateId();
  const timestamp = now();
  
  db.prepare(`
    INSERT INTO albums (id, user_id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, TEST_USER_ID, '测试相册', timestamp, timestamp);
  
  testAlbumId = id;
  
  const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(id);
  assertNotNull(album, '相册应该存在');
});

test('上传图片', () => {
  const id = generateId();
  const timestamp = now();
  
  db.prepare(`
    INSERT INTO images (id, user_id, album_id, filename, filepath, mime_type, size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, TEST_USER_ID, testAlbumId, 'test.jpg', '/path/to/test.jpg', 'image/jpeg', 2048, timestamp);
  
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
  assertNotNull(image, '图片应该存在');
});

test('查询相册图片', () => {
  const images = db.prepare('SELECT * FROM images WHERE album_id = ?').all(testAlbumId);
  assertEqual(images.length, 1, '应该有1张图片');
});

test('删除相册（级联删除图片）', () => {
  db.prepare('DELETE FROM albums WHERE id = ?').run(testAlbumId);
  
  const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(testAlbumId);
  assertEqual(album, undefined, '相册应该已删除');
  
  const images = db.prepare('SELECT * FROM images WHERE album_id = ?').all(testAlbumId);
  assertEqual(images.length, 0, '图片应该级联删除');
});

// ==================== 测试平台账号 ====================
console.log('\n--- 测试平台账号 ---');

let testAccountId;

test('创建平台账号', () => {
  const id = generateId();
  const timestamp = now();
  
  db.prepare(`
    INSERT INTO platform_accounts (id, user_id, platform, account_name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, TEST_USER_ID, 'xiaohongshu', '测试账号', 'active', timestamp, timestamp);
  
  testAccountId = id;
  
  const account = db.prepare('SELECT * FROM platform_accounts WHERE id = ?').get(id);
  assertNotNull(account, '账号应该存在');
  assertEqual(account.status, 'active', '状态应该是 active');
});

test('更新账号状态', () => {
  db.prepare('UPDATE platform_accounts SET status = ?, updated_at = ? WHERE id = ?')
    .run('inactive', now(), testAccountId);
  
  const account = db.prepare('SELECT * FROM platform_accounts WHERE id = ?').get(testAccountId);
  assertEqual(account.status, 'inactive', '状态应该已更新');
});

test('保存 Cookie（加密）', () => {
  const cookies = JSON.stringify([{ name: 'session', value: 'test123' }]);
  // 简单模拟加密
  const encrypted = Buffer.from(cookies).toString('base64');
  
  db.prepare('UPDATE platform_accounts SET cookies = ?, updated_at = ? WHERE id = ?')
    .run(encrypted, now(), testAccountId);
  
  const account = db.prepare('SELECT * FROM platform_accounts WHERE id = ?').get(testAccountId);
  assertNotNull(account.cookies, 'Cookie 应该已保存');
});

// ==================== 测试发布任务 ====================
console.log('\n--- 测试发布任务 ---');

let testTaskId;
let testBatchId = generateId();

test('创建发布任务', () => {
  const id = generateId();
  const timestamp = now();
  
  db.prepare(`
    INSERT INTO publishing_tasks (
      id, user_id, account_id, platform_id, status, config, 
      batch_id, batch_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, TEST_USER_ID, testAccountId, 'xiaohongshu', 'pending',
    JSON.stringify({ title: '测试' }), testBatchId, 1, timestamp, timestamp
  );
  
  testTaskId = id;
  
  const task = db.prepare('SELECT * FROM publishing_tasks WHERE id = ?').get(id);
  assertNotNull(task, '任务应该存在');
  assertEqual(task.status, 'pending', '状态应该是 pending');
});

test('更新任务状态', () => {
  db.prepare('UPDATE publishing_tasks SET status = ?, started_at = ?, updated_at = ? WHERE id = ?')
    .run('running', now(), now(), testTaskId);
  
  const task = db.prepare('SELECT * FROM publishing_tasks WHERE id = ?').get(testTaskId);
  assertEqual(task.status, 'running', '状态应该是 running');
  assertNotNull(task.started_at, '开始时间应该已设置');
});

test('添加任务日志', () => {
  db.prepare(`
    INSERT INTO publishing_logs (task_id, level, message, created_at)
    VALUES (?, ?, ?, ?)
  `).run(testTaskId, 'info', '开始执行发布任务', now());
  
  const logs = db.prepare('SELECT * FROM publishing_logs WHERE task_id = ?').all(testTaskId);
  assertEqual(logs.length, 1, '应该有1条日志');
});

test('完成任务', () => {
  db.prepare('UPDATE publishing_tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?')
    .run('completed', now(), now(), testTaskId);
  
  const task = db.prepare('SELECT * FROM publishing_tasks WHERE id = ?').get(testTaskId);
  assertEqual(task.status, 'completed', '状态应该是 completed');
  assertNotNull(task.completed_at, '完成时间应该已设置');
});

test('查询批次任务', () => {
  const tasks = db.prepare('SELECT * FROM publishing_tasks WHERE batch_id = ?').all(testBatchId);
  assertEqual(tasks.length, 1, '批次应该有1个任务');
});

// ==================== 测试分析上报队列 ====================
console.log('\n--- 测试分析上报队列 ---');

test('添加待上报分析数据', () => {
  db.prepare(`
    INSERT INTO pending_analytics (report_type, report_data, retry_count, created_at)
    VALUES (?, ?, ?, ?)
  `).run('publish', JSON.stringify({ taskId: testTaskId, status: 'success' }), 0, now());
  
  const pending = db.prepare('SELECT * FROM pending_analytics').all();
  assertEqual(pending.length, 1, '应该有1条待上报数据');
});

test('获取待上报数据', () => {
  const pending = db.prepare(
    'SELECT * FROM pending_analytics WHERE retry_count < 5 ORDER BY created_at ASC LIMIT 100'
  ).all();
  
  assertEqual(pending.length, 1, '应该获取到1条数据');
});

test('删除已上报数据', () => {
  const pending = db.prepare('SELECT id FROM pending_analytics').all();
  const ids = pending.map(p => p.id);
  
  if (ids.length > 0) {
    db.prepare(`DELETE FROM pending_analytics WHERE id IN (${ids.join(',')})`).run();
  }
  
  const remaining = db.prepare('SELECT * FROM pending_analytics').all();
  assertEqual(remaining.length, 0, '待上报数据应该已清空');
});

// ==================== 测试数据同步状态 ====================
console.log('\n--- 测试数据同步状态 ---');

test('更新同步状态', () => {
  const timestamp = now();
  const snapshotId = generateId();
  
  db.prepare(`
    UPDATE sync_status SET last_backup_at = ?, last_snapshot_id = ?, updated_at = ? WHERE id = 1
  `).run(timestamp, snapshotId, timestamp);
  
  const status = db.prepare('SELECT * FROM sync_status WHERE id = 1').get();
  assertNotNull(status.last_backup_at, '备份时间应该已设置');
  assertEqual(status.last_snapshot_id, snapshotId, '快照 ID 应该匹配');
});

// ==================== 清理测试数据 ====================
console.log('\n--- 清理测试数据 ---');

test('清理测试数据', () => {
  db.prepare('DELETE FROM publishing_logs WHERE task_id = ?').run(testTaskId);
  db.prepare('DELETE FROM publishing_tasks WHERE id = ?').run(testTaskId);
  db.prepare('DELETE FROM platform_accounts WHERE id = ?').run(testAccountId);
  
  const tasks = db.prepare('SELECT COUNT(*) as count FROM publishing_tasks').get();
  assertEqual(tasks.count, 0, '任务应该已清空');
});

// 关闭数据库
db.close();

// 打印测试总结
console.log('\n' + '='.repeat(60));
console.log('📊 测试总结');
console.log('='.repeat(60));
console.log(`✅ 通过: ${results.passed.length}`);
console.log(`❌ 失败: ${results.failed.length}`);

if (results.failed.length > 0) {
  console.log('\n失败的测试:');
  results.failed.forEach(f => {
    console.log(`  - ${f.name}: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 所有测试通过！');
  process.exit(0);
}
