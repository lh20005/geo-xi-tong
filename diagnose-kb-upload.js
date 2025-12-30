/**
 * 知识库文件上传诊断脚本
 * 测试文件序列化和 Blob 重构
 */

const fs = require('fs');
const path = require('path');

console.log('=== 知识库文件上传诊断 ===\n');

// 测试1: 模拟前端文件读取
console.log('测试1: 模拟前端文件序列化');
try {
  // 创建测试文件
  const testFilePath = path.join(__dirname, 'test-upload.txt');
  const testContent = '这是一个测试文件\n用于验证文件上传功能';
  fs.writeFileSync(testFilePath, testContent, 'utf8');
  
  // 读取文件为 Buffer（模拟 ArrayBuffer）
  const buffer = fs.readFileSync(testFilePath);
  const arrayData = Array.from(buffer);
  
  console.log('✅ 文件读取成功');
  console.log(`   文件大小: ${buffer.length} bytes`);
  console.log(`   数组长度: ${arrayData.length}`);
  console.log(`   前10个字节: [${arrayData.slice(0, 10).join(', ')}]`);
  
  // 测试2: 模拟 IPC Handler 重构 Blob
  console.log('\n测试2: 模拟 Blob 重构');
  
  const fileData = {
    name: 'test-upload.txt',
    type: 'text/plain',
    buffer: arrayData
  };
  
  // 重构 Buffer
  const reconstructedBuffer = Buffer.from(fileData.buffer);
  console.log('✅ Buffer 重构成功');
  console.log(`   重构后大小: ${reconstructedBuffer.length} bytes`);
  
  // 验证内容一致性
  const reconstructedContent = reconstructedBuffer.toString('utf8');
  if (reconstructedContent === testContent) {
    console.log('✅ 内容验证通过');
  } else {
    console.log('❌ 内容验证失败');
    console.log(`   原始: ${testContent}`);
    console.log(`   重构: ${reconstructedContent}`);
  }
  
  // 测试3: 检查 Blob 构造（Node.js 环境）
  console.log('\n测试3: Blob 对象构造');
  
  // Node.js 18+ 支持 Blob
  if (typeof Blob !== 'undefined') {
    const blob = new Blob([reconstructedBuffer], { type: fileData.type });
    console.log('✅ Blob 创建成功');
    console.log(`   Blob 大小: ${blob.size} bytes`);
    console.log(`   Blob 类型: ${blob.type}`);
    
    // 添加 name 属性
    Object.defineProperty(blob, 'name', {
      value: fileData.name,
      writable: false
    });
    console.log(`   Blob name: ${blob.name}`);
  } else {
    console.log('⚠️  当前 Node.js 版本不支持 Blob（需要 18+）');
    console.log('   Electron 环境应该支持 Blob');
  }
  
  // 清理测试文件
  fs.unlinkSync(testFilePath);
  console.log('\n✅ 测试文件已清理');
  
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  console.error(error.stack);
}

// 测试4: 检查后端路由
console.log('\n测试4: 检查后端路由配置');
const routePath = path.join(__dirname, 'server/src/routes/knowledgeBase.ts');
if (fs.existsSync(routePath)) {
  const routeContent = fs.readFileSync(routePath, 'utf8');
  
  // 检查关键代码
  const checks = [
    { name: 'multer 中间件', pattern: /upload\.array\('files'/ },
    { name: '用户验证', pattern: /getCurrentTenantId/ },
    { name: '所有权验证', pattern: /WHERE id = \$1 AND user_id = \$2/ },
    { name: '文件解析', pattern: /DocumentParserService/ },
    { name: '事务处理', pattern: /BEGIN.*COMMIT/s }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(routeContent)) {
      console.log(`✅ ${check.name} - 已配置`);
    } else {
      console.log(`❌ ${check.name} - 未找到`);
    }
  });
} else {
  console.log('❌ 后端路由文件不存在');
}

// 测试5: 检查前端代码
console.log('\n测试5: 检查前端代码');
const frontendPath = path.join(__dirname, 'windows-login-manager/src/pages/KnowledgeBaseDetailPage.tsx');
if (fs.existsSync(frontendPath)) {
  const frontendContent = fs.readFileSync(frontendPath, 'utf8');
  
  const checks = [
    { name: 'arrayBuffer 读取', pattern: /arrayBuffer\(\)/ },
    { name: 'Uint8Array 转换', pattern: /new Uint8Array\(buffer\)/ },
    { name: 'Array.from 转换', pattern: /Array\.from/ },
    { name: 'IPC 调用', pattern: /uploadKnowledgeBaseDocuments/ }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(frontendContent)) {
      console.log(`✅ ${check.name} - 已实现`);
    } else {
      console.log(`❌ ${check.name} - 未找到`);
    }
  });
} else {
  console.log('❌ 前端文件不存在');
}

// 测试6: 检查 IPC Handler
console.log('\n测试6: 检查 IPC Handler');
const ipcPath = path.join(__dirname, 'windows-login-manager/electron/ipc/handler.ts');
if (fs.existsSync(ipcPath)) {
  const ipcContent = fs.readFileSync(ipcPath, 'utf8');
  
  const checks = [
    { name: 'Buffer.from 重构', pattern: /Buffer\.from\(fileData\.buffer\)/ },
    { name: 'Blob 创建', pattern: /new Blob\(\[buffer\]/ },
    { name: 'name 属性添加', pattern: /Object\.defineProperty\(blob, 'name'/ },
    { name: '错误处理', pattern: /catch \(error/ }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(ipcContent)) {
      console.log(`✅ ${check.name} - 已实现`);
    } else {
      console.log(`❌ ${check.name} - 未找到`);
    }
  });
} else {
  console.log('❌ IPC Handler 文件不存在');
}

console.log('\n=== 诊断完成 ===');
console.log('\n建议操作:');
console.log('1. 如果所有检查都通过，重启 Windows 登录管理器');
console.log('2. 打开开发者工具查看控制台错误');
console.log('3. 检查 Electron 日志文件');
console.log('4. 尝试上传一个小的 .txt 文件测试');
