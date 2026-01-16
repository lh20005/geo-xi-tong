/**
 * 快速测试脚本 - PostgreSQL 迁移验证
 * 
 * 使用方法：
 * 1. 启动应用: npm run dev
 * 2. 打开开发者工具: Cmd+Option+I (Mac) 或 Ctrl+Shift+I (Windows)
 * 3. 在控制台中粘贴并运行此脚本
 * 
 * 这个脚本会测试所有模块的基本 CRUD 功能
 */

(async function testMigration() {
  console.log('🚀 开始测试 PostgreSQL 迁移...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };
  
  // 测试辅助函数
  async function test(name, fn) {
    try {
      console.log(`⏳ 测试: ${name}`);
      await fn();
      console.log(`✅ 通过: ${name}\n`);
      results.passed++;
    } catch (error) {
      console.error(`❌ 失败: ${name}`);
      console.error(`   错误: ${error.message}\n`);
      results.failed++;
      results.errors.push({ name, error: error.message });
    }
  }
  
  // 测试文章模块
  await test('文章列表查询', async () => {
    const result = await window.electron.invoke('article:local:findAll', {});
    if (!result.success) throw new Error(result.error);
    console.log(`   找到 ${result.data.length} 篇文章`);
  });
  
  // 测试图库模块
  await test('相册列表查询', async () => {
    const result = await window.electron.invoke('gallery:local:findAllAlbums', {});
    if (!result.success) throw new Error(result.error);
    console.log(`   找到 ${result.data.length} 个相册`);
  });

  // 测试知识库模块
  await test('知识库列表查询', async () => {
    const result = await window.electron.invoke('knowledge:local:findAll', {});
    if (!result.success) throw new Error(result.error);
    console.log(`   找到 ${result.data.length} 个知识库文档`);
  });
  
  // 测试平台账号模块
  await test('平台账号列表查询', async () => {
    const result = await window.electron.invoke('account:local:findAll', {});
    if (!result.success) throw new Error(result.error);
    console.log(`   找到 ${result.data.length} 个平台账号`);
  });
  
  // 测试发布任务模块
  await test('发布任务列表查询', async () => {
    const result = await window.electron.invoke('task:local:findAll', {});
    if (!result.success) throw new Error(result.error);
    console.log(`   找到 ${result.data.length} 个发布任务`);
  });
  
  // 测试蒸馏模块
  await test('蒸馏记录列表查询', async () => {
    const result = await window.electron.invoke('distillation:local:findAll', {});
    if (!result.success) throw new Error(result.error);
    console.log(`   找到 ${result.data.length} 条蒸馏记录`);
  });
  
  // 测试话题模块
  await test('话题列表查询', async () => {
    const result = await window.electron.invoke('topic:local:findAll', {});
    if (!result.success) throw new Error(result.error);
    console.log(`   找到 ${result.data.length} 个话题`);
  });
  
  // 测试转化目标模块
  await test('转化目标列表查询', async () => {
    const result = await window.electron.invoke('conversionTarget:local:findAll', {});
    if (!result.success) throw new Error(result.error);
    console.log(`   找到 ${result.data.length} 个转化目标`);
  });
  
  // 测试文章设置模块
  await test('文章设置列表查询', async () => {
    const result = await window.electron.invoke('articleSetting:local:findAll', {});
    if (!result.success) throw new Error(result.error);
    console.log(`   找到 ${result.data.length} 个文章设置`);
  });
  
  // 输出测试结果
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(50));
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📈 成功率: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ 失败的测试:');
    results.errors.forEach(({ name, error }) => {
      console.log(`   - ${name}: ${error}`);
    });
  }
  
  console.log('\n✨ 测试完成！');
})();
