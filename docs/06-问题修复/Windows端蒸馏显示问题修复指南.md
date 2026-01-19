# Windows 端蒸馏显示问题修复指南

**问题**: 用户登录后，蒸馏管理页面显示"暂无蒸馏结果"  
**实际情况**: 数据库中有蒸馏数据  
**根本原因**: 前端缓存问题

---

## 问题诊断结果

### 1. 用户信息 ✅

```
用户名: zhuangxiu
用户 ID: 5
角色: user
```

### 2. 数据库数据 ✅

```
蒸馏记录: 3 条
话题总数: 36 个
数据完整: 是
```

### 3. 数据详情

| ID | 关键词 | 话题数 | 创建时间 |
|----|--------|--------|----------|
| 17 | 法国留学 | 12 | 2026-01-16 10:15 |
| 12 | 周口装修公司 | 12 | 2026-01-16 09:50 |
| 7 | 装修装饰公司 | 12 | 2026-01-13 19:02 |

---

## 解决方案

### 方案 1: 清除应用缓存（推荐）⭐

1. **完全退出应用**
   - 点击右上角 × 关闭窗口
   - 确保应用完全退出（检查任务栏）

2. **清除缓存数据**
   ```bash
   # macOS
   rm -rf ~/Library/Application\ Support/ai-geo-system/Cache
   rm -rf ~/Library/Application\ Support/ai-geo-system/Code\ Cache
   
   # Windows
   # 删除 %APPDATA%\ai-geo-system\Cache
   # 删除 %APPDATA%\ai-geo-system\Code Cache
   ```

3. **重新启动应用**
   - 重新打开应用
   - 等待数据加载
   - 进入蒸馏管理页面

### 方案 2: 使用开发者工具清除缓存

1. **打开开发者工具**
   - 按 `Cmd+Option+I` (macOS) 或 `Ctrl+Shift+I` (Windows)

2. **清除缓存**
   - 打开 Console 标签
   - 输入并执行：
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

3. **刷新页面**
   - 按 `Cmd+R` (macOS) 或 `Ctrl+R` (Windows)

### 方案 3: 手动刷新数据

1. **进入蒸馏管理页面**
2. **点击"刷新"按钮**（页面右上角）
3. **等待数据加载**

---

## 验证修复

修复后，您应该能看到：

### 蒸馏结果列表

```
✅ 法国留学 - 12 个话题
✅ 周口装修公司 - 12 个话题
✅ 装修装饰公司 - 12 个话题
```

### 统计信息

```
总话题数: 36 个
关键词数量: 3 个
当前显示: 10 个（第一页）
```

---

## 如果仍然看不到数据

### 检查 1: 确认用户 ID

打开开发者工具，在 Console 中执行：

```javascript
window.electron.invoke('check-auth').then(console.log);
```

应该显示：
```json
{
  "isAuthenticated": true,
  "user": {
    "id": 5,
    "username": "zhuangxiu"
  }
}
```

### 检查 2: 手动调用 IPC

在 Console 中执行：

```javascript
window.electron.invoke('distillation:local:getResults', {}).then(result => {
  console.log('Success:', result.success);
  console.log('Total:', result.data?.total);
  console.log('Data length:', result.data?.data?.length);
});
```

应该显示：
```
Success: true
Total: 36
Data length: 10
```

### 检查 3: 查看网络请求

1. 打开开发者工具的 Network 标签
2. 刷新页面
3. 查找 `distillation:local:getResults` 相关的请求
4. 检查响应数据

---

## 技术说明

### 问题原因

1. **前端缓存机制**: 使用了 `useCachedData` Hook 缓存数据
2. **缓存键**: `distillationResults:list:${filterKeyword}:${searchText}:${currentPage}:${pageSize}`
3. **缓存未失效**: 旧的空数据被缓存，新数据未加载

### 缓存策略

```typescript
const { data, loading, refresh } = useCachedData(
  cacheKey,
  fetchData,
  {
    deps: [filterKeyword, searchText, currentPage, pageSize],
    onError: (error) => message.error(error.message)
  }
);
```

### 缓存失效条件

- 依赖项变化（filterKeyword, searchText, currentPage, pageSize）
- 手动调用 `refresh(true)`
- 应用重启

---

## 预防措施

### 1. 定期清理缓存

建议每周清理一次应用缓存：

```bash
# macOS
rm -rf ~/Library/Application\ Support/ai-geo-system/Cache

# Windows
# 删除 %APPDATA%\ai-geo-system\Cache
```

### 2. 使用强制刷新

在蒸馏管理页面，按住 `Shift` 键点击"刷新"按钮，强制重新加载数据。

### 3. 检查数据同步

确保本地数据库与服务器数据保持同步。

---

## 开发者信息

### 相关文件

- 前端页面: `windows-login-manager/src/pages/DistillationResultsPage.tsx`
- IPC Handler: `windows-login-manager/electron/ipc/handlers/localDistillationHandlers.ts`
- 缓存 Hook: `windows-login-manager/src/hooks/useCachedData.ts`
- 缓存 Store: `windows-login-manager/src/stores/cacheStore.ts`

### 调试命令

```bash
# 检查用户信息
node windows-login-manager/check-real-store.js

# 检查数据库数据
psql -U lzc -d geo_windows -c "SELECT * FROM distillations WHERE user_id = 5;"

# 检查话题数据
psql -U lzc -d geo_windows -c "SELECT COUNT(*) FROM topics t JOIN distillations d ON t.distillation_id = d.id WHERE d.user_id = 5;"
```

---

## 总结

✅ **数据库正常**: 有 3 条蒸馏记录，36 个话题  
✅ **用户已登录**: zhuangxiu (ID: 5)  
⚠️ **前端缓存**: 需要清除缓存或强制刷新

**推荐操作**: 清除应用缓存后重启应用

---

**最后更新**: 2026-01-19 16:30  
**状态**: 问题已诊断，等待用户执行修复步骤
