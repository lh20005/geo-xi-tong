# 🚀 快速启动指南

## 5分钟快速上手多平台发布系统

### 步骤1: 数据库迁移 (1分钟)

```bash
cd server
npm run db:migrate:publishing
```

**预期输出**:
```
✅ 数据库连接成功
🚀 开始创建多平台发布系统表...
✅ 多平台发布系统表创建成功！
```

### 步骤2: 启动后端服务 (1分钟)

```bash
cd server
npm run dev
```

**预期输出**:
```
✅ 加密服务初始化成功
✅ 任务调度器已启动
🚀 服务器运行在 http://localhost:3000
```

### 步骤3: 启动前端 (1分钟)

新开一个终端：

```bash
cd client
npm run dev
```

**预期输出**:
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

### 步骤4: 访问系统 (30秒)

打开浏览器访问：
```
http://localhost:5173/platform-management
```

你会看到12个平台的卡片式布局！

### 步骤5: 绑定第一个账号 (1分钟)

1. 点击"知乎"卡片
2. 填写信息：
   - 账号名称：主账号
   - 用户名：your_username
   - 密码：your_password
3. 点击"确定"

✅ 账号绑定成功！卡片会显示绿色边框和✓标记

### 步骤6: 测试发布 (30秒)

使用API测试工具（如Postman）或curl：

```bash
# 创建测试任务
curl -X POST http://localhost:3000/api/publishing/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "article_id": 1,
    "account_id": 1,
    "platform_id": "zhihu",
    "config": {
      "title": "测试文章"
    }
  }'

# 立即执行任务
curl -X POST http://localhost:3000/api/publishing/tasks/1/execute
```

## 🎯 常用操作

### 查看所有平台
```bash
curl http://localhost:3000/api/publishing/platforms
```

### 查看所有账号
```bash
curl http://localhost:3000/api/publishing/accounts
```

### 查看任务列表
```bash
curl http://localhost:3000/api/publishing/tasks
```

### 查看任务日志
```bash
curl http://localhost:3000/api/publishing/tasks/1/logs
```

## 🔧 故障排除

### 问题1: 数据库连接失败
```bash
# 检查数据库是否运行
psql $DATABASE_URL -c "SELECT 1"

# 检查.env文件
cat .env | grep DATABASE_URL
```

### 问题2: 端口被占用
```bash
# 修改端口
# 编辑 .env 文件
PORT=3001
```

### 问题3: 浏览器启动失败
```bash
# 安装Chromium依赖（Ubuntu/Debian）
sudo apt-get install -y \
  chromium-browser \
  libx11-xcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxi6 \
  libxtst6 \
  libnss3 \
  libcups2 \
  libxss1 \
  libxrandr2 \
  libasound2 \
  libpangocairo-1.0-0 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libgtk-3-0
```

## 📚 下一步

- 📖 阅读 [PUBLISHING_SYSTEM_SUMMARY.md](./PUBLISHING_SYSTEM_SUMMARY.md) 了解系统架构
- 📖 阅读 [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md) 了解实施细节
- 🔧 实现更多平台适配器
- 🎨 完善前端UI

## 💡 提示

1. **测试模式**: 设置 `BROWSER_HEADLESS=false` 可以看到浏览器操作过程
2. **日志查看**: 所有操作都有详细日志，查看 `publishing_logs` 表
3. **安全提示**: 生产环境务必使用HTTPS和强密码
4. **性能优化**: 大量任务时考虑使用任务队列

## ✅ 验证清单

- [ ] 数据库迁移成功
- [ ] 后端服务启动
- [ ] 前端服务启动
- [ ] 可以访问平台管理页面
- [ ] 可以绑定账号
- [ ] 可以创建任务
- [ ] 可以查看日志

全部完成？恭喜！🎉 系统已经可以使用了！
