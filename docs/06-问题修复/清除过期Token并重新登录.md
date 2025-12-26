# 清除过期 Token 并重新登录

## 问题说明

你遇到的 "令牌无效或已过期" 错误是因为：
- Access Token 已过期（过期时间：2025-12-25 07:53:05）
- Refresh Token 可能也已过期（7天有效期）

## 解决方案

### 方案一：清除浏览器缓存重新登录（推荐）

1. **打开浏览器开发者工具**
   - Chrome/Edge: 按 `F12` 或 `Cmd+Option+I` (Mac)
   - 或右键点击页面 → 检查

2. **清除 localStorage**
   - 在开发者工具中，点击 `Application` 或 `应用` 标签
   - 左侧找到 `Local Storage`
   - 点击你的网站地址（http://localhost:5173）
   - 右键点击 → `Clear` 或点击删除按钮
   
   或者在 Console 中执行：
   ```javascript
   localStorage.clear();
   location.reload();
   ```

3. **重新登录**
   - 页面会自动刷新并跳转到登录页
   - 使用测试账号登录：
     - 管理员：`admin` / `admin123`
     - 普通用户：`testuser` / `test123`

### 方案二：直接访问登录页

1. **访问登录页**
   ```
   http://localhost:8080/login
   ```

2. **使用测试账号登录**
   - 管理员账号：
     - 用户名：`admin`
     - 密码：`admin123`
   
   - 普通用户账号：
     - 用户名：`testuser`
     - 密码：`test123`

3. **登录成功后点击"进入系统"**

## 测试账号信息

### 管理员账号
```
用户名：admin
密码：  admin123
角色：  admin
```

**权限：**
- ✅ 可以访问所有功能
- ✅ 可以看到"商品管理"
- ✅ 可以看到"系统配置"
- ✅ 可以管理用户

### 普通用户账号
```
用户名：testuser
密码：  test123
角色：  user
```

**权限：**
- ✅ 可以访问大部分功能
- ❌ 无法访问"系统配置"
- ✅ 可以看到"商品管理"（如果有权限）

## Token 有效期说明

- **Access Token**: 1小时
- **Refresh Token**: 7天
- **自动刷新**: 当 Access Token 过期时，系统会自动使用 Refresh Token 刷新
- **完全过期**: 如果 Refresh Token 也过期，需要重新登录

## 预防措施

为了避免频繁遇到 token 过期问题：

1. **定期使用系统**
   - 每次访问都会更新 token 的使用时间
   - 保持活跃可以延长会话

2. **不要长时间不使用**
   - 超过 7 天不使用会导致 Refresh Token 过期
   - 需要重新登录

3. **开发环境建议**
   - 可以考虑延长 token 有效期（仅开发环境）
   - 修改 `server/src/services/TokenService.ts` 中的配置

## 快速清除命令

在浏览器控制台（Console）中执行：

```javascript
// 清除所有 localStorage
localStorage.clear();

// 或者只清除 token 相关
localStorage.removeItem('auth_token');
localStorage.removeItem('refresh_token');
localStorage.removeItem('user_info');

// 刷新页面
location.reload();
```

## 如果问题仍然存在

1. **检查后端服务是否正常运行**
   ```bash
   # 查看后端日志
   # 应该看到服务器运行在 http://localhost:3000
   ```

2. **检查数据库连接**
   ```bash
   # 确保 PostgreSQL 正在运行
   # 确保 Redis 正在运行
   ```

3. **重启所有服务**
   ```bash
   # 停止所有服务
   # 重新启动：
   npm run dev  # 在项目根目录
   ```

4. **查看浏览器控制台错误**
   - 按 F12 打开开发者工具
   - 查看 Console 标签中的错误信息
   - 查看 Network 标签中的请求失败原因

## 联系支持

如果以上方法都无法解决问题，请提供：
- 浏览器控制台的错误信息
- 后端服务器的日志
- 你执行的操作步骤

---

**快速操作：**
1. 按 F12 打开控制台
2. 输入：`localStorage.clear(); location.reload();`
3. 回到登录页，使用 `admin` / `admin123` 登录
4. 点击"进入系统"

完成！🎉
