# Windows端登录测试指南

## ✅ 当前状态

Windows端已成功启动并显示登录页面！

## 🧪 测试步骤

### 第一步：Windows端登录

1. **查看Windows应用**
   - 应该已经自动打开
   - 显示登录页面（紫色渐变背景）
   - 有用户名和密码输入框

2. **输入登录信息**
   ```
   用户名: admin
   密码: admin123
   ```

3. **点击"登录"按钮**

4. **预期结果**
   - ✅ 登录成功
   - ✅ 进入主界面
   - ✅ 看到侧边栏：
     - 🚀 平台登录
     - 👤 账号管理
     - ⚙️ 设置
     - 🚪 退出登录（底部）

### 第二步：验证WebSocket连接

登录成功后，Windows端应该自动初始化WebSocket连接。

**检查方法：**
查看Windows端的终端日志，应该看到：
```
[info] IPC: login - admin
[info] Login successful
[info] WebSocket initialized after login
```

### 第三步：查看账号列表

1. 点击侧边栏的"账号管理"
2. 应该看到账号列表
3. 记录看到的账号数量

### 第四步：测试实时同步

#### 方法1：使用快速测试脚本

```bash
chmod +x quick-test-sync.sh
./quick-test-sync.sh
```

按照脚本提示操作：
1. 确保网页端已登录并打开"平台管理"页面
2. 脚本会创建一个测试账号
3. 观察网页端是否显示新账号
4. 脚本会删除测试账号
5. 观察网页端是否实时更新

#### 方法2：手动测试

1. **准备**
   - 网页端：访问 http://localhost:5173，登录，进入"平台管理"
   - Windows端：已登录，在"账号管理"页面

2. **在Windows端删除一个账号**
   - 选择一个账号
   - 点击删除按钮
   - 确认删除

3. **观察网页端**
   - ✅ 账号应该立即消失
   - ✅ 显示通知："账号已被删除"
   - ✅ Console显示：`[WebSocket] 收到账号删除事件`
   - ✅ 无需刷新页面

## 🔍 故障排查

### 问题1: 看不到登录页面

**可能原因：**
- Windows应用没有正确启动
- 编译错误

**解决方法：**
```bash
# 查看进程日志
# 应该看到：
[info] Application initialized successfully
[info] Main window shown
```

### 问题2: 登录时报错 "this.api.login is not a function"

**原因：** preload脚本没有正确编译

**解决方法：**
已修复！重新启动后应该正常。

### 问题3: 登录成功但看不到数据

**检查：**
1. Token是否正确保存
2. API请求是否成功
3. 服务端是否正常运行

**解决方法：**
查看Windows端日志：
```
[info] IPC: login - admin
[info] Login successful
[debug] API Request: GET /api/publishing/accounts
[debug] API Response: 200 /api/publishing/accounts
[info] Retrieved X accounts
```

### 问题4: 实时同步不工作

**检查：**
1. WebSocket是否初始化成功
2. 两端是否都已登录
3. 服务端是否识别到两个客户端

**解决方法：**
查看服务端日志：
```
[WebSocket] 广播账号事件: account.deleted {
  accountId: xxx,
  authenticatedClients: 2,  ← 必须是2
  totalClients: 2
}
```

## 📊 验证清单

完成以下检查：

- [ ] Windows端显示登录页面
- [ ] 可以使用 admin/admin123 登录
- [ ] 登录后进入主界面
- [ ] 可以看到侧边栏菜单
- [ ] 可以看到账号列表
- [ ] 账号列表与网页端一致
- [ ] Windows端删除账号，网页端实时更新
- [ ] 网页端删除账号，Windows端实时更新
- [ ] 可以正常退出登录

## 🎉 成功标准

如果以上所有检查都通过，说明：

✅ **统一认证系统完全正常！**
✅ **实时同步功能完全正常！**
✅ **Windows端和网页端完美协同工作！**

## 📞 需要帮助？

如果遇到问题，请提供：
1. Windows端的终端日志
2. 网页端的Console日志
3. 服务端的日志
4. 具体的错误信息

## 🚀 下一步

测试通过后，系统已经完全可用：
- 网页端和Windows端都可以独立登录
- 使用同一套用户系统（admin账号）
- 访问同一套数据
- 实时同步更新
- 安全可靠

可以开始正常使用了！🎉
