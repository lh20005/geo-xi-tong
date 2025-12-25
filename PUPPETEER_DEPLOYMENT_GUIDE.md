# Puppeteer 部署到腾讯云服务器指南

## 📋 当前状态分析

### 本地依赖情况
- **Puppeteer 版本**: `24.33.0`
- **安装位置**: `server/node_modules/puppeteer`
- **Chrome 浏览器**: 
  - 本地使用系统 Chrome（macOS）
  - 如果找不到系统 Chrome，使用 Puppeteer 内置的 Chromium

### 使用场景
1. **账号登录自动化** (`server/src/services/AccountService.ts`)
2. **多平台文章发布** (`server/src/services/BrowserAutomationService.ts`)
3. **各平台适配器** (`server/src/services/adapters/*.ts`)

---

## 🚀 腾讯云服务器部署步骤

### 1. 系统依赖安装

#### Ubuntu/Debian 系统
```bash
# 更新包管理器
sudo apt-get update

# 安装 Chrome 依赖库
sudo apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils

# 安装中文字体（支持中文内容）
sudo apt-get install -y fonts-wqy-zenhei fonts-wqy-microhei
```

#### CentOS/RHEL 系统
```bash
# 更新包管理器
sudo yum update -y

# 安装 Chrome 依赖库
sudo yum install -y \
  alsa-lib \
  atk \
  cups-libs \
  gtk3 \
  ipa-gothic-fonts \
  libXcomposite \
  libXcursor \
  libXdamage \
  libXext \
  libXi \
  libXrandr \
  libXScrnSaver \
  libXtst \
  pango \
  xorg-x11-fonts-100dpi \
  xorg-x11-fonts-75dpi \
  xorg-x11-fonts-cyrillic \
  xorg-x11-fonts-misc \
  xorg-x11-fonts-Type1 \
  xorg-x11-utils

# 安装中文字体
sudo yum install -y wqy-zenhei-fonts
```

### 2. 安装 Google Chrome（推荐）

```bash
# Ubuntu/Debian
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f  # 修复依赖问题

# CentOS/RHEL
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo yum install -y google-chrome-stable_current_x86_64.rpm

# 验证安装
google-chrome --version
```

### 3. 修改代码配置

#### 方案 A：使用系统 Chrome（推荐）

修改 `server/src/config/browserConfig.ts`：

```typescript
export function findChromeExecutable(): string | undefined {
  const chromePaths = [
    '/usr/bin/google-chrome',           // Linux (新增)
    '/usr/bin/chromium',                // Linux Chromium
    '/usr/bin/chromium-browser',        // Ubuntu Chromium (新增)
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  const fs = require('fs');
  
  for (const path of chromePaths) {
    try {
      if (fs.existsSync(path)) {
        console.log(`✅ 找到Chrome浏览器: ${path}`);
        return path;
      }
    } catch (e) {
      // 继续尝试下一个路径
    }
  }

  console.log('⚠️  未找到系统Chrome，将使用Puppeteer内置浏览器');
  return undefined;
}
```

#### 方案 B：使用 Puppeteer 内置 Chromium（简单但体积大）

不需要修改代码，Puppeteer 会自动下载 Chromium。

**注意事项**：
- Chromium 体积约 300MB
- 下载可能较慢，建议使用国内镜像

```bash
# 设置 Puppeteer 国内镜像（安装前）
export PUPPETEER_DOWNLOAD_HOST=https://registry.npmmirror.com/-/binary/chrome-for-testing

# 或者在 .npmrc 中配置
echo "puppeteer_download_host=https://registry.npmmirror.com/-/binary/chrome-for-testing" >> ~/.npmrc
```

### 4. 修改浏览器启动参数

修改 `server/src/config/browserConfig.ts` 的 `getStandardBrowserConfig` 函数：

```typescript
export function getStandardBrowserConfig(options: {
  headless?: boolean;
  executablePath?: string;
} = {}): BrowserLaunchOptions {
  // 检测是否在服务器环境
  const isServer = !process.env.DISPLAY && process.platform === 'linux';
  
  return {
    headless: options.headless ?? isServer, // 服务器环境默认 headless
    executablePath: options.executablePath,
    defaultViewport: null,
    args: [
      '--no-sandbox',                    // 必须：服务器环境需要
      '--disable-setuid-sandbox',        // 必须：服务器环境需要
      '--disable-dev-shm-usage',         // 必须：避免共享内存不足
      '--disable-gpu',                   // 新增：服务器无GPU
      '--disable-software-rasterizer',   // 新增：禁用软件光栅化
      '--disable-extensions',            // 新增：禁用扩展
      '--disable-background-networking', // 新增：禁用后台网络
      '--disable-default-apps',          // 新增：禁用默认应用
      '--disable-sync',                  // 新增：禁用同步
      '--metrics-recording-only',        // 新增：仅记录指标
      '--mute-audio',                    // 新增：静音
      '--no-first-run',                  // 新增：跳过首次运行
      '--safebrowsing-disable-auto-update', // 新增：禁用安全浏览更新
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      ...(isServer ? [] : ['--start-maximized']) // 本地才最大化
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    ignoreHTTPSErrors: true
  };
}
```

### 5. 环境变量配置

在服务器的 `.env` 文件中添加：

```bash
# Puppeteer 配置
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome  # Chrome 路径
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true              # 跳过 Chromium 下载（如果使用系统 Chrome）

# 浏览器配置
BROWSER_HEADLESS=true                              # 服务器环境使用 headless 模式
BROWSER_TIMEOUT=60000                              # 超时时间（毫秒）
```

修改 `server/src/config/browserConfig.ts` 读取环境变量：

```typescript
export function getStandardBrowserConfig(options: {
  headless?: boolean;
  executablePath?: string;
} = {}): BrowserLaunchOptions {
  const isServer = !process.env.DISPLAY && process.platform === 'linux';
  
  return {
    headless: options.headless ?? 
              (process.env.BROWSER_HEADLESS === 'true') ?? 
              isServer,
    executablePath: options.executablePath ?? 
                    process.env.PUPPETEER_EXECUTABLE_PATH,
    // ... 其他配置
  };
}
```

### 6. 内存和资源优化

#### 限制并发浏览器实例

修改 `server/src/services/BrowserAutomationService.ts`：

```typescript
export class BrowserAutomationService {
  private browser: Browser | null = null;
  private maxConcurrentPages = 3; // 限制最大页面数
  private activePagesCount = 0;

  async createPage(): Promise<Page> {
    // 检查并发限制
    if (this.activePagesCount >= this.maxConcurrentPages) {
      throw new Error('已达到最大并发页面数');
    }

    if (!this.browser) {
      await this.launchBrowser();
    }

    const page = await this.browser!.newPage();
    this.activePagesCount++;
    
    // 页面关闭时减少计数
    page.on('close', () => {
      this.activePagesCount--;
    });

    return page;
  }
}
```

#### 添加内存监控

```typescript
// 监控内存使用
setInterval(() => {
  const used = process.memoryUsage();
  console.log('内存使用:', {
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`
  });
}, 60000); // 每分钟检查一次
```

### 7. 部署脚本

创建 `deploy-to-tencent.sh`：

```bash
#!/bin/bash

echo "🚀 开始部署到腾讯云..."

# 1. 安装系统依赖
echo "📦 安装系统依赖..."
sudo apt-get update
sudo apt-get install -y ca-certificates fonts-liberation libappindicator3-1 \
  libasound2 libatk-bridge2.0-0 libatk1.0-0 libgbm1 libgtk-3-0 libnss3 \
  libxss1 fonts-wqy-zenhei fonts-wqy-microhei

# 2. 安装 Chrome
echo "🌐 安装 Google Chrome..."
if ! command -v google-chrome &> /dev/null; then
  wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  sudo dpkg -i google-chrome-stable_current_amd64.deb
  sudo apt-get install -f -y
  rm google-chrome-stable_current_amd64.deb
fi

# 3. 验证 Chrome
echo "✅ 验证 Chrome 安装..."
google-chrome --version

# 4. 安装 Node.js 依赖
echo "📦 安装 Node.js 依赖..."
cd server
npm install

# 5. 构建项目
echo "🔨 构建项目..."
npm run build

# 6. 启动服务
echo "🎉 启动服务..."
pm2 restart geo-server || pm2 start dist/index.js --name geo-server

echo "✅ 部署完成！"
```

### 8. PM2 配置（推荐）

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'geo-server',
    script: './server/dist/index.js',
    instances: 1, // 单实例（避免浏览器冲突）
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      BROWSER_HEADLESS: 'true',
      PUPPETEER_EXECUTABLE_PATH: '/usr/bin/google-chrome'
    },
    max_memory_restart: '1G', // 内存超过 1GB 自动重启
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
```

启动：
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 🔍 常见问题排查

### 1. Chrome 启动失败

**错误**: `Failed to launch chrome!`

**解决方案**:
```bash
# 检查 Chrome 是否安装
which google-chrome

# 检查依赖库
ldd /usr/bin/google-chrome | grep "not found"

# 手动测试 Chrome
google-chrome --headless --no-sandbox --disable-gpu --dump-dom https://www.baidu.com
```

### 2. 共享内存不足

**错误**: `/dev/shm too small`

**解决方案**:
```bash
# 增加共享内存
sudo mount -o remount,size=2G /dev/shm

# 或在启动参数中添加
--disable-dev-shm-usage
```

### 3. 字体缺失（中文乱码）

**解决方案**:
```bash
# 安装中文字体
sudo apt-get install -y fonts-wqy-zenhei fonts-wqy-microhei

# 刷新字体缓存
fc-cache -fv
```

### 4. 内存占用过高

**解决方案**:
- 限制并发浏览器实例
- 及时关闭不用的页面
- 使用 PM2 的 `max_memory_restart` 自动重启
- 考虑使用 `--disable-dev-shm-usage` 参数

### 5. 权限问题

**错误**: `Running as root without --no-sandbox is not supported`

**解决方案**:
```bash
# 不要使用 root 用户运行
# 创建专用用户
sudo useradd -m -s /bin/bash geoapp
sudo chown -R geoapp:geoapp /path/to/project

# 切换用户
su - geoapp
```

---

## 📊 性能对比

| 配置 | 内存占用 | 启动速度 | 稳定性 |
|------|---------|---------|--------|
| 系统 Chrome + headless | ~200MB | 快 | ⭐⭐⭐⭐⭐ |
| Puppeteer Chromium + headless | ~250MB | 中 | ⭐⭐⭐⭐ |
| 系统 Chrome + GUI | ~400MB | 慢 | ⭐⭐⭐ |

**推荐**: 服务器环境使用 **系统 Chrome + headless 模式**

---

## ✅ 部署检查清单

- [ ] 安装系统依赖库
- [ ] 安装 Google Chrome
- [ ] 安装中文字体
- [ ] 修改 `browserConfig.ts` 添加 Linux Chrome 路径
- [ ] 修改启动参数支持服务器环境
- [ ] 配置环境变量
- [ ] 限制并发浏览器实例
- [ ] 配置 PM2 自动重启
- [ ] 测试浏览器启动
- [ ] 测试账号登录功能
- [ ] 测试文章发布功能
- [ ] 配置日志监控
- [ ] 配置内存监控

---

## 🎯 快速测试

部署完成后，运行以下测试：

```bash
# 测试 Chrome 启动
node -e "const puppeteer = require('puppeteer'); (async () => { const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']}); console.log('✅ Chrome 启动成功'); await browser.close(); })()"

# 测试访问网页
node -e "const puppeteer = require('puppeteer'); (async () => { const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']}); const page = await browser.newPage(); await page.goto('https://www.baidu.com'); console.log('✅ 网页访问成功'); await browser.close(); })()"
```

---

## 📚 参考资料

- [Puppeteer 官方文档](https://pptr.dev/)
- [Puppeteer Troubleshooting](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md)
- [Chrome Headless 最佳实践](https://developers.google.com/web/updates/2017/04/headless-chrome)
