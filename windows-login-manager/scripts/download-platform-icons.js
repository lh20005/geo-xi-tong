/**
 * 下载平台图标脚本
 * 使用方法: node scripts/download-platform-icons.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 平台图标URL映射
const platformIcons = {
  'toutiao': 'https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/img/favicon.ico',
  'weixin': 'https://res.wx.qq.com/a/wx_fed/assets/res/OTE0YTAw.png',
  'zhihu': 'https://static.zhihu.com/heifetz/favicon.ico',
  'douyin': 'https://lf1-cdn-tos.bytegoofy.com/goofy/ies/douyin_web/public/favicon.ico',
  'bilibili': 'https://www.bilibili.com/favicon.ico',
  'baidu': 'https://www.baidu.com/favicon.ico',
  'sohu': 'https://statics.itc.cn/web/static/images/favicon.ico',
  'sina': 'https://www.sina.com.cn/favicon.ico',
  'wangyi': 'https://www.163.com/favicon.ico',
  'qq': 'https://mat1.gtimg.com/www/icon/favicon2.ico',
  'taobao': 'https://www.taobao.com/favicon.ico',
  'jd': 'https://www.jd.com/favicon.ico'
};

// 输出目录
const outputDir = path.join(__dirname, '../public/platform-icons');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 下载单个图标
function downloadIcon(platformId, url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const ext = path.extname(url).split('?')[0] || '.png';
    const outputPath = path.join(outputDir, `${platformId}${ext}`);

    console.log(`正在下载 ${platformId} 图标...`);

    protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(outputPath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`✓ ${platformId} 图标下载成功`);
          resolve();
        });
      } else {
        console.error(`✗ ${platformId} 图标下载失败: HTTP ${response.statusCode}`);
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (err) => {
      console.error(`✗ ${platformId} 图标下载失败:`, err.message);
      reject(err);
    });
  });
}

// 下载所有图标
async function downloadAllIcons() {
  console.log('开始下载平台图标...\n');

  for (const [platformId, url] of Object.entries(platformIcons)) {
    try {
      await downloadIcon(platformId, url);
    } catch (error) {
      // 继续下载其他图标
    }
  }

  console.log('\n图标下载完成！');
  console.log(`图标保存在: ${outputDir}`);
}

// 执行下载
downloadAllIcons().catch(console.error);
