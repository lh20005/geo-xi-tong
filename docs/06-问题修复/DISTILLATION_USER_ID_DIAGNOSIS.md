# 蒸馏结果无法显示 - 用户 ID 诊断

**问题**: 蒸馏显示"成功生成话题"，但蒸馏结果页面看不到数据

---

## 数据库状态

### 蒸馏记录

```sql
SELECT d.id, d.keyword, d.user_id, d.topic_count, 
       (SELECT COUNT(*) FROM topics t WHERE t.distillation_id = d.id) as actual_topics 
FROM distillations d 
ORDER BY d.created_at DESC LIMIT 5;
```

**结果**:
| id | keyword | user_id | topic_count | actual_topics |
|----|---------|---------|-------------|---------------|
| 26 | 法国留学 | 1 | 12 | 12 ✅ |
| 25 | 如何蒸馏 | 1 | 12 | 0 ❌ |
| 24 | 应该留学 | 1 | 12 | 0 ❌ |
| 23 | 应该留学 | 1 | 12 | 0 ❌ |
| 22 | 应该留学 | 1 | 12 | 0 ❌ |

**问题**: 蒸馏记录存在，但话题数据缺失

---

## 可能的原因

### 1. 用户 ID 不匹配

**场景**: 
- 保存蒸馏记录时使用 user_id = 1
- 保存话题时使用不同的 user_id
- 查询时使用另一个 user_id

**验证**:
```sql
-- 检查话题的 user_id
SELECT DISTINCT user_id FROM topics;

-- 检查蒸馏记录的 user_id
SELECT DISTINCT user_id FROM distillations;
```

### 2. 话题保存静默失败

**场景**:
- IPC 调用返回 success: false
- 但错误被捕获后没有正确处理
- 或者错误处理代码未生效（未编译）

### 3. 事务问题

**场景**:
- 话题保存成功但未提交
- 或者保存后被回滚

---

## 诊断步骤

### 步骤 1: 检查当前登录用户

在开发者工具 Console 中执行:
```javascript
// 检查存储的用户信息
window.electron.invoke('user:getInfo').then(console.log);
```

### 步骤 2: 检查话题保存日志

查看 Electron 日志:
```bash
# macOS
tail -f ~/Library/Logs/platform-login-manager/main.log | grep "topic:local:create"
```

查找:
- ✅ "IPC: topic:local:create" - 调用成功
- ❌ "IPC: topic:local:create failed" - 调用失败
- ❌ "用户未登录" - 用户信息缺失

### 步骤 3: 手动测试话题保存

在开发者工具 Console 中执行:
```javascript
// 测试保存话题
window.electron.invoke('topic:local:create', {
  distillation_id: 26,  // 使用最新的蒸馏 ID
  question: '测试话题',
  category: '测试',
  priority: 0
}).then(result => {
  console.log('保存结果:', result);
  if (!result.success) {
    console.error('保存失败:', result.error);
  }
});
```

### 步骤 4: 检查数据库数据

```sql
-- 检查最新的话题
SELECT * FROM topics ORDER BY created_at DESC LIMIT 5;

-- 检查特定蒸馏的话题
SELECT * FROM topics WHERE distillation_id = 26;
```

---

## 修复方案

### 方案 1: 确保错误处理代码已编译

```bash
cd windows-login-manager
npm run build:electron
```

**验证**:
```bash
grep -n "保存话题失败" windows-login-manager/dist-electron/pages/DistillationPage.js
```

### 方案 2: 添加详细日志

**文件**: `windows-login-manager/src/pages/DistillationPage.tsx`

```typescript
// 3. 保存话题到本地数据库
console.log('开始保存话题，数量:', questions.length);
for (let i = 0; i < questions.length; i++) {
  const question = questions[i];
  console.log(`保存话题 ${i + 1}/${questions.length}:`, question.question || question);
  
  const topicResult = await window.electron.invoke('topic:local:create', {
    distillation_id: distillationId,
    question: question.question || question,
    category: question.category || '',
    priority: question.priority || 0
  });
  
  console.log(`话题 ${i + 1} 保存结果:`, topicResult);
  
  if (!topicResult.success) {
    console.error('保存话题失败:', topicResult.error);
    throw new Error(`保存话题失败: ${topicResult.error}`);
  }
}
console.log('所有话题保存完成');
```

### 方案 3: 检查用户登录状态

**文件**: `windows-login-manager/src/pages/DistillationPage.tsx`

在 `handleDistill` 开始时添加:
```typescript
const handleDistill = async () => {
  if (!keyword.trim()) {
    message.warning('请输入关键词');
    return;
  }

  // 检查用户登录状态
  const userInfo = await window.electron.invoke('user:getInfo');
  if (!userInfo) {
    message.error('用户未登录，请先登录');
    return;
  }
  console.log('当前用户:', userInfo);

  setLoading(true);
  // ... 继续执行
};
```

---

## 临时解决方案

如果问题持续，可以手动修复数据：

### 删除无效的蒸馏记录

```sql
-- 删除没有话题的蒸馏记录
DELETE FROM distillations 
WHERE id IN (
  SELECT d.id 
  FROM distillations d 
  LEFT JOIN topics t ON t.distillation_id = d.id 
  WHERE t.id IS NULL
);
```

### 重新执行蒸馏

1. 删除无效记录后
2. 重新执行蒸馏
3. 观察控制台日志
4. 验证话题是否保存成功

---

## 预防措施

### 1. 添加用户验证

在所有 IPC 处理器中验证用户:
```typescript
const user = await storageManager.getUser();
if (!user) {
  log.error('用户未登录');
  return { success: false, error: '用户未登录' };
}
log.info('当前用户 ID:', user.id);
```

### 2. 使用事务

确保蒸馏记录和话题保存在同一个事务中:
```typescript
// 伪代码
BEGIN TRANSACTION;
  INSERT INTO distillations ...;
  INSERT INTO topics ...;
  INSERT INTO topics ...;
COMMIT;
```

### 3. 添加数据验证

保存后验证数据:
```typescript
// 保存完成后验证
const savedTopics = await window.electron.invoke(
  'topic:local:getByDistillation', 
  distillationId
);

if (savedTopics.data.length !== questions.length) {
  throw new Error(`话题保存不完整: 预期 ${questions.length}，实际 ${savedTopics.data.length}`);
}
```

---

## 下一步

1. 添加详细日志（方案 2）
2. 编译代码
3. 重新测试蒸馏
4. 查看控制台和 Electron 日志
5. 根据日志确定具体问题
