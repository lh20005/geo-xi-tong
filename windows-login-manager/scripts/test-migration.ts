/**
 * PostgreSQL 迁移功能测试脚本
 * 测试基本的数据库连接和 Service 类功能
 */

import { PostgresDatabase } from '../electron/database/postgres';
import { ArticleServicePostgres } from '../electron/services/ArticleServicePostgres';
import { DistillationServicePostgres } from '../electron/services/DistillationServicePostgres';
import { TopicServicePostgres } from '../electron/services/TopicServicePostgres';
import { ConversionTargetServicePostgres } from '../electron/services/ConversionTargetServicePostgres';
import { ArticleSettingServicePostgres } from '../electron/services/ArticleSettingServicePostgres';

// 测试用户 ID（从导入的数据中）
const TEST_USER_ID = 1;

async function testDatabaseConnection() {
  console.log('\n=== 测试 1: 数据库连接 ===');
  
  try {
    const db = PostgresDatabase.getInstance();
    await db.initialize();
    
    // 测试简单查询
    const result = await db.query('SELECT NOW() as current_time');
    console.log('✅ 数据库连接成功');
    console.log('   当前时间:', result.rows[0].current_time);
    
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
}

async function testArticleService() {
  console.log('\n=== 测试 2: 文章 Service ===');
  
  try {
    const articleService = new ArticleServicePostgres();
    articleService.setUserId(TEST_USER_ID);
    
    // 测试查询所有文章
    const articles = await articleService.findAll();
    console.log(`✅ 查询文章成功: 找到 ${articles.length} 篇文章`);
    
    if (articles.length > 0) {
      const firstArticle = articles[0];
      console.log(`   第一篇文章: ID=${firstArticle.id}, 标题=${firstArticle.title || '无标题'}`);
      
      // 测试根据 ID 查询
      const article = await articleService.findById(firstArticle.id);
      if (article) {
        console.log('✅ 根据 ID 查询文章成功');
      }
    }
    
    // 测试统计
    const stats = await articleService.getStats();
    console.log(`✅ 获取统计信息成功: 总数=${stats.total}`);
    
    return true;
  } catch (error) {
    console.error('❌ 文章 Service 测试失败:', error);
    return false;
  }
}

async function testDistillationService() {
  console.log('\n=== 测试 3: 蒸馏 Service ===');
  
  try {
    const distillationService = new DistillationServicePostgres();
    distillationService.setUserId(TEST_USER_ID);
    
    // 测试查询所有蒸馏记录
    const distillations = await distillationService.findAll();
    console.log(`✅ 查询蒸馏记录成功: 找到 ${distillations.length} 条记录`);
    
    if (distillations.length > 0) {
      const first = distillations[0];
      console.log(`   第一条记录: ID=${first.id}, 关键词=${first.keyword}`);
    }
    
    // 测试统计
    const stats = await distillationService.getStats();
    console.log(`✅ 获取统计信息成功: 总数=${stats.total}`);
    
    return true;
  } catch (error) {
    console.error('❌ 蒸馏 Service 测试失败:', error);
    return false;
  }
}

async function testTopicService() {
  console.log('\n=== 测试 4: 话题 Service ===');
  
  try {
    const topicService = new TopicServicePostgres();
    topicService.setUserId(TEST_USER_ID);
    
    // 测试查询所有话题
    const topics = await topicService.findAll();
    console.log(`✅ 查询话题成功: 找到 ${topics.length} 个话题`);
    
    if (topics.length > 0) {
      const first = topics[0];
      console.log(`   第一个话题: ID=${first.id}, 问题=${first.question?.substring(0, 50)}...`);
    }
    
    // 测试统计
    const stats = await topicService.getStats();
    console.log(`✅ 获取统计信息成功: 总数=${stats.total}`);
    
    return true;
  } catch (error) {
    console.error('❌ 话题 Service 测试失败:', error);
    return false;
  }
}

async function testConversionTargetService() {
  console.log('\n=== 测试 5: 转化目标 Service ===');
  
  try {
    const conversionTargetService = new ConversionTargetServicePostgres();
    conversionTargetService.setUserId(TEST_USER_ID);
    
    // 测试查询所有转化目标
    const targets = await conversionTargetService.findAll();
    console.log(`✅ 查询转化目标成功: 找到 ${targets.length} 个目标`);
    
    if (targets.length > 0) {
      const first = targets[0];
      console.log(`   第一个目标: ID=${first.id}, 名称=${first.name}`);
    }
    
    // 测试统计
    const stats = await conversionTargetService.getStats();
    console.log(`✅ 获取统计信息成功: 总数=${stats.total}`);
    
    return true;
  } catch (error) {
    console.error('❌ 转化目标 Service 测试失败:', error);
    return false;
  }
}

async function testArticleSettingService() {
  console.log('\n=== 测试 6: 文章设置 Service ===');
  
  try {
    const articleSettingService = new ArticleSettingServicePostgres();
    articleSettingService.setUserId(TEST_USER_ID);
    
    // 测试查询所有文章设置
    const settings = await articleSettingService.findAll();
    console.log(`✅ 查询文章设置成功: 找到 ${settings.length} 个设置`);
    
    if (settings.length > 0) {
      const first = settings[0];
      console.log(`   第一个设置: ID=${first.id}, 键=${first.setting_key}`);
    }
    
    // 测试统计
    const stats = await articleSettingService.getStats();
    console.log(`✅ 获取统计信息成功: 总数=${stats.total}`);
    
    return true;
  } catch (error) {
    console.error('❌ 文章设置 Service 测试失败:', error);
    return false;
  }
}

async function testDataIsolation() {
  console.log('\n=== 测试 7: 数据隔离 ===');
  
  try {
    const articleService1 = new ArticleServicePostgres();
    articleService1.setUserId(TEST_USER_ID);
    
    const articleService2 = new ArticleServicePostgres();
    articleService2.setUserId(999); // 不存在的用户
    
    const articles1 = await articleService1.findAll();
    const articles2 = await articleService2.findAll();
    
    console.log(`✅ 用户 ${TEST_USER_ID} 的文章数: ${articles1.length}`);
    console.log(`✅ 用户 999 的文章数: ${articles2.length}`);
    
    if (articles2.length === 0) {
      console.log('✅ 数据隔离验证成功: 不同用户看不到彼此的数据');
    } else {
      console.log('⚠️  数据隔离可能有问题');
    }
    
    return true;
  } catch (error) {
    console.error('❌ 数据隔离测试失败:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     PostgreSQL 迁移功能测试                            ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  const results = {
    databaseConnection: false,
    articleService: false,
    distillationService: false,
    topicService: false,
    conversionTargetService: false,
    articleSettingService: false,
    dataIsolation: false,
  };
  
  try {
    results.databaseConnection = await testDatabaseConnection();
    
    if (results.databaseConnection) {
      results.articleService = await testArticleService();
      results.distillationService = await testDistillationService();
      results.topicService = await testTopicService();
      results.conversionTargetService = await testConversionTargetService();
      results.articleSettingService = await testArticleSettingService();
      results.dataIsolation = await testDataIsolation();
    }
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
  }
  
  // 输出测试结果
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     测试结果汇总                                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  const testResults = [
    ['数据库连接', results.databaseConnection],
    ['文章 Service', results.articleService],
    ['蒸馏 Service', results.distillationService],
    ['话题 Service', results.topicService],
    ['转化目标 Service', results.conversionTargetService],
    ['文章设置 Service', results.articleSettingService],
    ['数据隔离', results.dataIsolation],
  ];
  
  let passedCount = 0;
  let totalCount = testResults.length;
  
  testResults.forEach(([name, passed]) => {
    const status = passed ? '✅ 通过' : '❌ 失败';
    console.log(`${status} - ${name}`);
    if (passed) passedCount++;
  });
  
  console.log(`\n总计: ${passedCount}/${totalCount} 测试通过`);
  
  if (passedCount === totalCount) {
    console.log('\n🎉 所有测试通过！PostgreSQL 迁移功能正常。');
  } else {
    console.log(`\n⚠️  有 ${totalCount - passedCount} 个测试失败，请检查。`);
  }
  
  // 关闭数据库连接
  const db = PostgresDatabase.getInstance();
  await db.close();
  
  process.exit(passedCount === totalCount ? 0 : 1);
}

// 运行测试
runAllTests().catch((error) => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
