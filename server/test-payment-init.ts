import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Wechatpay } from 'wechatpay-axios-plugin';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('=== 测试微信支付初始化 ===\n');

const mchId = process.env.WECHAT_PAY_MCH_ID!;
const serialNo = process.env.WECHAT_PAY_SERIAL_NO!;
const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH!;

console.log('1. 读取私钥...');
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
console.log('   ✅ 私钥读取成功');

console.log('\n2. 读取微信支付公钥...');
const publicKeyPath = privateKeyPath.replace('apiclient_key.pem', 'wechat_pay_public_key.pem');
console.log('   公钥路径:', publicKeyPath);

if (!fs.existsSync(publicKeyPath)) {
  console.log('   ❌ 公钥文件不存在');
  process.exit(1);
}

const wechatPayPublicKey = fs.readFileSync(publicKeyPath, 'utf8');
console.log('   ✅ 公钥读取成功');

console.log('\n3. 初始化微信支付...');
try {
  const wechatpay = new Wechatpay({
    mchid: mchId,
    serial: serialNo,
    privateKey: privateKey,
    certs: {
      'wechatpay-public-key': wechatPayPublicKey,
    },
  } as any);
  
  console.log('   ✅ 初始化成功');
  
  console.log('\n4. 测试创建订单参数...');
  const testOrder = {
    appid: process.env.WECHAT_PAY_APP_ID,
    mchid: mchId,
    description: '测试订单',
    out_trade_no: 'TEST' + Date.now(),
    notify_url: process.env.WECHAT_PAY_NOTIFY_URL,
    amount: {
      total: 1,
      currency: 'CNY'
    }
  };
  
  console.log('   订单参数:', JSON.stringify(testOrder, null, 2));
  console.log('\n✅ 所有检查通过！');
  
} catch (error: any) {
  console.log('   ❌ 初始化失败');
  console.error('   错误:', error.message);
  if (error.stack) {
    console.error('   堆栈:', error.stack);
  }
  process.exit(1);
}
