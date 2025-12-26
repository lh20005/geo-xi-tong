# DeepSeek API 配置位置说明

## 📍 当前配置位置

### 1. 环境变量存储
```
项目根目录/.env
```

**内容：**
```bash
DEEPSEEK_API_KEY=your_deepseek_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. 实际使用位置

**后端服务：** `server/src/services/aiService.ts`

```typescript
// 第 207 行 - callDeepSeek 方法
private async callDeepSeek(prompt: string): Promise<string> {
  const response = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 1.0,
      max_tokens: 1000
    },
    {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,  // ← API Key 在这里使用
        'Content-Type': 'application/json'
      }
    }
  );
}
```

### 3. API Key 传递流程

```
.env 文件
  ↓
后端启动时读取 (server/src/index.ts)
  ↓
存储在数据库 api_configs 表
  ↓
AIService 从数据库读取配置
  ↓
调用 DeepSeek API
```

## 🔒 安全性分析

### ✅ 当前架构（安全）

```
前端 (client)
  ↓ HTTP请求
后端 API (server)
  ↓ 读取 API Key
DeepSeek API
```

**安全点：**
1. ✅ API Key 只存在于后端
2. ✅ 前端不直接访问 DeepSeek API
3. ✅ API Key 不会暴露在浏览器中
4. ✅ .env 文件在 .gitignore 中

### 使用场景

**1. 关键词蒸馏（生成用户提问）**
- 位置：`server/src/services/distillationService.ts`
- 调用：`aiService.distillKeyword(keyword)`

**2. 文章生成**
- 位置：`server/src/services/articleGenerationService.ts`
- 调用：`aiService.generateArticle(keyword, topics, requirements)`

**3. 文章排版**
- 位置：`server/src/services/articleGenerationService.ts`
- 调用：`aiService.formatArticle(content, hasImage)`

## 🌐 部署到云端的安全性

### ✅ 完全安全，因为：

1. **API Key 在后端**
   - 前端代码打包后不包含 API Key
   - 用户无法从浏览器查看到 API Key

2. **请求流程安全**
   ```
   用户浏览器 → 你的后端服务器 → DeepSeek API
                    ↑
              API Key 在这里
   ```

3. **环境变量隔离**
   - 开发环境：本地 .env 文件
   - 生产环境：云服务商环境变量管理

### 部署建议

#### 方案 A：云服务商环境变量（推荐）

**阿里云/腾讯云：**
```bash
# 在云服务器控制台配置环境变量
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyxxxxxxxxxx
```

**优点：**
- 不需要上传 .env 文件
- 密钥不会出现在代码仓库
- 可以随时在控制台修改

#### 方案 B：Docker Secrets

```yaml
# docker-compose.yml
services:
  backend:
    image: your-backend:latest
    environment:
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
    secrets:
      - deepseek_key

secrets:
  deepseek_key:
    external: true
```

#### 方案 C：密钥管理服务

**AWS Secrets Manager / 阿里云 KMS：**
```typescript
// 从密钥管理服务读取
const apiKey = await secretsManager.getSecret('deepseek-api-key');
```

## 📊 数据库存储

API 配置也存储在数据库中：

**表：** `api_configs`

```sql
CREATE TABLE api_configs (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,  -- 'deepseek' | 'gemini' | 'ollama'
  api_key TEXT,                   -- 加密存储的 API Key
  ollama_base_url VARCHAR(255),
  ollama_model VARCHAR(100),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**查询当前配置：**
```bash
curl http://localhost:3000/api/config/active
```

**响应：**
```json
{
  "id": 1,
  "provider": "deepseek",
  "configured": true,
  "ollamaBaseUrl": null,
  "ollamaModel": null
}
```

注意：API Key 不会在响应中返回（安全考虑）

## 🔧 如何配置

### 方法 1：通过前端界面（推荐）

1. 访问：`http://localhost:5173/config`
2. 选择 AI 提供商：DeepSeek
3. 输入 API Key
4. 点击"保存配置"

### 方法 2：直接修改 .env 文件

```bash
# 编辑 .env 文件
DEEPSEEK_API_KEY=sk-your-actual-api-key-here

# 重启后端服务
cd server
npm run dev
```

### 方法 3：通过 API 配置

```bash
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "provider": "deepseek",
    "apiKey": "sk-your-actual-api-key-here"
  }'
```

## 🔑 获取 DeepSeek API Key

1. 访问：https://platform.deepseek.com
2. 注册/登录账号
3. 进入"API Keys"页面
4. 点击"Create API Key"
5. 复制生成的密钥（格式：`sk-xxxxxxxxxxxxxxxx`）

**注意：**
- API Key 只显示一次，请妥善保存
- 建议设置使用限额，防止滥用
- 定期轮换密钥

## 📝 总结

| 项目 | 说明 |
|------|------|
| **存储位置** | 项目根目录 `.env` 文件 |
| **使用位置** | `server/src/services/aiService.ts` |
| **前端访问** | ❌ 不能直接访问 |
| **后端访问** | ✅ 通过环境变量读取 |
| **云端部署** | ✅ 完全安全（使用云服务商环境变量） |
| **Git 提交** | ❌ 已在 .gitignore 中排除 |
| **数据库存储** | ✅ 加密存储在 `api_configs` 表 |

**安全等级：🔒🔒🔒🔒🔒 (5/5)**

当前架构完全符合安全最佳实践，API Key 不会暴露给前端用户。
