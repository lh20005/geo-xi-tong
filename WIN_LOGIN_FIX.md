# Windows端登录问题 - 解决方案

## ✅ 诊断结果

根据诊断脚本的结果：
- ✅ 后端服务正常运行
- ✅ testuser 账号存在且可以通过 API 登录
- ✅ 数据库连接正常
- ✅ 配置文件已创建

**结论：** 后端一切正常，问题出在 Windows 端的前端。

---

## 🔧 解决方案

### 方案 1：检查 Windows 端的服务器配置（最常见）

1. **启动 Windows 登录管理器**
   ```bash
   cd windows-login-manager
   npm run dev
   ```

2. **使用管理员账号登录**
   ```
   用户名: admin
   密码: admin123
   ```

3. **进入"设置"页面**

4. **检查"服务器URL"配置**
   - 应该是：`http://localhost:3000`
   - 如果不是，修改为正确的地址
   - 点击"保存"

5. **退出登录，重新用 testuser 登录**

---

### 方案 2：清除应用缓存

Windows 端可能缓存了旧的配置或认证信息。

1. **关闭 Windows 登录管理器**

2. **删除应用数据**
   ```bash
   # Mac
   rm -rf ~/Library/Application\ Support/platform-login-manager
   
   # Windows
   # 删除文件夹: %APPDATA%\platform-login-manager
   ```

3. **重新启动应用**
   ```bash
   cd windows-login-manager
   npm run dev
   ```

4. **首次启动会要求配置服务器URL**
   - 输入：`http://localhost:3000`
   - 保存

5. **尝试登录 testuser**

---

### 方案 3：查看详细错误信息

1. **启动 Windows 登录管理器**

2. **打开开发者工具**
   - Mac: `Cmd + Option + I`
   - Windows: `Ctrl + Shift + I`

3. **切换到 Console 标签**

4. **尝试登录 testuser**

5. **查看错误信息**

**常见错误及解决方案：**

#### 错误 A：`Error: connect ECONNREFUSED`
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
**原因：** 无法连接到后端服务  
**解决：** 确保后端服务正在运行

#### 错误 B：`401 Unauthorized`
```
Error: Request failed with status code 401
```
**原因：** 密码错误或用户不存在  
**解决：** 重新创建用户（见方案 4）

#### 错误 C：`Network Error`
```
Error: Network Error
```
**原因：** 服务器URL配置错误  
**解决：** 检查设置中的服务器URL

#### 错误 D：`undefined is not an object`
```
TypeError: Cannot read property 'user' of undefined
```
**原因：** 后端返回格式不符合预期  
**解决：** 检查后端代码是否最新

---

### 方案 4：重新创建 testuser

如果怀疑用户数据有问题：

```bash
# 1. 删除旧用户
psql postgresql://lzc@localhost:5432/geo_system -c "DELETE FROM users WHERE username = 'testuser';"

# 2. 重新创建
psql postgresql://lzc@localhost:5432/geo_system -f create-test-user.sql

# 3. 验证创建成功
psql postgresql://lzc@localhost:5432/geo_system -c "SELECT * FROM users WHERE username = 'testuser';"
```

---

### 方案 5：检查 Electron IPC 通信

可能是 Electron 的 IPC 通信有问题。

1. **打开开发者工具**

2. **在 Console 中运行以下命令测试**：

```javascript
// 测试配置获取
window.electronAPI.getConfig().then(config => {
  console.log('Config:', config);
});

// 测试登录
window.electronAPI.login('testuser', 'test123').then(result => {
  console.log('Login result:', result);
}).catch(error => {
  console.error('Login error:', error);
});
```

3. **查看输出结果**

---

## 🎯 推荐操作流程

按以下顺序尝试：

1. ✅ **先用管理员账号测试**
   - 如果管理员可以登录，说明应用本身没问题
   - 问题可能在 testuser 账号或配置上

2. ✅ **检查服务器URL配置**
   - 用管理员登录后，进入设置
   - 确认服务器URL是 `http://localhost:3000`

3. ✅ **清除缓存重试**
   - 删除应用数据文件夹
   - 重新启动应用

4. ✅ **查看错误日志**
   - 打开开发者工具
   - 查看 Console 中的错误信息

5. ✅ **重新创建用户**
   - 如果以上都不行，重新创建 testuser

---

## 📸 预期的正常流程

### 正常登录流程：

1. **输入用户名和密码**
   ```
   用户名: testuser
   密码: test123
   ```

2. **点击"登录"按钮**

3. **Console 输出（正常情况）**：
   ```
   [IPC] login - testuser
   [Auth] 用户验证成功: testuser
   Login successful
   WebSocket initialized after login
   ```

4. **登录成功后**：
   - 跳转到"平台登录"页面
   - 左侧菜单显示：平台登录、账号管理
   - 左侧菜单**不显示**：设置（因为是普通用户）

---

## 🐛 如果问题仍然存在

请提供以下信息：

1. **Electron Console 的完整错误日志**
   - 截图或复制文本

2. **后端日志**
   - 运行 `npm run dev` 时的输出

3. **配置信息**
   - 在 Console 中运行：
     ```javascript
     window.electronAPI.getConfig().then(console.log)
     ```

4. **测试结果**
   - 管理员账号能否登录？
   - 网页端 testuser 能否登录？

---

## 💡 临时解决方案

如果急需测试权限功能，可以：

1. **创建另一个普通用户**
   ```sql
   INSERT INTO users (username, password_hash, email, role) 
   VALUES (
     'user2', 
     '$2b$10$zAorZMYyuWbC/rvVl9k1HOlzTGCr3QmECk2OljPYqPLWrA7/pgeNK',
     'user2@example.com',
     'user'
   );
   ```
   用户名: `user2`  
   密码: `test123`

2. **或者修改现有用户的角色**
   ```sql
   -- 临时将 testuser 改为管理员
   UPDATE users SET role = 'admin' WHERE username = 'testuser';
   
   -- 测试完后改回普通用户
   UPDATE users SET role = 'user' WHERE username = 'testuser';
   ```

---

## 📞 获取帮助

如果以上方案都无法解决问题，请：

1. 运行诊断脚本：`./diagnose-win-login.sh`
2. 截图 Electron Console 的错误信息
3. 提供后端日志输出
4. 说明具体的错误现象

我会帮你进一步分析！
