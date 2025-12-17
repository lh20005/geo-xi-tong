# 平台登录功能快速修复指南

## 问题：点击平台卡片无法打开浏览器

### 立即执行以下步骤：

## 步骤1：重新编译后端代码

```bash
cd server
npm run build
```

等待编译完成，确保没有错误。

## 步骤2：重启后端服务

```bash
# 如果后端正在运行，按 Ctrl+C 停止
# 然后重新启动
cd server
npm run dev
```

确保看到：
```
✅ 加密服务初始化成功
🚀 服务器运行在 http://localhost:3000
```

## 步骤3：重启前端服务

```bash
# 如果前端正在运行，按 Ctrl+C 停止
# 然后重新启动
cd client
npm run dev
```

确保看到类似：
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

## 步骤4：清除浏览器缓存

1. 打开浏览器开发者工具（F12）
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

## 步骤5：测试功能

1. 访问 http://localhost:5173
2. 点击左侧菜单的【平台登录】
3. 打开浏览器控制台（F12 -> Console）
4. 点击任意平台卡片（如：知乎）
5. 查看控制台输出

### 预期的控制台输出：

```
[前端] 点击平台卡片: 知乎 zhihu
[前端] 调用 loginWithBrowser API...
```

### 如果看到错误：

#### 错误1：Network Error
**原因**：后端服务未运行或端口不对
**解决**：
```bash
# 检查后端是否运行
lsof -i :3000

# 如果没有运行，启动它
cd server
npm run dev
```

#### 错误2：404 Not Found
**原因**：路由未正确注册
**解决**：
```bash
# 重新编译
cd server
npm run build
npm run dev
```

#### 错误3：500 Internal Server Error
**原因**：后端代码错误
**解决**：查看后端终端的错误信息

## 步骤6：查看后端日志

在运行 `npm run dev` 的终端窗口中，应该能看到：

```
[浏览器登录] 启动浏览器，准备打开 知乎 登录页面...
[浏览器登录] 正在打开登录页面: https://www.zhihu.com/signin
[浏览器登录] 已打开 知乎 登录页面，等待用户登录...
```

如果没有看到这些日志，说明请求没有到达后端。

## 步骤7：手动测试API

打开新终端，运行：

```bash
# 测试平台列表
curl http://localhost:3000/api/publishing/platforms

# 应该返回JSON数据，包含平台列表
```

如果返回数据，说明后端API正常。

## 步骤8：测试浏览器登录API

```bash
# 这将尝试打开浏览器
curl -X POST http://localhost:3000/api/publishing/browser-login \
  -H "Content-Type: application/json" \
  -d '{"platform_id":"zhihu"}'
```

**注意**：这个命令会打开浏览器窗口！

### 预期结果：
- 浏览器窗口打开
- 显示知乎登录页面
- 等待你登录

## 常见问题排查

### 问题A：Puppeteer错误

```bash
cd server
npm install puppeteer --force
```

### 问题B：数据库表不存在

```bash
cd server
npx tsx src/db/migrate-publishing.ts
```

### 问题C：端口被占用

```bash
# 查看占用3000端口的进程
lsof -i :3000

# 如果需要，杀死进程
kill -9 <PID>
```

## 完整的重启流程

如果以上都不行，执行完整重启：

```bash
# 1. 停止所有服务（Ctrl+C）

# 2. 清理并重新编译后端
cd server
rm -rf dist
npm run build

# 3. 启动后端
npm run dev

# 4. 新终端 - 启动前端
cd client
npm run dev

# 5. 清除浏览器缓存并刷新页面

# 6. 测试功能
```

## 验证清单

- [ ] 后端服务运行在 3000 端口
- [ ] 前端服务运行在 5173 端口
- [ ] 后端编译无错误
- [ ] 数据库表存在
- [ ] Puppeteer已安装
- [ ] 浏览器控制台无错误
- [ ] 后端日志显示正常

## 如果仍然不工作

请提供以下信息：

1. **浏览器控制台的完整输出**（F12 -> Console）
2. **后端终端的完整输出**
3. **运行以下命令的输出**：
   ```bash
   lsof -i :3000
   lsof -i :5173
   curl http://localhost:3000/api/publishing/platforms
   ```

## 联系支持

如果问题持续存在，请查看：
- [调试指南](./DEBUG_PLATFORM_LOGIN.md)
- [诊断脚本](./diagnose-platform-login.sh)
