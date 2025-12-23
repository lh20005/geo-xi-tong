# 🚀 GEO宣传网站 - 5分钟快速开始

## 📋 前提条件

- ✅ Node.js 18+ 已安装
- ✅ 后端服务运行在 3000 端口
- ✅ 系统应用运行在 5173 端口

## ⚡ 快速启动（3步）

### 1️⃣ 安装依赖

```bash
cd landing
npm install
```

### 2️⃣ 启动开发服务器

```bash
npm run dev
```

### 3️⃣ 访问网站

打开浏览器访问: **http://localhost:8080**

## 🧪 测试登录流程

1. 点击页面上的"登录"按钮
2. 输入用户名: `admin`
3. 输入密码: `admin123`
4. 点击"登录"
5. ✅ 自动跳转到系统应用 (http://localhost:5173)

## 📁 项目结构

```
landing/
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx      # 首页（需完善）⚠️
│   │   └── LoginPage.tsx     # 登录页 ✅
│   ├── App.tsx               # 路由 ✅
│   └── main.tsx              # 入口 ✅
├── package.json              # 端口: 8080 ✅
└── vite.config.ts            # Vite配置 ✅
```

## ⚠️ 重要提示

### HomePage.tsx 需要完善

当前HomePage只有基础框架，需要添加以下内容：

1. **GEO趋势部分** - 为什么需要GEO优化
2. **核心功能部分** - 3大功能 + 4个辅助功能
3. **产品优势部分** - 6大核心优势
4. **价格方案部分** - 基础版/专业版/企业版
5. **CTA部分** - 最终行动号召
6. **Footer部分** - 页脚链接

### 如何完善

参考 `landing/SUMMARY.md` 中的代码块，将内容添加到HomePage.tsx中。

## 🎨 设计风格

- **配色**: 蓝色(#2563EB) + 紫色(#9333EA)
- **风格**: 高端、商务、专业
- **响应式**: 完美适配桌面和移动端

## 🔧 常用命令

```bash
# 开发
npm run dev          # 启动开发服务器 (8080)

# 构建
npm run build        # 构建生产版本

# 预览
npm run preview      # 预览生产版本 (8080)
```

## 🌐 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| 宣传网站 | 8080 | 你正在开发的 |
| 系统应用 | 5173 | 登录后跳转到这里 |
| 后端API | 3000 | 提供登录接口 |

## 🐛 常见问题

### Q: 登录后没有跳转？

**A**: 检查系统应用是否运行在5173端口

```bash
cd client
npm run dev
```

### Q: 登录失败？

**A**: 检查后端服务是否运行在3000端口

```bash
cd server
npm run dev
```

### Q: 端口被占用？

**A**: 修改 `vite.config.ts` 中的端口号

```typescript
server: {
  port: 8081,  // 改成其他端口
}
```

## 📚 更多文档

- `landing/README.md` - 完整项目说明
- `landing/SUMMARY.md` - 项目总结和待办
- `LANDING_DEPLOYMENT_GUIDE.md` - 腾讯云部署指南

## 💬 需要帮助？

- 📧 Email: contact@example.com
- 📞 Phone: 400-xxx-xxxx

---

**开始开发吧！** 🎉
