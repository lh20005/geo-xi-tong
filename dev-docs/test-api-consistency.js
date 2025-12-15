/**
 * 简单的 API 一致性测试脚本
 * 验证文章管理和文章设置页面的 API 调用是否正常
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5174';

async function testAPIConsistency() {
  console.log('🧪 开始测试 API 一致性...\n');

  try {
    // 测试 1: 获取文章列表
    console.log('📝 测试 1: 获取文章列表 (GET /api/articles)');
    try {
      const articlesResponse = await axios.get(`${API_BASE}/api/articles`);
      console.log('✅ 文章列表 API 调用成功');
      console.log(`   返回数据类型: ${typeof articlesResponse.data}`);
      console.log(`   状态码: ${articlesResponse.status}\n`);
    } catch (error) {
      console.log(`❌ 文章列表 API 调用失败: ${error.message}\n`);
    }

    // 测试 2: 获取文章设置列表
    console.log('⚙️  测试 2: 获取文章设置列表 (GET /api/article-settings)');
    try {
      const settingsResponse = await axios.get(`${API_BASE}/api/article-settings?page=1&pageSize=10`);
      console.log('✅ 文章设置列表 API 调用成功');
      console.log(`   返回数据类型: ${typeof settingsResponse.data}`);
      console.log(`   状态码: ${settingsResponse.status}\n`);
    } catch (error) {
      console.log(`❌ 文章设置列表 API 调用失败: ${error.message}\n`);
    }

    // 测试 3: 模拟页面切换 - 多次调用不同的 API
    console.log('🔄 测试 3: 模拟页面切换 (多次 API 调用)');
    for (let i = 0; i < 3; i++) {
      try {
        await axios.get(`${API_BASE}/api/articles`);
        await axios.get(`${API_BASE}/api/article-settings?page=1&pageSize=10`);
        console.log(`✅ 第 ${i + 1} 次切换成功`);
      } catch (error) {
        console.log(`❌ 第 ${i + 1} 次切换失败: ${error.message}`);
      }
    }

    console.log('\n✨ API 一致性测试完成！');
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error.message);
  }
}

testAPIConsistency();
