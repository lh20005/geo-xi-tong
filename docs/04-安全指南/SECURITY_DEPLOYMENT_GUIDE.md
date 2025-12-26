# 云端部署安全指南

## 📋 环境变量安全配置

### 1. 环境变量存放位置

**当前架构（正确）：**
```
项目根目录/.env  ← 后端读取（安全）
client/.env       ← 前端配置（仅非敏感信息）
```

**安全原则：**
- ✅ 敏感信息（API Key、数据库密码）只放在后端 `.env`
- ✅ 前端只配置公开信息（API URL、WebSocket URL）
- ✅ 前端通过后端 API 调用 AI 服务，不直接暴露 API Key

### 2. 云端部署安全配置

#### 方案 A：使用云服务商的环境变量管理（推荐）

**阿里云/腾讯云：**
```bash
# 不要上传 .env 文件到服务器
# 在云服务商控制台配置环境变量：
- DATABASE_URL
- JWT_SECRET
- DEEPSEEK_API_KEY
- GEMINI_API_KEY
- WECHAT_PAY_* (微信支付相关)
```

**Docker 部署：**
```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
    env_file:
      - .env.production  # 不要提交到 Git
```

#### 方案 B：使用密钥管理服务（最安全）

**AWS Secrets Manager / 阿里云 KMS：**
```typescript
// server/src/config/secrets.ts
import { SecretsManager } from 'aws-sdk';

export async function getSecret(secretName: string) {
  const client = new SecretsManager({ region: 'cn-north-1' });
  const data = await client.getSecretValue({ SecretId: secretName }).promise();
  return JSON.parse(data.SecretString);
}
```

### 3. 必须修改的配置项

#### 生产环境 .env.production（示例）

```bash
# 数据库配置 - 使用强密码
DATABASE_URL=postgresql://prod_user:STRONG_PASSWORD_HERE@db-host:5432/geo_system

# JWT密钥 - 必须使用强随机字符串
JWT_SECRET=生成方式见下方

# AI API配置 - 从服务商获取
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx

# 服务器配置
PORT=3000
NODE_ENV=production

# 管理员账号 - 使用强密码
ADMIN_USERNAME=admin
ADMIN_PASSWORD=使用强密码生成器

# 微信支付配置
WECHAT_PAY_APP_ID=wxxxxxxxxxxx
WECHAT_PAY_MCH_ID=xxxxxxxxxx
WECHAT_PAY_API_V3_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WECHAT_PAY_SERIAL_NO=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WECHAT_PAY_PRIVATE_KEY_PATH=/secure/path/to/apiclient_key.pem
WECHAT_PAY_NOTIFY_URL=https://your-domain.com/api/payment/wechat/notify

# Redis配置（如果使用）
REDIS_URL=redis://:password@redis-host:6379
```

### 4. 生成强密钥的方法

```bash
# 生成 JWT_SECRET（64字符随机字符串）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 或使用 OpenSSL
openssl rand -hex 32

# 生成强密码
openssl rand -base64 24
```

### 5. 部署检查清单

#### 部署前：
- [ ] 修改所有默认密码
- [ ] 生成新的 JWT_SECRET
- [ ] 配置真实的 API Key
- [ ] 确认 .env 在 .gitignore 中
- [ ] 删除 .env 中的注释和示例值

#### 部署时：
- [ ] 使用云服务商的环境变量管理
- [ ] 或使用 .env.production（不提交到 Git）
- [ ] 配置 HTTPS（使用 Let's Encrypt）
- [ ] 配置防火墙规则
- [ ] 限制数据库访问 IP

#### 部署后：
- [ ] 验证环境变量已正确加载
- [ ] 测试 API 功能正常
- [ ] 检查日志中没有泄露敏感信息
- [ ] 定期轮换密钥

### 6. 前端环境变量配置

**client/.env.production：**
```bash
# 前端只配置公开信息
VITE_API_URL=https://your-domain.com/api
VITE_WS_URL=wss://your-domain.com/ws
VITE_LANDING_URL=https://your-domain.com
```

**注意：** Vite 会将 `VITE_` 开头的变量打包到前端代码中，所以：
- ❌ 不要在前端 .env 中放 API Key
- ❌ 不要在前端 .env 中放数据库密码
- ✅ 只放公开的配置信息

### 7. AI API 使用安全

**当前架构（安全）：**
```
用户 → 前端 → 后端 API → AI 服务
              ↑
         API Key 在这里
```

**后端 API 示例：**
```typescript
// server/src/routes/ai.ts
import express from 'express';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// AI API Key 只在后端使用
router.post('/generate', authenticateToken, async (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY; // 安全：不暴露给前端
  
  // 调用 AI 服务
  const response = await fetch('https://api.deepseek.com/v1/chat', {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(req.body)
  });
  
  res.json(await response.json());
});
```

### 8. 常见安全问题

#### ❌ 错误做法：
```typescript
// 前端代码 - 危险！
const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY; // 会暴露在浏览器中
fetch('https://api.deepseek.com', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

#### ✅ 正确做法：
```typescript
// 前端代码 - 安全
fetch('/api/ai/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`, // 用户 JWT token
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ prompt: '...' })
});

// 后端处理 - API Key 不暴露
```

### 9. 监控和审计

**建议配置：**
```typescript
// server/src/middleware/logger.ts
export function logSensitiveAccess(req, res, next) {
  if (req.path.includes('/api/ai')) {
    console.log(`[AI API] User: ${req.user.id}, Time: ${new Date()}`);
  }
  next();
}
```

**监控指标：**
- API 调用频率
- 异常访问模式
- 密钥使用量
- 错误率

### 10. 应急响应

**如果 API Key 泄露：**
1. 立即在服务商控制台撤销旧密钥
2. 生成新密钥
3. 更新服务器环境变量
4. 重启服务
5. 检查是否有异常调用
6. 考虑添加 IP 白名单

**如果数据库密码泄露：**
1. 立即修改数据库密码
2. 更新 DATABASE_URL
3. 重启所有服务
4. 检查数据库访问日志
5. 考虑迁移到新数据库实例

## 📝 总结

**当前系统的安全性：**
- ✅ 架构设计正确（后端处理敏感信息）
- ✅ .gitignore 配置正确
- ⚠️ 需要在部署前修改默认密钥
- ⚠️ 需要配置生产环境的环境变量管理

**部署到云端是安全的，前提是：**
1. 使用云服务商的环境变量管理
2. 修改所有默认密码和密钥
3. 配置 HTTPS
4. 定期轮换密钥
5. 监控异常访问
