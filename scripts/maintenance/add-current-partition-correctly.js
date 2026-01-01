#!/usr/bin/env node
/**
 * 正确地添加 currentPartition 属性到类定义中
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
  
  // 检查是否已经有 currentPartition
  if (content.includes('private currentPartition: string')) {
    console.log(`ℹ️  ${filename}: 已有 currentPartition 属性`);
    return;
  }
  
  // 在 private constructor() 之前添加 currentPartition
  const constructorPattern = /(\n\n  private constructor\(\) \{\})/;
  if (constructorPattern.test(content)) {
    content = content.replace(
      constructorPattern,
      '\n\n  // 当前登录使用的临时 partition\n  private currentPartition: string = \'\';$1'
    );
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${filename}: 添加 currentPartition 属性`);
  } else {
    console.log(`⚠️  ${filename}: 未找到 constructor`);
  }
});

console.log('\n🎉 完成！');
