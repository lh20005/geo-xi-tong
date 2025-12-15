# 🔧 修复Ollama配置保存错误

## 问题描述

如果你遇到以下问题：
- ✅ Ollama连接测试成功
- ❌ 保存配置时提示失败
- ❌ 无法调用Ollama进行AI任务

这是由于数据库约束配置不正确导致的。

## 快速修复步骤

### 方法1：运行修复脚本（推荐）

```bash
cd server
npm run db:fix:constraint
```

这个脚本会：
1. 删除旧的约束
2. 添加正确的约束
3. 清理不一致的数据

### 方法2：手动执行SQL

如果方法1不工作，可以手动执行SQL：

```bash
cd server
psql -d geo_system -f src/db/fix-ollama-constraint.sql
```

或者连接到数据库后执行：

```sql
-- 1. 删除旧约束
ALTER TABLE api_configs 
  DROP CONSTRAINT IF EXISTS check_ollama_config;

-- 2. 添加新约束
ALTER TABLE api_configs
  ADD CONSTRAINT check_ollama_config
    CHECK (
      (provider = 'ollama' AND ollama_base_url IS NOT NULL AND ollama_model IS NOT NULL AND api_key IS NULL)
      OR
      (provider IN ('deepseek', 'gemini') AND api_key IS NOT NULL AND ollama_base_url IS NULL AND ollama_model IS NULL)
    );

-- 3. 清理数据
UPDATE api_configs 
SET api_key = NULL 
WHERE provider = 'ollama' AND api_key IS NOT NULL;

UPDATE api_configs 
SET ollama_base_url = NULL, ollama_model = NULL 
WHERE provider IN ('deepseek', 'gemini') AND (ollama_base_url IS NOT NULL OR ollama_model IS NOT NULL);
```

### 方法3：重新创建数据库（如果数据不重要）

```bash
# 删除旧数据库
dropdb geo_system

# 创建新数据库
createdb geo_system

# 运行迁移
cd server
npm run db:migrate
```

## 验证修复

修复后，测试以下操作：

### 1. 保存Ollama配置

```bash
# 启动服务器
npm run dev
```

访问配置页面：
1. 选择"本地Ollama"
2. 选择模型
3. 点击"保存配置"
4. 应该显示"API配置保存成功"

### 2. 测试AI功能

1. 进入"关键词蒸馏"页面
2. 输入测试关键词
3. 点击"开始蒸馏"
4. 应该成功生成问题列表

## 问题原因

### 原始约束问题

旧的约束定义：
```sql
CHECK (
  (provider = 'ollama' AND ollama_base_url IS NOT NULL AND ollama_model IS NOT NULL)
  OR
  (provider != 'ollama' AND api_key IS NOT NULL)
)
```

**问题**：当保存ollama配置时，api_key为NULL，但约束要求非ollama的provider必须有api_key。这导致约束检查失败。

### 修复后的约束

新的约束定义：
```sql
CHECK (
  (provider = 'ollama' AND ollama_base_url IS NOT NULL AND ollama_model IS NOT NULL AND api_key IS NULL)
  OR
  (provider IN ('deepseek', 'gemini') AND api_key IS NOT NULL AND ollama_base_url IS NULL AND ollama_model IS NULL)
)
```

**改进**：
1. 明确要求ollama配置时api_key必须为NULL
2. 明确要求云端API配置时ollama字段必须为NULL
3. 确保配置的互斥性和完整性

## 常见错误信息

### 错误1：约束违反
```
ERROR: new row for relation "api_configs" violates check constraint "check_ollama_config"
```

**解决**：运行修复脚本 `npm run db:fix:constraint`

### 错误2：保存配置失败
```
保存配置失败
```

**解决**：
1. 检查服务器日志查看详细错误
2. 运行修复脚本
3. 确保Ollama服务正在运行

### 错误3：模型未安装
```
模型 deepseek-r1:latest 未安装
```

**解决**：
```bash
ollama pull deepseek-r1:latest
```

## 预防措施

为避免将来出现类似问题：

1. **全新安装**：直接运行 `npm run db:migrate`，不要单独运行旧的迁移脚本

2. **更新现有数据库**：先运行修复脚本，再使用系统

3. **检查约束**：可以查询数据库确认约束正确：
   ```sql
   SELECT conname, pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conrelid = 'api_configs'::regclass;
   ```

## 技术细节

### 约束逻辑

新约束确保：
- Ollama配置：`provider='ollama'` + `ollama_base_url` + `ollama_model` + `api_key=NULL`
- DeepSeek配置：`provider='deepseek'` + `api_key` + `ollama_base_url=NULL` + `ollama_model=NULL`
- Gemini配置：`provider='gemini'` + `api_key` + `ollama_base_url=NULL` + `ollama_model=NULL`

### 代码更新

保存逻辑已更新为明确设置NULL值：

```typescript
// Ollama配置
INSERT INTO api_configs (provider, api_key, ollama_base_url, ollama_model, is_active) 
VALUES ('ollama', NULL, $1, $2, true)

// 云端API配置
INSERT INTO api_configs (provider, api_key, ollama_base_url, ollama_model, is_active) 
VALUES ($1, $2, NULL, NULL, true)
```

## 获取帮助

如果问题仍然存在：

1. 查看服务器日志：
   ```bash
   # 服务器终端会显示详细错误
   ```

2. 查看数据库日志：
   ```bash
   # PostgreSQL日志位置取决于安装方式
   ```

3. 检查数据库状态：
   ```sql
   SELECT * FROM api_configs;
   ```

4. 提交Issue并附上：
   - 错误信息
   - 服务器日志
   - 数据库版本
   - 操作步骤

## 总结

这个问题已经在代码层面修复，只需要运行修复脚本更新数据库约束即可。修复后，Ollama配置保存和使用都应该正常工作。

---

**修复命令**：`cd server && npm run db:fix:constraint`

**验证**：保存Ollama配置应该成功，并能正常使用AI功能
