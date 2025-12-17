# 平台登录功能调试指南

## 问题诊断

如果点击平台卡片没有反应或报错，请按以下步骤排查：

### 1. 检查后端服务是否运行

```bash
# 检查后端进程
ps aux | grep "node.*server"

# 或者查看端口
lsof -i :3001
```

如果没有运行，启动后端：
```bash
cd server
npm run dev
```

### 2. 检查前端服务是否运行

```bash
# 检查前端进程
ps aux | grep "node.*client"

# 或者查看端口
lsof -i :3000
```

如果没有运行，启动前端：
```bash
cd client
npm start
```

### 3. 检查浏览器控制台错误

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 点击平台卡片
4. 查看是否有错误信息

常见错误：
- **Network Error**: 后端服务未启动或端口不对
- **404 Not Found**: API路由未正确注册
- **500 Internal Server Error**: 后端代码错误

### 4. 检查后端日志

查看终端中运行 `npm run dev` 的窗口，应该能看到：

```
[浏览器登录] 启动浏览器，准备打开 XXX 登录页面...
[浏览器登录] 正在打开登录页面: https://...
[浏览器登录] 已打开 XXX 登录页面，等待用户登录...
```

如果看到错误，记录错误信息。

### 5. 测试API是否可用

```bash
# 测试平台列表API
curl http://localhost:3001/api/publishing/platforms

# 测试账号列表API
curl http://localhost:3001/api/publishing/accounts

# 测试浏览器登录API（会打开浏览器）
curl -X POST http://localhost:3001/api/publishing/browser-login \
  -H "Content-Type: application/json" \
  -d '{"platform_id":"zhihu"}'
```

### 6. 检查Puppeteer是否正确安装

```bash
cd server
npm list puppeteer
```

应该显示：
```
└── puppeteer@24.33.0
```

如果没有安装或版本不对：
```bash
cd server
npm install puppeteer
```

### 7. 检查数据库表是否存在

```bash
# 如果使用PostgreSQL
psql -d your_database -c "\dt platform*"

# 应该看到：
# - platforms_config
# - platform_accounts
```

如果表不存在，运行迁移：
```bash
cd server
npm run migrate:publishing
```

### 8. 检查编译是否成功

```bash
cd server
npm run build

# 检查是否有AccountService相关的错误
npm run build 2>&1 | grep AccountService
```

如果有编译错误，查看错误信息并修复。

### 9. 重启服务

有时候需要重启服务才能生效：

```bash
# 停止后端（Ctrl+C）
# 重新启动
cd server
npm run dev

# 停止前端（Ctrl+C）
# 重新启动
cd client
npm start
```

### 10. 清除缓存

```bash
# 清除后端编译缓存
cd server
rm -rf dist
npm run build

# 清除前端缓存
cd client
rm -rf node_modules/.cache
npm start
```

## 常见问题解决方案

### 问题1：点击卡片没有反应

**可能原因**：
- 前端代码未正确调用API
- 后端路由未注册
- CORS问题

**解决方案**：
1. 检查浏览器控制台是否有错误
2. 检查Network标签，看请求是否发出
3. 确认后端路由已注册（查看 server/src/routes/index.ts）

### 问题2：浏览器无法打开

**可能原因**：
- Puppeteer未安装
- Chromium下载失败
- 系统权限问题

**解决方案**：
```bash
cd server
npm install puppeteer --force

# 如果下载Chromium失败，设置镜像
export PUPPETEER_DOWNLOAD_HOST=https://npm.taobao.org/mirrors
npm install puppeteer
```

### 问题3：登录后Cookie未保存

**可能原因**：
- 数据库连接失败
- 加密服务未初始化
- 表结构不正确

**解决方案**：
1. 检查数据库连接
2. 查看后端日志中的错误信息
3. 运行数据库迁移脚本

### 问题4：500 Internal Server Error

**可能原因**：
- 后端代码错误
- 数据库查询失败
- 缺少必要的依赖

**解决方案**：
1. 查看后端终端的错误堆栈
2. 检查数据库是否正常
3. 确认所有依赖已安装

### 问题5：CORS错误

**可能原因**：
- 后端未配置CORS
- 前端请求的URL不正确

**解决方案**：
检查 server/src/index.ts 中是否有：
```typescript
app.use(cors());
```

## 手动测试步骤

### 步骤1：测试后端API

```bash
# 终端1 - 启动后端
cd server
npm run dev

# 终端2 - 测试API
curl http://localhost:3001/api/publishing/platforms
```

应该返回平台列表的JSON数据。

### 步骤2：测试前端页面

1. 打开浏览器访问：http://localhost:3000
2. 点击左侧菜单的【平台登录】
3. 应该能看到平台卡片

### 步骤3：测试浏览器登录

1. 点击任意平台卡片（建议先测试知乎）
2. 应该会打开一个新的浏览器窗口
3. 在浏览器中输入账号密码登录
4. 登录成功后浏览器自动关闭
5. 页面显示"登录成功"
6. 在下方表格中看到新增的账号

### 步骤4：验证数据保存

```bash
# 查询数据库
psql -d your_database -c "SELECT id, platform_id, account_name, status FROM platform_accounts;"
```

应该能看到刚刚保存的账号记录。

## 获取帮助

如果以上步骤都无法解决问题，请提供以下信息：

1. **浏览器控制台的完整错误信息**
2. **后端终端的完整错误信息**
3. **操作系统和版本**
4. **Node.js版本**：`node -v`
5. **npm版本**：`npm -v`
6. **Puppeteer版本**：`npm list puppeteer`
7. **数据库类型和版本**

## 快速测试脚本

运行以下脚本进行快速测试：

```bash
# 测试API
./test-browser-login-api.sh

# 或使用测试页面
open test-platform-login.html
```

## 日志位置

- **后端日志**：终端输出
- **前端日志**：浏览器控制台
- **Puppeteer日志**：后端终端（带 [浏览器登录] 前缀）

## 调试模式

如果需要更详细的日志，可以修改代码：

```typescript
// server/src/services/AccountService.ts
// 在 loginWithBrowser 方法开始处添加：
console.log('[DEBUG] 开始浏览器登录，平台:', platform);
console.log('[DEBUG] 平台配置:', JSON.stringify(platform, null, 2));
```

重新编译并运行：
```bash
cd server
npm run build
npm run dev
```
