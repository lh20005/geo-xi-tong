import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Wechatpay } from 'wechatpay-axios-plugin';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('=== 测试微信支付配置 ===\n');

// 1. 检查环境变量
console.log('1. 检查环境变量：');
const appId = process.env.WECHAT_PAY_APP_ID;
const mchId = process.env.WECHAT_PAY_MCH_ID;
const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
const serialNo = process.env.WECHAT_PAY_SERIAL_NO;
const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH;
const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL;

console.log('   WECHAT_PAY_APP_ID:', appId ? '✅' : '❌');
console.log('   WECHAT_PAY_MCH_ID:', mchId ? '✅' : '❌');
console.log('   WECHAT_PAY_API_V3_KEY:', apiV3Key ? '✅' : '❌');
console.log('   WECHAT_PAY_SERIAL_NO:', serialNo ? '✅' : '❌');
console.log('   WECHAT_PAY_PRIVATE_KEY_PATH:', privateKeyPath ? '✅' : '❌');
console.log('   WECHAT_PAY_NOTIFY_URL:', notifyUrl ? '✅' : '❌');

if (!appId || !mchId || !apiV3Key || !serialNo || !privateKeyPath || !notifyUrl) {
  console.log('\n❌ 环境变量配置不完整');
  process.exit(1);
}

// 2. 检查私钥文件
console.log('\n2. 检查私钥文件：');
console.log('   路径:', privateKeyPath);
if (fs.existsSync(privateKeyPath)) {
  console.log('   文件存在: ✅');
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  if (privateKey.includes('BEGIN PRIVATE KEY')) {
    console.log('   格式正确: ✅');
  } else {
    console.log('   格式错误: ❌');
    process.exit(1);
  }
} else {
  console.log('   文件不存在: ❌');
  process.exit(1);
}

// 3. 测试初始化微信支付
console.log('\n3. 测试初始化微信支付：');
try {
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  
  // 读取商户证书
  const certPath = privateKeyPath.replace('apiclient_key.pem', 'apiclient_cert.pem');
  console.log('   证书路径:', certPath);
  
  if (!fs.existsSync(certPath)) {
    console.log('   证书文件不存在: ❌');
    process.exit(1);
  }
  
  const certificate = fs.readFileSync(certPath, 'utf8');
  console.log('   证书文件存在: ✅');
  
  const wechatpay = new Wechatpay({
    mchid: mchId,
    serial: serialNo,
    privateKey: privateKey,
    certs: {
      [serialNo]: certificate, // 使用证书序列号作为key
    },
  } as any);
  
  console.log('   初始化成功: ✅');
  console.log('\n4. 测试创建订单（模拟）：');
  
  // 模拟创建订单的参数
  const testOrderData = {
    appid: appId,
    mchid: mchId,
    description: '测试订单',
    out_trade_no: 'TEST' + Date.now(),
    notify_url: notifyUrl,
    amount: {
      total: 1,
      currency: 'CNY'
    }
  };
  
  console.log('   订单参数:', JSON.stringify(testOrderData, null, 2));
  console.log('\n✅ 所有配置检查通过！');
  console.log('\n可以尝试创建真实订单了。');
  
} catch (error) {
  console.log('   初始化失败: ❌');
  console.error('   错误:', error);
  process.exit(1);
}
