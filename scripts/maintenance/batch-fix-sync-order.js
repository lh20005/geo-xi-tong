#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要修改的平台列表
const platforms = [
  { name: 'bilibili', file: 'windows-login-manager/electron/login/bilibili-login-manager.ts', label: 'Bilibili' },
  { name: 'csdn', file: 'windows-login-manager/electron/login/csdn-login-manager.ts', label: 'CSDN' },
  { name: 'douyin', file: 'windows-login-manager/electron/login/douyin-login-manager.ts', label: 'Douyin' },
  { name: 'qie', file: 'windows-login-manager/electron/login/qie-login-manager.ts', label: 'Qie' },
  { name: 'souhu', file: 'windows-login-manager/electron/login/souhu-login-manager.ts', label: 'Souhu' },
  { name: 'wangyi', file: 'windows-login-manager/electron/login/wangyi-login-manager.ts', label: 'Wangyi' },
  { name: 'zhihu', file: 'windows-login-manager/electron/login/zhihu-login-manager.ts', label: 'Zhihu' }
];

platforms.forEach(platform => {
  const filePath = platform.file;
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ 文件不存在: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // 修改1: 调整调用顺序（保存到本地 -> 同步到后端）
  const callPattern1 = /(\s+)\/\/ \d+\. 保存账号\s+await this\.saveAccount\(account\);\s+\/\/ \d+\. 同步到后端\s+await this\.syncToBackend\(account\);/;
  const callPattern2 = /(\s+)\/\/ \d+\. 保存到本地\s+await this\.saveAccountLocally\(account\);\s+\/\/ \d+\. 同步到后端\s+await this\.syncAccountToBackend\(account\);/;
  
  if (callPattern1.test(content)) {
    content = content.replace(callPattern1, (match, indent) => {
      const num1 = match.match(/\/\/ (\d+)\. 保存账号/)[1];
      const num2 = match.match(/\/\/ (\d+)\. 同步到后端/)[1];
      return `${indent}// ${num1}. 先同步到后端（必须先同步，确保后端有数据）
${indent}const backendAccount = await this.syncToBackend(account);
${indent}
${indent}// ${num2}. 同步成功后，使用后端返回的账号ID保存到本地
${indent}if (backendAccount && backendAccount.id) {
${indent}  account.id = backendAccount.id;
${indent}  await this.saveAccount(account);
${indent}} else {
${indent}  log.warn('[${platform.label}] 后端同步失败，不保存到本地缓存');
${indent}}`;
    });
    modified = true;
  } else if (callPattern2.test(content)) {
    content = content.replace(callPattern2, (match, indent) => {
      const num1 = match.match(/\/\/ (\d+)\. 保存到本地/)[1];
      const num2 = match.match(/\/\/ (\d+)\. 同步到后端/)[1];
      return `${indent}// ${num1}. 先同步到后端（必须先同步，确保后端有数据）
${indent}const backendAccount = await this.syncAccountToBackend(account);
${indent}
${indent}// ${num2}. 同步成功后，使用后端返回的账号ID保存到本地
${indent}if (backendAccount && backendAccount.id) {
${indent}  account.id = backendAccount.id;
${indent}  await this.saveAccountLocally(account);
${indent}} else {
${indent}  log.warn('[${platform.label}] 后端同步失败，不保存到本地缓存');
${indent}}`;
    });
    modified = true;
  }
  
  // 修改2: 修改 syncToBackend 方法签名和实现
  const syncPattern1 = /private async syncToBackend\(account: any\): Promise<void> \{\s+try \{\s+log\.info\('\[.*?\] 同步账号到后端\.\.\.'\);\s+const result = await syncService\.syncAccount\(account\);\s+if \(result\.success\) \{\s+log\.info\('\[.*?\] 账号同步成功'\);\s+\} else \{\s+log\.warn\('\[.*?\] 账号同步失败，已加入队列:', result\.error\);\s+\}\s+\} catch \(error\) \{\s+log\.error\('\[.*?\] 同步账号失败:', error\);\s+\}\s+\}/;
  
  const syncPattern2 = /private async syncAccountToBackend\(account: any\): Promise<void> \{\s+try \{\s+const result = await syncService\.syncAccount\(account\);\s+if \(result\.success\) \{\s+log\.info\('\[.*?\] 账号已同步到后端'\);\s+\} else \{\s+log\.warn\('\[.*?\] 账号同步失败，已加入队列:', result\.error\);\s+\}\s+\} catch \(error\) \{\s+log\.error\('\[.*?\] 同步账号到后端失败:', error\);\s+\}\s+\}/;
  
  // 简化的替换：只替换方法签名和关键部分
  content = content.replace(
    /private async syncToBackend\(account: any\): Promise<void>/g,
    `private async syncToBackend(account: any): Promise<any>`
  );
  
  content = content.replace(
    /private async syncAccountToBackend\(account: any\): Promise<void>/g,
    `private async syncAccountToBackend(account: any): Promise<any>`
  );
  
  // 替换方法体中的 log.warn 为 log.error 并添加 throw
  content = content.replace(
    /(\s+)log\.warn\('\[(.*?)\] 账号同步失败，已加入队列:', result\.error\);/g,
    `$1log.error('[$2] 账号同步失败:', result.error);
$1throw new Error(result.error || '同步失败');`
  );
  
  // 在成功分支添加 return
  content = content.replace(
    /(log\.info\('\[(.*?)\] 账号同步成功'\);)/g,
    `$1
        return result.account; // 返回后端创建的账号对象`
  );
  
  content = content.replace(
    /(log\.info\('\[(.*?)\] 账号已同步到后端'\);)/g,
    `$1
        return result.account; // 返回后端创建的账号对象`
  );
  
  // 在 catch 块添加 throw
  content = content.replace(
    /(log\.error\('\[(.*?)\] 同步账号失败:', error\);)\s+\}/g,
    `$1
      throw error;
    }`
  );
  
  content = content.replace(
    /(log\.error\('\[(.*?)\] 同步账号到后端失败:', error\);)\s+\}/g,
    `$1
      throw error;
    }`
  );
  
  if (modified || content !== fs.readFileSync(filePath, 'utf8')) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 已修改: ${platform.label}`);
  } else {
    console.log(`⚠️  未检测到需要修改的模式: ${platform.label}`);
  }
});

console.log('\n✨ 批量修改完成！');
