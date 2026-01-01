# 🚀 系统级API配置实施指南

## 📋 实施清单

### ✅ 已完成的工作

1. **数据库设计**
   - ✅ 创建系统级API配置表 (`system_api_configs`)
   - ✅ 创建租户级API配置表 (`tenant_api_configs`)
   - ✅ 创建API使用记录表 (`api_usage_logs`)
   - ✅ 创建API配额配置表 (`api_quota_configs`)

2. **后端服务**
   - ✅ 密钥加密服务 (`EncryptionService.ts`)
   - ✅ 系统API配置服务 (`SystemApiConfigService.ts`)
   - ✅ 改造AIService支持系统级配置
   - ✅ 管理员API路由 (`admin/systemApiConfig.ts`)
   - ✅ 普通用户API状态路由 (`apiStatus.ts`)

3. **前端界面**
   - ✅ 系统API配置管理页面 (`SystemApiConfigPage.tsx`)

4. **工具脚本**
   - ✅ 数据库迁移脚本 (`migrate-system-api-config.js`)
   - ✅ 快速设置脚本 (`setup-system-api-config.sh`)

5. **文档**
   - ✅ 完整方案文档 (`AI_KEY_MANAGEMENT_SOLUTION.md`)
   - ✅ 实施指南（本文档）

## 🔧 实施步骤

### 第一步：数据库迁移

```bash
# 运行快速设置脚本（推荐）
./setup-system-api-config.sh

# 或者手动执行
node server/src/db/migrate-system-api-config.js
```

这将：
- 创建所有必要的数据库表
- 迁移现有的API配置数据
- 为所有租户创建默认配额

### 第二步：配置环境变量

在 `.env` 文件中添加：

```bash
# API密钥加密密钥（必须配置）
API_KEY_ENCRYPTION_KEY=your-generated-encryption-key-here
```

生成加密密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 第三步：注册路由

在 `server/src/index.ts` 或主路由文件中添加：

```typescript
import systemApiConfigRouter from './routes/admin/systemApiConfig';
import { apiStatusRouter } from './routes/apiStatus';

// 管理员路由（需要管理员权限）
app.use('/api/admin/system-api-config', authenticate, requireAdmin, systemApiConfigRouter);

// 普通用户路由
app.use('/api/api-status', apiStatusRouter);
```

### 第四步：更新前端路由

在前端路由配置中添加系统API配置页面：

```typescript
// 在管理员路由中添加
{
  path: '/admin/system-api-config',
  component: SystemApiConfigPage,
  meta: { requiresAdmin: true }
}
```

### 第五步：更新现有代码

#### 5.1 更新关键词蒸馏路由

在 `server/src/routes/distillation.ts` 中：

```typescript
import { AIService } from '../services/aiService';

// 旧代码
const aiService = new AIService({
  provider: config.provider,
  apiKey: config.api_key,
  // ...
});

// 新代码
const aiService = await AIService.createFromSystemConfig(
  undefined,  // 使用默认provider
  tenantId,   // 从请求中获取
  userId      // 从请求中获取
);
```

#### 5.2 更新文章生成路由

在 `server/src/routes/articleGeneration.ts` 中：

```typescript
// 旧代码
const aiService = new AIService({
  provider: config.provider,
  apiKey: config.api_key,
  // ...
});

// 新代码
const aiService = await AIService.createFromSystemConfig(
  undefined,
  tenantId,
  userId
);
```

### 第六步：测试

1. **启动服务器**
   ```bash
   npm run dev
   ```

2. **使用管理员账号登录**

3. **配置系统级API**
   - 访问 `/admin/system-api-config`
   - 选择AI服务提供商（DeepSeek/Gemini/Ollama）
   - 输入API密钥或Ollama配置
   - 点击"测试配置"验证
   - 点击"保存配置"

4. **测试普通用户**
   - 使用普通用户账号登录
   - 尝试使用关键词蒸馏功能
   - 尝试生成文章
   - 检查配额显示是否正常

## 📝 代码修改清单

### 需要修改的文件

1. **server/src/index.ts** 或主路由文件
   - 添加新路由注册

2. **server/src/routes/distillation.ts**
   - 使用 `AIService.createFromSystemConfig()`

3. **server/src/routes/articleGeneration.ts**
   - 使用 `AIService.createFromSystemConfig()`

4. **client/src/App.tsx** 或路由配置文件
   - 添加系统API配置页面路由

5. **client/src/components/Layout/Sidebar.tsx** 或菜单配置
   - 添加"系统API配置"菜单项（仅管理员可见）

### 示例：更新distillation路由

```typescript
// server/src/routes/distillation.ts

import { Router } from 'express';
import { AIService } from '../services/aiService';
import { authenticate } from '../middleware/adminAuth';

const router = Router();

router.post('/', authenticate, async (req, res) => {
  try {
    const { keyword, promptTemplate, topicCount } = req.body;
    const userId = (req as any).user.userId;
    const tenantId = (req as any).user.tenantId;
    
    // 使用系统级配置创建AI服务
    const aiService = await AIService.createFromSystemConfig(
      undefined,  // 使用默认provider
      tenantId,
      userId
    );
    
    // 执行关键词蒸馏
    const questions = await aiService.distillKeyword(
      keyword,
      promptTemplate,
      topicCount
    );
    
    res.json({
      success: true,
      data: questions
    });
  } catch (error: any) {
    console.error('关键词蒸馏失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
```

## 🎯 验收测试

### 测试用例

1. **管理员配置测试**
   - [ ] 管理员可以访问系统API配置页面
   - [ ] 可以添加DeepSeek配置
   - [ ] 可以添加Gemini配置
   - [ ] 可以添加Ollama配置
   - [ ] 测试功能正常工作
   - [ ] 保存后配置生效

2. **普通用户测试**
   - [ ] 普通用户无法访问系统API配置页面
   - [ ] 可以正常使用关键词蒸馏功能
   - [ ] 可以正常生成文章
   - [ ] 可以查看自己的配额使用情况
   - [ ] 配额用完后显示正确的错误信息

3. **安全性测试**
   - [ ] API密钥在数据库中是加密存储的
   - [ ] API密钥不会返回给前端
   - [ ] 普通用户无法通过API获取密钥
   - [ ] 配额限制正常工作

4. **配额测试**
   - [ ] 每日配额限制生效
   - [ ] 每月配额限制生效
   - [ ] 使用记录正确保存
   - [ ] 统计数据准确

## 🔒 安全注意事项

1. **环境变量保护**
   - 确保 `API_KEY_ENCRYPTION_KEY` 不被提交到代码仓库
   - 在生产环境使用强随机密钥
   - 定期轮换加密密钥

2. **API密钥管理**
   - 定期轮换API密钥（建议3-6个月）
   - 监控API使用情况，发现异常及时处理
   - 为不同环境使用不同的API密钥

3. **访问控制**
   - 只有管理员可以配置系统级API
   - 使用中间件验证管理员权限
   - 记录所有配置变更操作

4. **配额管理**
   - 根据订阅套餐设置合理的配额
   - 监控高使用量租户
   - 提供配额升级选项

## 📊 监控和维护

### 日常监控

1. **API使用情况**
   ```sql
   -- 查看今日API调用统计
   SELECT provider, operation_type, COUNT(*) as count
   FROM api_usage_logs
   WHERE created_at >= CURRENT_DATE
   GROUP BY provider, operation_type;
   ```

2. **配额使用情况**
   ```sql
   -- 查看接近配额限制的租户
   SELECT t.name, q.monthly_used, q.monthly_limit
   FROM api_quota_configs q
   JOIN tenants t ON t.id = q.tenant_id
   WHERE q.monthly_used >= q.monthly_limit * 0.8;
   ```

3. **错误率监控**
   ```sql
   -- 查看API调用错误率
   SELECT 
     provider,
     COUNT(*) as total,
     SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as errors,
     ROUND(SUM(CASE WHEN success = false THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 2) as error_rate
   FROM api_usage_logs
   WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
   GROUP BY provider;
   ```

### 定期维护

1. **清理旧日志**（建议保留3个月）
   ```sql
   DELETE FROM api_usage_logs
   WHERE created_at < CURRENT_DATE - INTERVAL '90 days';
   ```

2. **密钥轮换**
   - 每3-6个月轮换一次API密钥
   - 使用管理界面添加新密钥
   - 测试新密钥后激活
   - 删除旧密钥

3. **配额调整**
   - 根据用户反馈调整配额
   - 为高级套餐提供更高配额
   - 监控配额使用趋势

## 🆘 故障排查

### 常见问题

1. **"系统未配置AI服务"错误**
   - 检查是否已在管理后台配置API
   - 检查配置是否已激活
   - 查看数据库 `system_api_configs` 表

2. **"API调用配额不足"错误**
   - 检查租户配额设置
   - 查看 `api_quota_configs` 表
   - 调整配额或升级套餐

3. **"解密失败"错误**
   - 检查 `API_KEY_ENCRYPTION_KEY` 是否正确
   - 可能是加密密钥变更导致
   - 需要重新配置API密钥

4. **API调用失败**
   - 检查API密钥是否有效
   - 检查网络连接
   - 查看 `api_usage_logs` 表的错误信息

## 📚 相关文档

- [完整方案文档](./AI_KEY_MANAGEMENT_SOLUTION.md)
- [数据库迁移SQL](./server/src/db/migrations/add-system-api-config.sql)
- [加密服务文档](./server/src/services/EncryptionService.ts)
- [系统API配置服务文档](./server/src/services/SystemApiConfigService.ts)

## 🎉 完成后的效果

1. **管理员视角**
   - 在后台统一管理AI服务配置
   - 监控所有租户的API使用情况
   - 灵活调整配额和限制
   - 轻松更换API密钥

2. **普通用户视角**
   - 无需配置，开箱即用
   - 清晰看到自己的配额使用情况
   - 流畅使用AI功能
   - 配额不足时有明确提示

3. **系统优势**
   - API密钥安全加密存储
   - 完整的使用记录和审计
   - 灵活的配额管理
   - 支持多种AI服务提供商

---

**准备好开始实施了吗？按照上述步骤逐步执行即可！**
