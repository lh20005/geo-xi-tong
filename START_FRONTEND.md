# 🚀 启动前端服务器

## 问题原因
新添加的 `PublishingRecordsPage.tsx` 文件需要前端开发服务器重启才能识别。

## 解决方案

### 方法1: 使用终端启动（推荐）

```bash
# 进入client目录
cd client

# 启动开发服务器
npm run dev
```

### 方法2: 使用Kiro启动

在Kiro中打开终端，然后运行：
```bash
cd client && npm run dev
```

## 验证步骤

1. 等待服务器启动完成（看到 "Local: http://localhost:5173"）
2. 打开浏览器访问 http://localhost:5173
3. 点击左侧菜单的"发布记录"
4. 应该能正常进入发布记录页面

## 如果还是不行

### 检查1: 清除缓存
```bash
cd client
rm -rf node_modules/.vite
npm run dev
```

### 检查2: 重新安装依赖
```bash
cd client
rm -rf node_modules
npm install
npm run dev
```

### 检查3: 检查浏览器控制台
1. 打开浏览器开发者工具 (F12)
2. 查看Console标签页
3. 查看是否有错误信息

## 常见错误

### 错误1: "Cannot find module"
**解决**: 重新安装依赖
```bash
cd client
npm install
```

### 错误2: 端口被占用
**解决**: 更换端口或关闭占用端口的进程
```bash
# 查找占用5173端口的进程
lsof -i :5173

# 杀死进程（替换PID为实际进程ID）
kill -9 PID
```

### 错误3: 页面空白
**解决**: 检查浏览器控制台错误，通常是导入路径问题

## 后端服务器

如果后端也没运行，需要同时启动：

```bash
# 新开一个终端
cd server
npm run dev
```

## 完整启动流程

```bash
# 终端1: 启动后端
cd server
npm run dev

# 终端2: 启动前端
cd client
npm run dev
```

然后访问: http://localhost:5173

---

**提示**: 每次添加新页面或组件后，如果热重载没有生效，建议重启开发服务器。
