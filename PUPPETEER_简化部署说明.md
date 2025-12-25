# Puppeteer 腾讯云部署 - 简化说明

## ✅ 可以直接部署！不需要模拟云端环境

### 为什么可以直接部署？

Puppeteer 是**跨平台**的 npm 包：
- 本地 macOS：`npm install` 自动下载 macOS 版 Chromium
- 服务器 Linux：`npm install` 自动下载 Linux 版 Chromium
- 代码完全相同，无需修改

---

## 🚀 实际部署步骤（3步）

### 方案 A：最简单（推荐新手）

```bash
# 1. 在服务器上克隆代码
git clone your-repo
cd your-project

# 2. 安装依赖（会自动下载 Linux 版 Chromium）
cd server
npm install

# 3. 安装系统依赖（重要！）
sudo apt-get update
sudo apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libgbm1 \
  libgtk-3-0 \
  libnss3 \
  libxss1 \
  fonts-wqy-zenhei

# 4. 启动服务
npm run build
npm start
```

**就这么简单！** Puppeteer 会使用自己下载的 Chromium。

---

### 方案 B：使用系统 Chrome（更稳定）

```bash
# 1-2. 同上（克隆代码 + npm install）

# 3. 安装 Google Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f -y

# 4. 修改一行代码（可选）
# 在 server/src/config/browserConfig.ts 的 chromePaths 数组最前面加上：
# '/usr/bin/google-chrome',  // Linux

# 5. 启动服务
npm run build
npm start
```

---

## ⚠️ 唯一需要注意的事项

### 1. 安装系统依赖库（必须）

Chromium 需要一些系统库才能运行：

```bash
# Ubuntu/Debian
sudo apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libgbm1 \
  libgtk-3-0 \
  libnss3 \
  libxss1 \
  fonts-wqy-zenhei
```

**不安装会报错**：
```
Error: Failed to launch chrome!
```

### 2. 使用 headless 模式（建议）

服务器没有显示器，建议使用 headless 模式。

**当前代码已经支持**，会自动检测：
```typescript
// server/src/config/browserConfig.ts
const isServer = !process.env.DISPLAY && process.platform === 'linux';
headless: options.headless ?? isServer  // Linux 服务器自动 headless
```

或者在 `.env` 中设置：
```bash
BROWSER_HEADLESS=true
```

---

## 📦 部署流程对比

### ❌ 不需要这样做：
```bash
# 本地
npm install  # 下载 macOS 版
npm run build
打包整个 node_modules
上传到服务器  # ❌ 错误！macOS 版在 Linux 上无法运行
```

### ✅ 正确做法：
```bash
# 本地
git push

# 服务器
git pull
npm install  # ✅ 自动下载 Linux 版
npm run build
npm start
```

---

## 🎯 一键部署脚本

创建 `deploy.sh`（在服务器上运行）：

```bash
#!/bin/bash
set -e

echo "🚀 开始部署..."

# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖
cd server
npm install

# 3. 构建
npm run build

# 4. 重启服务
pm2 restart geo-server || pm2 start dist/index.js --name geo-server

echo "✅ 部署完成！"
```

使用：
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 🔍 验证部署是否成功

```bash
# 测试 Puppeteer 是否正常工作
node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  console.log('✅ Puppeteer 工作正常');
  await browser.close();
})();
"
```

---

## 💡 总结

| 问题 | 答案 |
|------|------|
| 需要在本地模拟云端环境吗？ | ❌ 不需要 |
| 需要特殊打包吗？ | ❌ 不需要 |
| 需要上传 node_modules 吗？ | ❌ 不需要 |
| 代码需要修改吗？ | ❌ 基本不需要（已经兼容） |
| 需要安装系统依赖吗？ | ✅ 需要（一次性） |
| 可以直接 git pull + npm install 吗？ | ✅ 可以！ |

**核心原则**：
- 代码跨平台，直接部署
- 依赖自动适配，无需打包
- 只需安装系统库，一次配置

---

## 🆘 如果遇到问题

### 问题 1：Chrome 启动失败
```bash
# 检查系统依赖
ldd $(which google-chrome) | grep "not found"

# 补装缺失的库
sudo apt-get install -f
```

### 问题 2：内存不足
```bash
# 在 .env 中限制并发
MAX_CONCURRENT_BROWSERS=1
```

### 问题 3：中文乱码
```bash
# 安装中文字体
sudo apt-get install -y fonts-wqy-zenhei fonts-wqy-microhei
```

---

## 📞 快速支持

如果部署遇到问题，运行诊断脚本：

```bash
# 创建 diagnose.sh
cat > diagnose.sh << 'EOF'
#!/bin/bash
echo "=== 系统信息 ==="
uname -a
echo ""
echo "=== Node.js 版本 ==="
node -v
echo ""
echo "=== Chrome 状态 ==="
which google-chrome && google-chrome --version || echo "未安装"
echo ""
echo "=== Puppeteer 测试 ==="
cd server
node -e "const p=require('puppeteer');console.log('Puppeteer版本:',p.version);"
EOF

chmod +x diagnose.sh
./diagnose.sh
```

把输出发给我，我帮你排查问题。
