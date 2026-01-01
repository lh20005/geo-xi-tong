#!/usr/bin/env node
/**
 * 批量修复所有登录管理器的 partition 问题
 * 使用临时 partition 确保每次登录都是全新的会话
 */

const fs = require('fs');
const path = require('path');

const loginManagersDir = path.join(__dirname, 'windows-login-manager/electron/login');

// 需要修复的文件列表
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
  let modified = false;

  // 1. 添加 currentPartition 属性（在配置常量后面）
  if (!content.includes('private currentPartition: string')) {
    // 找到最后一个 private readonly 配置
    const lastReadonlyMatch = content.match(/private readonly [A-Z_]+.*?;(?=\n\n|$)/gs);
    if (lastReadonlyMatch) {
      const lastReadonly = lastReadonlyMatch[lastReadonlyMatch.length - 1];
      const insertPos = content.indexOf(lastReadonly) + lastReadonly.length;
      content = content.slice(0, insertPos) + '\n\n  // 当前登录使用的临时 partition\n  private currentPartition: string = \'\';' + content.slice(insertPos);
      modified = true;
      console.log(`✅ ${filename}: 添加 currentPartition 属性`);
    }
  }

  // 2. 修改 createWebView 方法中的 partition
  const createWebViewRegex = /partition: `persist:\$\{this\.PLATFORM_ID\}`/g;
  if (createWebViewRegex.test(content)) {
    // 找到 createWebView 方法
    const methodMatch = content.match(/private async createWebView\(\): Promise<void> \{[\s\S]*?log\.info\(\[.*?\] 创建 WebView'\);[\s\S]*?\}/);
    if (methodMatch) {
      const oldMethod = methodMatch[0];
      let newMethod = oldMethod;
      
      // 添加临时 partition 创建代码
      if (!newMethod.includes('temp-login-')) {
        newMethod = newMethod.replace(
          /(log\.info\(\[.*?\] 创建 WebView'\);)/,
          `$1\n\n    // 使用临时 partition，确保每次登录都是全新的会话\n    this.currentPartition = \`temp-login-\${this.PLATFORM_ID}-\${Date.now()}\`;\n    log.info(\`[${filename.replace('-login-manager.ts', '')}] 使用临时 partition: \${this.currentPartition}\`);`
        );
      }
      
      // 替换 partition 使用
      newMethod = newMethod.replace(
        /partition: `persist:\$\{this\.PLATFORM_ID\}`/g,
        'partition: this.currentPartition'
      );
      
      content = content.replace(oldMethod, newMethod);
      modified = true;
      console.log(`✅ ${filename}: 修改 createWebView 方法`);
    }
  }

  // 3. 修改 captureCredentials 或 getCookies 方法中的 partition
  const captureRegex = /session\.fromPartition\(`persist:\$\{this\.PLATFORM_ID\}`\)/g;
  if (captureRegex.test(content)) {
    content = content.replace(captureRegex, 'session.fromPartition(this.currentPartition)');
    modified = true;
    console.log(`✅ ${filename}: 修改 captureCredentials/getCookies 方法`);
  }

  const partitionVarRegex = /const partition = `persist:\$\{this\.PLATFORM_ID\}`;/g;
  if (partitionVarRegex.test(content)) {
    content = content.replace(partitionVarRegex, 'const partition = this.currentPartition;');
    modified = true;
    console.log(`✅ ${filename}: 修改 partition 变量`);
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${filename}: 修复完成\n`);
  } else {
    console.log(`ℹ️  ${filename}: 无需修改\n`);
  }
});

console.log('\n🎉 所有文件处理完成！');
