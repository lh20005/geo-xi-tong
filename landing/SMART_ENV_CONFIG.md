# 🚀 智能环境配置说明

## 概述

营销网站现在支持智能环境检测，能够自动根据访问域名选择正确的配置，无需手动修改环境变量。

## 工作原理

系统会检测当前访问的域名，并自动选择对应的配置：

### 📍 本地开发环境
**检测条件：**
- `localhost`
- `127.0.0.1` 
- `192.168.x.x` (局域网)
- `10.x.x.x` (内网)
- `*.local` (本地域名)

**自动配置：**
- API URL: `http://localhost:3000/api`
- Client URL: `http://localhost:5173`

### 📍 远程开发环境  
**检测条件：**
- 非生产域名的远程IP或域名
- 例如：`43.143.163.6`

**自动配置：**
- API URL: `http://43.143.163.6/api`
- Client URL: `http://43.143.163.6`

### 📍 生产环境
**检测条件：**
- `import.meta.env.PROD` 为 `true`

**自动配置：**
- API URL: `https://your-domain.com/api`
- Client URL: `https://app.your-domain.com`

## 使用方法

### 1. 自动模式（推荐）
无需任何配置，系统自动检测环境：

```bash
# 本地开发
npm run dev  # 访问 http://localhost:8080

# 远程部署  
# 直接部署到服务器，系统自动检测远程环境
```

### 2. 手动覆盖模式
如果需要强制指定配置，在 `.env` 文件中设置：

```bash
# 强制使用本地配置
VITE_API_URL=http://localhost:3000/api
VITE_CLIENT_URL=http://localhost:5173

# 或强制使用远程配置
VITE_API_URL=http://43.143.163.6/api
VITE_CLIENT_URL=http://43.143.163.6
```

## 调试信息

在开发环境下，打开浏览器控制台可以看到详细的环境检测信息：

```javascript
[Landing Config] 🚀 智能环境检测结果: {
  hostname: "localhost",
  port: "8080", 
  detectedEnv: {
    isLocalDev: true,
    isRemoteDev: false,
    isProduction: false
  },
  selectedConfig: {
    apiUrl: "http://localhost:3000/api",
    clientUrl: "http://localhost:5173",
    environment: "local"
  }
}
```

## 优势

✅ **自动化**：无需手动修改配置文件  
✅ **智能检测**：根据访问域名自动选择配置  
✅ **开发友好**：本地开发时自动使用本地配置  
✅ **部署简单**：远程部署时自动使用远程配置  
✅ **灵活性**：支持手动覆盖配置  
✅ **调试方便**：提供详细的检测日志  

## 配置文件

- **智能配置逻辑**：`src/config/env.ts`
- **环境变量**：`.env` (可选)
- **配置示例**：`.env.example`
- **说明文档**：`SMART_ENV_CONFIG.md` (本文件)

## 故障排除

### 问题：点击"进入系统"跳转到错误的地址
**解决方案：**
1. 打开浏览器控制台查看环境检测日志
2. 确认检测到的环境是否正确
3. 如需强制指定，在 `.env` 文件中设置 `VITE_CLIENT_URL`

### 问题：API 请求失败
**解决方案：**
1. 检查控制台中的 `apiUrl` 配置
2. 确认对应的后端服务是否正常运行
3. 如需强制指定，在 `.env` 文件中设置 `VITE_API_URL`

---

**更新时间：** 2025-12-27  
**版本：** 1.0.0