/**
 * 本地服务测试脚本
 * 用于测试 Phase 8 的功能测试项目
 * 
 * 运行方式：在 windows-login-manager 目录下执行
 * node test-local-services.js
 * 
 * 注意：此脚本需要在编译后运行，因为服务是 TypeScript
 */

const path = require('path');
const fs = require('fs');

// 模拟 Electron app 对象
const mockApp = {
  getPath: (name) => {
    if (name === 'userData') {
      return path.join(__dirname, 'test-data');
    }
    return __dirname;
  },
  isPackaged: false
};

// 在加载模块前设置 mock
global.mockElectronApp = mockApp;

// 测试结果收集
const testResults = {
  passed: [],
  failed: [],
  skipped: []
};

function logTest(name, passed, error = null) {
  if (passed) {
    console.log(`✅ ${name}`);
    testResults.passed.push(name);
  } else {
    console.log(`❌ ${name}`);
    if (error) console.log(`   Error: ${error.message || error}`);
    testResults.failed.push({ name, error: error?.message || String(error) });
  }
}

function logSkip(name, reason) {
  console.log(`⏭️  ${name} - ${reason}`);
  testResults.skipped.push({ name, reason });
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`📋 ${title}`);
  console.log('='.repeat(60));
}

async function runTests() {
  console.log('\n🚀 GEO 系统本地服务测试');
  console.log('测试时间:', new Date().toISOString());
  console.log('测试目录:', __dirname);

  // 确保测试数据目录存在
  const testDataDir = path.join(__dirname, 'test-data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // 检查编译后的文件是否存在
  const distDir = path.join(__dirname, 'dist-electron');
  if (!fs.existsSync(distDir)) {
    console.log('\n❌ 编译目录不存在，请先运行: npm run build:electron');
    process.exit(1);
  }

  // 由于服务依赖 Electron，我们需要检查关键文件
  logSection('1. 检查编译文件');
  
  const requiredFiles = [
    'dist-electron/database/sqlite.js',
    'dist-electron/services/ArticleService.js',
    'dist-electron/services/AccountService.js',
    'dist-electron/services/GalleryService.js',
    'dist-electron/services/KnowledgeBaseService.js',
    'dist-electron/services/TaskService.js',
    'dist-electron/browser/BrowserAutomationService.js',
    'dist-electron/adapters/AdapterRegistry.js',
    'dist-electron/publishing/PublishingExecutor.js'
  ];

  let allFilesExist = true;
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    const exists = fs.existsSync(filePath);
    logTest(`文件存在: ${file}`, exists);
    if (!exists) allFilesExist = false;
  }

  if (!allFilesExist) {
    console.log('\n⚠️  部分编译文件缺失，请检查编译是否成功');
  }

  // 检查迁移文件
  logSection('2. 检查迁移文件');
  
  const migrationsDir = path.join(__dirname, 'dist-electron/database/migrations');
  if (fs.existsSync(migrationsDir)) {
    const migrations = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    logTest(`迁移文件目录存在`, true);
    logTest(`迁移文件数量: ${migrations.length}`, migrations.length > 0);
    migrations.forEach(m => console.log(`   - ${m}`));
  } else {
    logTest('迁移文件目录存在', false, '目录不存在');
  }

  // 检查数据库文件
  logSection('3. 检查数据库');
  
  const dbPath = path.join(testDataDir, 'geo-data.db');
  const dbExists = fs.existsSync(dbPath);
  logTest(`数据库文件存在: ${dbPath}`, dbExists);
  
  if (dbExists) {
    const stats = fs.statSync(dbPath);
    console.log(`   数据库大小: ${(stats.size / 1024).toFixed(2)} KB`);
  }

  // 由于无法在 Node.js 中直接运行 Electron 模块，我们检查 IPC 处理器
  logSection('4. 检查 IPC 处理器');
  
  const ipcHandlers = [
    'dist-electron/ipc/handlers/articleHandlers.js',
    'dist-electron/ipc/handlers/taskHandlers.js',
    'dist-electron/ipc/handlers/publishHandlers.js',
    'dist-electron/ipc/handlers/browserHandlers.js',
    'dist-electron/ipc/handlers/localAccountHandlers.js',
    'dist-electron/ipc/handlers/localKnowledgeHandlers.js',
    'dist-electron/ipc/handlers/localGalleryHandlers.js',
    'dist-electron/ipc/handlers/dataSyncHandlers.js'
  ];

  for (const handler of ipcHandlers) {
    const handlerPath = path.join(__dirname, handler);
    const exists = fs.existsSync(handlerPath);
    logTest(`IPC 处理器: ${path.basename(handler)}`, exists);
  }

  // 检查适配器
  logSection('5. 检查平台适配器');
  
  const adapters = [
    'XiaohongshuAdapter.js',
    'DouyinAdapter.js',
    'ToutiaoAdapter.js',
    'ZhihuAdapter.js',
    'BaijiahaoAdapter.js',
    'WangyiAdapter.js',
    'SohuAdapter.js',
    'CSDNAdapter.js',
    'JianshuAdapter.js',
    'WechatAdapter.js',
    'QieAdapter.js',
    'BilibiliAdapter.js'
  ];

  const adaptersDir = path.join(__dirname, 'dist-electron/adapters');
  for (const adapter of adapters) {
    const adapterPath = path.join(adaptersDir, adapter);
    const exists = fs.existsSync(adapterPath);
    logTest(`适配器: ${adapter}`, exists);
  }

  // 检查发布引擎
  logSection('6. 检查发布引擎');
  
  const publishingFiles = [
    'PublishingExecutor.js',
    'BatchExecutor.js',
    'TaskScheduler.js',
    'ImageUploadService.js'
  ];

  const publishingDir = path.join(__dirname, 'dist-electron/publishing');
  for (const file of publishingFiles) {
    const filePath = path.join(publishingDir, file);
    const exists = fs.existsSync(filePath);
    logTest(`发布模块: ${file}`, exists);
  }

  // 检查 API 客户端
  logSection('7. 检查 API 客户端');
  
  const apiClientPath = path.join(__dirname, 'dist-electron/api/client.js');
  const apiClientExists = fs.existsSync(apiClientPath);
  logTest('API 客户端存在', apiClientExists);

  if (apiClientExists) {
    const content = fs.readFileSync(apiClientPath, 'utf-8');
    logTest('包含 reserveQuota 方法', content.includes('reserveQuota'));
    logTest('包含 confirmQuota 方法', content.includes('confirmQuota'));
    logTest('包含 releaseQuota 方法', content.includes('releaseQuota'));
    logTest('包含 reportPublish 方法', content.includes('reportPublish'));
    logTest('包含 reportPublishBatch 方法', content.includes('reportPublishBatch'));
  }

  // 检查前端 Store
  logSection('8. 检查前端 Store');
  
  const stores = [
    'src/stores/articleStore.ts',
    'src/stores/taskStore.ts',
    'src/stores/accountStore.ts',
    'src/stores/knowledgeStore.ts',
    'src/stores/galleryStore.ts',
    'src/stores/syncStore.ts'
  ];

  for (const store of stores) {
    const storePath = path.join(__dirname, store);
    const exists = fs.existsSync(storePath);
    logTest(`Store: ${path.basename(store)}`, exists);
  }

  // 检查前端 API 抽象层
  logSection('9. 检查前端 API 抽象层');
  
  const apiFiles = [
    'src/api/local.ts',
    'src/api/remote.ts',
    'src/api/index.ts'
  ];

  for (const apiFile of apiFiles) {
    const apiPath = path.join(__dirname, apiFile);
    const exists = fs.existsSync(apiPath);
    logTest(`API 文件: ${path.basename(apiFile)}`, exists);
  }

  // 检查数据同步页面
  logSection('10. 检查数据同步页面');
  
  const dataSyncPage = path.join(__dirname, 'src/pages/DataSyncPage.tsx');
  const dataSyncExists = fs.existsSync(dataSyncPage);
  logTest('DataSyncPage.tsx 存在', dataSyncExists);

  // 打印测试总结
  logSection('测试总结');
  
  console.log(`\n✅ 通过: ${testResults.passed.length}`);
  console.log(`❌ 失败: ${testResults.failed.length}`);
  console.log(`⏭️  跳过: ${testResults.skipped.length}`);

  if (testResults.failed.length > 0) {
    console.log('\n失败的测试:');
    testResults.failed.forEach(f => {
      console.log(`  - ${f.name}: ${f.error}`);
    });
  }

  // 返回退出码
  return testResults.failed.length === 0 ? 0 : 1;
}

// 运行测试
runTests()
  .then(exitCode => {
    console.log('\n测试完成');
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
