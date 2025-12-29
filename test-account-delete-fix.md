# 账号删除问题修复说明

## 问题描述
在网页端平台登录页面，删除账号后提示显示"账号删除失败"，但刷新后实际已经被删除了。

## 问题原因
后端 API (`server/src/routes/accounts.ts`) 的删除接口返回 `204 No Content` 状态码，这是一个空响应体。虽然删除操作成功执行了，但前端在处理空响应时可能出现问题，导致显示错误提示。

## 修复方案
将删除接口的响应从 `204 No Content` 改为 `200 OK` 并返回 JSON 格式的成功消息：

```typescript
res.json({
  success: true,
  message: '账号删除成功'
});
```

这样做的好处：
1. 与其他删除接口（如 `platformAccounts.ts`）保持一致
2. 前端可以正确解析响应并显示成功消息
3. 更符合 RESTful API 的最佳实践

## 修改的文件
- `server/src/routes/accounts.ts`
  - 修复了 `DELETE /:id` 接口（删除账号）
  - 修复了 `POST /:id/set-default` 接口（设置默认账号）

## 测试步骤
1. 重启后端服务：
   ```bash
   cd server
   npm run dev
   ```

2. 在 Windows 登录管理器中测试：
   - 打开平台管理页面
   - 选择一个账号并点击删除
   - 确认删除后，应该显示"账号删除成功"
   - 账号列表应该立即更新，不需要刷新页面

3. 验证数据库：
   ```bash
   # 连接数据库查看账号是否真的被删除
   psql -U postgres -d geo_system
   SELECT * FROM platform_accounts WHERE id = <被删除的账号ID>;
   ```

## 预期结果
- ✅ 删除账号后显示"账号删除成功"
- ✅ 账号列表立即更新
- ✅ 数据库中账号被正确删除
- ✅ 不再出现"删除失败"的错误提示
