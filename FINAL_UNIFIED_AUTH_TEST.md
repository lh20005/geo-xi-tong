# 统一认证系统 - 完整测试指南

## ✅ 当前状态

### 所有服务已启动
- ✅ 服务端: http://localhost:3000
- ✅ 网页端: http://localhost:5173
- ✅ Windows端: Electron应用已启动
- ✅ WebSocket: ws://localhost:3000/ws

### 统一认证系统已实现
- ✅ 同一套服务端API (`/api/auth/login`)
- ✅ 同一个用户数据库 (`users`表)
- ✅ 同一套JWT认证机制
- ✅ 网页端登录界面
- ✅ Windows端登录界面
- ✅ 独立的token存储
- ✅ 共享的数据访问

## 📋 完整测试流程

### 第一步：网页端登录测试

1. **打开网页端**
   ```
   访问: http://localhost:5173
   ```

2. **应该看到登录页面**
   - 渐变紫色背景
   - 登录表单
   - 提示：默认账号 admin / admin123

3. **输入账号密码**
   - 用户名: `admin`
   - 密码: `admin123`

4. **点击登录**

5. **验证登录成功**
   - ✅ 显示"欢迎回来，admin！"
   - ✅ 跳转到首页
   - ✅ 顶部显示用户头像和用户名
   - ✅ Console显示：`[Auth] 登录成功`
   - ✅ Console显示：`[WebSocket] 连接成功`
   - ✅ Console显示：`[WebSocket] 认证成功`

### 第二步：Windows端登录测试

1. **查看Windows端应用**
   - 应该已经自动打开
   - 显示登录页面（紫色渐变背景）

2. **输入相同的账号密码**
   - 用户名: `admin`
   - 密码: `admin123`

3. **点击登录**

4. **验证登录成功**
   - ✅ 进入主界面
   - ✅ 看到侧边栏（平台登录、账号管理、设置）
   - ✅ 底部有"退出登录"按钮
   - ✅ 可以看到账号列表

### 第三步：验证数据一致性

1. **在网页端查看账号列表**
   - 进入"平台管理"页面
   - 记录看到的账号数量和名称

2. **在Windows端查看账号列表**
   - 点击"账号管理"
   - 应该看到**相同的账号列表**

3. **验证**
   - ✅ 两端显示的账号数量相同
   - ✅ 两端显示的账号名称相同
   - ✅ 数据完全一致

### 第四步：测试实时同步（网页端删除）

1. **准备**
   - 网页端：打开"平台管理"页面
   - Windows端：打开"账号管理"页面
   - 两端都能看到账号列表

2. **在网页端删除一个账号**
   - 点击某个账号的删除按钮
   - 确认删除

3. **观察Windows端**
   - ✅ 账号自动从列表中消失
   - ✅ 无需刷新或重新加载
   - ✅ 实时同步成功

4. **检查服务端日志**
   ```
   [DELETE] 收到删除账号请求: ID=xxx
   [DELETE] 账号删除成功: ID=xxx
   [WebSocket] 广播账号事件: account.deleted {
     accountId: xxx,
     authenticatedClients: 2,  // 两个客户端都已认证
     totalClients: 2
   }
   ```

### 第五步：测试实时同步（Windows端删除）

1. **准备**
   - 网页端：打开"平台管理"页面，打开Console
   - Windows端：打开"账号管理"页面

2. **在Windows端删除一个账号**
   - 点击某个账号的删除按钮
   - 确认删除

3. **观察网页端**
   - ✅ 账号自动从列表中消失
   - ✅ 显示"账号已被删除"通知
   - ✅ Console显示：`[WebSocket] 收到账号删除事件`
   - ✅ 无需刷新页面

### 第六步：测试退出登录

#### 网页端退出
1. 点击顶部用户头像
2. 选择"退出登录"
3. 验证：
   - ✅ 跳转回登录页
   - ✅ localStorage中的token被清除
   - ✅ 无法访问其他页面

#### Windows端退出
1. 点击侧边栏底部的"退出登录"按钮
2. 验证：
   - ✅ 返回登录页面
   - ✅ Token被清除
   - ✅ WebSocket连接断开

### 第七步：验证独立性

1. **网页端登录，Windows端未登录**
   - 网页端可以正常使用
   - Windows端显示登录页面
   - 两端独立运行

2. **Windows端登录，网页端未登录**
   - Windows端可以正常使用
   - 网页端显示登录页面
   - 两端独立运行

3. **验证**
   - ✅ 两端可以独立登录
   - ✅ 一端登出不影响另一端
   - ✅ Token独立管理

## 🔍 关键验证点

### 服务端日志检查

启动时应该看到：
```
✅ 数据库连接成功
[Auth] 默认管理员账号已存在: admin
✅ WebSocket服务器初始化成功
✅ WebSocket心跳检测已启动
🚀 服务器运行在 http://localhost:3000
🔌 WebSocket服务运行在 ws://localhost:3000/ws
```

网页端登录时：
```
[Auth] 用户验证成功: admin
[Auth] 用户登录成功: admin
新的WebSocket连接
用户 admin 认证成功
客户端订阅频道: accounts
```

Windows端登录时：
```
[Auth] 用户验证成功: admin
[Auth] 用户登录成功: admin
新的WebSocket连接
用户 admin 认证成功
客户端订阅频道: accounts
```

删除账号时：
```
[DELETE] 收到删除账号请求: ID=xxx
[DELETE] 账号删除成功: ID=xxx
[WebSocket] 广播账号事件: account.deleted {
  accountId: xxx,
  authenticatedClients: 2,  // 关键：应该是2（网页端+Windows端）
  totalClients: 2
}
```

### 网页端Console检查

登录后应该看到：
```
[Auth] 登录成功: {username: "admin"}
[WebSocket] 初始化WebSocket连接
[WebSocket] 连接成功
[WebSocket] 认证成功
```

收到删除事件时：
```
[WebSocket] 收到账号删除事件: {id: xxx}
```

### Windows端日志检查

登录后应该看到：
```
[info] IPC: login - admin
[info] Login successful
[info] WebSocket initialized after login
```

## ✅ 成功标准

测试通过的标志：

- [ ] 网页端可以使用 admin/admin123 登录
- [ ] Windows端可以使用 admin/admin123 登录（同一个账号）
- [ ] 两端看到的账号列表完全一致
- [ ] 网页端删除账号，Windows端实时更新
- [ ] Windows端删除账号，网页端实时更新
- [ ] 服务端日志显示 `authenticatedClients: 2`
- [ ] 两端可以独立登出
- [ ] 一端登出不影响另一端

## 🎉 测试完成

如果所有测试通过，说明：

✅ **统一认证系统完全正常！**

- 网页端和Windows端使用同一套认证系统
- 使用同一个用户数据库
- 使用同一套JWT认证机制
- 可以独立登录，但共享数据
- 实时同步功能正常
- Token独立管理，安全可靠

## 📞 故障排查

### 问题1: Windows端看不到登录页面

**检查：**
- Windows应用是否正常启动
- 是否有编译错误

**解决：**
- 查看进程日志
- 重新启动Windows端

### 问题2: 登录后看不到数据

**检查：**
- Token是否正确保存
- API请求是否成功
- 服务端是否正常运行

**解决：**
- 检查Console日志
- 检查Network请求
- 检查服务端日志

### 问题3: 实时同步不工作

**检查：**
- WebSocket是否连接成功
- WebSocket是否认证成功
- 服务端是否广播事件

**解决：**
- 检查Console中的WebSocket日志
- 检查服务端的 `authenticatedClients` 数量
- 确保两端都已登录

## 📚 相关文档

- `UNIFIED_AUTH_SYSTEM.md` - 统一认证系统详细说明
- `COMPLETE_SYNC_TEST_GUIDE.md` - 完整同步测试指南
- `.kiro/specs/account-deletion-sync-fix/FINAL_STATUS.md` - 项目完成状态

## 🎯 下一步

测试通过后，系统已经完全可用：
- ✅ 统一认证系统
- ✅ 实时数据同步
- ✅ 网页端和Windows端协同工作

可以开始正常使用系统了！🎉
