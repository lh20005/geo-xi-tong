# 测试指南

## 本地测试步骤

### 1. 启动服务

```bash
# 启动服务端
cd server
npm run dev

# 启动客户端（新终端）
cd client
npm run dev
```

### 2. 测试登录功能

1. 打开浏览器访问 `http://localhost:5173`
2. 应该自动跳转到登录页 `/login`
3. 输入默认账号：
   - 用户名: `admin`
   - 密码: `admin123`
4. 点击登录按钮
5. 验证：
   - ✅ 显示"欢迎回来，admin！"消息
   - ✅ 跳转到首页
   - ✅ 顶部导航栏显示用户头像和用户名
   - ✅ 浏览器Console显示登录成功日志

### 3. 测试WebSocket连接

1. 登录后，打开浏览器开发者工具（F12）
2. 切换到Console标签
3. 查找WebSocket相关日志：
   ```
   [WebSocket] 初始化WebSocket连接
   [WebSocket] 连接成功
   [WebSocket] 认证成功
   ```
4. 切换到Network标签
5. 筛选WS（WebSocket）连接
6. 验证：
   - ✅ 有一个到 `ws://localhost:3000/ws` 的连接
   - ✅ 状态为 `101 Switching Protocols`
   - ✅ 连接保持打开状态

### 4. 测试账号删除同步（网页端到网页端）

1. 打开两个浏览器窗口，都登录系统
2. 两个窗口都导航到"平台管理"页面
3. 在窗口A中删除一个账号
4. 观察窗口B：
   - ✅ 自动显示"账号已被删除"通知
   - ✅ 账号从列表中消失（无需刷新）
   - ✅ Console显示接收到删除事件日志

### 5. 测试账号删除同步（Windows端到网页端）

**前提条件：** Windows登录管理器已启动并连接到同一服务器

1. 打开网页端，登录并进入"平台管理"页面
2. 打开浏览器开发者工具Console
3. 使用Windows端删除一个账号
4. 观察网页端：
   - ✅ 自动显示"账号已被删除"通知
   - ✅ 账号从列表中消失（无需刷新）
   - ✅ Console显示：
     ```
     [WebSocket] 收到账号删除事件: {id: xxx}
     ```

### 6. 测试退出登录

1. 点击顶部导航栏的用户头像
2. 选择"退出登录"
3. 验证：
   - ✅ 跳转到登录页
   - ✅ localStorage中的token被清除
   - ✅ WebSocket连接断开
   - ✅ 无法访问受保护的页面

### 7. 测试Token过期自动刷新

**注意：** 这个测试需要等待1小时（token过期时间），或者临时修改JWT_EXPIRES_IN为更短的时间（如'1m'）

1. 登录系统
2. 等待token过期
3. 执行任何API操作（如刷新页面、删除账号等）
4. 验证：
   - ✅ 请求自动重试
   - ✅ Console显示"Token刷新成功"
   - ✅ 操作正常完成
   - ✅ 不需要重新登录

## 服务端日志检查

启动服务端后，观察Console输出：

### 启动时应该看到：

```
✅ 数据库连接成功
[Auth] 默认管理员账号已存在: admin
✅ WebSocket服务器初始化成功
✅ WebSocket心跳检测已启动
服务器运行在 http://localhost:3000
```

### 用户登录时应该看到：

```
[Auth] 用户验证成功: admin
[Auth] 用户登录成功: admin
```

### WebSocket连接时应该看到：

```
新的WebSocket连接
用户 admin 认证成功
客户端订阅频道: accounts
```

### 删除账号时应该看到：

```
[DELETE] 收到删除账号请求: ID=123
[DELETE] 账号删除成功: ID=123
[WebSocket] 广播账号事件: account.deleted {
  accountId: 123,
  authenticatedClients: 2,
  totalClients: 2
}
[DELETE] WebSocket事件已广播: account.deleted, ID=123
```

## 常见问题排查

### 问题1: 登录后立即跳转回登录页

**原因：** Token没有正确保存到localStorage

**检查：**
1. 打开浏览器开发者工具 → Application → Local Storage
2. 查看是否有 `auth_token`、`refresh_token`、`user_info`
3. 检查Console是否有错误日志

**解决：**
- 确保登录API返回正确的数据格式
- 检查浏览器是否禁用了localStorage

### 问题2: WebSocket无法连接

**原因：** 没有auth_token或服务端未启动

**检查：**
1. Console是否显示"没有auth token"警告
2. Network标签是否有WebSocket连接失败
3. 服务端是否正常运行

**解决：**
- 确保已登录（有auth_token）
- 确保服务端WebSocket服务已启动
- 检查WebSocket URL是否正确

### 问题3: 删除账号后网页端不更新

**原因：** WebSocket未认证或事件未广播

**检查：**
1. Console是否显示"WebSocket认证成功"
2. 服务端是否输出"广播账号事件"日志
3. Network → WS → Messages 查看是否收到消息

**解决：**
- 确保WebSocket已认证
- 检查服务端broadcastAccountEvent是否被调用
- 检查客户端事件监听器是否正确注册

### 问题4: Token过期后无法自动刷新

**原因：** refreshToken无效或刷新API失败

**检查：**
1. Console是否显示"Token刷新失败"
2. localStorage是否有refresh_token
3. 刷新API是否返回401

**解决：**
- 确保refresh_token存在且有效
- 检查服务端refresh路由是否正常
- 如果刷新失败，会自动跳转到登录页（正常行为）

## 性能测试

### WebSocket连接数测试

1. 打开10个浏览器标签页
2. 全部登录系统
3. 检查服务端日志：
   ```
   authenticatedClients: 10
   totalClients: 10
   ```
4. 在任意一个标签页删除账号
5. 验证所有标签页都收到更新

### 并发删除测试

1. 打开多个浏览器窗口
2. 同时删除不同的账号
3. 验证：
   - ✅ 所有删除操作都成功
   - ✅ 所有客户端都收到所有删除事件
   - ✅ 没有数据不一致

## 测试完成检查清单

- [ ] 登录功能正常
- [ ] 退出登录功能正常
- [ ] WebSocket连接成功
- [ ] WebSocket认证成功
- [ ] 网页端删除账号，其他网页端实时更新
- [ ] Windows端删除账号，网页端实时更新
- [ ] Token过期自动刷新
- [ ] 所有日志输出正确
- [ ] 没有Console错误
- [ ] 用户体验流畅

## 下一步

测试通过后，可以准备部署到腾讯云：

1. 配置生产环境变量（.env）
2. 构建前端：`cd client && npm run build`
3. 配置Nginx（参考nginx.conf.example）
4. 申请SSL证书
5. 部署并测试HTTPS/WSS连接
