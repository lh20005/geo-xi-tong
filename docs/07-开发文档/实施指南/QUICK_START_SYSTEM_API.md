# ⚡ 系统级API配置 - 快速开始

## 🎯 5分钟快速部署

### 1️⃣ 运行设置脚本

```bash
./setup-system-api-config.sh
```

这个脚本会自动：
- ✅ 生成API密钥加密密钥
- ✅ 更新.env文件
- ✅ 执行数据库迁移
- ✅ 创建所有必要的表

### 2️⃣ 重启服务器

```bash
npm run dev
```

### 3️⃣ 配置系统API

1. 使用管理员账号登录
2. 访问【系统设置】->【AI配置】
3. 选择AI服务（DeepSeek/Gemini/Ollama）
4. 输入API密钥
5. 点击"测试配置"
6. 点击"保存配置"

### 4️⃣ 测试功能

使用普通用户账号：
- 尝试关键词蒸馏
- 尝试生成文章
- 查看配额使用情况

## 📋 需要修改的代码

### 主路由文件 (server/src/index.ts)

```typescript
import systemApiConfigRouter from './routes/admin/systemApiConfig';
import { apiStatusRouter } from './routes/apiStatus';

// 添加路由
app.use('/api/admin/system-api-config', authenticate, requireAdmin, systemApiConfigRouter);
app.use('/api/api-status', apiStatusRouter);
```

### 关键词蒸馏路由 (server/src/routes/distillation.ts)

```typescript
// 替换旧的AIService创建方式
const aiService = await AIService.createFromSystemConfig(
  undefined,  // provider
  tenantId,   // 从req.user获取
  userId      // 从req.user获取
);
```

### 文章生成路由 (server/src/routes/articleGeneration.ts)

```typescript
// 同样替换AIService创建方式
const aiService = await AIService.createFromSystemConfig(
  undefined,
  tenantId,
  userId
);
```

## 🔑 环境变量

在 `.env` 文件中确保有：

```bash
# API密钥加密密钥（自动生成）
API_KEY_ENCRYPTION_KEY=your-generated-key-here
```

## ✅ 验收检查

- [ ] 管理员可以配置系统API
- [ ] 普通用户可以使用AI功能
- [ ] 配额显示正常
- [ ] API密钥加密存储
- [ ] 使用记录正常保存

## 🆘 遇到问题？

### 问题1：数据库迁移失败
```bash
# 检查数据库连接
psql $DATABASE_URL -c "SELECT 1"

# 手动执行迁移
node server/src/db/migrate-system-api-config.js
```

### 问题2：加密密钥错误
```bash
# 重新生成加密密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 更新.env文件
# API_KEY_ENCRYPTION_KEY=新生成的密钥
```

### 问题3：API调用失败
- 检查API密钥是否正确
- 使用"测试配置"功能验证
- 查看服务器日志

## 📚 完整文档

- [完整方案](./AI_KEY_MANAGEMENT_SOLUTION.md)
- [实施指南](./SYSTEM_API_CONFIG_IMPLEMENTATION.md)

---

**就这么简单！5分钟完成部署，让所有用户都能使用AI功能。**
