/**
 * 测试登录功能
 * 用于验证用户账号是否可以正常登录
 */

const axios = require('axios');

// 配置
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// 测试账号
const testAccounts = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin'
  },
  {
    username: 'testuser',
    password: 'test123',
    role: 'user'
  }
];

async function testLogin(username, password, expectedRole) {
  try {
    console.log(`\n🔐 测试登录: ${username}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      username,
      password
    });

    if (response.data.success) {
      const { user, token } = response.data.data;
      console.log('✅ 登录成功！');
      console.log(`   用户名: ${user.username}`);
      console.log(`   邮箱: ${user.email || '未设置'}`);
      console.log(`   角色: ${user.role}`);
      console.log(`   Token: ${token.substring(0, 20)}...`);
      
      if (user.role === expectedRole) {
        console.log(`✅ 角色验证通过: ${user.role}`);
      } else {
        console.log(`❌ 角色验证失败: 期望 ${expectedRole}, 实际 ${user.role}`);
      }
      
      return true;
    } else {
      console.log('❌ 登录失败:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ 登录失败');
    
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误信息: ${error.response.data.message || error.response.statusText}`);
    } else if (error.request) {
      console.log('   错误: 无法连接到服务器');
      console.log(`   请确保后端服务正在运行: ${API_BASE_URL}`);
    } else {
      console.log('   错误:', error.message);
    }
    
    return false;
  }
}

async function runTests() {
  console.log('🚀 开始测试登录功能');
  console.log(`📡 API地址: ${API_BASE_URL}`);
  console.log('');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const account of testAccounts) {
    const success = await testLogin(account.username, account.password, account.role);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 测试结果汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 成功: ${successCount}`);
  console.log(`❌ 失败: ${failCount}`);
  console.log(`📈 成功率: ${(successCount / testAccounts.length * 100).toFixed(0)}%`);
  console.log('');
  
  if (failCount > 0) {
    console.log('💡 故障排查建议：');
    console.log('1. 检查后端服务是否正在运行');
    console.log('2. 检查数据库连接是否正常');
    console.log('3. 检查用户是否已创建');
    console.log('4. 检查密码hash是否正确');
    console.log('5. 查看后端日志获取详细错误信息');
    console.log('');
  }
}

// 运行测试
runTests().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
