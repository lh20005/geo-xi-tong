/**
 * Service 类基本功能测试（Node.js 环境）
 * 
 * 这个脚本可以在 Node.js 环境中运行，测试 Service 类的基本功能
 */

import { Pool } from 'pg';

// 数据库配置
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'geo_windows',
  user: process.env.DB_USER || 'geo_user',
  password: process.env.DB_PASSWORD || '',
});

// 测试结果
const results = {
  passed: 0,
  failed: 0,
  errors: [] as Array<{ test: string; error: string }>,
};

// 测试辅助函数
async function test(name: string, fn: () => Promise<void>) {
  try {
    console.log(`⏳ 测试: ${name}`);
    await fn();
    console.log(`✅ 通过: ${name}\n`);
    results.passed++;
  } catch (error: any) {
    console.error(`❌ 失败: ${name}`);
    console.error(`   错误: ${error.message}\n`);
    results.failed++;
    results.errors.push({ test: name, error: error.message });
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始测试 PostgreSQL Service 类...\n');
  
  try {
    // 测试数据库连接
    await test('数据库连接', async () => {
      const result = await pool.query('SELECT 1 as test');
      if (result.rows[0].test !== 1) {
        throw new Error('数据库查询结果不正确');
      }
    });
    
    // 测试用户表
    await test('查询用户表', async () => {
      const result = await pool.query('SELECT COUNT(*) as count FROM users');
      const count = parseInt(result.rows[0].count);
      console.log(`   找到 ${count} 个用户`);
      if (count === 0) {
        throw new Error('用户表为空');
      }
    });
    
    // 测试文章表
    await test('查询文章表', async () => {
      const result = await pool.query('SELECT COUNT(*) as count FROM windows_articles');
      const count = parseInt(result.rows[0].count);
      console.log(`   找到 ${count} 篇文章`);
    });
    
    // 测试相册表
    await test('查询相册表', async () => {
      const result = await pool.query('SELECT COUNT(*) as count FROM windows_albums');
      const count = parseInt(result.rows[0].count);
      console.log(`   找到 ${count} 个相册`);
    });
    
    // 测试图片表
    await test('查询图片表', async () => {
      const result = await pool.query('SELECT COUNT(*) as count FROM windows_images');
      const count = parseInt(result.rows[0].count);
      console.log(`   找到 ${count} 张图片`);
    });
    
    // 测试知识库表
    await test('查询知识库表', async () => {
      const result = await pool.query('SELECT COUNT(*) as count FROM windows_knowledge_bases');
      const count = parseInt(result.rows[0].count);
      console.log(`   找到 ${count} 个知识库`);
    });
    
    // 测试平台账号表
    await test('查询平台账号表', async () => {
      const result = await pool.query('SELECT COUNT(*) as count FROM windows_platform_accounts');
      const count = parseInt(result.rows[0].count);
      console.log(`   找到 ${count} 个平台账号`);
    });
    
    // 测试发布任务表
    await test('查询发布任务表', async () => {
      const result = await pool.query('SELECT COUNT(*) as count FROM windows_publishing_tasks');
      const count = parseInt(result.rows[0].count);
      console.log(`   找到 ${count} 个发布任务`);
    });
    
    // 测试蒸馏表
    await test('查询蒸馏表', async () => {
      const result = await pool.query('SELECT COUNT(*) as count FROM windows_distillations');
      const count = parseInt(result.rows[0].count);
      console.log(`   找到 ${count} 条蒸馏记录`);
    });
    
    // 测试话题表
    await test('查询话题表', async () => {
      const result = await pool.query('SELECT COUNT(*) as count FROM windows_topics');
      const count = parseInt(result.rows[0].count);
      console.log(`   找到 ${count} 个话题`);
    });
    
    // 测试转化目标表
    await test('查询转化目标表', async () => {
      const result = await pool.query('SELECT COUNT(*) as count FROM windows_conversion_targets');
      const count = parseInt(result.rows[0].count);
      console.log(`   找到 ${count} 个转化目标`);
    });
    
    // 测试文章设置表
    await test('查询文章设置表', async () => {
      const result = await pool.query('SELECT COUNT(*) as count FROM windows_article_settings');
      const count = parseInt(result.rows[0].count);
      console.log(`   找到 ${count} 个文章设置`);
    });
    
    // 测试数据隔离（查询特定用户的数据）
    await test('数据隔离验证', async () => {
      const userResult = await pool.query('SELECT id FROM users LIMIT 1');
      if (userResult.rows.length === 0) {
        throw new Error('没有用户数据');
      }
      
      const userId = userResult.rows[0].id;
      console.log(`   测试用户 ID: ${userId}`);
      
      // 查询该用户的文章
      const articleResult = await pool.query(
        'SELECT COUNT(*) as count FROM windows_articles WHERE user_id = $1',
        [userId]
      );
      const articleCount = parseInt(articleResult.rows[0].count);
      console.log(`   用户 ${userId} 有 ${articleCount} 篇文章`);
    });
    
  } catch (error: any) {
    console.error('测试过程中发生错误:', error.message);
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
  
  // 输出测试结果
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(50));
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📈 成功率: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ 失败的测试:');
    results.errors.forEach(({ test, error }) => {
      console.log(`   - ${test}: ${error}`);
    });
  }
  
  console.log('\n✨ 测试完成！');
  
  // 退出进程
  process.exit(results.failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch((error) => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
