#!/usr/bin/env node
/**
 * 修复被破坏的登录管理器文件
 * 移除错误插入的 currentPartition 声明
 */

const fs = require('fs');
const path = require('path');

const loginManagersDir = path.join(__dirname, 'windows-login-manager/electron/login');

const files = [
  'xiaohongshu-login-manager.ts',
  'wechat-login-manager.ts',
  'baijiahao-login-manager.ts',
  'jianshu-login-manager.ts',
  'zhihu-login-manager.ts',
  'qie-login-manager.ts',
  'souhu-login-manager.ts',
  'wangyi-login-manager.ts',
  'csdn-login-manager.ts',
  'bilibili-login-manager.ts'
];

files.forEach(filename => {
  const filePath = path.join(loginManagersDir, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${filename}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // 移除错误插入的 currentPartition 声明（在方法内部的）
  const wrongPattern = /\n\n  \/\/ 当前登录使用的临时 partition\n  private currentPartition: string = '';\n\n    try \{/g;
  if (wrongPattern.test(content)) {
    content = content.replace(wrongPattern, '\n\n    try {');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${filename}: 移除错误的 currentPartition 声明`);
  } else {
    console.log(`ℹ️  ${filename}: 未发现错误`);
  }
});

console.log('\n🎉 修复完成！');
