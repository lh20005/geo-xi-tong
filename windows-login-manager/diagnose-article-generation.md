# 文章生成功能诊断指南

## 问题描述
点击"生成文章"按钮后，没有任何反馈，也没有生成文章。

## 诊断步骤

### 1. 检查浏览器控制台
打开 Windows 桌面客户端后，按 `Ctrl+Shift+I` 打开开发者工具，查看 Console 标签页：

**需要检查的关键日志：**
- `[API Client] 🔄 处理请求:` - 确认请求是否发出
- `[API Client] ✅ 已添加 Authorization header` - 确认 token 是否存在
- `[API Client] ✅ 响应成功:` 或 `[API Client] ❌ 响应错误:` - 查看响应状态
- `🔍 服务器收到的原始数据:` - 服务器端日志（如果有）

**常见错误：**
- `❌ 没有找到任何 token！` → 需要重新登录
- `401 Unauthorized` → Token 过期，需要刷新或重新登录
- `403 Forbidden` → 配额不足或权限问题
- `404 Not Found` → 选择的资源（蒸馏历史/图库/知识库等）不存在
- `500 Internal Server Error` → 服务器错误

### 2. 检查网络请求
在开发者工具的 Network 标签页中：

1. 筛选 XHR 请求
2. 查找 `/api/article-generation/tasks` 的 POST 请求
3. 检查请求状态码和响应内容

**正常流程：**
```
POST /api/article-generation/tasks
Status: 200 OK
Response: {
  "taskId": 123,
  "status": "pending",
  "selectedDistillationIds": [...],
  "createdAt": "2025-01-16T..."
}
```

### 3. 检查表单数据
在 TaskConfigModal 组件中，确认所有必填字段都已填写：

- ✅ 蒸馏历史（distillationId）
- ✅ 转化目标（conversionTargetId）
- ✅ 企业图库（albumId）
- ✅ 企业知识库（knowledgeBaseId）
- ✅ 文章设置（articleSettingId）
- ✅ 文章数量（articleCount）

### 4. 检查服务器连接
确认 Windows 客户端能够连接到服务器：

**检查环境变量配置：**
```bash
# windows-login-manager/.env
VITE_API_BASE_URL=https://jzgeo.cc
VITE_WS_BASE_URL=wss://jzgeo.cc/ws
```

**测试连接：**
```bash
curl https://jzgeo.cc/api/health
```

### 5. 检查服务器日志
如果前端没有错误，检查服务器端日志：

```bash
# SSH 连接到服务器
ssh -i /Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem ubuntu@124.221.247.107

# 查看 PM2 日志
pm2 logs geo-server --lines 50
```

**查找关键日志：**
- `🔍 服务器收到的原始数据:` - 确认服务器收到请求
- `创建任务错误:` - 查看错误详情
- `配额不足` - 检查用户配额

### 6. 检查数据库状态
确认必要的数据存在：

```sql
-- 检查蒸馏历史
SELECT id, keyword FROM distillations WHERE user_id = YOUR_USER_ID;

-- 检查转化目标
SELECT id, company_name FROM conversion_targets WHERE user_id = YOUR_USER_ID;

-- 检查文章设置
SELECT id, name FROM article_settings WHERE user_id = YOUR_USER_ID;

-- 检查用户配额
SELECT * FROM user_subscriptions WHERE user_id = YOUR_USER_ID;
```

## 常见问题和解决方案

### 问题 1: 没有任何反馈
**可能原因：**
- 前端 JavaScript 错误
- 表单验证失败（静默失败）
- 网络请求被阻止

**解决方案：**
1. 打开浏览器控制台查看错误
2. 检查 Network 标签页是否有请求发出
3. 确认所有表单字段都已填写

### 问题 2: 401 Unauthorized
**可能原因：**
- Token 过期
- Token 不存在
- Token 格式错误

**解决方案：**
1. 重新登录
2. 检查 localStorage 或 Electron storage 中的 token
3. 清除缓存后重新登录

### 问题 3: 403 配额不足
**可能原因：**
- 用户配额已用完
- 订阅已过期

**解决方案：**
1. 检查用户订阅状态
2. 购买或续费订阅
3. 联系管理员增加配额

### 问题 4: 404 资源不存在
**可能原因：**
- 选择的蒸馏历史/图库/知识库已被删除
- 数据库中没有对应的记录

**解决方案：**
1. 刷新页面重新加载数据
2. 选择其他可用的资源
3. 检查数据库中的数据完整性

### 问题 5: 500 服务器错误
**可能原因：**
- 服务器代码错误
- 数据库连接失败
- AI API 调用失败

**解决方案：**
1. 查看服务器日志获取详细错误信息
2. 检查数据库连接状态
3. 检查 AI API 配置（DeepSeek/Gemini）

## 调试技巧

### 1. 启用详细日志
在 `windows-login-manager/src/api/client.ts` 中，所有请求都会打印详细日志。

### 2. 使用 React DevTools
安装 React DevTools 扩展，检查组件状态：
- TaskConfigModal 的 form 值
- ArticleGenerationPage 的 state

### 3. 断点调试
在以下位置设置断点：
- `TaskConfigModal.tsx` 的 `handleSubmit` 函数
- `articleGenerationApi.ts` 的 `createTask` 函数
- `client.ts` 的请求拦截器

### 4. 模拟请求
使用 curl 或 Postman 直接测试 API：

```bash
curl -X POST https://jzgeo.cc/api/article-generation/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "distillationId": 1,
    "albumId": 1,
    "knowledgeBaseId": 1,
    "articleSettingId": 1,
    "conversionTargetId": 1,
    "articleCount": 1
  }'
```

## 下一步操作

根据诊断结果：

1. **如果是前端问题**：
   - 检查浏览器控制台错误
   - 修复 JavaScript 错误
   - 确保表单验证正确

2. **如果是网络问题**：
   - 检查服务器连接
   - 确认 API URL 配置正确
   - 检查防火墙/代理设置

3. **如果是后端问题**：
   - 查看服务器日志
   - 检查数据库状态
   - 修复服务器代码错误

4. **如果是配额问题**：
   - 检查用户订阅
   - 增加配额或续费
   - 联系管理员

## 联系支持

如果以上步骤都无法解决问题，请提供以下信息：

1. 浏览器控制台的完整错误日志
2. Network 标签页的请求详情（截图）
3. 服务器日志（如果可以访问）
4. 用户 ID 和订阅状态
5. 重现问题的详细步骤
