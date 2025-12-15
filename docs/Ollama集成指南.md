# Ollama 本地模型集成指南

## 概述

系统现已支持使用本地Ollama服务运行DeepSeek大模型，无需依赖云端API。这为用户提供了更灵活的部署选项，降低了API调用成本，并提高了数据隐私性。

## 前置要求

### 1. 安装 Ollama

访问 [https://ollama.ai](https://ollama.ai) 下载并安装Ollama。

**macOS/Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
从官网下载安装程序并运行。

### 2. 安装 DeepSeek 模型

Ollama安装完成后，在终端运行以下命令安装DeepSeek模型：

```bash
# 安装 DeepSeek R1 模型（推荐）
ollama pull deepseek-r1:latest

# 或安装 DeepSeek Coder 模型
ollama pull deepseek-coder:latest

# 或安装其他DeepSeek模型
ollama pull deepseek-r1:7b
```

### 3. 验证 Ollama 服务

确认Ollama服务正在运行：

```bash
# 检查Ollama版本
ollama --version

# 列出已安装的模型
ollama list

# 测试模型
ollama run deepseek-r1:latest "Hello"
```

## 数据库迁移

在使用Ollama功能前，需要更新数据库schema：

```bash
cd server
npm run db:migrate:ollama
```

如果是全新安装，直接运行：

```bash
npm run db:migrate
```

## 配置步骤

### 1. 访问配置页面

启动系统后，访问配置页面（通常在 `/config` 路径）。

### 2. 选择本地 Ollama

在"选择 AI 模型"下拉框中选择"本地 Ollama"。

### 3. 配置 Ollama 服务地址

- 默认地址：`http://localhost:11434`
- 如果Ollama运行在其他地址或端口，请相应修改

### 4. 选择模型

系统会自动检测本地已安装的DeepSeek模型。从下拉列表中选择要使用的模型。

### 5. 测试连接

点击"测试连接"按钮，确认系统能够成功连接到Ollama服务并使用选定的模型。

### 6. 保存配置

点击"保存配置"按钮完成设置。

## 使用功能

配置完成后，系统的所有AI功能都会使用本地Ollama模型：

- **关键词蒸馏**：生成用户搜索问题
- **文章生成**：基于关键词和话题生成文章

使用方式与云端API完全相同，无需修改工作流程。

## 故障排除

### 问题：无法连接到Ollama服务

**解决方案：**
1. 确认Ollama已安装并正在运行
2. 检查服务地址是否正确（默认：http://localhost:11434）
3. 尝试在终端运行 `ollama list` 验证服务状态

### 问题：未检测到DeepSeek模型

**解决方案：**
1. 运行 `ollama list` 查看已安装的模型
2. 如果没有DeepSeek模型，运行 `ollama pull deepseek-r1:latest`
3. 刷新配置页面重新检测

### 问题：模型响应超时

**解决方案：**
1. 检查系统资源（CPU、内存）是否充足
2. 尝试使用更小的模型（如 deepseek-r1:7b）
3. 增加系统可用内存

### 问题：模型未安装错误

**解决方案：**
按照错误提示运行安装命令，例如：
```bash
ollama pull deepseek-r1:latest
```

## 性能优化建议

### 1. 选择合适的模型大小

- **7B模型**：适合8GB内存的机器，响应较快
- **14B模型**：需要16GB内存，质量更好
- **70B+模型**：需要32GB+内存，质量最佳但速度较慢

### 2. 硬件加速

Ollama会自动使用可用的GPU加速。确保：
- **NVIDIA GPU**：安装最新的CUDA驱动
- **Apple Silicon**：Ollama会自动使用Metal加速
- **AMD GPU**：确保ROCm驱动已安装

### 3. 并发控制

本地模型处理能力有限，建议：
- 避免同时执行多个AI任务
- 合理设置任务队列
- 监控系统资源使用情况

## 在云端API和本地Ollama之间切换

系统支持灵活切换AI服务提供商：

1. 访问配置页面
2. 选择新的provider（DeepSeek、Gemini或Ollama）
3. 填写相应的配置信息
4. 保存配置

切换后，系统会立即使用新的配置执行后续任务。

## API参考

### 检测Ollama模型

```http
GET /api/config/ollama/models?baseUrl=http://localhost:11434
```

**响应：**
```json
{
  "models": [
    {
      "name": "deepseek-r1:latest",
      "size": "7.2 GB",
      "modifiedAt": "2024-12-10T10:30:00Z"
    }
  ],
  "count": 1
}
```

### 测试Ollama连接

```http
POST /api/config/ollama/test
Content-Type: application/json

{
  "baseUrl": "http://localhost:11434",
  "model": "deepseek-r1:latest"
}
```

**响应：**
```json
{
  "success": true,
  "message": "连接成功！模型可用。"
}
```

### 保存Ollama配置

```http
POST /api/config
Content-Type: application/json

{
  "provider": "ollama",
  "ollamaBaseUrl": "http://localhost:11434",
  "ollamaModel": "deepseek-r1:latest"
}
```

## 常见问题

**Q: Ollama和云端API有什么区别？**

A: 
- **Ollama**：在本地运行，无需API密钥，数据不离开本地，但需要较好的硬件配置
- **云端API**：在云端运行，需要API密钥和网络连接，响应速度快，无硬件要求

**Q: 可以同时配置多个provider吗？**

A: 系统同时只能激活一个provider配置，但可以随时切换。

**Q: Ollama支持哪些模型？**

A: 系统目前自动检测并过滤DeepSeek系列模型。理论上Ollama支持的任何模型都可以使用，但系统针对DeepSeek进行了优化。

**Q: 本地模型的质量如何？**

A: DeepSeek模型质量接近或达到GPT-4水平，具体取决于模型大小和任务类型。

## 技术支持

如遇到问题，请：
1. 查看系统日志（浏览器控制台和服务器日志）
2. 确认Ollama版本是否最新
3. 检查系统资源使用情况
4. 参考Ollama官方文档：https://github.com/ollama/ollama

## 更新日志

### v1.0.0 (2024-12-10)
- ✅ 添加Ollama支持
- ✅ 自动检测DeepSeek模型
- ✅ 连接测试功能
- ✅ 完整的错误处理
- ✅ 配置持久化
