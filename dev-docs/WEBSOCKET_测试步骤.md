# WebSocket自动刷新测试步骤

## 问题

网页端账户管理列表不能自动同步信息，需要手动刷新。

## 快速测试（5分钟）

### 步骤1：启动所有服务

```bash
# 终端1：后端服务
cd server
npm run dev

# 终端2：前端服务
cd client
npm run dev

# 终端3：Windows登录管理器
cd windows-login-manager
npm run dev
```

### 步骤2：使用WebSocket测试工具

1. **打开测试页面**
   ```bash
   # 在浏览器中打开
   open test-websocket.html
   # 或直接拖拽文件到浏览器
   ```

2. **点击"连接"按钮**
   - 应该看到：✅ WebSocket连接成功
   - 应该看到：✅ 认证成功
   - 应该看到：✅ 订阅成功: accounts

3. **保持测试页面打开**

### 步骤3：测试自动刷新

1. **使用Windows登录管理器登录**
   - 选择任意平台（如：头条）
   - 完成登录流程

2. **查看测试页面**
   - 应该看到：🎉 收到账号事件: account.created
   - "账号事件数"应该增加
   - 日志中显示账号数据

3. **查看网页端**
   - 打开 http://localhost:5173
   - 进入平台管理页面
   - 应该自动刷新并显示新账号

## 详细诊断

### 方法1：使用浏览器控制台

1. **打开网页端**
   - 访问：http://localhost:5173
   - 登录并进入平台管理页面
   - 按F12打开控制台

2. **查看WebSocket日志**
   ```
   应该看到：
   [WebSocket] Initializing connection to: ws://localhost:3000/ws
   [WebSocket] Auth token found, length: XXX
   [WebSocket] Connecting...
   [WebSocket] ✅ Connected successfully
   [WebSocket] ✅ Authenticated successfully
   [WebSocket] Subscribing to channels: [accounts]
   ```

3. **检查Network标签**
   - 切换到Network标签
   - 筛选WS (WebSocket)
   - 应该看到绿色的连接状态

4. **测试事件接收**
   - 使用Windows端登录
   - 控制台应该显示：
   ```
   [WebSocket] 🎉 Account created event received: {...}
   检测到新账号创建，正在刷新列表...
   ```

### 方法2：查看后端日志

在后端终端中，应该看到：

```
[WebSocket] ✅ User authenticated: username (ID: 1)
[WebSocket] ✅ Client subscribed to channels: accounts
[WebSocket] 📢 Broadcasting account event: account.created { accountId: XXX, clientCount: 1 }
[WebSocket] 📤 Message sent to 1 authenticated clients
[WebSocket] ✅ Broadcast complete for: account.created
```

## 常见问题

### 问题1：测试页面显示"未连接"

**检查**：
1. 后端服务是否运行？
   ```bash
   lsof -i :3000
   ```

2. WebSocket URL是否正确？
   - 默认：`ws://localhost:3000/ws`

3. Token是否存在？
   - 先登录网页端系统
   - 测试页面会自动读取token

### 问题2：连接成功但认证失败

**检查**：
1. Token是否有效？
   ```javascript
   // 在浏览器控制台执行
   localStorage.getItem('auth_token')
   ```

2. JWT_SECRET是否一致？
   - 检查 `server/.env` 中的 JWT_SECRET

3. Token是否过期？
   - 重新登录获取新token

### 问题3：认证成功但未收到事件

**检查**：
1. 是否订阅了accounts频道？
   - 测试页面应显示：✅ 订阅成功: accounts

2. 后端是否广播了事件？
   - 查看后端日志

3. 客户端数量是否正确？
   - 后端日志应显示：`clientCount: 1` 或更多

## 验证清单

使用测试页面验证：

- [ ] 连接状态显示"✅ 已连接"
- [ ] 日志显示"✅ WebSocket连接成功"
- [ ] 日志显示"✅ 认证成功"
- [ ] 日志显示"✅ 订阅成功: accounts"
- [ ] Windows端登录后收到事件
- [ ] 日志显示"🎉 收到账号事件: account.created"
- [ ] "账号事件数"增加
- [ ] 网页端自动刷新

## 成功标准

✅ 测试页面所有步骤通过
✅ 网页端自动刷新工作
✅ 无错误日志
✅ 用户体验流畅

## 下一步

如果测试页面工作正常，但网页端仍不自动刷新：

1. **检查网页端代码**
   - 查看 `client/src/pages/PlatformManagementPage.tsx`
   - 确认事件监听代码存在

2. **检查浏览器控制台**
   - 是否有JavaScript错误？
   - loadData函数是否被调用？

3. **清除缓存**
   ```bash
   # 清除浏览器缓存
   # Chrome: Ctrl+Shift+Delete
   
   # 或在控制台执行
   localStorage.clear()
   location.reload()
   ```

4. **重新构建前端**
   ```bash
   cd client
   npm run build
   npm run dev
   ```

## 获取帮助

如果问题仍然存在，请提供：

1. **测试页面截图**（显示连接状态和日志）
2. **后端日志**（完整的WebSocket相关日志）
3. **浏览器控制台日志**（网页端的所有日志）
4. **Network标签截图**（显示WebSocket连接）

参考文档：
- `dev-docs/WEBSOCKET_DEBUG_GUIDE.md` - 详细调试指南
- `dev-docs/ACCOUNT_AUTO_REFRESH_FEATURE.md` - 技术实现文档
