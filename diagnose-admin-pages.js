#!/usr/bin/env node

/**
 * 诊断管理员页面API问题
 * 使用方法: node diagnose-admin-pages.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('========================================');
console.log('管理员页面API诊断工具');
console.log('========================================\n');

rl.question('请输入你的认证令牌 (从浏览器localStorage.getItem("auth_token")获取): ', async (token) => {
  if (!token || token.trim() === '') {
    console.log('❌ 令牌不能为空');
    rl.close();
    return;
  }

  const API_BASE = 'http://localhost:3000';
  
  console.log('\n开始测试...\n');

  // 测试1: 验证令牌
  console.log('1️⃣  测试令牌有效性');
  console.log('-----------------------------------');
  try {
    const response = await fetch(`${API_BASE}/api/users/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ 令牌有效');
      console.log(`   用户: ${data.data.username}`);
      console.log(`   角色: ${data.data.role}`);
      
      if (data.data.role !== 'admin') {
        console.log('⚠️  警告: 当前用户不是管理员，无法访问管理员页面');
      }
    } else {
      console.log('❌ 令牌无效或已过期');
      console.log(`   错误: ${data.message}`);
      rl.close();
      return;
    }
  } catch (error) {
    console.log('❌ 网络错误:', error.message);
    rl.close();
    return;
  }

  console.log('\n');

  // 测试2: 订单列表API
  console.log('2️⃣  测试订单列表API');
  console.log('-----------------------------------');
  try {
    const response = await fetch(`${API_BASE}/api/admin/orders?page=1&limit=10`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    console.log(`   状态码: ${response.status}`);
    console.log(`   响应:`, JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('✅ 订单列表API正常');
      console.log(`   订单数量: ${data.pagination?.total || 0}`);
    } else {
      console.log('❌ 订单列表API失败');
      console.log(`   错误: ${data.message || '未知错误'}`);
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
  }

  console.log('\n');

  // 测试3: 订单统计API
  console.log('3️⃣  测试订单统计API');
  console.log('-----------------------------------');
  try {
    const response = await fetch(`${API_BASE}/api/admin/orders/stats/summary`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    console.log(`   状态码: ${response.status}`);
    
    if (response.ok && data.success) {
      console.log('✅ 订单统计API正常');
      console.log(`   统计数据:`, JSON.stringify(data.data, null, 2));
    } else {
      console.log('❌ 订单统计API失败');
      console.log(`   错误: ${data.message || '未知错误'}`);
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
  }

  console.log('\n');

  // 测试4: 套餐列表API
  console.log('4️⃣  测试套餐列表API');
  console.log('-----------------------------------');
  try {
    const response = await fetch(`${API_BASE}/api/admin/products`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    console.log(`   状态码: ${response.status}`);
    
    if (response.ok && data.success) {
      console.log('✅ 套餐列表API正常');
      console.log(`   套餐数量: ${data.data?.length || 0}`);
      if (data.data && data.data.length > 0) {
        console.log(`   套餐列表:`);
        data.data.forEach(plan => {
          console.log(`     - ${plan.plan_name}: ¥${plan.price}`);
        });
      }
    } else {
      console.log('❌ 套餐列表API失败');
      console.log(`   错误: ${data.message || '未知错误'}`);
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
  }

  console.log('\n');
  console.log('========================================');
  console.log('诊断完成');
  console.log('========================================');
  
  rl.close();
});
