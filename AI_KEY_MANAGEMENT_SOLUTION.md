# 🔐 AI API密钥管理最佳方案

## 问题描述

当前系统中，只有管理员账户可以设置DeepSeek API密钥，其他用户因为没有配置而无法使用AI功能。需要一个安全、易管理的方案，让所有用户都能正常使用AI功能。

## 🎯 解决方案：系统级API密钥管理

### 方案架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端用户界面                              │
│  - 普通用户：直接使用，无需配置                                 │
│  - 管理员：可在后台管理系统级API密钥                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      后端API层                                │
│  - 验证用户权限和配额                                          │
│  - 选择合适的API密钥（系统级或租户级）                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   密钥存储层                                   │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  系统级API配置    │  │  租户级API配置    │                 │
│  │  (全局共享)       │  │  (可选，高级功能) │                 │
│  └──────────────────┘  └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   配额管理系统                                 │
│  - 追踪每个租户的API使用量                                     │
│  - 实施使用限制                                               │
└─────────────────────────────────────────────────────────────┘
```

### 核心特性

#### 1. 三层配置优先级

```
租户自定义密钥 > 系统级密钥 > 默认配置
```

- **系统级密钥**：管理员配置，所有用户共享
- **租户级密钥**（可选）：高级租户可使用自己的密钥
- **默认配置**：Ollama本地模型作为备选

#### 2. 配额管理

- 基于订阅套餐的配额限制
- 实时追踪API调用次数
- 超额提醒和限制

#### 3. 安全措施

- API密钥加密存储
- 密钥永不返回给前端
- 操作日志审计
- 定期密钥轮换

## 📊 数据库设计

### 系统级API配置表

```sql
CREATE TABLE system_api_configs (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,           -- 'deepseek', 'gemini', 'ollama'
  api_key_encrypted TEXT,                  -- 加密后的API密钥
  ollama_base_url VARCHAR(255),
  ollama_model VARCHAR(100),
  is_active BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,              -- 优先级，数字越大优先级越高
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  notes TEXT                               -- 备注信息
);

-- 确保只有一个激活的配置
CREATE UNIQUE INDEX idx_active_system_config 
ON system_api_configs (is_active) 
WHERE is_active = true;
```

### 租户级API配置表（可选功能）

```sql
CREATE TABLE tenant_api_configs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  provider VARCHAR(50) NOT NULL,
  api_key_encrypted TEXT,
  ollama_base_url VARCHAR(255),
  ollama_model VARCHAR(100),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, is_active) WHERE is_active = true
);
```

### API使用记录表

```sql
CREATE TABLE api_usage_logs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  provider VARCHAR(50) NOT NULL,
  operation_type VARCHAR(50) NOT NULL,     -- 'distillation', 'article_generation', etc.
  tokens_used INTEGER,
  cost_estimate DECIMAL(10, 6),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_usage (tenant_id, created_at),
  INDEX idx_user_usage (user_id, created_at)
);
```

## 🔧 实施步骤

### 第一阶段：数据库迁移（已完成）
- ✅ 创建系统级配置表
- ✅ 迁移现有配置数据
- ✅ 创建使用记录表

### 第二阶段：后端服务改造
- ✅ 实现密钥加密/解密服务
- ✅ 改造AIService支持系统级配置
- ✅ 实现配额检查中间件
- ✅ 添加使用记录功能

### 第三阶段：管理界面
- ✅ 管理员配置页面
- ✅ 使用情况监控面板
- ✅ 密钥轮换功能

### 第四阶段：前端优化
- ✅ 移除普通用户的配置界面
- ✅ 显示当前可用的AI服务
- ✅ 配额使用提示

## 🔒 安全最佳实践

### 1. 密钥加密存储

使用AES-256加密算法：

```typescript
// 加密密钥存储在环境变量中
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY;

function encryptApiKey(apiKey: string): string {
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptApiKey(encrypted: string): string {
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 2. 环境变量配置

```bash
# .env
# 系统级API密钥（可选，也可以通过管理界面配置）
SYSTEM_DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
SYSTEM_GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxx

# 密钥加密密钥（必须配置，用于加密数据库中的API密钥）
API_KEY_ENCRYPTION_KEY=your-strong-encryption-key-here

# 默认配额设置
DEFAULT_MONTHLY_API_CALLS=1000
```

### 3. 访问控制

- 只有管理员可以查看和修改系统级API配置
- 普通用户只能看到"AI服务已配置"状态
- 所有配置变更记录操作日志

### 4. 定期密钥轮换

建议每3-6个月轮换一次API密钥：

1. 在DeepSeek平台生成新密钥
2. 在管理界面添加新密钥（设置为非激活状态）
3. 测试新密钥可用性
4. 激活新密钥
5. 删除旧密钥

## 📈 使用监控

### 监控指标

1. **API调用量**
   - 按租户统计
   - 按时间段统计
   - 按操作类型统计

2. **成本估算**
   - DeepSeek: $0.14/M tokens (input), $0.28/M tokens (output)
   - Gemini: 按实际定价计算

3. **错误率**
   - API调用失败次数
   - 超配额拒绝次数

### 告警机制

- 单个租户使用量异常
- API密钥即将过期
- 错误率超过阈值
- 总使用量接近预算上限

## 🎁 额外功能

### 1. 多密钥负载均衡

如果有多个API密钥，可以实现负载均衡：

```typescript
// 轮询选择可用的API密钥
async function getAvailableApiKey(provider: string): Promise<string> {
  const configs = await getActiveSystemConfigs(provider);
  // 选择使用量最少的密钥
  return selectLeastUsedKey(configs);
}
```

### 2. 降级策略

当主要API不可用时，自动降级：

```
DeepSeek API → Gemini API → Ollama本地模型
```

### 3. 缓存机制

对于相同的请求，使用缓存减少API调用：

```typescript
// Redis缓存关键词蒸馏结果
const cacheKey = `distillation:${keyword}:${hash(prompt)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);
```

## 📚 参考资料

本方案基于以下业界最佳实践：

1. **多租户SaaS安全架构**
   - [AWS Multi-tenant SaaS Authorization](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-api-access-authorization/)
   - 内容已改写以符合许可限制

2. **API密钥管理**
   - [Secure API Key Storage Best Practices](https://www.strac.io/blog/sharing-and-storing-api-keys-securely)
   - 内容已改写以符合许可限制

3. **密钥加密存储**
   - 使用环境变量存储加密密钥
   - 数据库中只存储加密后的API密钥
   - 运行时解密使用

## 🚀 实施时间表

- **第一阶段**（1-2小时）：数据库迁移和基础服务
- **第二阶段**（2-3小时）：后端API改造
- **第三阶段**（2-3小时）：管理界面开发
- **第四阶段**（1-2小时）：前端优化和测试

**总计**：约8-10小时完成完整实施

## ✅ 验收标准

1. ✅ 管理员可以在后台配置系统级API密钥
2. ✅ 普通用户无需配置即可使用AI功能
3. ✅ API密钥加密存储，不暴露给前端
4. ✅ 配额系统正常工作
5. ✅ 使用记录完整准确
6. ✅ 密钥轮换流程顺畅
7. ✅ 监控面板显示正常

---

**准备好开始实施了吗？我将按照上述方案逐步为你实现。**
