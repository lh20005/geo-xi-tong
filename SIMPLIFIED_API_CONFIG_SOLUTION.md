# 🎯 简化方案：改造现有配置页面

## 问题分析

你说得对！现在系统已经有一个配置页面 (`ConfigPage.tsx`)，不需要再创建新页面。

**当前问题**：
- 现有配置页面每个用户都需要单独配置API密钥
- 管理员配置了，普通用户还是无法使用

**解决方案**：
改造现有配置页面，支持两种模式：
1. **管理员模式**：配置系统级API密钥（所有用户共享）
2. **普通用户模式**：只显示当前可用的AI服务状态

## 🏗️ 简化架构

```
┌─────────────────────────────────────────────────────────┐
│              现有ConfigPage.tsx                          │
│  ┌───────────────────┐  ┌───────────────────┐          │
│  │   管理员视图       │  │   普通用户视图     │          │
│  │ - 配置API密钥     │  │ - 查看服务状态     │          │
│  │ - 测试连接        │  │ - 查看配额         │          │
│  │ - 管理配置        │  │ - 无法修改         │          │
│  └───────────────────┘  └───────────────────┘          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│           改造后的 config.ts 路由                         │
│  - 管理员：可以保存配置（加密存储）                        │
│  - 普通用户：只能查看状态                                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              数据库（复用现有表）                          │
│  api_configs 表（添加加密功能）                           │
└─────────────────────────────────────────────────────────┘
```

## 📋 实施步骤

### 第一步：改造数据库（最小改动）

**不需要创建新表！** 只需要：

1. 添加加密密钥到环境变量
2. 在 `api_configs` 表中加密存储API密钥
3. 添加配额表（可选）

```sql
-- 可选：添加配额表
CREATE TABLE IF NOT EXISTS api_quota_configs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  monthly_limit INTEGER DEFAULT 1000,
  daily_limit INTEGER DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 可选：添加使用记录表
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  provider VARCHAR(50),
  operation_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 第二步：改造后端路由

**改造 `server/src/routes/config.ts`**：

```typescript
// 保存API配置 - 添加加密功能
configRouter.post('/', authenticate, requireAdmin, async (req, res) => {
  const { provider, apiKey, ollamaBaseUrl, ollamaModel } = req.body;
  
  // 如果有API密钥，加密存储
  let encryptedKey = null;
  if (apiKey) {
    encryptedKey = encryptionService.encrypt(apiKey);
  }
  
  // 停用所有现有配置
  await pool.query('UPDATE api_configs SET is_active = false');
  
  // 插入新配置（加密后的密钥）
  if (provider === 'ollama') {
    await pool.query(
      'INSERT INTO api_configs (provider, api_key, ollama_base_url, ollama_model, is_active) VALUES ($1, NULL, $2, $3, true)',
      [provider, ollamaBaseUrl, ollamaModel]
    );
  } else {
    await pool.query(
      'INSERT INTO api_configs (provider, api_key, ollama_base_url, ollama_model, is_active) VALUES ($1, $2, NULL, NULL, true)',
      [provider, encryptedKey]  // 存储加密后的密钥
    );
  }
  
  res.json({ success: true, message: 'API配置保存成功' });
});

// 获取配置 - 普通用户只能看状态，不能看密钥
configRouter.get('/active', authenticate, async (req, res) => {
  const isAdmin = (req as any).user?.isAdmin;
  
  const result = await pool.query(
    'SELECT provider, ollama_base_url, ollama_model, is_active FROM api_configs WHERE is_active = true LIMIT 1'
  );
  
  if (result.rows.length === 0) {
    return res.json({ 
      provider: null, 
      configured: false,
      message: isAdmin ? '请配置AI服务' : '系统未配置AI服务，请联系管理员'
    });
  }
  
  res.json({ 
    provider: result.rows[0].provider,
    ollamaBaseUrl: result.rows[0].ollama_base_url,
    ollamaModel: result.rows[0].ollama_model,
    configured: true,
    canEdit: isAdmin  // 告诉前端是否可以编辑
  });
});
```

### 第三步：改造前端页面

**改造 `client/src/pages/ConfigPage.tsx`**：

```typescript
export default function ConfigPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  
  useEffect(() => {
    // 检查用户权限
    checkUserRole();
    loadConfig();
  }, []);
  
  const checkUserRole = async () => {
    try {
      const response = await apiClient.get('/auth/me');
      setIsAdmin(response.data.isAdmin);
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  };
  
  const loadConfig = async () => {
    const response = await apiClient.get('/config/active');
    setCurrentConfig(response.data);
    setCanEdit(response.data.canEdit);  // 后端告诉我们是否可以编辑
  };
  
  return (
    <div>
      {/* 如果不是管理员，显示只读视图 */}
      {!canEdit && currentConfig?.configured && (
        <Alert
          message="AI服务已配置"
          description={`当前使用: ${currentConfig.provider}`}
          type="success"
          showIcon
        />
      )}
      
      {/* 如果不是管理员且未配置，显示提示 */}
      {!canEdit && !currentConfig?.configured && (
        <Alert
          message="AI服务未配置"
          description="请联系管理员配置AI服务"
          type="warning"
          showIcon
        />
      )}
      
      {/* 只有管理员可以看到配置表单 */}
      {canEdit && (
        <Form form={form} onFinish={handleSubmit}>
          {/* 原有的配置表单 */}
        </Form>
      )}
    </div>
  );
}
```

## ✅ 优势

1. **最小改动** - 复用现有页面和路由
2. **用户友好** - 统一的配置入口
3. **权限清晰** - 管理员配置，用户查看
4. **向后兼容** - 不破坏现有功能

## 📝 需要修改的文件

### 必须修改（3个文件）

1. **server/src/routes/config.ts**
   - 添加加密存储功能
   - 添加权限检查

2. **client/src/pages/ConfigPage.tsx**
   - 添加权限判断
   - 区分管理员和普通用户视图

3. **.env**
   - 添加 `API_KEY_ENCRYPTION_KEY`

### 可选修改（增强功能）

4. **server/src/services/aiService.ts**
   - 从数据库读取配置时解密API密钥
   - 添加使用记录功能

5. **数据库**
   - 添加配额表（可选）
   - 添加使用记录表（可选）

## 🚀 实施时间

- **核心功能**：2-3小时
- **增强功能**：1-2小时
- **总计**：3-5小时

## 🎯 最终效果

### 管理员看到的

```
┌─────────────────────────────────────┐
│ 系统配置                             │
├─────────────────────────────────────┤
│ [AI API配置] [关键词蒸馏配置]        │
│                                     │
│ 选择AI模型: [DeepSeek ▼]            │
│ API Key: [**********]               │
│                                     │
│ [保存配置] [测试连接]                │
└─────────────────────────────────────┘
```

### 普通用户看到的

```
┌─────────────────────────────────────┐
│ 系统配置                             │
├─────────────────────────────────────┤
│ ✅ AI服务已配置                      │
│ 当前使用: DeepSeek                   │
│                                     │
│ 本月已使用: 45 / 1000 次             │
│ 今日已使用: 5 / 100 次               │
└─────────────────────────────────────┘
```

## 💡 关键点

1. **不创建新页面** - 改造现有ConfigPage
2. **不创建新表** - 复用api_configs表，只添加加密
3. **权限控制** - 后端判断是否管理员
4. **渐进增强** - 先实现核心功能，再添加配额等高级功能

---

**这个方案更简单、更直观，你觉得如何？**
