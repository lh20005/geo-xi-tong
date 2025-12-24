# GEO优化系统 - 宣传网站

高端商务风格的营销网站，用于宣传GEO优化系统。包含完整的用户认证和管理功能。

## 端口配置

- **开发环境**: `http://localhost:8080`
- **后端API**: `http://localhost:3000`
- **系统应用**: `http://localhost:5173`

## 快速开始

### 1. 安装依赖

```bash
cd landing
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:8080` 查看网站

### 3. 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录

## 功能特点

### 页面结构

1. **首页** (`/`)
   - Hero区域：主标题、CTA按钮、数据展示
   - GEO趋势：为什么需要GEO优化
   - 核心功能：智能关键词蒸馏、AI内容生成、多平台发布
   - 产品优势：6大核心优势
   - 价格方案：基础版、专业版、企业版
   - CTA区域：引导试用
   - Footer：联系方式、链接

2. **注册页** (`/register`)
   - 用户名/密码注册
   - 可选邀请码输入
   - 实时用户名可用性检查
   - 密码强度指示器
   - 注册成功后自动登录

3. **登录页** (`/login`)
   - 用户名/密码登录
   - 调用后端 `/api/auth/login` 接口
   - 登录成功后跳转到系统应用 (5173端口)
   - 临时密码强制修改流程

4. **个人资料页** (`/profile`)
   - 查看个人信息
   - 邀请码展示和复制
   - 邀请统计（邀请人数、被邀请用户列表）
   - 修改密码功能

5. **用户管理页** (`/admin/users`) - 仅管理员
   - 用户列表（分页、搜索）
   - 查看用户详情
   - 编辑用户信息（用户名、角色）
   - 重置用户密码
   - 删除用户
   - 实时数据同步（WebSocket）

### 认证流程

```
用户在宣传网站注册/登录 (8080)
  ↓
调用后端API (3000/api/auth/register 或 /login)
  ↓
获取JWT token 和 refresh token
  ↓
存储到 localStorage
  ↓
跳转到系统应用 (5173) 或 个人资料页
  ↓
系统应用验证token
```

### 用户管理功能

#### 邀请系统
- 每个用户都有唯一的6位邀请码
- 注册时可选填邀请码建立推荐关系
- 查看自己邀请了多少人
- 查看被邀请用户列表

#### 管理员功能
- 查看所有用户列表
- 搜索用户（按用户名）
- 分页浏览用户
- 查看用户详细信息和邀请统计
- 编辑用户信息（用户名、角色）
- 重置用户密码（生成临时密码）
- 删除用户

#### 实时同步
- 使用 WebSocket 实现跨平台实时同步
- 用户信息更新时，所有平台立即同步
- 用户被删除时，所有会话立即终止
- 密码被修改时，旧令牌立即失效

#### 安全特性
- 登录限流：15分钟内最多5次失败尝试
- 注册限流：每小时最多3次注册
- 密码 bcrypt 哈希（10轮盐）
- JWT 令牌认证（1小时有效期）
- 刷新令牌（7天有效期）
- 会话管理和令牌失效

## 腾讯云部署方案

### 使用Nginx反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 宣传网站
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 系统应用
    location /app {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 后端API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 启动服务

```bash
# 1. 启动后端
cd server
npm run start

# 2. 启动系统应用
cd client
npm run build
npm run preview

# 3. 启动宣传网站
cd landing
npm run build
npm run preview

# 4. 启动Nginx
sudo nginx -s reload
```

## 营销内容亮点

### GEO优化趋势
- 58%用户查询已转向AI
- 传统SEO流量持续下降
- AI搜索时代已经到来
- 普林斯顿大学2023年提出GEO概念

### 核心卖点
1. **提升AI推荐率30-80%** - 基于普林斯顿大学研究
2. **10倍内容生产效率** - 批量自动化生成
3. **全流程AI优化** - 从分析到发布一站式
4. **多平台智能发布** - 10+主流平台支持
5. **企业级数据安全** - 本地部署，数据可控
6. **科学的GEO方法论** - 学术研究支撑

### 目标用户
- 品牌营销团队
- 内容运营团队
- SEO/SEM团队
- 企业市场部
- 数字营销机构

## 设计风格

- **配色**: 蓝色(#2563EB) + 紫色(#9333EA) 渐变
- **风格**: 高端、商务、专业
- **交互**: 流畅的动画和过渡效果
- **响应式**: 完美适配桌面和移动端

## 技术栈

- React 18
- TypeScript
- Tailwind CSS
- React Router
- Axios
- Vite

## 待完善功能

- [ ] 移动端菜单
- [ ] 产品演示视频
- [ ] 客户案例展示
- [ ] 博客文章
- [ ] 在线客服
- [ ] 数据统计（Google Analytics）
- [ ] 邮箱验证
- [ ] 密码找回功能
- [ ] 双因素认证（2FA）
- [ ] 社交登录（OAuth）

## API 文档

详细的用户管理 API 文档请参考：
- [用户管理 API 文档](../server/docs/USER_MANAGEMENT_API.md)
- [用户管理功能说明](../server/docs/USER_MANAGEMENT_README.md)

## 联系方式

如需定制或技术支持，请联系：
- 邮箱: contact@example.com
- 电话: 400-xxx-xxxx
