# 🚀 Ollama集成快速启动指南

## 5分钟快速开始

### 步骤 1: 安装 Ollama

**macOS/Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
访问 https://ollama.ai 下载安装程序

### 步骤 2: 安装 DeepSeek 模型

```bash
ollama pull deepseek-r1:latest
```

等待下载完成（约7GB）

### 步骤 3: 验证安装

```bash
# 查看已安装的模型
ollama list

# 测试模型
ollama run deepseek-r1:latest "你好"
```

### 步骤 4: 更新数据库

```bash
cd server
npm run db:migrate:ollama
```

### 步骤 5: 启动服务

**终端 1 - 启动后端:**
```bash
cd server
npm run dev
```

**终端 2 - 启动前端:**
```bash
cd client
npm run dev
```

### 步骤 6: 配置系统

1. 打开浏览器访问 `http://localhost:5173`（或你的前端地址）
2. 进入"配置"页面
3. 在"选择 AI 模型"下拉框中选择"本地 Ollama"
4. 系统会自动检测到你安装的模型
5. 选择 `deepseek-r1:latest`
6. 点击"测试连接"确认可用
7. 点击"保存配置"

### 步骤 7: 开始使用

现在你可以：
- 使用关键词蒸馏功能
- 生成文章内容
- 所有操作都在本地完成，无需API密钥！

## 常见问题快速解决

### ❌ 无法连接到Ollama服务

**解决：**
```bash
# 检查Ollama是否运行
ollama list

# 如果没有运行，启动Ollama
# macOS/Linux: Ollama通常自动运行
# Windows: 从开始菜单启动Ollama
```

### ❌ 未检测到DeepSeek模型

**解决：**
```bash
# 安装模型
ollama pull deepseek-r1:latest

# 刷新配置页面
```

### ❌ 数据库迁移失败

**解决：**
```bash
# 如果是全新安装，运行完整迁移
cd server
npm run db:migrate

# 如果已有数据库，运行Ollama迁移
npm run db:migrate:ollama
```

## 推荐模型

| 模型 | 大小 | 内存需求 | 速度 | 质量 |
|------|------|----------|------|------|
| deepseek-r1:7b | ~7GB | 8GB | 快 | 好 |
| deepseek-r1:latest | ~14GB | 16GB | 中 | 很好 |
| deepseek-coder:latest | ~7GB | 8GB | 快 | 好（代码） |

**建议：**
- 8GB内存：使用 `deepseek-r1:7b`
- 16GB内存：使用 `deepseek-r1:latest`
- 32GB+内存：可以尝试更大的模型

## 性能提示

### 🚀 加速技巧

1. **使用GPU加速**
   - NVIDIA GPU：确保安装了CUDA
   - Apple Silicon：自动使用Metal加速
   - AMD GPU：确保安装了ROCm

2. **选择合适的模型**
   - 开发测试：使用7B模型
   - 生产环境：根据硬件选择

3. **避免并发**
   - 一次只运行一个AI任务
   - 等待当前任务完成再开始下一个

### 💾 节省资源

```bash
# 卸载不需要的模型
ollama rm model-name

# 查看模型占用空间
ollama list
```

## 切换回云端API

如果本地资源不足，随时可以切换回云端API：

1. 进入配置页面
2. 选择"DeepSeek"或"Google Gemini"
3. 输入API Key
4. 保存配置

## 下一步

- 📖 阅读完整文档：`docs/Ollama集成指南.md`
- ✅ 运行测试清单：`test-ollama-integration.md`
- 📊 查看实现总结：`OLLAMA_INTEGRATION_SUMMARY.md`

## 获取帮助

- Ollama官方文档：https://github.com/ollama/ollama
- DeepSeek官网：https://www.deepseek.com
- 系统问题：查看服务器日志和浏览器控制台

---

**🎉 恭喜！你现在可以使用本地AI模型了！**
