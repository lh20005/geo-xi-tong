require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log('=== 测试环境变量加载 ===');
console.log('WECHAT_PAY_APP_ID:', process.env.WECHAT_PAY_APP_ID);
console.log('WECHAT_PAY_MCH_ID:', process.env.WECHAT_PAY_MCH_ID);
console.log('WECHAT_PAY_API_V3_KEY:', process.env.WECHAT_PAY_API_V3_KEY ? '已设置' : '未设置');
console.log('WECHAT_PAY_SERIAL_NO:', process.env.WECHAT_PAY_SERIAL_NO);
console.log('WECHAT_PAY_PRIVATE_KEY_PATH:', process.env.WECHAT_PAY_PRIVATE_KEY_PATH);
console.log('WECHAT_PAY_NOTIFY_URL:', process.env.WECHAT_PAY_NOTIFY_URL);
