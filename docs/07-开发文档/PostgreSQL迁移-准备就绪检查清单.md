# PostgreSQL 迁移 - 准备就绪检查清单

**创建时间**: 2026-01-16  
**状态**: ✅ 代码迁移完成，准备测试  
**目标**: 确保环境配置正确，可以开始实际运行测试

---

## 📋 环境准备检查清单

### 1. PostgreSQL 数据库 ✅

- [ ] PostgreSQL 服务正在运行
  ```bash
  pg_isready
  # 应该显示: accepting connections
  ```

- [ ] 数据库 `geo_windows` 存在
  ```bash
  psql -U geo_user -d geo_windows -c "SELECT 1"
  # 应该返回: 1
  ```

- [ ] 数据表完整（至少 17 个表）
  ```bash
  psql -U geo_user -d geo_windows -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
  # 应该返回: >= 17
  ```

- [ ] 有测试数据（至少有用户数据）
  ```bash
  psql -U geo_user -d geo_windows -c "SELECT COUNT(*) FROM users"
  # 应该返回: > 0
  ```

---

### 2. 环境变量配置 ✅

- [ ] `.env` 文件存在
  ```bash
  ls windows-login-manager/.env
  ```

- [ ] 数据库配置正确
  ```bash
  # 检查 .env 文件包含以下配置
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=geo_windows
  DB_USER=geo_user
  DB_PASSWORD=your_password
  ```

---

### 3. Node.js 依赖 ✅

- [ ] node_modules 存在
  ```bash
  ls windows-login-manager/node_modules
  ```

- [ ] 如果不存在，安装依赖
  ```bash
  cd windows-login-manager
  npm install
  ```

---

### 4. 代码完整性 ✅

- [ ] 运行完整性验证脚本
  ```bash
  ./windows-login-manager/scripts/verify-migration-completeness.sh
  # 应该显示: ✅ 迁移完整性验证通过！
  ```

---

### 5. TypeScript 编译 ✅

- [ ] electron/ 目录无编译错误
  ```bash
  cd windows-login-manager
  npx tsc --noEmit 2>&1 | grep "electron/"
  # 应该没有输出（表示无错误）
  ```

---

## 🚀 启动应用

### 方法 1: 开发模式（推荐）

```bash
cd windows-login-manager
npm run dev
```

**预期结果**:
- Electron 窗口打开
- 显示登录界面
- 控制台无错误

---

### 方法 2: 构建后运行

```bash
cd windows-login-manager
npm run build
npm start
```

---

## 🔐 登录测试账号

### 测试账号信息

根据数据库中的用户数据，使用以下账号之一登录：

```bash
# 查询可用的测试账号
psql -U geo_user -d geo_windows -c "SELECT id, username, email FROM users LIMIT 5"
```

**常见测试账号**:
- 用户名: `test_user` 或 `admin`
- 密码: 查看数据库或使用默认密码

---

## 🧪 快速功能验证

### 方法 1: 使用快速测试脚本

1. 启动应用并登录
2. 打开开发者工具: `Cmd+Option+I` (Mac) 或 `Ctrl+Shift+I` (Windows)
3. 打开文件: `windows-login-manager/scripts/quick-test-migration.js`
4. 复制内容到控制台运行
5. 查看测试结果

**预期结果**:
```
✅ 通过: 文章列表查询
✅ 通过: 相册列表查询
✅ 通过: 知识库列表查询
✅ 通过: 平台账号列表查询
✅ 通过: 发布任务列表查询
✅ 通过: 蒸馏记录列表查询
✅ 通过: 话题列表查询
✅ 通过: 转化目标列表查询
✅ 通过: 文章设置列表查询

📊 测试结果汇总
✅ 通过: 9
❌ 失败: 0
📈 成功率: 100.0%
```

---

### 方法 2: 手动测试

按照以下顺序测试各模块：

1. **文章管理**
   - [ ] 打开文章列表页面
   - [ ] 能看到文章列表
   - [ ] 点击"新建文章"
   - [ ] 创建一篇测试文章
   - [ ] 编辑文章
   - [ ] 删除文章

2. **图库管理**
   - [ ] 打开图库页面
   - [ ] 能看到相册列表
   - [ ] 创建新相册
   - [ ] 上传图片
   - [ ] 查看图片
   - [ ] 删除图片

3. **知识库管理**
   - [ ] 打开知识库页面
   - [ ] 能看到知识库列表
   - [ ] 上传文档
   - [ ] 查看文档内容
   - [ ] 删除文档

4. **平台账号管理**
   - [ ] 打开平台账号页面
   - [ ] 能看到账号列表
   - [ ] 查看账号详情

5. **发布任务管理**
   - [ ] 打开发布任务页面
   - [ ] 能看到任务列表
   - [ ] 查看任务详情

6. **蒸馏管理**
   - [ ] 打开蒸馏页面
   - [ ] 能看到蒸馏记录
   - [ ] 查看蒸馏详情

7. **话题管理**
   - [ ] 打开话题页面
   - [ ] 能看到话题列表
   - [ ] 查看话题详情

8. **转化目标管理**
   - [ ] 打开转化目标页面
   - [ ] 能看到转化目标列表
   - [ ] 查看转化目标详情

9. **文章设置管理**
   - [ ] 打开文章设置页面
   - [ ] 能看到文章设置列表
   - [ ] 查看文章设置详情

---

## 🔍 关键验证点

### 数据隔离验证

1. [ ] 使用用户 A 登录，记录看到的数据数量
2. [ ] 退出登录
3. [ ] 使用用户 B 登录
4. [ ] 验证看不到用户 A 的数据
5. [ ] 验证只能看到用户 B 的数据

**预期结果**: 用户只能看到自己的数据

---

### 关联数据验证

1. [ ] 创建蒸馏记录
2. [ ] 从蒸馏记录创建话题
3. [ ] 使用话题生成文章
4. [ ] 验证关联关系正确

**预期结果**: 
- 话题能正确关联到蒸馏记录
- 文章能正确关联到话题

---

### 性能验证

1. [ ] 查询文章列表，观察响应时间
2. [ ] 创建文章，观察响应时间
3. [ ] 更新文章，观察响应时间
4. [ ] 删除文章，观察响应时间

**预期结果**: 
- 查询操作 < 1 秒
- 创建/更新/删除操作 < 500ms

---

## 🐛 常见问题排查

### 问题 1: 应用无法启动

**症状**: 运行 `npm run dev` 后应用崩溃

**排查步骤**:
1. 检查 PostgreSQL 是否运行: `pg_isready`
2. 检查数据库连接配置: 查看 `.env` 文件
3. 查看控制台错误信息
4. 查看日志文件: `~/Library/Logs/windows-login-manager/main.log`

---

### 问题 2: 登录失败

**症状**: 输入用户名密码后无法登录

**排查步骤**:
1. 检查用户是否存在: `psql -U geo_user -d geo_windows -c "SELECT * FROM users WHERE username='test_user'"`
2. 检查密码是否正确
3. 查看控制台错误信息
4. 检查 JWT token 配置

---

### 问题 3: 数据查询为空

**症状**: 打开页面后显示"暂无数据"

**排查步骤**:
1. 检查数据库中是否有数据
2. 检查 user_id 是否正确
3. 打开开发者工具，查看网络请求
4. 查看控制台错误信息

---

### 问题 4: 数据库连接失败

**症状**: 控制台显示"数据库连接失败"

**排查步骤**:
1. 检查 PostgreSQL 是否运行: `pg_isready`
2. 检查数据库配置: `.env` 文件
3. 测试数据库连接: `psql -U geo_user -d geo_windows -c "SELECT 1"`
4. 检查防火墙设置

---

## 📝 测试记录

### 测试日期: [填写日期]

**环境检查**:
- [ ] PostgreSQL 运行正常
- [ ] 数据库配置正确
- [ ] Node.js 依赖完整
- [ ] 代码完整性验证通过

**应用启动**:
- [ ] 应用成功启动
- [ ] 登录界面正常显示
- [ ] 无控制台错误

**功能测试**:
- [ ] 文章管理正常
- [ ] 图库管理正常
- [ ] 知识库管理正常
- [ ] 平台账号管理正常
- [ ] 发布任务管理正常
- [ ] 蒸馏管理正常
- [ ] 话题管理正常
- [ ] 转化目标管理正常
- [ ] 文章设置管理正常

**关键验证**:
- [ ] 数据隔离正常
- [ ] 关联数据正确
- [ ] 性能正常

**发现的问题**:
[记录发现的问题]

---

## ✅ 准备就绪确认

当以下所有项都完成后，即可开始正式测试：

- [ ] PostgreSQL 数据库运行正常
- [ ] 环境变量配置正确
- [ ] Node.js 依赖安装完成
- [ ] 代码完整性验证通过
- [ ] TypeScript 编译无错误
- [ ] 应用可以成功启动
- [ ] 可以成功登录

**确认人**: [填写姓名]  
**确认时间**: [填写时间]

---

## 📚 相关文档

1. [PostgreSQL 迁移 - 阶段 6 最终总结](./PostgreSQL迁移-阶段6最终总结.md)
2. [PostgreSQL 迁移 - 阶段 6 完整性测试报告](./PostgreSQL迁移-阶段6完整性测试报告.md)
3. [PostgreSQL 迁移 - 阶段 6 步骤 10 实际测试指南](./PostgreSQL迁移-阶段6步骤10实际测试指南.md)
4. [数据库设置指南](../../windows-login-manager/docs/DATABASE_SETUP_GUIDE.md)

---

**文档版本**: 1.0  
**最后更新**: 2026-01-16  
**状态**: ✅ 准备就绪，可以开始测试
