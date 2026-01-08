/**
 * 测试微信小程序码生成
 */

import axios from 'axios';

async function test() {
  const appId = process.env.WECHAT_PAY_APP_ID || 'wx76c24846b57dfaa9';
  const appSecret = process.env.WECHAT_APP_SECRET || 'e1ff433c276535905e6b1587ea12e76c';
  
  console.log('AppID:', appId);
  console.log('AppSecret:', appSecret.substring(0, 8) + '...');
  
  // 1. 获取 access_token
  console.log('\n1. 获取 access_token...');
  const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  const tokenRes = await axios.get(tokenUrl);
  console.log('Token 响应:', JSON.stringify(tokenRes.data, null, 2));
  
  if (tokenRes.data.errcode) {
    console.log('获取 token 失败');
    return;
  }
  
  const accessToken = tokenRes.data.access_token;
  
  // 2. 生成小程序码
  console.log('\n2. 生成小程序码...');
  const qrUrl = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`;
  
  try {
    const qrRes = await axios.post(qrUrl, {
      scene: '123456',
      page: 'pages/bindAgent/bindAgent',
      width: 280,
      env_version: 'develop'
    }, {
      responseType: 'arraybuffer'
    });
    
    const contentType = qrRes.headers['content-type'];
    console.log('Content-Type:', contentType);
    
    if (contentType && contentType.includes('application/json')) {
      const errorData = JSON.parse(Buffer.from(qrRes.data).toString());
      console.log('错误响应:', JSON.stringify(errorData, null, 2));
    } else {
      console.log('成功！图片大小:', qrRes.data.length, 'bytes');
      // 保存图片
      const fs = require('fs');
      fs.writeFileSync('/tmp/test_qrcode.png', qrRes.data);
      console.log('图片已保存到 /tmp/test_qrcode.png');
    }
  } catch (e: any) {
    console.log('请求失败:', e.message);
  }
}

test().catch(console.error);
