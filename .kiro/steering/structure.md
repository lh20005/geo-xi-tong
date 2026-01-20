# 项目结构

## 根目录布局

```
geo-optimization-system/
├── client/              # 主前端应用（React）- Web 端
├── server/              # 后端 API（Node.js/Express）- 数据存储
├── landing/             # 营销落地页
├── windows-login-manager/  # Electron 桌面应用（登录管理 + 本地发布）
├── docs/                # 文档目录（按类别组织）
├── dev-docs/            # 开发文档
├── scripts/             # 工具脚本（部署、测试、安全）
├── config/              # 配置文件（nginx 等）
├── backups/             # 数据库和文档备份
└── temp/                # 临时文件
```

## 前端结构 (client/src/)

```
src/
├── api/                 # API 客户端函数（基于 axios）
├── components/          # 可复用 React 组件
│   ├── Dashboard/       # 仪表盘相关组件
│   ├── Layout/          # 布局组件（头部、侧边栏）
│   └── Publishing/      # 发布功能组件
├── config/              # 环境配置
├── constants/           # 常量（提示词模板等）
├── pages/               # 页面组件（每个路由一个）
├── services/            # WebSocket 和其他服务
├── styles/              # CSS 文件
├── types/               # TypeScript 类型定义
├── utils/               # 工具函数
├── App.tsx              # 根组件（含路由）
└── main.tsx             # 入口文件
```

## 后端结构 (server/src/)

```
src/
├── config/              # 服务器配置（浏览器、功能开关）
├── db/                  # 数据库层
│   ├── migrations/      # SQL 迁移文件
│   ├── database.ts      # PostgreSQL 连接
│   ├── redis.ts         # Redis 连接
│   └── migrate.ts       # 迁移执行器
├── errors/              # 自定义错误类
├── middleware/          # Express 中间件
│   ├── adminAuth.ts     # 管理员认证
│   ├── checkPermission.ts  # RBAC 权限检查
│   ├── rateLimit.ts     # 限流
│   └── tenantContext.ts # 多租户上下文
├── routes/              # API 路由处理器
│   ├── admin/           # 管理员专用路由
│   └── *.ts             # 功能路由
├── services/            # 业务逻辑层
│   ├── adapters/        # 平台发布适配器
│   └── *.ts             # 功能服务
├── scripts/             # 维护脚本
├── types/               # TypeScript 类型
├── utils/               # 工具函数
└── index.ts             # 服务器入口
```

## Electron 桌面应用结构 (windows-login-manager/)

```
windows-login-manager/
├── electron/                # Electron 主进程代码
│   ├── main.ts              # 应用入口
│   ├── preload.ts           # 预加载脚本（IPC 桥接）
│   ├── api/                 # 服务器 API 客户端
│   ├── ipc/                 # IPC 处理器
│   ├── login/               # 平台登录功能
│   ├── publishing/          # 本地发布功能（迁移自服务器）
│   │   ├── executor.ts      # 发布执行器
│   │   ├── browser.ts       # 浏览器自动化服务
│   │   ├── config.ts        # 浏览器配置
│   │   └── adapters/        # 12个平台适配器
│   ├── storage/             # 本地存储管理
│   ├── websocket/           # WebSocket 连接
│   └── security/            # 安全相关
├── src/                     # React 渲染进程代码
│   ├── api/                 # API 封装（复用服务器 API）
│   ├── pages/               # 页面组件
│   │   ├── PublishingTasksPage.tsx    # 发布任务管理
│   │   ├── PublishingRecordsPage.tsx  # 发布记录查看
│   │   └── ...
│   ├── components/          # 可复用组件
│   └── stores/              # 状态管理
└── package.json
```

## 平台适配器位置

**重要：本地发布迁移后，适配器存在于两个位置：**

| 位置 | 路径 | 用途 |
|------|------|------|
| 服务器（保留） | `server/src/services/adapters/` | Web 端发布（兼容） |
| Electron（新增） | `electron/publishing/adapters/` | 本地发布（主要） |

适配器列表（12个平台）：
- 小红书、抖音、头条号、知乎、百家号、网易号
- 搜狐号、CSDN、简书、微信公众号、企鹅号、B站

## 关键架构模式

1. **服务层模式**：业务逻辑在 `services/`，路由只做薄控制器
2. **适配器模式**：通过适配器实现平台特定的发布逻辑
3. **多租户**：通过 `tenantContext` 中间件实现用户数据隔离
4. **迁移系统**：`db/migrations/` 中的版本化 SQL 迁移
5. **WebSocket 同步**：通过 `WebSocketService` 实现实时更新
6. **本地发布架构**：Electron 应用通过 IPC 调用本地浏览器执行发布，通过 API 同步状态到服务器

## 发布功能架构

**本地发布模式（Electron 应用）**
```
用户操作 → React 页面 → IPC 调用 → Electron 主进程
                                        ↓
                              本地 PublishingExecutor
                                        ↓
                              本地 Playwright 浏览器
                                        ↓
                              调用服务器 API 同步状态
```

**服务器职责**：
- 数据存储（任务、记录、账号、文章）
- 状态同步 API
- 配额管理
- 发布记录创建

**Electron 职责**：
- 浏览器自动化执行
- 平台登录和发布
- 实时日志显示

## 文档组织 (docs/)

```
docs/
├── 00-项目管理/         # 项目管理
├── 01-快速开始/         # 快速入门指南
├── 02-功能说明/         # 功能详细文档
├── 03-部署指南/         # 部署指南
├── 04-安全指南/         # 安全文档
├── 05-测试指南/         # 测试指南
├── 06-问题修复/         # 问题修复记录
├── 07-开发文档/         # 开发文档
├── 08-用户界面文档/     # UI 文档
└── 09-安全评估/         # 安全评估报告
```
