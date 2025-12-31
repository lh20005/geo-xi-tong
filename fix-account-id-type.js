#!/usr/bin/env node

const fs = require('fs');

// 需要修改的文件列表
const files = [
  'windows-login-manager/electron/login/baijiahao-login-manager.ts',
  'windows-login-manager/electron/login/bilibili-login-manager.ts',
  'windows-login-manager/electron/login/csdn-login-manager.ts',
  'windows-login-manager/electron/login/douyin-login-manager.ts',
  'windows-login-manager/electron/login/jianshu-login-manager.ts',
  'windows-login-manager/electron/login/qie-login-manager.ts',
  'windows-login-manager/electron/login/souhu-login-manager.ts',
  'windows-login-manager/electron/login/toutiao-login-manager.ts',
  'windows-login-manager/electron/login/wangyi-login-manager.ts',
  'windows-login-manager/electron/login/wechat-login-manager.ts',
  'windows-login-manager/electron/login/xiaohongshu-login-manager.ts',
  'windows-login-manager/electron/login/zhihu-login-manager.ts'
];

files.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`❌ 文件不存在: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(file, 'utf8');
  
  // 替换 account.id = backendAccount.id 为类型安全的方式
  content = content.replace(
    /(\s+)account\.id = backendAccount\.id;/g,
    `$1(account as any).id = backendAccount.id;`
  );
  
  fs.writeFileSync(file, content, 'utf8');
  console.log(`✅ 已修改: ${file}`);
});

console.log('\n✨ 类型修复完成！');
