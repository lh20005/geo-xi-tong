# Windows端登录问题排查指南

## 问题描述
testuser/test123 在 Windows 端无法登录

## ✅ 已验证的信息

1. **后端API正常**
   - ✅ 后端服务运行在 http://localhost:3000
   - ✅ testuser 账号已创建（ID: 5）
   - ✅ 密码hash正确
   - ✅ 通过 curl 测试登录成功

2. **用户信息**
   ```
   用户名: testuser
   密码: test123
   邮箱: testuser@example.com
   角色: user
   ```

---

## 🔍 排查步骤

### 步骤 1：检查后端服务是否运行

```bash
# 检查后端服务
curl http://localhost:3000/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'
```

**预期结果：** 返回包含 token 和 user 信息的 JSON

---

### 步骤 2：检查 Windows 端配置

1. **打开 Windows 登录管理器**
2. **查看设置页面**（如果是管理员登录）
3. **检查服务器URL配置**
   - 应该是：`http://localhost:3000`
   - 如果不是，请修改为正确的地址

---

### 步骤 3：查看 Electron 日志

1. **打开 Windows 登录管理器**
2. **按 `Cmd+Option+I` (Mac) 或 `Ctrl+Shift+I` (Windows)** 打开开发者工具
3. **切换到 Console 标签**
4. **尝试登录 testuser**
5. **查看错误信息**

**常见错误：**

#### 错误 1：网络连接失败
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
**解决方案：** 确保后端服务正在运行

#### 错误 2：401 Unauthorized
```
Error: Request failed with status code 401
```
**解决方案：** 密码错误或用户不存在

#### 错误 3：服务器URL错误
```
Error: getaddrinfo ENOTFOUND xxx
```
**解决方案：** 检查设置中的服务器URL配置

---

### 步骤 4：清除缓存重试

1. **关闭 Windows 登录管理器**
2. **删除缓存数据**：
   ```bash
   # Mac
   rm -rf ~/Library/Application\ Support/platform-login-manager
   
   # Windows
   # 删除 %APPDATA%\platform-login-manager
   ```
3. **重新启动应用**
4. **重新配置服务器URL**（如果需要）
5. **尝试登录**

---

### 步骤 5：检查数据库中的用户

```bash
# 连接数据库
psql postgresql://lzc@localhost:5432/geo_system

# 查询用户
SELECT id, username, email, role, created_at 
FROM users 
WHERE username = 'testuser';
```

**预期结果：**
```
 id | username |        email         | role |         created_at         
----+----------+----------------------+------+----------------------------
  5 | testuser | testuser@example.com | user | 2025-12-23 21:19:34.702646
```

---

### 步骤 6：测试密码验证

```bash
# 在 server 目录下运行
cd server
node -e "
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://lzc@localhost:5432/geo_system'
});

async function test() {
  const result = await pool.query('SELECT password_hash FROM users WHERE username = \$1', ['testuser']);
  if (result.rows.length > 0) {
    const hash = result.rows[0].password_hash;
    const match = await bcrypt.compare('test123', hash);
    console.log('Password match:', match);
  } else {
    console.log('User not found');
  }
  await pool.end();
}

test();
"
```

**预期结果：** `Password match: true`

---

## 🛠️ 快速修复方案

### 方案 1：重新创建用户（推荐）

```bash
# 删除旧用户
psql postgresql://lzc@localhost:5432/geo_system -c "DELETE FROM users WHERE username = 'testuser';"

# 重新创建
psql postgresql://lzc@localhost:5432/geo_system -f create-test-user.sql
```

### 方案 2：重置密码

```bash
# 生成新的密码hash
cd server
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('test123', 10).then(hash => console.log(hash));"

# 复制输出的hash，然后更新数据库
psql postgresql://lzc@localhost:5432/geo_system -c "UPDATE users SET password_hash = '新的hash' WHERE username = 'testuser';"
```

### 方案 3：使用管理员账号测试

先用管理员账号测试 Windows 端是否可以正常登录：
```
用户名: admin
密码: admin123
```

如果管理员可以登录，说明问题出在 testuser 账号上。

---

## 📝 收集诊断信息

如果以上步骤都无法解决问题，请收集以下信息：

1. **Electron 控制台的完整错误日志**
2. **后端服务日志**（运行 `npm run dev` 时的输出）
3. **数据库查询结果**：
   ```sql
   SELECT * FROM users WHERE username = 'testuser';
   ```
4. **Windows 端配置**：
   - 打开开发者工具
   - 在 Console 中运行：
     ```javascript
     window.electronAPI.getConfig().then(config => console.log(config))
     ```

---

## 💡 常见原因总结

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 无法连接 | 后端未运行 | 启动后端服务 |
| 401错误 | 密码错误 | 重置密码 |
| 用户不存在 | 数据库中无此用户 | 重新创建用户 |
| 配置错误 | 服务器URL不正确 | 修改设置中的URL |
| 缓存问题 | 旧数据干扰 | 清除应用缓存 |

---

## 🚀 快速测试命令

```bash
# 1. 确保后端运行
cd server && npm run dev

# 2. 测试API（新终端）
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'

# 3. 启动 Windows 端（新终端）
cd windows-login-manager && npm run dev

# 4. 尝试登录
# 用户名: testuser
# 密码: test123
```

---

## 📞 需要帮助？

如果问题仍然存在，请提供：
1. Electron 控制台的错误截图
2. 后端日志输出
3. 执行上述诊断步骤的结果

我会帮你进一步分析问题！
