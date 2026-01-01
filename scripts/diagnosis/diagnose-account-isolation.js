#!/usr/bin/env node

/**
 * 诊断平台账号隔离问题
 * 检查 lzc2005 和 testuser 的账号数据
 */

const jwt = require('jsonwebtoken');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n========================================');
console.log('🔍 平台账号隔离问题诊断工具');
console.log('========================================\n');

console.log('请提供以下信息来诊断问题：\n');

// 询问用户提供 token
rl.question('1. 请粘贴 lzc2005 用户的 JWT token（从 Windows 端获取）:\n', (lzc2005Token) => {
  rl.question('\n2. 请粘贴 testuser 用户的 JWT token（从 Web 端获取）:\n', (testuserToken) => {
    
    console.log('\n========================================');
    console.log('📊 Token 分析结果');
    console.log('========================================\n');
    
    try {
      // 解码 token（不验证签名）
      const lzc2005Decoded = jwt.decode(lzc2005Token);
      const testuserDecoded = jwt.decode(testuserToken);
      
      console.log('lzc2005 的 Token 信息:');
      console.log('  用户ID:', lzc2005Decoded?.userId);
      console.log('  用户名:', lzc2005Decoded?.username);
      console.log('  角色:', lzc2005Decoded?.role || '未设置');
      console.log('  过期时间:', lzc2005Decoded?.exp ? new Date(lzc2005Decoded.exp * 1000).toLocaleString() : '未设置');
      
      console.log('\ntestuser 的 Token 信息:');
      console.log('  用户ID:', testuserDecoded?.userId);
      console.log('  用户名:', testuserDecoded?.username);
      console.log('  角色:', testuserDecoded?.role || '未设置');
      console.log('  过期时间:', testuserDecoded?.exp ? new Date(testuserDecoded.exp * 1000).toLocaleString() : '未设置');
      
      console.log('\n========================================');
      console.log('🔍 问题诊断');
      console.log('========================================\n');
      
      if (lzc2005Decoded?.userId === testuserDecoded?.userId) {
        console.log('❌ 发现问题！两个用户使用了相同的用户ID:', lzc2005Decoded.userId);
        console.log('\n可能的原因:');
        console.log('  1. Windows 端和 Web 端共享了同一个 token');
        console.log('  2. 两个账号实际上是同一个用户');
        console.log('  3. Token 被错误地复制或共享');
        console.log('\n解决方案:');
        console.log('  1. 在 Windows 端重新登录 lzc2005 账号');
        console.log('  2. 在 Web 端重新登录 testuser 账号');
        console.log('  3. 确保两个客户端使用不同的 localStorage/storage');
      } else if (lzc2005Decoded?.userId && testuserDecoded?.userId) {
        console.log('✅ Token 正常！两个用户使用了不同的用户ID:');
        console.log('  lzc2005 用户ID:', lzc2005Decoded.userId);
        console.log('  testuser 用户ID:', testuserDecoded.userId);
        console.log('\n如果仍然看到数据混淆，可能是:');
        console.log('  1. 数据库中的 user_id 字段有问题');
        console.log('  2. 后端代码没有正确使用 userId 进行过滤');
        console.log('  3. 缓存问题导致数据显示错误');
      } else {
        console.log('⚠️  无法解析 token，请检查 token 是否正确');
      }
      
      console.log('\n========================================\n');
      
    } catch (error) {
      console.error('❌ 解析 token 失败:', error.message);
      console.log('\n请确保提供的是有效的 JWT token');
    }
    
    rl.close();
  });
});
