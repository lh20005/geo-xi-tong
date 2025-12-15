# GEO优化系统 🚀

<div align="center">

**专业的品牌AI推荐优化工具**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

</div>

---

## 📖 项目简介

GEO（Generative Engine Optimization）优化系统是一个专业的品牌AI推荐优化工具，旨在帮助品牌提升在AI平台（如ChatGPT、Claude、Gemini等）的主动推荐率。

通过智能的关键词蒸馏和AI驱动的内容生成，系统能够：
- 🎯 分析关键词，生成真实用户搜索问题
- 💡 管理和优化话题内容
- ✨ 自动生成高质量SEO文章
- 🔄 支持多个AI模型灵活切换

## ✨ 核心功能

### 1️⃣ 多模型AI支持
- ✅ DeepSeek API集成（中文优化）
- ✅ Google Gemini API集成
- ✅ **本地Ollama支持（新增）** - 无需API密钥，数据本地化
- ✅ 灵活切换AI模型
- ✅ 统一的API管理界面
- ✅ 自动检测本地模型

### 2️⃣ 关键词蒸馏
- ✅ 智能分析关键词搜索意图
- ✅ 生成10-15个真实用户提问
- ✅ 基于真实搜索行为分析
- ✅ 支持各行业关键词

### 3️⃣ 话题管理
- ✅ 可视化话题列表
- ✅ 编辑和删除话题
- ✅ 选择话题用于文章生成
- ✅ 历史记录追踪

### 4️⃣ 文章生成
- ✅ AI驱动的内容创作
- ✅ 自定义文章生成要求
- ✅ 高质量SEO优化
- ✅ 知识库智能引用
- ✅ 一键复制和下载

### 5️⃣ 文章管理
- ✅ 文章列表和详情查看
- ✅ 文章编辑功能
- ✅ 按任务筛选
- ✅ 文章历史管理
- ✅ 批量管理功能

### 6️⃣ 文章生成任务 **（新增）**
- ✅ 批量文章生成
- ✅ 任务状态监控
- ✅ 智能选择蒸馏结果
- ✅ 任务诊断和重试
- ✅ 批量删除管理

### 7️⃣ 文章设置 **（新增）**
- ✅ 文章模板管理
- ✅ 字数和风格配置
- ✅ 自定义要求设置
- ✅ 模板复用

### 8️⃣ 转化目标 **（新增）**
- ✅ 转化目标管理
- ✅ 多种目标类型（电话、邮箱、网址、微信）
- ✅ 文章中自动嵌入
- ✅ 灵活配置

### 9️⃣ 企业图库
- ✅ 相册创建和管理
- ✅ 图片批量上传（支持JPEG、PNG、GIF、WebP）
- ✅ 图片预览和删除
- ✅ 相册编辑功能
- ✅ 文章自动配图

### 🔟 企业知识库
- ✅ 知识库分类管理
- ✅ 文档上传和解析（支持txt、md、pdf、doc、docx）
- ✅ 全文搜索功能
- ✅ AI文章生成时智能引用知识库
- ✅ 文档内容自动提取和存储

## 🛠️ 技术栈

### 前端
```
React 18          - 现代化UI框架
TypeScript        - 类型安全
Ant Design 5      - 企业级UI组件
Tailwind CSS      - 实用优先的CSS框架
React Router v6   - 路由管理
Axios             - HTTP客户端
Vite              - 极速构建工具
```

### 后端
```
Node.js           - JavaScript运行时
Express           - Web应用框架
TypeScript        - 类型安全
PostgreSQL        - 关系型数据库
pg                - PostgreSQL驱动
```

### AI集成
```
DeepSeek API      - 中文优化的AI模型
Gemini API        - Google的多模态AI
Ollama            - 本地AI模型运行（新增）
```

## 🚀 快速开始

### 方式一：双击启动（推荐 - macOS 用户）⚡

**最简单的启动方式！**

1. **首次使用**，在终端中运行：
   ```bash
   chmod +x start.command
   ```

2. **双击** `start.command` 文件

3. 系统会自动：
   - ✅ 检查环境配置
   - ✅ 启动前后端服务
   - ✅ 打开浏览器

4. 按 `Ctrl+C` 停止服务

**注意**：
- Windows 用户请使用方式二
- Linux 用户可以在终端运行 `./start.command`

### 方式二：手动启动

#### 前置要求

- Node.js 18+
- PostgreSQL 12+
- **以下三选一**：
  - DeepSeek API密钥
  - Gemini API密钥
  - 本地Ollama + DeepSeek模型（推荐用于隐私保护）

#### 1. 克隆项目

```bash
git clone <repository-url>
cd geo-optimization-system
```

#### 2. 安装依赖

```bash
npm run install:all
```

#### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/geo_system

# AI API配置（至少配置一个）
DEEPSEEK_API_KEY=your_deepseek_api_key
GEMINI_API_KEY=your_gemini_api_key

# Ollama配置（可选，用于本地AI模型）
OLLAMA_BASE_URL=http://localhost:11434

# 服务器配置
PORT=3000
NODE_ENV=development
```

#### 可选：使用本地Ollama

如果你想使用本地AI模型（无需API密钥，数据更安全）：

```bash
# 1. 安装Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. 安装DeepSeek模型
ollama pull deepseek-r1:latest

# 3. 验证安装
ollama list

# 4. 修复数据库约束（重要！）
cd server
npm run db:fix:constraint
```

详细说明请查看 [Ollama集成指南](./docs/Ollama集成指南.md) 或 [快速启动](./QUICK_START_OLLAMA.md)

**⚠️ 重要提示：** 如果遇到"保存配置失败"错误，请运行：
```bash
cd server && npm run db:fix:constraint
```
详见 [修复指南](./FIX_OLLAMA_SAVE_ERROR.md)

#### 4. 创建数据库

```bash
createdb geo_system
```

#### 5. 运行数据库迁移

```bash
cd server
npm run db:migrate
cd ..
```

#### 6. 启动开发服务器

```bash
npm run dev
```

访问地址：
- 🌐 前端: http://localhost:5173
- 🔧 后端: http://localhost:3000

## 📁 项目结构

```
geo-optimization-system/
│
├── client/                    # 前端应用
│   ├── src/
│   │   ├── components/        # React组件
│   │   │   └── Layout/        # 布局组件
│   │   ├── pages/             # 页面组件
│   │   │   ├── Dashboard.tsx                  # 工作台
│   │   │   ├── ConfigPage.tsx                 # API配置
│   │   │   ├── DistillationPage.tsx           # 关键词蒸馏
│   │   │   ├── TopicsPage.tsx                 # 话题管理
│   │   │   ├── ArticlePage.tsx                # 文章生成
│   │   │   ├── ArticleListPage.tsx            # 文章列表
│   │   │   ├── GalleryPage.tsx                # 企业图库
│   │   │   ├── AlbumDetailPage.tsx            # 相册详情
│   │   │   ├── KnowledgeBasePage.tsx          # 企业知识库
│   │   │   └── KnowledgeBaseDetailPage.tsx    # 知识库详情
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
├── server/                    # 后端应用
│   ├── src/
│   │   ├── routes/            # API路由
│   │   │   ├── config.ts              # API配置
│   │   │   ├── distillation.ts        # 关键词蒸馏
│   │   │   ├── topic.ts               # 话题管理
│   │   │   ├── article.ts             # 文章管理
│   │   │   ├── gallery.ts             # 企业图库
│   │   │   └── knowledgeBase.ts       # 企业知识库
│   │   ├── services/          # 业务服务
│   │   │   ├── aiService.ts           # AI服务集成
│   │   │   ├── documentParser.ts      # 文档解析
│   │   │   └── knowledgeBaseService.ts # 知识库服务
│   │   ├── db/                # 数据库
│   │   │   ├── database.ts
│   │   │   ├── schema.sql
│   │   │   └── migrate.ts
│   │   └── index.ts
│   └── package.json
│
├── docs/                      # 📚 正式文档（面向用户）
│   ├── 系统设计文档.md
│   ├── UI设计说明.md
│   ├── 快速开始.md
│   └── 项目总览.md
│
├── dev-docs/                  # 🔧 开发文档（开发过程记录）
│   ├── README.md              # 开发文档说明
│   ├── 功能实现总结/          # 各功能模块的实现总结
│   ├── 使用指南/              # 快速启动和使用指南
│   ├── 问题修复/              # Bug修复记录
│   └── 测试文档/              # 测试脚本和清单
│
├── scripts/                   # 🛠️ 工具脚本
│   ├── diagnose.sh            # 系统诊断脚本
│   └── check-database.sh      # 数据库检查脚本
│
├── .env.example               # 环境变量模板
├── .gitignore
├── package.json
├── start.command              # 一键启动脚本（macOS）
└── README.md
```

## 🎨 界面预览

### 工作台
- 渐变色统计卡片
- 快速开始引导
- 系统特点展示

### 关键词蒸馏
- 简洁的输入界面
- 实时蒸馏结果展示
- 历史记录管理

### 话题管理
- 可视化话题列表
- 便捷的编辑功能
- 批量选择操作

### 文章生成
- 自定义要求输入
- 实时生成进度
- 一键复制下载

## 📚 文档

### 📖 正式文档（docs/）
面向最终用户的正式文档：

- [� 系统设计文档]/(./docs/系统设计文档.md) - 完整的技术架构和设计
- [🎨 UI设计说明](./docs/UI设计说明.md) - 详细的UI设计规范
- [🚀 快速开始](./docs/快速开始.md) - 安装和使用指南
- [📋 项目总览](./docs/项目总览.md) - 项目概览和特性
- [☁️ 腾讯EdgeOne部署方案](./docs/腾讯EdgeOne部署方案.md) - EdgeOne云平台部署指南
- [📊 EdgeOne架构适配性评估](./docs/EdgeOne架构适配性评估.md) - 架构评估和优化建议
- [🚀 部署指南](./docs/部署指南.md) - 通用部署方案和最佳实践
- [📖 Ollama集成指南](./docs/Ollama集成指南.md) - 完整的使用指南

### 🔧 开发文档（dev-docs/）
开发过程中的记录和参考文档：

- [� 开发文档(说明](./dev-docs/README.md) - 开发文档索引和说明
- 功能实现总结 - 各模块的完整实现记录
- 快速启动指南 - 各功能的快速上手指南
- 问题修复记录 - Bug修复和解决方案
- 测试文档 - 测试脚本和验证清单

**注意**：开发文档主要用于开发团队内部参考，包含了开发过程中的详细记录、问题排查和测试文档。

## 🔧 开发命令

```bash
# 启动开发服务器（前端+后端）
npm run dev

# 仅启动前端
npm run client:dev

# 仅启动后端
npm run server:dev

# 构建生产版本
npm run build

# 数据库迁移
cd server && npm run db:migrate

# Ollama支持迁移（如果已有数据库）
cd server && npm run db:migrate:ollama
```

## 🌟 使用示例

### 1. 配置AI服务

**选项A：使用云端API**
```
1. 进入"API配置"页面
2. 选择AI模型（DeepSeek/Gemini）
3. 输入API Key
4. 保存配置
```

**选项B：使用本地Ollama（推荐）**
```
1. 确保Ollama已安装并运行
2. 进入"API配置"页面
3. 选择"本地Ollama"
4. 系统自动检测已安装的模型
5. 选择模型并测试连接
6. 保存配置
```

### 2. 关键词蒸馏
```
1. 进入"关键词蒸馏"页面
2. 输入关键词，如"英国留学"
3. 点击"开始蒸馏"
4. 查看生成的话题列表
```

### 3. 创建企业资源（推荐）

**企业图库**
```
1. 进入"企业图库"页面
2. 创建相册
3. 上传图片（支持批量，最多20张）
4. 管理和组织图片资源
```

**企业知识库**
```
1. 进入"企业知识库"页面
2. 创建知识库
3. 上传文档（txt、md、pdf、doc、docx）
4. 系统自动提取文本内容
5. 支持全文搜索
```

**文章设置**
```
1. 进入"文章设置"页面
2. 创建设置模板
3. 配置字数、风格、要求
4. 保存模板供后续使用
```

**转化目标（可选）**
```
1. 进入"转化目标"页面
2. 创建转化目标
3. 配置类型和内容（电话、邮箱、网址等）
4. 在文章中自动嵌入
```

### 4. 批量生成文章（推荐）
```
1. 进入"文章生成任务"页面
2. 点击"创建任务"
3. 选择蒸馏历史、图库、知识库、文章设置
4. 可选择转化目标
5. 设置文章数量（1-100）
6. 系统后台自动生成
7. 查看任务状态和生成的文章
```

### 5. 单篇生成文章
```
1. 在话题列表中选择话题
2. 点击"生成文章"
3. 选择要使用的知识库（可选）
4. 输入文章要求
5. AI基于知识库生成专业文章
6. 复制或下载文章
```

## 🔐 安全特性

- ✅ API密钥加密存储
- ✅ 环境变量管理敏感信息
- ✅ SQL注入防护
- ✅ XSS攻击防护
- ✅ CORS安全配置

## 📈 性能优化

- ✅ 数据库索引优化
- ✅ 前端代码分割
- ✅ API响应缓存
- ✅ 图片懒加载
- ✅ Gzip压缩

## 🎯 应用场景

- **品牌营销**: 提升品牌在AI平台的曝光率
- **SEO优化**: 生成高质量SEO优化文章
- **内容创作**: 快速生成专业内容，引用企业知识库
- **批量生产**: 通过任务系统批量生成文章，提高效率
- **市场研究**: 分析用户搜索意图
- **知识管理**: 系统化管理企业知识资产
- **资源管理**: 统一管理企业图片和文档资源
- **转化优化**: 在文章中自然嵌入转化目标

## 🔮 未来规划

### 已完成 ✅
- [x] 本地Ollama模型支持
- [x] 腾讯EdgeOne云部署方案
- [x] 架构适配性评估
- [x] 文章生成任务系统
- [x] 文章设置模板管理
- [x] 转化目标管理
- [x] 企业图库和知识库
- [x] 批量文章生成
- [x] 任务监控和诊断

### 进行中 🚧
- [ ] 完整文档系统
- [ ] 性能监控和优化
- [ ] 安全加固

### 计划中 📋
- [ ] 用户认证和权限管理
- [ ] 文章质量评分系统
- [ ] 任务优先级管理
- [ ] 数据分析面板
- [ ] 多语言支持
- [ ] 移动端应用
- [ ] 更多AI模型集成（Claude、LLaMA等）
- [ ] CI/CD自动化部署
- [ ] 微服务架构升级

## 🔧 故障排除

### 快速诊断

如果遇到问题，首先运行系统诊断脚本：

```bash
./scripts/diagnose.sh
```

该脚本会自动检查：
- Node.js 和 npm 安装状态
- PostgreSQL 数据库状态
- 端口占用情况
- 配置文件完整性
- 项目依赖安装状态
- 数据库连接和表结构

### 常见问题

#### 1. 数据库连接失败

**症状**：启动时提示数据库连接错误，API调用失败

**原因**：PostgreSQL 服务未运行

**解决方案**：
```bash
# macOS (Homebrew)
brew services start postgresql@14

# Linux (systemd)
sudo systemctl start postgresql

# 验证数据库状态
pg_isready -h localhost -p 5432
```

**说明**：`start.command` 脚本已集成自动检查和启动功能，会在启动时自动检测并尝试启动 PostgreSQL。

#### 2. 端口被占用

**症状**：启动失败，提示端口 3000 或 5173 被占用

**解决方案**：
```bash
# 查看占用进程
lsof -i :3000
lsof -i :5173

# 停止占用进程
kill -9 <PID>
```

#### 3. 依赖安装问题

**症状**：启动时提示模块未找到

**解决方案**：
```bash
# 重新安装所有依赖
npm run install:all

# 或清除缓存后重装
rm -rf node_modules server/node_modules client/node_modules
npm run install:all
```

#### 4. 数据库表不存在

**症状**：API调用返回表不存在错误

**解决方案**：
```bash
# 运行数据库迁移
cd server
npm run migrate
```

### 诊断工具

项目提供了两个诊断脚本：

1. **系统诊断** (`scripts/diagnose.sh`)
   - 全面检查系统状态
   - 识别常见问题
   - 提供修复建议

2. **数据库检查** (`scripts/check-database.sh`)
   - 详细检查数据库状态
   - 验证数据库连接
   - 列出数据库表结构

更多详情请查看 [scripts/README.md](scripts/README.md)

---

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 💬 联系方式

- 📧 Email: your-email@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-repo/discussions)

## 🙏 致谢

感谢以下开源项目：
- [React](https://reactjs.org/)
- [Ant Design](https://ant.design/)
- [Express](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/)

---

<div align="center">

**GEO优化系统** - 让您的品牌在AI时代脱颖而出 🚀

Made with ❤️ by Your Team

</div>
