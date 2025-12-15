# 🔍 Ollama集成故障排查指南

## 问题1：保存配置失败

### 症状
- ✅ Ollama连接测试成功
- ❌ 点击"保存配置"后提示失败
- ❌ 浏览器控制台显示错误

### 原因
数据库约束配置不正确

### 解决方案

**步骤1：运行修复脚本**
```bash
cd server
npm run db:fix:constraint
```

**步骤2：重启服务器**
```bash
# 停止当前服务器（Ctrl+C）
npm run dev
```

**步骤3：清除浏览器缓存并刷新页面**

**步骤4：重新保存配置**
1. 选择"本地Ollama"
2. 选择模型
3. 点击"保存配置"

### 验证
保存成功后应该看到：
- ✅ "API配置保存成功！"消息
- ✅ 页面顶部显示"已配置本地Ollama"

---

## 问题2：无法连接到Ollama服务

### 症状
- ❌ 检测模型时提示"无法连接到Ollama服务"
- ❌ 测试连接失败

### 解决方案

**检查1：确认Ollama已安装**
```bash
ollama --version
```

如果命令不存在，安装Ollama：
```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# 访问 https://ollama.ai 下载安装程序
```

**检查2：确认Ollama服务运行**
```bash
# 列出模型（这会启动服务）
ollama list

# 或直接测试API
curl http://localhost:11434/api/tags
```

**检查3：检查端口**
```bash
# macOS/Linux
lsof -i :11434

# 或使用netstat
netstat -an | grep 11434
```

**检查4：检查防火墙**
确保端口11434没有被防火墙阻止

---

## 问题3：未检测到DeepSeek模型

### 症状
- ✅ 连接Ollama成功
- ❌ 模型列表为空
- ❌ 提示"未检测到DeepSeek模型"

### 解决方案

**步骤1：检查已安装的模型**
```bash
ollama list
```

**步骤2：安装DeepSeek模型**
```bash
# 推荐：安装最新版本
ollama pull deepseek-r1:latest

# 或安装其他版本
ollama pull deepseek-r1:7b
ollama pull deepseek-coder:latest
```

**步骤3：验证安装**
```bash
ollama list
# 应该看到 deepseek-r1:latest 或其他DeepSeek模型
```

**步骤4：刷新配置页面**
点击服务地址输入框旁边的刷新图标

---

## 问题4：模型响应超时

### 症状
- ✅ 配置保存成功
- ❌ 执行蒸馏或生成文章时超时
- ❌ 提示"模型响应超时"

### 解决方案

**方案1：使用更小的模型**
```bash
# 卸载大模型
ollama rm deepseek-r1:latest

# 安装7B版本（更快）
ollama pull deepseek-r1:7b
```

**方案2：增加系统资源**
- 关闭其他占用内存的应用
- 确保至少有8GB可用内存
- 考虑升级硬件

**方案3：调整超时设置**
编辑 `server/src/services/ollamaService.ts`：
```typescript
this.client = axios.create({
  baseURL: baseUrl,
  timeout: 120000, // 增加到120秒
  // ...
});
```

---

## 问题5：AI任务无法使用Ollama

### 症状
- ✅ 配置保存成功
- ❌ 执行蒸馏时报错
- ❌ 生成文章时报错

### 解决方案

**检查1：确认配置已激活**
```sql
-- 连接数据库
psql -d geo_system

-- 查询配置
SELECT * FROM api_configs WHERE is_active = true;

-- 应该看到 provider='ollama' 的记录
```

**检查2：查看服务器日志**
服务器终端应该显示详细的错误信息

**检查3：测试Ollama直接调用**
```bash
ollama run deepseek-r1:latest "你好"
```

如果这个命令失败，说明Ollama本身有问题

**检查4：重启服务器**
```bash
# 停止服务器（Ctrl+C）
npm run dev
```

---

## 问题6：数据库迁移失败

### 症状
- ❌ 运行 `npm run db:migrate:ollama` 失败
- ❌ 提示约束已存在或其他错误

### 解决方案

**方案1：运行修复脚本**
```bash
cd server
npm run db:fix:constraint
```

**方案2：手动删除约束后重新迁移**
```sql
-- 连接数据库
psql -d geo_system

-- 删除约束
ALTER TABLE api_configs DROP CONSTRAINT IF EXISTS check_ollama_config;

-- 退出数据库
\q

-- 重新运行迁移
npm run db:migrate:ollama
```

**方案3：重建数据库（如果数据不重要）**
```bash
dropdb geo_system
createdb geo_system
cd server
npm run db:migrate
```

---

## 问题7：切换provider后出错

### 症状
- 从Ollama切换到云端API后出错
- 或从云端API切换到Ollama后出错

### 解决方案

**步骤1：清除旧配置**
```sql
-- 连接数据库
psql -d geo_system

-- 停用所有配置
UPDATE api_configs SET is_active = false;

-- 删除有问题的配置
DELETE FROM api_configs WHERE id = <问题配置的ID>;
```

**步骤2：重新配置**
1. 刷新配置页面
2. 选择新的provider
3. 填写配置信息
4. 保存

---

## 调试技巧

### 1. 查看服务器日志
服务器终端会显示所有API调用和错误信息

### 2. 查看浏览器控制台
按F12打开开发者工具，查看Console和Network标签

### 3. 测试API端点

**测试模型检测：**
```bash
curl "http://localhost:3000/api/config/ollama/models?baseUrl=http://localhost:11434"
```

**测试连接：**
```bash
curl -X POST http://localhost:3000/api/config/ollama/test \
  -H "Content-Type: application/json" \
  -d '{"baseUrl":"http://localhost:11434","model":"deepseek-r1:latest"}'
```

**测试保存配置：**
```bash
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{"provider":"ollama","ollamaBaseUrl":"http://localhost:11434","ollamaModel":"deepseek-r1:latest"}'
```

### 4. 查看数据库状态

```sql
-- 连接数据库
psql -d geo_system

-- 查看所有配置
SELECT * FROM api_configs;

-- 查看约束
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'api_configs'::regclass;

-- 查看表结构
\d api_configs
```

---

## 常见错误代码

### 400 Bad Request
- 缺少必要参数
- 配置验证失败
- 模型未安装

**解决**：检查请求参数，确保模型已安装

### 404 Not Found
- 模型不存在
- API端点错误

**解决**：安装模型，检查URL

### 500 Internal Server Error
- 数据库错误
- 约束违反
- 服务器异常

**解决**：查看服务器日志，运行修复脚本

### 503 Service Unavailable
- Ollama服务未运行
- 网络连接问题

**解决**：启动Ollama服务，检查网络

---

## 性能优化

### 1. 选择合适的模型
- 8GB内存：使用7B模型
- 16GB内存：使用14B模型
- 32GB+内存：可以使用更大模型

### 2. 预加载模型
```bash
# 预先运行一次，让模型加载到内存
ollama run deepseek-r1:latest "test"
```

### 3. 监控资源使用
```bash
# macOS/Linux
top
htop

# 查看Ollama进程
ps aux | grep ollama
```

---

## 获取更多帮助

### 文档
- [Ollama集成指南](./docs/Ollama集成指南.md)
- [快速启动](./QUICK_START_OLLAMA.md)
- [修复保存错误](./FIX_OLLAMA_SAVE_ERROR.md)

### 日志位置
- 服务器日志：终端输出
- Ollama日志：`~/.ollama/logs/`
- PostgreSQL日志：取决于安装方式

### 社区支持
- Ollama GitHub: https://github.com/ollama/ollama
- Ollama Discord: https://discord.gg/ollama

---

## 预防措施

### 1. 定期更新
```bash
# 更新Ollama
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# 更新模型
ollama pull deepseek-r1:latest
```

### 2. 备份配置
```bash
# 备份数据库
pg_dump geo_system > backup.sql

# 恢复
psql geo_system < backup.sql
```

### 3. 监控资源
定期检查磁盘空间和内存使用

### 4. 测试环境
在生产环境使用前，先在测试环境验证

---

**最常见问题的快速解决方案：**

```bash
# 1. 修复保存错误
cd server && npm run db:fix:constraint

# 2. 安装模型
ollama pull deepseek-r1:latest

# 3. 重启服务
npm run dev
```
