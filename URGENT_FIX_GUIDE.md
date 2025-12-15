# 紧急修复指南 - 蒸馏结果重复使用问题

## 问题确认

你报告的问题：
- ✗ 每次都使用"英国留学机构哪家好"这个蒸馏结果
- ✗ 无法均衡使用所有蒸馏结果
- ✗ 计数不同步到蒸馏结果模块

## 立即执行修复

### 步骤1：诊断问题

```bash
cd server
npm run diagnose-issue
```

这将显示：
- 数据库表结构是否正确
- 最近任务的配置
- 文章是否使用了不同的蒸馏结果
- usage_count是否一致

### 步骤2：强制修复

```bash
cd server
npm run force-fix
```

这个脚本会：
1. 检查并添加`selected_distillation_ids`字段（如果不存在）
2. 为所有现有任务初始化`selected_distillation_ids`
3. 修复所有`usage_count`

### 步骤3：重启服务器

```bash
cd server
npm run dev
```

### 步骤4：创建新任务测试

在前端：
1. 创建一个生成**3篇文章**的新任务
2. 观察服务器日志

### 步骤5：验证修复

```bash
# 在另一个终端
cd server
npm run diagnose-issue
```

## 预期的正确日志

### 任务创建时

```
[任务创建] 开始创建任务，请求生成 3 篇文章
[智能选择] 开始选择 3 个蒸馏结果...
[智能选择] 可用蒸馏结果数量: 10
[智能选择] 成功选择 3 个蒸馏结果: [5, 8, 12]
[任务创建] 选择的蒸馏结果IDs: [5,8,12]
[任务创建] 任务创建成功，ID: 123
```

**关键点**：
- ✓ 选择了3个**不同**的ID
- ✓ IDs被保存为JSON数组

### 任务执行时

```
[任务 123] 开始执行
[任务 123] 读取到预选的蒸馏结果IDs: [5, 8, 12]
[任务 123] 批量加载蒸馏结果数据...
[任务 123] 成功加载 3 个蒸馏结果的数据
[任务 123] 蒸馏结果 ID=5, 关键词="关键词A", 话题数=5
[任务 123] 蒸馏结果 ID=8, 关键词="关键词B", 话题数=4
[任务 123] 蒸馏结果 ID=12, 关键词="关键词C", 话题数=6

[任务 123] ========== 开始生成第 1/3 篇文章 ==========
[任务 123] [文章 1] 从selected_distillation_ids[0]获取蒸馏结果ID: 5
[任务 123] [文章 1] 使用蒸馏结果: ID=5, 关键词="关键词A", 话题数=5

[任务 123] ========== 开始生成第 2/3 篇文章 ==========
[任务 123] [文章 2] 从selected_distillation_ids[1]获取蒸馏结果ID: 8
[任务 123] [文章 2] 使用蒸馏结果: ID=8, 关键词="关键词B", 话题数=4

[任务 123] ========== 开始生成第 3/3 篇文章 ==========
[任务 123] [文章 3] 从selected_distillation_ids[2]获取蒸馏结果ID: 12
[任务 123] [文章 3] 使用蒸馏结果: ID=12, 关键词="关键词C", 话题数=6
```

**关键点**：
- ✓ 文章1使用ID=5
- ✓ 文章2使用ID=8
- ✓ 文章3使用ID=12
- ✓ 每篇文章使用**不同**的蒸馏结果

### 文章保存时

```
[保存文章] 蒸馏结果ID 5 当前usage_count: 2
[保存文章] 事务开始
[保存文章] 文章已插入，ID: 456
[保存文章] 使用记录已创建: distillation_id=5, task_id=123, article_id=456
[保存文章] usage_count已更新（+1）
[保存文章] 事务提交成功
[保存文章] 蒸馏结果ID 5 更新后usage_count: 3 (增加了 1)
```

**关键点**：
- ✓ usage_count从2增加到3
- ✓ 事务成功提交

## 错误的日志（问题未修复）

### 如果看到这样的日志

```
[任务 123] selected_distillation_ids为空，使用旧的单蒸馏结果逻辑
[任务 123] 使用旧的单蒸馏结果逻辑
```

**说明**：
- ✗ `selected_distillation_ids`字段为NULL
- ✗ 系统回退到旧逻辑
- ✗ 所有文章会使用同一个蒸馏结果

**解决方法**：
1. 运行 `npm run force-fix`
2. 重启服务器
3. 创建**新任务**测试

### 如果所有文章使用同一个蒸馏结果

```
[任务 123] [文章 1] 使用蒸馏结果: ID=5, 关键词="英国留学机构哪家好"
[任务 123] [文章 2] 使用蒸馏结果: ID=5, 关键词="英国留学机构哪家好"  ← 重复！
[任务 123] [文章 3] 使用蒸馏结果: ID=5, 关键词="英国留学机构哪家好"  ← 重复！
```

**可能原因**：
1. 使用了旧任务（在修复前创建的）
2. `selected_distillation_ids`未正确保存
3. 代码未正确读取`selected_distillation_ids`

**解决方法**：
1. 确认是**新创建**的任务
2. 运行 `npm run diagnose-issue` 查看任务的`selected_distillation_ids`
3. 如果为NULL，运行 `npm run force-fix`

## 验证修复成功

### 在前端验证

1. 打开"蒸馏结果"模块
2. 查看"被引用次数"列
3. 创建新任务后，相关蒸馏结果的"被引用次数"应该增加

### 在数据库验证

```bash
cd server
npm run verify-usage-count
```

应该显示：
```
✓ 所有数据一致！
```

### 在日志验证

创建新任务后，日志应该显示：
- ✓ 选择了N个不同的蒸馏结果ID
- ✓ 每篇文章使用了不同的蒸馏结果
- ✓ usage_count正确更新

## 常见问题

### Q1: 为什么旧任务仍然有问题？

**A**: 旧任务在修复前创建，没有`selected_distillation_ids`。解决方法：
- 创建**新任务**测试
- 或运行 `npm run force-fix` 初始化所有旧任务

### Q2: 如何确认修复成功？

**A**: 检查以下三点：
1. 日志显示每篇文章使用不同的蒸馏结果
2. 前端"蒸馏结果"模块的"被引用次数"正确更新
3. 运行 `npm run verify-usage-count` 显示一致

### Q3: 修复后仍有问题怎么办？

**A**: 按顺序执行：
1. `npm run diagnose-issue` - 查看详细诊断
2. `npm run force-fix` - 强制修复
3. 重启服务器
4. 创建**新任务**（不要重试旧任务）
5. 查看日志，截图发送

## 完整修复流程

```bash
# 1. 诊断
cd server
npm run diagnose-issue

# 2. 强制修复
npm run force-fix

# 3. 验证数据
npm run verify-usage-count

# 4. 重启服务器
npm run dev

# 5. 创建新任务（在前端操作）

# 6. 再次诊断
npm run diagnose-issue

# 7. 验证结果
npm run test-smart-selection
```

## 关键检查点

- [ ] `selected_distillation_ids`字段存在
- [ ] 所有任务都有`selected_distillation_ids`（不为NULL）
- [ ] 新任务的日志显示选择了多个不同的ID
- [ ] 每篇文章使用不同的蒸馏结果
- [ ] usage_count正确更新
- [ ] 前端显示正确的"被引用次数"
- [ ] 验证脚本显示所有数据一致

## 需要帮助

如果按照本指南操作后问题仍未解决，请提供：

1. `npm run diagnose-issue` 的完整输出
2. 服务器日志（创建新任务时的日志）
3. 数据库查询结果：
   ```sql
   SELECT id, selected_distillation_ids, requested_count, generated_count 
   FROM generation_tasks 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
4. 截图：前端"蒸馏结果"模块的"被引用次数"列
