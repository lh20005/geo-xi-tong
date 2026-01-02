# 项目结构

## 根目录布局

```
geo-optimization-system/
├── client/              # 主前端应用（React）
├── server/              # 后端 API（Node.js/Express）
├── landing/             # 营销落地页
├── windows-login-manager/  # Electron 桌面应用（登录管理器）
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

## 平台适配器模式 (server/src/services/adapters/)

每个内容平台都有一个继承 `PlatformAdapter` 的适配器：

```
adapters/
├── PlatformAdapter.ts   # 抽象基类
├── AdapterRegistry.ts   # 适配器注册和查找
├── XiaohongshuAdapter.ts  # 小红书
├── DouyinAdapter.ts     # 抖音
├── ToutiaoAdapter.ts    # 头条号
├── ZhihuAdapter.ts      # 知乎
├── BaijiahaoAdapter.ts  # 百家号
├── WangyiAdapter.ts     # 网易号
├── SohuAdapter.ts       # 搜狐号
├── CSDNAdapter.ts       # CSDN
├── JianshuAdapter.ts    # 简书
├── WechatAdapter.ts     # 微信公众号
├── QieAdapter.ts        # 企鹅号
└── BilibiliAdapter.ts   # B站
```

## 关键架构模式

1. **服务层模式**：业务逻辑在 `services/`，路由只做薄控制器
2. **适配器模式**：通过适配器实现平台特定的发布逻辑
3. **多租户**：通过 `tenantContext` 中间件实现用户数据隔离
4. **迁移系统**：`db/migrations/` 中的版本化 SQL 迁移
5. **WebSocket 同步**：通过 `WebSocketService` 实现实时更新

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
