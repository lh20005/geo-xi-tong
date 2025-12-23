# 测试账号信息

## 可用测试账号

### 1. 管理员账号（可以看到所有功能）

```
用户名：admin
密码：  admin123
角色：  admin
```

**权限：**
- ✅ 可以看到"系统配置"菜单（网页端）
- ✅ 可以看到"设置"菜单（Windows端）
- ✅ 可以访问所有功能模块

---

### 2. 普通用户账号（受限访问）

```
用户名：testuser
密码：  test123
邮箱：  testuser@example.com
角色：  user
```

**权限：**
- ❌ 看不到"系统配置"菜单（网页端）
- ❌ 看不到"设置"菜单（Windows端）
- ❌ 尝试通过URL直接访问会被重定向
- ✅ 可以访问其他所有功能模块

**状态：** ✅ 已创建（ID: 5）

---

## 创建测试用户

如果测试用户不存在，可以通过以下方式创建：

### 方法 1：使用 SQL 脚本（推荐）

```bash
# 连接到数据库并执行脚本
psql -U postgres -d geo_system -f create-test-user.sql
```

### 方法 2：手动执行 SQL

```sql
-- 创建普通用户
INSERT INTO users (username, password_hash, email, role) 
VALUES (
  'testuser', 
  '$2b$10$rKvVPZqGhXqKX8X8X8X8XeN5YqGhXqKX8X8X8X8X8X8X8X8X8X8X8',
  'test@example.com',
  'user'
)
ON CONFLICT (username) DO NOTHING;
```

### 方法 3：使用 Node.js 脚本

```bash
# 安装依赖（如果还没安装）
npm install

# 运行创建用户脚本
node create-test-user.js
```

---

## 测试步骤

### 网页端测试

1. **测试管理员权限**
   - 访问 http://localhost:5173
   - 使用管理员账号登录（admin / admin123）
   - 验证左侧菜单显示"系统配置"选项
   - 点击进入系统配置页面
   - 验证可以正常访问

2. **测试普通用户权限**
   - 退出登录
   - 使用普通用户账号登录（testuser / test123）
   - 验证左侧菜单**不显示**"系统配置"选项
   - 尝试通过URL访问 http://localhost:5173/config
   - 验证被重定向到首页，并显示警告消息

### Windows端测试

1. **测试管理员权限**
   - 启动 Windows 登录管理器
   - 使用管理员账号登录（admin / admin123）
   - 验证左侧菜单显示"设置"选项
   - 点击进入设置页面
   - 验证可以正常访问

2. **测试普通用户权限**
   - 退出登录
   - 使用普通用户账号登录（testuser / test123）
   - 验证左侧菜单**不显示**"设置"选项
   - 尝试通过URL访问 /settings
   - 验证被重定向到 /platforms

---

## 注意事项

1. **密码加密**：上面的密码hash是示例，实际使用时需要用 bcrypt 生成正确的hash
2. **数据库连接**：确保 PostgreSQL 正在运行，且数据库配置正确
3. **环境变量**：检查 `.env` 文件中的数据库配置
4. **后端验证**：前端权限控制仅用于UI展示，后端API也需要实现权限验证

---

## 故障排查

### 问题：无法登录

**解决方案：**
- 检查数据库是否正在运行
- 检查用户是否已创建
- 检查密码hash是否正确
- 查看后端日志

### 问题：菜单项没有隐藏

**解决方案：**
- 清除浏览器缓存和 localStorage
- 检查用户角色是否正确保存
- 查看浏览器控制台是否有错误
- 确认前端代码已正确部署

### 问题：路由保护不生效

**解决方案：**
- 检查 AdminRoute 组件是否正确导入
- 检查用户信息是否存在于 localStorage
- 查看控制台日志
- 刷新页面重新加载

---

## 快速测试命令

```bash
# 1. 创建测试用户
psql -U postgres -d geo_system -f create-test-user.sql

# 2. 启动后端服务
npm run dev

# 3. 启动网页端（新终端）
cd client && npm run dev

# 4. 启动 Windows 端（新终端）
cd windows-login-manager && npm run dev

# 5. 开始测试
# 网页端：http://localhost:5173
# Windows端：Electron 应用窗口
```

---

## 更多信息

详细的实现说明和测试指南请参考：
- `ROLE_BASED_ACCESS_CONTROL_TEST.md` - 完整测试指南
- `PERMISSION_IMPLEMENTATION_SUMMARY.md` - 实现总结
