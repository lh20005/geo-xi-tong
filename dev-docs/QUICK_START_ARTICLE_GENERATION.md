# 文章生成模块 - 快速启动指南

## 🚀 5分钟快速开始

### 1. 数据库迁移（必需）

```bash
# 连接到你的PostgreSQL数据库并执行迁移
psql -d your_database_name -f server/src/db/migrations/add_article_generation.sql
```

### 2. 启动服务

```bash
# 启动后端服务
cd server
npm run dev

# 启动前端服务（新终端）
cd client
npm run dev
```

### 3. 准备数据

在使用文章生成功能前，确保已有以下数据：

- ✅ **关键词蒸馏记录** - 在"关键词蒸馏"页面创建
- ✅ **企业图库** - 在"企业图库"页面创建相册并上传图片
- ✅ **企业知识库** - 在"企业知识库"页面创建并上传文档
- ✅ **文章设置** - 在"文章设置"页面创建提示词模板
- ✅ **AI配置** - 在"API配置"页面配置AI服务

### 4. 生成文章

1. 访问 http://localhost:5173
2. 点击侧边栏的"生成文章"
3. 点击"新建任务"按钮
4. 填写配置：
   ```
   蒸馏历史: 选择已有的蒸馏记录
   企业图库: 选择已有的相册
   企业知识库: 选择已有的知识库
   文章设置: 选择已有的提示词模板
   生成数量: 输入1-100之间的数字
   ```
5. 点击"生成文章"
6. 等待任务完成（可以看到实时进度）
7. 在"文章管理"中查看生成的文章

## 📊 运行测试

```bash
cd server

# 运行所有测试
npm test

# 运行测试并查看覆盖率
npm test -- --coverage

# 运行特定测试
npm test -- articleGenerationService.test.ts
```

## 🔍 验证安装

### 检查数据库表

```sql
-- 检查generation_tasks表是否存在
SELECT * FROM generation_tasks LIMIT 1;

-- 检查articles表的新字段
SELECT title, task_id, image_url FROM articles LIMIT 1;
```

### 检查API端点

```bash
# 测试任务列表API
curl http://localhost:3000/api/article-generation/tasks

# 测试文章列表API
curl http://localhost:3000/api/articles?page=1&pageSize=10
```

## 🎯 示例工作流

### 完整的文章生成流程

```
1. 创建转化目标
   └─> 定义企业信息和目标受众

2. 关键词蒸馏
   └─> 输入关键词，生成相关话题

3. 准备资源
   ├─> 上传企业图片到图库
   ├─> 上传企业文档到知识库
   └─> 创建文章设置（提示词模板）

4. 生成文章
   ├─> 选择蒸馏历史
   ├─> 选择图库
   ├─> 选择知识库
   ├─> 选择文章设置
   └─> 设置生成数量

5. 查看结果
   └─> 在文章管理中查看和编辑生成的文章
```

## ⚠️ 常见问题

### Q: 任务一直显示"等待中"？
A: 检查后端服务是否正常运行，查看控制台日志。

### Q: 生成失败显示AI错误？
A: 确认AI配置正确，API密钥有效，网络连接正常。

### Q: 找不到"生成文章"菜单？
A: 确认前端代码已更新，刷新浏览器缓存。

### Q: 数据库错误？
A: 确认已运行迁移脚本，检查数据库连接。

## 📝 测试数据示例

### 创建测试蒸馏记录

```sql
INSERT INTO distillations (keyword, provider) 
VALUES ('测试关键词', 'deepseek') 
RETURNING id;

INSERT INTO topics (distillation_id, question) 
VALUES 
  (1, '测试问题1'),
  (1, '测试问题2'),
  (1, '测试问题3');
```

### 创建测试图库

```sql
INSERT INTO albums (name) 
VALUES ('测试相册') 
RETURNING id;

-- 需要实际上传图片文件
```

### 创建测试知识库

```sql
INSERT INTO knowledge_bases (name, description) 
VALUES ('测试知识库', '用于测试的知识库') 
RETURNING id;

-- 需要上传文档文件
```

### 创建测试文章设置

```sql
INSERT INTO article_settings (name, prompt) 
VALUES ('测试模板', '请撰写一篇专业的文章，要求内容有价值、语言流畅。') 
RETURNING id;
```

## 🎉 成功标志

当你看到以下内容时，说明一切正常：

- ✅ 侧边栏显示"生成文章"菜单
- ✅ 可以打开任务配置弹窗
- ✅ 所有下拉列表都能加载数据
- ✅ 可以成功创建任务
- ✅ 任务列表显示进度
- ✅ 任务完成后可以在文章管理中看到生成的文章

## 📚 更多信息

详细文档请参考：
- [完整部署指南](./ARTICLE_GENERATION_README.md)
- [设计文档](./.kiro/specs/article-generation/design.md)
- [需求文档](./.kiro/specs/article-generation/requirements.md)

祝使用愉快！🎊
