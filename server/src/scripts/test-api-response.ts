/**
 * 测试用户列表API响应
 */

import axios from 'axios';

async function testApiResponse() {
  console.log('=== 测试用户列表API响应 ===\n');

  try {
    // 假设你有一个管理员token，这里需要替换
    const token = process.env.ADMIN_TOKEN || 'your-admin-token-here';
    
    console.log('1. 调用 /api/admin/users API：');
    const response = await axios.get('http://localhost:3000/api/admin/users', {
      params: {
        page: 1,
        pageSize: 10
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('API响应状态:', response.status);
    console.log('API响应数据:\n', JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.data.users) {
      console.log('\n2. 用户订阅套餐信息：');
      response.data.data.users.forEach((user: any) => {
        console.log(`  ${user.username}: ${user.subscriptionPlanName || '无订阅'}`);
      });

      const noSubCount = response.data.data.users.filter((u: any) => 
        !u.subscriptionPlanName || u.subscriptionPlanName === '无订阅'
      ).length;

      console.log(`\n3. 统计：`);
      console.log(`   总用户数: ${response.data.data.users.length}`);
      console.log(`   无订阅用户: ${noSubCount}`);
      console.log(`   有订阅用户: ${response.data.data.users.length - noSubCount}`);
    }

  } catch (error: any) {
    if (error.response) {
      console.error('API错误响应:', error.response.status);
      console.error('错误详情:', error.response.data);
    } else {
      console.error('请求失败:', error.message);
    }
  }
}

testApiResponse();
