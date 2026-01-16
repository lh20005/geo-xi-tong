# Web 前端归档说明

**归档日期**: 2026-01-16  
**原目录名**: `client/`  
**新目录名**: `client-archived-web-frontend/`

---

## ⚠️ 重要说明

此目录是原 Web 前端应用的归档版本，**已不再使用**。

---

## 📋 归档原因

根据架构改造方案，系统已从 Web 应用转变为桌面应用：

- ❌ **Web 前端**（此目录）- 已废弃
- ✅ **Windows 桌面客户端**（`windows-login-manager/`）- 当前使用

---

## 🎯 当前架构

### 服务器端
- 后端 API（`server/`）
- 落地页（`landing/`）

### 客户端
- Windows 桌面应用（`windows-login-manager/`）
  - 包含完整的前端界面
  - 本地数据存储（SQLite）
  - 本地浏览器自动化
  - 本地发布执行

---

## 🔄 如何恢复（如果需要）

如果将来需要恢复 Web 前端：

```bash
# 1. 重命名回原名称
mv client-archived-web-frontend client

# 2. 安装依赖
cd client
npm install

# 3. 启动开发服务器
npm run dev

# 4. 恢复服务器部署
# 参考 docs/03-部署指南/ 中的相关文档
```

---

## 📚 相关文档

- [改造方案](../改造方案-最终版.md)
- [架构改造完成报告](../docs/07-开发文档/架构改造完成报告.md)
- [服务器前端移除完成报告](../docs/07-开发文档/服务器前端移除完成报告.md)

---

## 🗂️ 目录内容

此目录包含完整的 React Web 应用代码：

```
client-archived-web-frontend/
├── src/                 # 源代码
│   ├── api/            # API 客户端
│   ├── components/     # React 组件
│   ├── pages/          # 页面组件
│   ├── services/       # 服务层
│   └── ...
├── public/             # 静态资源
├── package.json        # 依赖配置
├── vite.config.ts      # Vite 配置
└── ...
```

---

## ⚠️ 注意事项

1. **不要在此目录进行开发** - 所有新功能应在 `windows-login-manager/` 中实现
2. **不要部署此代码** - 服务器已移除 Web 前端支持
3. **仅作为参考和备份** - 如需查看旧代码或恢复功能时使用

---

## 📞 联系方式

如有疑问，请参考项目文档或联系开发团队。
