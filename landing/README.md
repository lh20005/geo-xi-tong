# GEO优化系统 - 宣传网站

高端商务风格的营销网站，用于宣传GEO优化系统。

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

2. **登录页** (`/login`)
   - 用户名/密码登录
   - 调用后端 `/api/auth/login` 接口
   - 登录成功后跳转到系统应用 (5173端口)

### 认证流程

```
用户在宣传网站登录 (8080)
  ↓
调用后端API (3000/api/auth/login)
  ↓
获取JWT token
  ↓
跳转到系统应用 (5173)
  ↓
系统应用验证token
```

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

## 联系方式

如需定制或技术支持，请联系：
- 邮箱: contact@example.com
- 电话: 400-xxx-xxxx
