// 测试 headless 模式判断
const { getStandardBrowserConfig } = require('./server/dist/config/browserConfig');

console.log('=== 环境信息 ===');
console.log('操作系统:', process.platform);
console.log('DISPLAY:', process.env.DISPLAY || '(未设置)');

const isServer = !process.env.DISPLAY && process.platform === 'linux';
console.log('是否服务器环境:', isServer);

console.log('\n=== 浏览器配置 ===');
const config = getStandardBrowserConfig();
console.log('headless 模式:', config.headless);
console.log('启动参数:', config.args);

console.log('\n=== 结论 ===');
if (config.headless) {
  console.log('❌ 后台运行，看不到浏览器窗口');
} else {
  console.log('✅ 会显示浏览器窗口');
}
