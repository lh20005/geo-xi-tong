# 完整同步测试指南

## 🎯 测试目标
验证Windows端删除账号后，网页端能够实时同步更新（无需刷新页面）

## ✅ 当前状态

### 运行中的服务
- ✅ 服务端: http://localhost:3000
- ✅ 网页端: http://localhost:5173
- ✅ Windows端: http://localhost:5175 (Electron应用)
- ✅ WebSocket: ws://localhost:3000/ws

### Windows端状态
```
✅ Electron应用已启动
✅ API连接正常
✅ 成功获取账号列表
⚠️  未登录（需要先登录才能使用WebSocket）
```

## 📋 完整测试步骤

### 第一步：网页端登录

1. 打开浏览器访问: http://localhost:5173
2. 应该自动跳转到登录页
3. 输入账号密码：
   - 用户名: `admin`
   - 密码: `admin123`
4. 点击登录按钮

**预期结果:**
- ✅ 显示"欢迎回来，admin！"
- ✅ 跳转到首页
- ✅ 顶部显示用户头像和用户名

### 第二步：检查网页端WebSocket连接

1. 按 F12 打开开发者工具
2. 切换到 Console 标签
3. 查找以下日志:
   ```
   [WebSocket] 初始化WebSocket连接
   [WebSocket] 连接成功
   [WebSocket] 认证成功
   ```

4. 切换到 Network 标签
5. 筛选 WS (WebSocket)
6. 应该看到:
   - 连接到: `ws://localhost:3000/ws`
   - 状态: `101 Switching Protocols`
   - 连接保持打开

**预期结果:**
- ✅ WebSocket连接成功
- ✅ 认证成功
- ✅ 连接保持打开状态

### 第三步：Windows端登录（如果需要）

**注意:** Windows端可能需要先登录才能使用WebSocket功能。

1. 打开Windows端应用（应该已经自动打开）
2. 如果显示登录界面，使用相同账号登录：
   - 用户名: `admin`
   - 密码: `admin123`

**预期结果:**
- ✅ Windows端登录成功
- ✅ WebSocket连接初始化

### 第四步：测试实时同步

#### 方法1: 使用测试脚本（推荐）

1. 确保网页端已登录并打开平台管理页面
2. 打开浏览器开发者工具 Console
3. 在终端运行测试脚本:
   ```bash
   ./test-login-and-sync.sh
   ```

**观察网页端:**
- ✅ 应该看到新账号被创建（test_sync_account）
- ✅ 3秒后账号自动消失
- ✅ 显示"账号已被删除"通知
- ✅ Console显示: `[WebSocket] 收到账号删除事件`

#### 方法2: 使用Windows端删除

1. 网页端登录并进入"平台管理"页面
2. 打开浏览器开发者工具 Console
3. 在Windows端应用中找到一个账号
4. 点击删除按钮

**观察网页端:**
- ✅ 账号自动从列表中消失（无需刷新）
- ✅ 显示"账号已被删除"通知
- ✅ Console显示: `[WebSocket] 收到账号删除事件: {id: xxx}`

#### 方法3: 多窗口测试

1. 打开两个浏览器窗口
2. 都登录并进入"平台管理"页面
3. 在窗口A删除一个账号
4. 观察窗口B

**预期结果:**
- ✅ 窗口B自动更新（无需刷新）
- ✅ 账号从列表中消失
- ✅ 显示通知

### 第五步：检查服务端日志

在服务端终端查看日志，应该看到:

```
新的WebSocket连接
用户 admin 认证成功
客户端订阅频道: accounts
[DELETE] 收到删除账号请求: ID=xxx
[DELETE] 账号删除成功: ID=xxx
[WebSocket] 广播账号事件: account.deleted {
  accountId: xxx,
  authenticatedClients: 1,  // 或更多
  totalClients: 1
}
[DELETE] WebSocket事件已广播: account.deleted, ID=xxx
```

**关键指标:**
- ✅ `authenticatedClients` > 0 (表示有已认证的客户端)
- ✅ 广播事件成功

## 🔍 故障排查

### 问题1: 网页端WebSocket无法连接

**检查:**
1. Console是否显示"没有auth token"
2. 是否已登录
3. localStorage是否有 `auth_token`

**解决:**
- 确保已登录
- 清除浏览器缓存后重新登录

### 问题2: 网页端收不到删除事件

**检查:**
1. Console是否显示"WebSocket认证成功"
2. Network → WS → Messages 是否收到消息
3. 服务端是否输出"广播账号事件"

**解决:**
- 确保WebSocket已认证
- 检查服务端日志中的 `authenticatedClients` 数量
- 刷新页面重新连接

### 问题3: Windows端无法连接

**检查:**
1. Windows端是否显示"No access token"
2. Windows端是否已登录

**解决:**
- 在Windows端登录
- 检查Windows端的API配置

## ✅ 成功标准

测试通过的标志：

- [ ] 网页端登录成功
- [ ] WebSocket连接成功
- [ ] WebSocket认证成功
- [ ] 删除账号时网页端实时更新
- [ ] 无需刷新页面
- [ ] Console显示正确的事件日志
- [ ] 服务端显示正确的广播日志
- [ ] `authenticatedClients` > 0

## 🎉 测试完成

如果所有测试通过，说明：

✅ **问题已完全解决！**

- Windows端删除账号后，网页端可以实时同步
- 网页端删除账号后，其他网页端可以实时同步
- 无需刷新页面
- 系统具备完整的实时同步功能

## 📊 测试报告

测试完成后，请记录：

1. 网页端是否能实时收到删除事件？ ✅/❌
2. 是否需要刷新页面？ ✅/❌
3. Console是否显示正确日志？ ✅/❌
4. 服务端是否显示广播日志？ ✅/❌
5. `authenticatedClients` 数量是否正确？ ✅/❌

## 📞 需要帮助？

如果遇到问题，请查看：
- `TESTING_GUIDE.md` - 详细测试指南
- `TEST_RESULTS.md` - API测试结果
- `FINAL_STATUS.md` - 完整状态报告

或者提供以下信息：
- 浏览器Console日志
- 服务端日志
- Windows端日志
- 具体的错误信息
