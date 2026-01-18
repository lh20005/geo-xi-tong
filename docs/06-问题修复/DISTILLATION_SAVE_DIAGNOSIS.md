# 蒸馏结果无法显示 - 诊断指南

## 问题描述

用户报告：关键词蒸馏后，无法在蒸馏结果页面显示话题。

## 诊断步骤

### 1. 检查数据库连接

#### 方法 1：通过命令行检查

```bash
# 检查 PostgreSQL 是否运行
psql -U lzc -d geo_windows -c "SELECT NOW();"

# 如果成功，应该显示当前时间
```

#### 方法 2：检查应用日志

打开应用后，查看控制台日志（开发者工具 → Console）：

**预期日志**：
```
✅ PostgreSQL 数据库连接成功
PostgreSQL: 开始运行迁移...
PostgreSQL: 迁移完成
```

**如果看到错误**：
```
❌ PostgreSQL 数据库初始化失败: ...
```

说明数据库连接失败，需要检查：
- PostgreSQL 是否安装并运行
- 数据库 `geo_windows` 是否存在
- 用户 `lzc` 是否有权限

### 2. 检查蒸馏流程日志

执行蒸馏操作时，打开开发者工具（F12），查看 Console 日志：

**正常流程日志**：
```
[蒸馏] 开始调用服务器 API
[蒸馏] 服务器返回话题数量: 12
[蒸馏] 开始保存蒸馏记录
[蒸馏] 蒸馏记录已保存, ID: 31
[蒸馏] 开始保存话题，数量: 12
[蒸馏] 保存话题 1/12: 话题内容...
[蒸馏] 话题 1 保存结果: { success: true, data: {...} }
...
[蒸馏] 所有话题保存完成
```

**如果看到错误**：
```
[蒸馏] 保存话题失败: 数据库未初始化
[蒸馏] 保存话题失败: 用户未登录
[蒸馏] 保存话题失败: ...
```

### 3. 检查数据库数据

#### 检查蒸馏记录

```bash
psql -U lzc -d geo_windows -c "SELECT id, keyword, topic_count, created_at FROM distillations ORDER BY created_at DESC LIMIT 5;"
```

**预期结果**：应该看到最近的蒸馏记录

#### 检查话题记录

```bash
psql -U lzc -d geo_windows -c "SELECT COUNT(*) as total_topics FROM topics;"
```

**预期结果**：应该有话题记录

#### 检查数据一致性

```bash
psql -U lzc -d geo_windows -c "
SELECT 
  d.id, 
  d.keyword, 
  d.topic_count, 
  COUNT(t.id) as actual_topics 
FROM distillations d 
LEFT JOIN topics t ON d.id = t.distillation_id 
GROUP BY d.id 
ORDER BY d.created_at DESC 
LIMIT 5;
"
```

**预期结果**：`topic_count` 应该等于 `actual_topics`

**如果不一致**：说明话题没有正确保存

### 4. 检查用户登录状态

话题保存需要用户登录，检查：

```bash
# 检查是否有用户数据
psql -U lzc -d geo_windows -c "SELECT id, username FROM users LIMIT 5;"
```

在应用中检查：
- 右上角是否显示用户名
- 是否能访问其他需要登录的页面

### 5. 检查 IPC 通信

在开发者工具 Console 中执行：

```javascript
// 测试 IPC 通信
window.electron.invoke('topic:local:findAll', { page: 1, pageSize: 10 })
  .then(result => console.log('IPC 测试结果:', result))
  .catch(error => console.error('IPC 测试失败:', error));
```

**预期结果**：
```javascript
{
  success: true,
  data: {
    items: [...],
    total: 12,
    page: 1,
    pageSize: 10
  }
}
```

## 常见问题和解决方案

### 问题 1：数据库连接失败

**症状**：
```
❌ PostgreSQL 数据库初始化失败: connect ECONNREFUSED
```

**解决方案**：
1. 确认 PostgreSQL 已安装并运行：
   ```bash
   # macOS
   brew services list | grep postgresql
   
   # 如果未运行，启动它
   brew services start postgresql@14
   ```

2. 创建数据库（如果不存在）：
   ```bash
   createdb geo_windows
   ```

3. 检查配置文件 `windows-login-manager/.env`：
   ```bash
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=geo_windows
   DB_USER=lzc
   DB_PASSWORD=
   ```

### 问题 2：用户未登录

**症状**：
```
[蒸馏] 保存话题失败: 用户未登录
```

**解决方案**：
1. 退出应用
2. 重新登录
3. 再次尝试蒸馏

### 问题 3：话题保存失败但蒸馏记录已创建

**症状**：
- `distillations` 表有记录
- `topics` 表没有对应记录

**解决方案**：
1. 清理孤立的 distillations 记录：
   ```sql
   DELETE FROM distillations 
   WHERE id IN (
     SELECT d.id 
     FROM distillations d 
     LEFT JOIN topics t ON d.id = t.distillation_id 
     WHERE t.id IS NULL
   );
   ```

2. 重新执行蒸馏

### 问题 4：缓存问题

**症状**：
- 数据库有数据
- 但页面不显示

**解决方案**：
1. 清除缓存：在蒸馏结果页面点击"刷新"按钮
2. 或者在开发者工具 Console 执行：
   ```javascript
   localStorage.clear();
   location.reload();
   ```

## 修复验证

执行以下步骤验证修复：

1. **重启应用**：确保使用最新编译的代码
2. **执行蒸馏**：输入关键词，点击"开始蒸馏"
3. **检查日志**：确认所有步骤都成功
4. **检查数据库**：确认数据已保存
5. **查看结果页面**：确认话题正确显示
6. **测试筛选**：确认筛选框只显示有话题的关键词

## 需要提供的信息

如果问题仍然存在，请提供以下信息：

1. **控制台日志**：
   - 打开开发者工具（F12）
   - 切换到 Console 标签
   - 执行蒸馏操作
   - 复制所有日志

2. **数据库状态**：
   ```bash
   # 执行以下命令并提供输出
   psql -U lzc -d geo_windows -c "
   SELECT 
     (SELECT COUNT(*) FROM distillations) as distillations_count,
     (SELECT COUNT(*) FROM topics) as topics_count,
     (SELECT COUNT(*) FROM users) as users_count;
   "
   ```

3. **环境信息**：
   - 操作系统版本
   - PostgreSQL 版本
   - 应用版本

## 相关文件

- `windows-login-manager/electron/database/postgres.ts` - 数据库连接
- `windows-login-manager/electron/ipc/handlers/localTopicHandlers.ts` - 话题 IPC 处理器
- `windows-login-manager/src/pages/DistillationPage.tsx` - 蒸馏页面
- `windows-login-manager/src/pages/DistillationResultsPage.tsx` - 蒸馏结果页面
