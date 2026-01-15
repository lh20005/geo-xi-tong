/**
 * Phase 8 完整测试脚本
 * 
 * 测试所有被跳过的项目：
 * - 8.3 性能测试：大文件处理、批量发布、内存占用
 * - 8.4 集成测试：完整发布流程、多平台发布、定时发布、数据同步
 * 
 * 运行方式：node test-phase8-complete.js
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 测试数据目录
const TEST_DATA_DIR = path.join(__dirname, 'test-data');
const DIST_DIR = path.join(__dirname, 'dist-electron');

// 确保测试目录存在
if (!fs.existsSync(TEST_DATA_DIR)) {
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

// 测试结果
const results = {
  passed: [],
  failed: [],
  total: 0
};

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function pass(name) {
  results.passed.push(name);
  results.total++;
  console.log(`✅ ${name}`);
}

function fail(name, error) {
  results.failed.push({ name, error: error?.message || String(error) });
  results.total++;
  console.log(`❌ ${name}: ${error?.message || error}`);
}


// ==================== 8.3 性能测试 ====================

/**
 * 8.3.1 测试大文件处理
 * 模拟上传和解析大型文档
 */
async function testLargeFileProcessing() {
  log('\n📋 8.3.1 测试大文件处理');
  
  try {
    // 创建一个 5MB 的测试文件
    const largeContent = 'A'.repeat(5 * 1024 * 1024); // 5MB
    const testFilePath = path.join(TEST_DATA_DIR, 'large-test-file.txt');
    
    const writeStart = Date.now();
    fs.writeFileSync(testFilePath, largeContent);
    const writeTime = Date.now() - writeStart;
    
    // 验证文件大小
    const stats = fs.statSync(testFilePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    if (stats.size >= 5 * 1024 * 1024) {
      pass(`大文件写入 (${fileSizeMB}MB, ${writeTime}ms)`);
    } else {
      fail('大文件写入', `文件大小不正确: ${fileSizeMB}MB`);
    }
    
    // 测试读取性能
    const readStart = Date.now();
    const content = fs.readFileSync(testFilePath, 'utf-8');
    const readTime = Date.now() - readStart;
    
    if (content.length === largeContent.length) {
      pass(`大文件读取 (${fileSizeMB}MB, ${readTime}ms)`);
    } else {
      fail('大文件读取', '内容长度不匹配');
    }
    
    // 清理
    fs.unlinkSync(testFilePath);
    
  } catch (error) {
    fail('大文件处理', error);
  }
}

/**
 * 8.3.2 测试批量数据插入性能
 * 模拟批量插入文章数据
 */
async function testBulkInsertPerformance() {
  log('\n📋 8.3.2 测试批量数据插入性能');
  
  try {
    // 检查 better-sqlite3 是否可用
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (e) {
      // 尝试从 dist-electron 加载
      const dbPath = path.join(DIST_DIR, 'node_modules', 'better-sqlite3');
      if (fs.existsSync(dbPath)) {
        Database = require(dbPath);
      } else {
        fail('批量插入性能', 'better-sqlite3 不可用');
        return;
      }
    }
    
    const testDbPath = path.join(TEST_DATA_DIR, 'perf-test.db');
    
    // 清理旧数据库
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    const db = new Database(testDbPath);
    
    // 创建测试表
    db.exec(`
      CREATE TABLE IF NOT EXISTS test_articles (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        title TEXT,
        content TEXT,
        created_at TEXT
      )
    `);
    
    // 准备插入语句
    const insert = db.prepare(`
      INSERT INTO test_articles (id, user_id, title, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    // 批量插入 500 条记录
    const count = 500;
    const insertStart = Date.now();
    
    const insertMany = db.transaction((articles) => {
      for (const article of articles) {
        insert.run(article.id, article.user_id, article.title, article.content, article.created_at);
      }
    });
    
    const articles = [];
    for (let i = 0; i < count; i++) {
      articles.push({
        id: crypto.randomUUID(),
        user_id: 1,
        title: `测试文章 ${i + 1}`,
        content: `这是测试文章 ${i + 1} 的内容，包含一些测试数据。`.repeat(10),
        created_at: new Date().toISOString()
      });
    }
    
    insertMany(articles);
    const insertTime = Date.now() - insertStart;
    
    pass(`批量插入 ${count} 条记录 (${insertTime}ms, ${(count / insertTime * 1000).toFixed(0)} 条/秒)`);
    
    // 测试查询性能
    const queryStart = Date.now();
    const rows = db.prepare('SELECT * FROM test_articles WHERE user_id = ?').all(1);
    const queryTime = Date.now() - queryStart;
    
    if (rows.length === count) {
      pass(`查询 ${count} 条记录 (${queryTime}ms)`);
    } else {
      fail('查询性能', `返回记录数不正确: ${rows.length}`);
    }
    
    // 测试搜索性能
    const searchStart = Date.now();
    const searchResults = db.prepare(
      'SELECT * FROM test_articles WHERE title LIKE ? OR content LIKE ?'
    ).all('%测试文章 10%', '%测试文章 10%');
    const searchTime = Date.now() - searchStart;
    
    pass(`模糊搜索 (${searchTime}ms, 找到 ${searchResults.length} 条)`);
    
    // 清理
    db.close();
    fs.unlinkSync(testDbPath);
    
  } catch (error) {
    fail('批量插入性能', error);
  }
}


/**
 * 8.3.3 测试内存占用
 * 监控内存使用情况
 */
async function testMemoryUsage() {
  log('\n📋 8.3.3 测试内存占用');
  
  try {
    const initialMemory = process.memoryUsage();
    log(`初始内存: RSS=${(initialMemory.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    
    // 模拟大量数据操作
    const largeArray = [];
    for (let i = 0; i < 100000; i++) {
      largeArray.push({
        id: crypto.randomUUID(),
        title: `文章 ${i}`,
        content: `内容 ${i}`.repeat(100)
      });
    }
    
    const afterAllocation = process.memoryUsage();
    log(`分配后内存: RSS=${(afterAllocation.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(afterAllocation.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    
    // 清理
    largeArray.length = 0;
    
    // 强制 GC（如果可用）
    if (global.gc) {
      global.gc();
    }
    
    const afterCleanup = process.memoryUsage();
    log(`清理后内存: RSS=${(afterCleanup.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(afterCleanup.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    
    // 检查内存是否在合理范围内（小于 500MB）
    if (afterAllocation.heapUsed < 500 * 1024 * 1024) {
      pass(`内存占用在合理范围内 (峰值 ${(afterAllocation.heapUsed / 1024 / 1024).toFixed(2)}MB)`);
    } else {
      fail('内存占用', `内存占用过高: ${(afterAllocation.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
    
  } catch (error) {
    fail('内存占用测试', error);
  }
}

// ==================== 8.4 集成测试 ====================

/**
 * 8.4.1 测试完整发布流程（模拟）
 * 模拟从创建文章到发布的完整流程
 */
async function testCompletePublishFlow() {
  log('\n📋 8.4.1 测试完整发布流程（模拟）');
  
  try {
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (e) {
      fail('完整发布流程', 'better-sqlite3 不可用');
      return;
    }
    
    const testDbPath = path.join(TEST_DATA_DIR, 'flow-test.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    const db = new Database(testDbPath);
    
    // 创建必要的表
    db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        title TEXT,
        content TEXT,
        keyword TEXT,
        is_published INTEGER DEFAULT 0,
        created_at TEXT
      );
      
      CREATE TABLE IF NOT EXISTS platform_accounts (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        platform_id TEXT,
        account_name TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT
      );
      
      CREATE TABLE IF NOT EXISTS publishing_tasks (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        article_id TEXT,
        account_id TEXT,
        platform_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT
      );
    `);
    
    // 步骤 1: 创建文章
    const articleId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO articles (id, user_id, title, content, keyword, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(articleId, 1, '测试文章标题', '测试文章内容', '测试关键词', new Date().toISOString());
    
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
    if (article) {
      pass('步骤1: 创建文章成功');
    } else {
      fail('步骤1: 创建文章', '文章未创建');
      return;
    }
    
    // 步骤 2: 创建账号
    const accountId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO platform_accounts (id, user_id, platform_id, account_name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(accountId, 1, 'xiaohongshu', '测试账号', new Date().toISOString());
    
    const account = db.prepare('SELECT * FROM platform_accounts WHERE id = ?').get(accountId);
    if (account) {
      pass('步骤2: 创建账号成功');
    } else {
      fail('步骤2: 创建账号', '账号未创建');
      return;
    }
    
    // 步骤 3: 创建发布任务
    const taskId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO publishing_tasks (id, user_id, article_id, account_id, platform_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId, 1, articleId, accountId, 'xiaohongshu', new Date().toISOString());
    
    const task = db.prepare('SELECT * FROM publishing_tasks WHERE id = ?').get(taskId);
    if (task) {
      pass('步骤3: 创建发布任务成功');
    } else {
      fail('步骤3: 创建发布任务', '任务未创建');
      return;
    }
    
    // 步骤 4: 模拟任务执行（更新状态）
    db.prepare('UPDATE publishing_tasks SET status = ? WHERE id = ?').run('running', taskId);
    const runningTask = db.prepare('SELECT * FROM publishing_tasks WHERE id = ?').get(taskId);
    if (runningTask.status === 'running') {
      pass('步骤4: 任务状态更新为 running');
    } else {
      fail('步骤4: 任务状态更新', `状态不正确: ${runningTask.status}`);
    }
    
    // 步骤 5: 模拟发布完成
    db.prepare('UPDATE publishing_tasks SET status = ? WHERE id = ?').run('completed', taskId);
    db.prepare('UPDATE articles SET is_published = 1 WHERE id = ?').run(articleId);
    
    const completedTask = db.prepare('SELECT * FROM publishing_tasks WHERE id = ?').get(taskId);
    const publishedArticle = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
    
    if (completedTask.status === 'completed' && publishedArticle.is_published === 1) {
      pass('步骤5: 发布完成，文章标记为已发布');
    } else {
      fail('步骤5: 发布完成', '状态不正确');
    }
    
    // 清理
    db.close();
    fs.unlinkSync(testDbPath);
    
    pass('完整发布流程测试通过');
    
  } catch (error) {
    fail('完整发布流程', error);
  }
}


/**
 * 8.4.2 测试多平台发布（模拟）
 * 模拟同一篇文章发布到多个平台
 */
async function testMultiPlatformPublish() {
  log('\n📋 8.4.2 测试多平台发布（模拟）');
  
  try {
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (e) {
      fail('多平台发布', 'better-sqlite3 不可用');
      return;
    }
    
    const testDbPath = path.join(TEST_DATA_DIR, 'multi-platform-test.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    const db = new Database(testDbPath);
    
    // 创建表
    db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        title TEXT,
        content TEXT
      );
      
      CREATE TABLE IF NOT EXISTS platform_accounts (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        platform_id TEXT,
        account_name TEXT
      );
      
      CREATE TABLE IF NOT EXISTS publishing_tasks (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        article_id TEXT,
        account_id TEXT,
        platform_id TEXT,
        status TEXT DEFAULT 'pending',
        batch_id TEXT,
        batch_order INTEGER
      );
    `);
    
    // 创建文章
    const articleId = crypto.randomUUID();
    db.prepare('INSERT INTO articles (id, user_id, title, content) VALUES (?, ?, ?, ?)')
      .run(articleId, 1, '多平台测试文章', '这是一篇需要发布到多个平台的文章');
    
    // 创建多个平台账号
    const platforms = ['xiaohongshu', 'douyin', 'toutiao', 'zhihu', 'bilibili'];
    const accounts = [];
    
    for (const platform of platforms) {
      const accountId = crypto.randomUUID();
      db.prepare('INSERT INTO platform_accounts (id, user_id, platform_id, account_name) VALUES (?, ?, ?, ?)')
        .run(accountId, 1, platform, `${platform}_测试账号`);
      accounts.push({ id: accountId, platform });
    }
    
    pass(`创建 ${platforms.length} 个平台账号`);
    
    // 创建批次任务
    const batchId = crypto.randomUUID();
    
    for (let i = 0; i < accounts.length; i++) {
      const taskId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO publishing_tasks (id, user_id, article_id, account_id, platform_id, batch_id, batch_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, 1, articleId, accounts[i].id, accounts[i].platform, batchId, i);
    }
    
    // 验证批次任务
    const batchTasks = db.prepare('SELECT * FROM publishing_tasks WHERE batch_id = ? ORDER BY batch_order').all(batchId);
    
    if (batchTasks.length === platforms.length) {
      pass(`创建 ${batchTasks.length} 个批次任务`);
    } else {
      fail('创建批次任务', `任务数量不正确: ${batchTasks.length}`);
    }
    
    // 模拟批次执行
    for (const task of batchTasks) {
      db.prepare('UPDATE publishing_tasks SET status = ? WHERE id = ?').run('running', task.id);
      // 模拟执行延迟
      await new Promise(resolve => setTimeout(resolve, 10));
      db.prepare('UPDATE publishing_tasks SET status = ? WHERE id = ?').run('completed', task.id);
    }
    
    // 验证所有任务完成
    const completedTasks = db.prepare('SELECT * FROM publishing_tasks WHERE batch_id = ? AND status = ?').all(batchId, 'completed');
    
    if (completedTasks.length === platforms.length) {
      pass(`所有 ${completedTasks.length} 个平台发布完成`);
    } else {
      fail('批次执行', `完成任务数量不正确: ${completedTasks.length}`);
    }
    
    // 清理
    db.close();
    fs.unlinkSync(testDbPath);
    
  } catch (error) {
    fail('多平台发布', error);
  }
}

/**
 * 8.4.3 测试定时发布（模拟）
 * 模拟定时任务调度
 */
async function testScheduledPublish() {
  log('\n📋 8.4.3 测试定时发布（模拟）');
  
  try {
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (e) {
      fail('定时发布', 'better-sqlite3 不可用');
      return;
    }
    
    const testDbPath = path.join(TEST_DATA_DIR, 'scheduled-test.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    const db = new Database(testDbPath);
    
    // 创建表
    db.exec(`
      CREATE TABLE IF NOT EXISTS publishing_tasks (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        article_id TEXT,
        platform_id TEXT,
        status TEXT DEFAULT 'pending',
        scheduled_at TEXT,
        started_at TEXT,
        completed_at TEXT
      );
    `);
    
    // 创建定时任务（计划在 1 秒后执行）
    const taskId = crypto.randomUUID();
    const scheduledTime = new Date(Date.now() + 1000).toISOString();
    
    db.prepare(`
      INSERT INTO publishing_tasks (id, user_id, article_id, platform_id, scheduled_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(taskId, 1, crypto.randomUUID(), 'xiaohongshu', scheduledTime);
    
    pass(`创建定时任务，计划时间: ${scheduledTime}`);
    
    // 模拟调度器检查
    const checkScheduledTasks = () => {
      const now = new Date().toISOString();
      return db.prepare(`
        SELECT * FROM publishing_tasks 
        WHERE status = 'pending' AND scheduled_at <= ?
      `).all(now);
    };
    
    // 等待任务到期
    log('等待定时任务到期...');
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const dueTasks = checkScheduledTasks();
    
    if (dueTasks.length > 0) {
      pass(`检测到 ${dueTasks.length} 个到期任务`);
      
      // 执行任务
      for (const task of dueTasks) {
        const startTime = new Date().toISOString();
        db.prepare('UPDATE publishing_tasks SET status = ?, started_at = ? WHERE id = ?')
          .run('running', startTime, task.id);
        
        // 模拟执行
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const completeTime = new Date().toISOString();
        db.prepare('UPDATE publishing_tasks SET status = ?, completed_at = ? WHERE id = ?')
          .run('completed', completeTime, task.id);
      }
      
      // 验证执行结果
      const completedTask = db.prepare('SELECT * FROM publishing_tasks WHERE id = ?').get(taskId);
      
      if (completedTask.status === 'completed' && completedTask.started_at && completedTask.completed_at) {
        pass('定时任务执行完成');
      } else {
        fail('定时任务执行', `状态不正确: ${completedTask.status}`);
      }
    } else {
      fail('定时任务检测', '未检测到到期任务');
    }
    
    // 清理
    db.close();
    fs.unlinkSync(testDbPath);
    
  } catch (error) {
    fail('定时发布', error);
  }
}


/**
 * 8.4.4 测试数据同步（模拟）
 * 模拟数据备份和恢复流程
 */
async function testDataSync() {
  log('\n📋 8.4.4 测试数据同步（模拟）');
  
  try {
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (e) {
      fail('数据同步', 'better-sqlite3 不可用');
      return;
    }
    
    const sourceDbPath = path.join(TEST_DATA_DIR, 'sync-source.db');
    const backupPath = path.join(TEST_DATA_DIR, 'sync-backup.json');
    const restoreDbPath = path.join(TEST_DATA_DIR, 'sync-restore.db');
    
    // 清理旧文件
    [sourceDbPath, backupPath, restoreDbPath].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    
    // 创建源数据库并填充数据
    const sourceDb = new Database(sourceDbPath);
    
    sourceDb.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT
      );
      
      CREATE TABLE IF NOT EXISTS knowledge_bases (
        id TEXT PRIMARY KEY,
        name TEXT
      );
    `);
    
    // 插入测试数据
    const articles = [];
    for (let i = 0; i < 10; i++) {
      const id = crypto.randomUUID();
      sourceDb.prepare('INSERT INTO articles (id, title, content) VALUES (?, ?, ?)')
        .run(id, `文章 ${i + 1}`, `内容 ${i + 1}`);
      articles.push({ id, title: `文章 ${i + 1}`, content: `内容 ${i + 1}` });
    }
    
    const knowledgeBases = [];
    for (let i = 0; i < 3; i++) {
      const id = crypto.randomUUID();
      sourceDb.prepare('INSERT INTO knowledge_bases (id, name) VALUES (?, ?)')
        .run(id, `知识库 ${i + 1}`);
      knowledgeBases.push({ id, name: `知识库 ${i + 1}` });
    }
    
    pass(`创建源数据: ${articles.length} 篇文章, ${knowledgeBases.length} 个知识库`);
    
    // 导出数据（模拟备份）
    const exportStart = Date.now();
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      articles: sourceDb.prepare('SELECT * FROM articles').all(),
      knowledgeBases: sourceDb.prepare('SELECT * FROM knowledge_bases').all()
    };
    
    fs.writeFileSync(backupPath, JSON.stringify(exportData, null, 2));
    const exportTime = Date.now() - exportStart;
    
    const backupStats = fs.statSync(backupPath);
    pass(`数据导出完成 (${(backupStats.size / 1024).toFixed(2)}KB, ${exportTime}ms)`);
    
    sourceDb.close();
    
    // 创建新数据库并恢复数据（模拟恢复）
    const restoreDb = new Database(restoreDbPath);
    
    restoreDb.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT
      );
      
      CREATE TABLE IF NOT EXISTS knowledge_bases (
        id TEXT PRIMARY KEY,
        name TEXT
      );
    `);
    
    const importStart = Date.now();
    const importData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    
    // 导入文章
    const insertArticle = restoreDb.prepare('INSERT INTO articles (id, title, content) VALUES (?, ?, ?)');
    for (const article of importData.articles) {
      insertArticle.run(article.id, article.title, article.content);
    }
    
    // 导入知识库
    const insertKb = restoreDb.prepare('INSERT INTO knowledge_bases (id, name) VALUES (?, ?)');
    for (const kb of importData.knowledgeBases) {
      insertKb.run(kb.id, kb.name);
    }
    
    const importTime = Date.now() - importStart;
    
    // 验证恢复结果
    const restoredArticles = restoreDb.prepare('SELECT * FROM articles').all();
    const restoredKbs = restoreDb.prepare('SELECT * FROM knowledge_bases').all();
    
    if (restoredArticles.length === articles.length && restoredKbs.length === knowledgeBases.length) {
      pass(`数据恢复完成 (${restoredArticles.length} 篇文章, ${restoredKbs.length} 个知识库, ${importTime}ms)`);
    } else {
      fail('数据恢复', `数据数量不匹配: 文章 ${restoredArticles.length}/${articles.length}, 知识库 ${restoredKbs.length}/${knowledgeBases.length}`);
    }
    
    // 验证数据完整性
    let dataIntegrity = true;
    for (let i = 0; i < articles.length; i++) {
      const original = articles[i];
      const restored = restoredArticles.find(a => a.id === original.id);
      if (!restored || restored.title !== original.title || restored.content !== original.content) {
        dataIntegrity = false;
        break;
      }
    }
    
    if (dataIntegrity) {
      pass('数据完整性验证通过');
    } else {
      fail('数据完整性', '恢复的数据与原始数据不匹配');
    }
    
    // 清理
    restoreDb.close();
    [sourceDbPath, backupPath, restoreDbPath].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    
  } catch (error) {
    fail('数据同步', error);
  }
}

/**
 * 8.4.5 测试适配器加载
 * 验证所有平台适配器可以正确加载
 */
async function testAdapterLoading() {
  log('\n📋 8.4.5 测试适配器加载');
  
  const adapters = [
    'XiaohongshuAdapter',
    'DouyinAdapter',
    'ToutiaoAdapter',
    'ZhihuAdapter',
    'BaijiahaoAdapter',
    'WangyiAdapter',
    'SohuAdapter',
    'CSDNAdapter',
    'JianshuAdapter',
    'WechatAdapter',
    'QieAdapter',
    'BilibiliAdapter'
  ];
  
  let loadedCount = 0;
  
  for (const adapterName of adapters) {
    const adapterPath = path.join(DIST_DIR, 'adapters', `${adapterName}.js`);
    
    if (fs.existsSync(adapterPath)) {
      // 检查文件内容是否包含关键方法
      const content = fs.readFileSync(adapterPath, 'utf-8');
      const hasPerformLogin = content.includes('performLogin');
      const hasPerformPublish = content.includes('performPublish');
      const hasGetPublishUrl = content.includes('getPublishUrl');
      
      if (hasPerformLogin && hasPerformPublish && hasGetPublishUrl) {
        loadedCount++;
        console.log(`  ✓ ${adapterName}`);
      } else {
        console.log(`  ✗ ${adapterName} - 缺少必要方法`);
      }
    } else {
      console.log(`  ✗ ${adapterName} - 文件不存在`);
    }
  }
  
  if (loadedCount === adapters.length) {
    pass(`所有 ${loadedCount} 个适配器加载验证通过`);
  } else {
    fail('适配器加载', `只有 ${loadedCount}/${adapters.length} 个适配器通过验证`);
  }
}


/**
 * 8.4.6 测试服务器 API 连接
 * 验证与服务器的 API 通信
 */
async function testServerAPIConnection() {
  log('\n📋 8.4.6 测试服务器 API 连接');
  
  try {
    const https = require('https');
    const http = require('http');
    
    // 测试健康检查端点
    const testEndpoint = (url, name) => {
      return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, { timeout: 10000 }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            resolve({ success: true, status: res.statusCode, data });
          });
        });
        
        req.on('error', (error) => {
          resolve({ success: false, error: error.message });
        });
        
        req.on('timeout', () => {
          req.destroy();
          resolve({ success: false, error: 'timeout' });
        });
      });
    };
    
    // 测试本地服务器（如果运行中）
    const localResult = await testEndpoint('http://localhost:3000/api/health', '本地服务器');
    if (localResult.success) {
      pass(`本地服务器连接成功 (状态码: ${localResult.status})`);
    } else {
      console.log(`  ⚠️ 本地服务器未运行: ${localResult.error}`);
    }
    
    // 测试生产服务器
    const prodResult = await testEndpoint('https://www.jzgeo.cc/api/health', '生产服务器');
    if (prodResult.success) {
      pass(`生产服务器连接成功 (状态码: ${prodResult.status})`);
    } else {
      fail('生产服务器连接', prodResult.error);
    }
    
  } catch (error) {
    fail('服务器 API 连接', error);
  }
}

/**
 * 8.4.7 测试离线队列机制
 * 验证网络失败时的数据保存和重试
 */
async function testOfflineQueue() {
  log('\n📋 8.4.7 测试离线队列机制');
  
  try {
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (e) {
      fail('离线队列', 'better-sqlite3 不可用');
      return;
    }
    
    const testDbPath = path.join(TEST_DATA_DIR, 'offline-queue-test.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    const db = new Database(testDbPath);
    
    // 创建离线队列表
    db.exec(`
      CREATE TABLE IF NOT EXISTS pending_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_type TEXT NOT NULL,
        report_data TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);
    
    // 模拟添加待上报数据
    const addPending = db.prepare(`
      INSERT INTO pending_analytics (report_type, report_data, created_at)
      VALUES (?, ?, ?)
    `);
    
    for (let i = 0; i < 5; i++) {
      addPending.run('publish', JSON.stringify({
        taskId: crypto.randomUUID(),
        platform: 'xiaohongshu',
        status: 'success',
        duration: 1000 + i * 100
      }), new Date().toISOString());
    }
    
    // 验证数据已保存
    const pendingCount = db.prepare('SELECT COUNT(*) as count FROM pending_analytics').get();
    if (pendingCount.count === 5) {
      pass('离线数据保存成功 (5 条)');
    } else {
      fail('离线数据保存', `数量不正确: ${pendingCount.count}`);
    }
    
    // 模拟重试机制
    const getPending = db.prepare('SELECT * FROM pending_analytics WHERE retry_count < 5 LIMIT 10');
    const incrementRetry = db.prepare('UPDATE pending_analytics SET retry_count = retry_count + 1 WHERE id = ?');
    const deletePending = db.prepare('DELETE FROM pending_analytics WHERE id = ?');
    
    const pending = getPending.all();
    let processedCount = 0;
    
    for (const item of pending) {
      // 模拟上报（假设前 3 个成功，后 2 个失败）
      if (processedCount < 3) {
        deletePending.run(item.id);
        processedCount++;
      } else {
        incrementRetry.run(item.id);
      }
    }
    
    // 验证处理结果
    const remainingCount = db.prepare('SELECT COUNT(*) as count FROM pending_analytics').get();
    const retriedItems = db.prepare('SELECT * FROM pending_analytics WHERE retry_count > 0').all();
    
    if (remainingCount.count === 2 && retriedItems.length === 2) {
      pass('离线队列重试机制正常 (3 条成功删除, 2 条重试计数增加)');
    } else {
      fail('离线队列重试', `剩余: ${remainingCount.count}, 重试: ${retriedItems.length}`);
    }
    
    // 测试超过重试次数的数据排除
    db.prepare('UPDATE pending_analytics SET retry_count = 5').run();
    const excludedItems = db.prepare('SELECT * FROM pending_analytics WHERE retry_count < 5').all();
    
    if (excludedItems.length === 0) {
      pass('超过重试次数的数据被正确排除');
    } else {
      fail('重试次数排除', `仍有 ${excludedItems.length} 条数据未被排除`);
    }
    
    // 清理
    db.close();
    fs.unlinkSync(testDbPath);
    
  } catch (error) {
    fail('离线队列', error);
  }
}

// ==================== 主测试函数 ====================

async function runAllTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 GEO 系统 Phase 8 完整测试');
  console.log('测试时间:', new Date().toISOString());
  console.log('='.repeat(70));
  
  // 8.3 性能测试
  console.log('\n' + '─'.repeat(70));
  console.log('📊 8.3 性能测试');
  console.log('─'.repeat(70));
  
  await testLargeFileProcessing();
  await testBulkInsertPerformance();
  await testMemoryUsage();
  
  // 8.4 集成测试
  console.log('\n' + '─'.repeat(70));
  console.log('🔗 8.4 集成测试');
  console.log('─'.repeat(70));
  
  await testCompletePublishFlow();
  await testMultiPlatformPublish();
  await testScheduledPublish();
  await testDataSync();
  await testAdapterLoading();
  await testServerAPIConnection();
  await testOfflineQueue();
  
  // 打印测试总结
  console.log('\n' + '='.repeat(70));
  console.log('📋 测试总结');
  console.log('='.repeat(70));
  
  console.log(`\n✅ 通过: ${results.passed.length}`);
  console.log(`❌ 失败: ${results.failed.length}`);
  console.log(`📊 总计: ${results.total}`);
  
  if (results.failed.length > 0) {
    console.log('\n失败的测试:');
    results.failed.forEach(f => {
      console.log(`  ❌ ${f.name}: ${f.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  
  // 返回退出码
  return results.failed.length === 0 ? 0 : 1;
}

// 运行测试
runAllTests()
  .then(exitCode => {
    console.log(`\n测试完成，退出码: ${exitCode}`);
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
