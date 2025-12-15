# 文章生成模块 - 部署和使用指南

## 概述

文章生成模块是一个智能内容创作系统，整合了关键词蒸馏、企业图库、企业知识库和文章设置等多个模块的数据，通过AI大模型自动批量生成高质量文章。

## 功能特性

- ✅ 多数据源整合（蒸馏历史、图库、知识库、文章设置）
- ✅ 异步任务执行和实时进度跟踪
- ✅ 一对一关键词-文章生成逻辑
- ✅ 完整的错误处理和恢复机制
- ✅ 分页展示（每页10条）
- ✅ 完整的属性测试覆盖

## 数据库迁移

在使用文章生成功能之前，需要先运行数据库迁移脚本：

```bash
# 方式1：使用psql命令
psql -d your_database_name -f server/src/db/migrations/add_article_generation.sql

# 方式2：使用数据库客户端执行schema.sql
# 新的schema.sql已包含所有必需的表和字段
```

### 新增的数据库表和字段

1. **generation_tasks 表** - 存储文章生成任务
   - 包含任务配置、状态、进度等信息
   - 支持状态：pending, running, completed, failed

2. **articles 表扩展** - 添加了以下字段：
   - `title` - 文章标题
   - `task_id` - 关联的生成任务ID
   - `image_url` - 文章配图URL

## API 端点

### 文章生成任务 API

#### 创建任务
```http
POST /api/article-generation/tasks
Content-Type: application/json

{
  "distillationId": 1,
  "albumId": 2,
  "knowledgeBaseId": 3,
  "articleSettingId": 4,
  "articleCount": 5
}
```

#### 获取任务列表
```http
GET /api/article-generation/tasks?page=1&pageSize=10
```

#### 获取任务详情
```http
GET /api/article-generation/tasks/:id
```

### 文章 API（扩展）

#### 获取文章列表（支持任务筛选）
```http
GET /api/articles?page=1&pageSize=10&taskId=1
```

## 前端使用

### 访问文章生成页面

1. 在侧边栏点击"生成文章"菜单项
2. 点击"新建任务"按钮
3. 在弹窗中配置：
   - 选择蒸馏历史
   - 选择企业图库
   - 选择企业知识库
   - 选择文章设置
   - 设置生成数量（1-100）
4. 点击"生成文章"按钮
5. 在任务列表中查看进度
6. 任务完成后，在"文章管理"中查看生成的文章

### 任务状态说明

- **等待中** (pending) - 任务已创建，等待执行
- **执行中** (running) - 正在生成文章
- **已完成** (completed) - 所有文章生成完成
- **失败** (failed) - 任务执行失败

## 运行测试

### 后端测试

```bash
cd server
npm test

# 运行特定测试文件
npm test -- articleGenerationService.test.ts

# 查看测试覆盖率
npm test -- --coverage
```

### 测试文件说明

1. **articleGenerationService.test.ts** - 任务创建持久化测试
2. **dataPreparation.test.ts** - 数据获取和准备逻辑测试
3. **articleGeneration.test.ts** - 文章生成逻辑测试
4. **articlePersistence.test.ts** - 文章持久化测试
5. **articlePagination.test.ts** - 分页逻辑测试

所有测试都使用 **fast-check** 进行属性测试，确保系统在各种输入下的正确性。

## 核心逻辑说明

### 文章生成流程

1. **任务创建** - 用户提交配置，创建任务记录
2. **异步执行** - 后台异步执行生成任务
3. **数据提取** - 从蒸馏历史提取关键词-话题对
4. **图片选择** - 从图库随机选择图片
5. **内容获取** - 获取知识库内容和文章设置提示词
6. **AI生成** - 调用AI服务生成文章
7. **解析保存** - 解析标题和内容，保存到数据库
8. **进度更新** - 实时更新任务进度
9. **状态标记** - 完成后标记任务状态

### 一对一关键词-文章对应

系统确保每篇文章只使用一个关键词及其对应的蒸馏结果：
- 每个蒸馏记录对应一个关键词
- 每个关键词有多个相关话题
- 生成文章时，一个关键词+话题集合生成一篇文章
- 不同文章使用不同的关键词

### 错误处理

- **AI调用失败** - 记录错误，继续处理下一篇
- **数据库错误** - 回滚事务，保持数据一致性
- **空图库** - 使用默认占位图片
- **致命错误** - 标记任务失败，保存已生成的文章

## 性能优化

1. **异步执行** - 任务创建立即返回，后台异步生成
2. **批量操作** - 优化数据库查询
3. **索引优化** - 在关键字段上创建索引
4. **定时刷新** - 前端每10秒自动刷新任务状态

## 环境变量

确保以下环境变量已配置：

```env
# 数据库连接
DATABASE_URL=postgresql://user:password@localhost:5432/database

# AI配置（在系统中通过UI配置）
# 支持 DeepSeek, Gemini, Ollama
```

## 故障排查

### 任务一直处于"等待中"状态

- 检查后端服务是否正常运行
- 查看后端日志是否有错误信息
- 确认AI配置是否正确

### 文章生成失败

- 检查AI API配置和密钥
- 确认网络连接正常
- 查看任务详情中的错误信息

### 数据库错误

- 确认数据库迁移已执行
- 检查数据库连接配置
- 验证引用的资源（蒸馏历史、图库等）是否存在

## 后续扩展

可能的功能扩展方向：

1. **定时任务** - 支持定时自动生成
2. **模板系统** - 更灵活的文章模板
3. **质量控制** - AI内容审核和原创度检测
4. **批量管理** - 批量编辑和发布
5. **统计分析** - 生成效率和成功率统计

## 技术栈

- **后端**: Node.js, Express, TypeScript, PostgreSQL
- **前端**: React 18, TypeScript, Ant Design 5
- **AI服务**: DeepSeek / Gemini / Ollama
- **测试**: Jest, fast-check (属性测试)
- **验证**: Zod

## 联系支持

如有问题或建议，请联系开发团队。
