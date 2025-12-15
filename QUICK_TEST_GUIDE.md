# 快速测试指南

## 快速验证修复是否成功

### 1分钟快速测试

```bash
# 1. 进入server目录
cd server

# 2. 验证当前数据状态
npm run verify-usage-count

# 3. 如果发现不一致，运行修复
npm run fix-usage-count

# 4. 启动服务器
npm run dev
```

然后在前端：
1. 创建一个生成3篇文章的任务
2. 等待任务完成
3. 查看服务器日志

### 查看日志中的关键信息

#### ✓ 正确的日志（问题已修复）

```
[智能选择] 成功选择 3 个蒸馏结果: [1, 5, 3]

[任务 123] ========== 开始生成第 1/3 篇文章 ==========
[任务 123] [文章 1] 从selected_distillation_ids[0]获取蒸馏结果ID: 1
[任务 123] [文章 1] 使用蒸馏结果: ID=1, 关键词="关键词1", 话题数=5

[任务 123] ========== 开始生成第 2/3 篇文章 ==========
[任务 123] [文章 2] 从selected_distillation_ids[1]获取蒸馏结果ID: 5
[任务 123] [文章 2] 使用蒸馏结果: ID=5, 关键词="关键词5", 话题数=4

[任务 123] ========== 开始生成第 3/3 篇文章 ==========
[任务 123] [文章 3] 从selected_distillation_ids[2]获取蒸馏结果ID: 3
[任务 123] [文章 3] 使用蒸馏结果: ID=3, 关键词="关键词3", 话题数=6
```

**关键点**：
- ✓ 选择了3个不同的ID: [1, 5, 3]
- ✓ 文章1使用ID=1
- ✓ 文章2使用ID=5
- ✓ 文章3使用ID=3
- ✓ 每篇文章使用了不同的蒸馏结果

#### ✗ 错误的日志（问题未修复）

```
[智能选择] 成功选择 3 个蒸馏结果: [1, 5, 3]

[任务 123] [文章 1] 使用蒸馏结果: ID=1, 关键词="关键词1"
[任务 123] [文章 2] 使用蒸馏结果: ID=1, 关键词="关键词1"  ← 重复！
[任务 123] [文章 3] 使用蒸馏结果: ID=1, 关键词="关键词1"  ← 重复！
```

**问题**：所有文章都使用了ID=1

### 验证usage_count更新

任务完成后，运行：

```bash
cd server
npm run test-smart-selection
```

#### ✓ 正确的输出

```
验证usage_count更新：
✓ 蒸馏结果ID 1: usage_count=3, 实际使用=3 - 一致
✓ 蒸馏结果ID 5: usage_count=1, 实际使用=1 - 一致
✓ 蒸馏结果ID 3: usage_count=1, 实际使用=1 - 一致
```

#### ✗ 错误的输出

```
验证usage_count更新：
✗ 蒸馏结果ID 1: usage_count=2, 实际使用=3 - 不一致！
```

### 在前端验证

1. 打开"蒸馏结果"模块
2. 查看"被引用次数"列
3. 数字应该与实际使用次数一致

## 如果测试失败

### 问题1：所有文章使用同一个蒸馏结果

**解决方法**：
1. 检查数据库迁移是否成功：
   ```bash
   cd server
   npm run db:migrate:smart-selection
   ```

2. 查看数据库中的`selected_distillation_ids`：
   ```sql
   SELECT id, selected_distillation_ids FROM generation_tasks ORDER BY id DESC LIMIT 1;
   ```
   应该看到类似 `[1, 5, 3]` 的JSON数组

3. 如果字段不存在或为NULL，重新运行迁移

### 问题2：usage_count不更新

**解决方法**：
1. 查看日志中是否有"事务回滚"的消息
2. 检查数据库连接是否正常
3. 运行修复脚本：
   ```bash
   npm run fix-usage-count
   ```

### 问题3：日志中没有详细信息

**解决方法**：
1. 确认使用的是最新代码
2. 重启服务器：
   ```bash
   cd server
   npm run dev
   ```

## 完整测试流程

```bash
# 1. 验证数据
cd server
npm run verify-usage-count

# 2. 修复不一致（如果需要）
npm run fix-usage-count

# 3. 启动服务器
npm run dev

# 在另一个终端：
# 4. 创建测试任务（在前端操作）
# 5. 等待任务完成

# 6. 测试结果
npm run test-smart-selection

# 7. 再次验证数据一致性
npm run verify-usage-count
```

## 预期结果

- ✓ 每篇文章使用不同的蒸馏结果
- ✓ usage_count正确更新
- ✓ 前端显示正确的"被引用次数"
- ✓ 验证脚本显示所有数据一致

## 需要帮助？

查看详细文档：
- `SMART_SELECTION_FIX_GUIDE.md` - 完整修复指南
- `SMART_SELECTION_FIX_SUMMARY.md` - 修复总结
- 服务器日志 - 查看详细的执行过程
