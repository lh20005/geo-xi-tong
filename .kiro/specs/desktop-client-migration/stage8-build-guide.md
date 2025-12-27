# Stage 8 构建和发布指南

## 概述
本指南提供桌面客户端的构建、打包和发布流程。

---

## 📋 准备工作

### 1. 环境检查

#### Node.js 版本
```bash
node --version  # 应该 >= 18.0.0
npm --version   # 应该 >= 9.0.0
```

#### 依赖安装
```bash
cd windows-login-manager
npm install
```

#### 构建测试
```bash
# TypeScript 编译检查
npm run type-check

# Electron 主进程构建
npm run build:electron

# 前端构建测试
npm run build
```

### 2. 配置检查

#### package.json 配置
```json
{
  "name": "platform-login-manager",
  "version": "1.0.0",
  "description": "Windows平台登录管理器 - 基于Electron的桌面应用",
  "main": "dist-electron/main.js",
  "author": "Your Company",
  "license": "MIT"
}
```

#### electron-builder 配置
```json
{
  "build": {
    "appId": "com.yourcompany.platform-login-manager",
    "productName": "平台登录管理器",
    "asar": true,
    "directories": {
      "output": "release",
      "buildResources": "build"
    },
    "files": [
      "dist/**/*",
      "dist-electron/**/*",
      "package.json"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

---

## 🔨 构建流程

### Step 1: 清理旧构建

```bash
# 清理 dist 目录
rm -rf dist

# 清理 dist-electron 目录
rm -rf dist-electron

# 清理 release 目录
rm -rf release
```

### Step 2: 构建 Electron 主进程

```bash
npm run build:electron
```

**预期输出**:
```
> platform-login-manager@1.0.0 build:electron
> tsc -p electron/tsconfig.json

✓ Electron 主进程构建成功
```

**验证**:
```bash
ls -la dist-electron/
# 应该看到 main.js 和其他编译后的文件
```

### Step 3: 构建前端

```bash
npm run build
```

**预期输出**:
```
> platform-login-manager@1.0.0 build
> vite build

vite v5.0.7 building for production...
✓ 1234 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.30 kB
dist/assets/index-abc123.css     12.34 kB │ gzip:  3.45 kB
dist/assets/index-def456.js     234.56 kB │ gzip: 78.90 kB
✓ built in 12.34s
```

**验证**:
```bash
ls -la dist/
# 应该看到 index.html 和 assets 目录
```

### Step 4: 打包应用

```bash
npm run build
```

这将执行完整的构建流程：
1. 构建 Electron 主进程
2. 构建前端
3. 使用 electron-builder 打包

**预期输出**:
```
• electron-builder  version=24.9.1
• loaded configuration  file=package.json
• building        target=nsis arch=x64
• packaging       platform=win32 arch=x64
• building block map  blockMapFile=release\平台登录管理器 Setup 1.0.0.exe.blockmap
• building        target=nsis file=release\平台登录管理器 Setup 1.0.0.exe
```

**验证**:
```bash
ls -la release/
# 应该看到安装程序文件
```

---

## 📦 打包配置

### 图标准备

#### Windows 图标
- **文件**: `build/icon.ico`
- **尺寸**: 256x256 (推荐)
- **格式**: ICO

#### 创建图标
```bash
# 如果没有图标，可以使用默认图标
mkdir -p build
# 将图标文件复制到 build/icon.ico
```

### NSIS 安装程序配置

#### 基础配置
```json
{
  "nsis": {
    "oneClick": false,                    // 允许用户选择安装目录
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,        // 创建桌面快捷方式
    "createStartMenuShortcut": true,      // 创建开始菜单快捷方式
    "perMachine": false,                  // 为当前用户安装
    "allowElevation": true,               // 允许提升权限
    "installerIcon": "build/icon.ico",
    "uninstallerIcon": "build/icon.ico",
    "deleteAppDataOnUninstall": true,     // 卸载时删除应用数据
    "runAfterFinish": true                // 安装后运行应用
  }
}
```

#### 自定义安装脚本（可选）
```nsh
# build/installer.nsh
!macro customInstall
  # 自定义安装逻辑
!macroend

!macro customUnInstall
  # 自定义卸载逻辑
!macroend
```

---

## 🚀 发布流程

### 本地测试

#### 1. 安装测试
```bash
# 找到安装程序
cd release
# 双击运行安装程序
# 平台登录管理器 Setup 1.0.0.exe
```

#### 2. 功能测试
- [ ] 应用启动正常
- [ ] 登录功能正常
- [ ] 所有页面可访问
- [ ] API 调用正常
- [ ] 数据持久化正常

#### 3. 性能测试
- [ ] 启动时间 < 5秒
- [ ] 内存使用 < 500MB
- [ ] CPU 使用正常
- [ ] 响应速度快

### 版本管理

#### 更新版本号
```bash
# 更新 package.json 中的版本号
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

#### 创建 Git 标签
```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### 自动更新配置

#### electron-updater 配置
```json
{
  "publish": {
    "provider": "generic",
    "url": "https://your-update-server.com/updates"
  }
}
```

#### 更新服务器
- 需要搭建更新服务器
- 上传新版本文件
- 提供版本检查接口

---

## 📝 发布清单

### 构建前检查
- [ ] 代码已提交到 Git
- [ ] 版本号已更新
- [ ] 更新日志已编写
- [ ] 依赖已更新到最新稳定版
- [ ] TypeScript 编译通过
- [ ] 所有测试通过

### 构建检查
- [ ] Electron 主进程构建成功
- [ ] 前端构建成功
- [ ] 安装程序生成成功
- [ ] 文件大小合理（< 300MB）

### 测试检查
- [ ] 安装程序可正常安装
- [ ] 应用可正常启动
- [ ] 所有功能正常工作
- [ ] 性能达标
- [ ] 无明显 bug

### 发布检查
- [ ] 安装程序已签名（可选）
- [ ] 更新服务器已配置
- [ ] 文档已更新
- [ ] 发布说明已准备

---

## 🔧 常见问题

### 构建失败

#### 问题：TypeScript 编译错误
```bash
# 检查错误信息
npm run type-check

# 修复类型错误后重新构建
```

#### 问题：依赖缺失
```bash
# 重新安装依赖
rm -rf node_modules
npm install
```

#### 问题：打包失败
```bash
# 检查 electron-builder 配置
# 确保所有必需文件存在
# 检查 build 目录中的图标文件
```

### 运行问题

#### 问题：应用无法启动
- 检查 Electron 主进程日志
- 检查渲染进程控制台
- 验证所有依赖已正确打包

#### 问题：白屏
- 检查前端构建是否成功
- 检查 index.html 路径
- 检查控制台错误信息

#### 问题：API 调用失败
- 检查后端服务是否运行
- 检查 API 地址配置
- 检查网络连接

---

## 📚 文档完善

### 用户文档

#### README.md
```markdown
# 平台登录管理器

## 简介
基于 Electron 的桌面应用，提供平台登录管理和内容管理功能。

## 安装
1. 下载安装程序
2. 双击运行安装
3. 按照提示完成安装

## 使用
1. 启动应用
2. 登录账号
3. 开始使用

## 系统要求
- Windows 10 或更高版本
- 4GB RAM
- 500MB 磁盘空间
```

#### 使用手册
- 功能介绍
- 操作指南
- 常见问题
- 故障排除

### 开发文档

#### 开发指南
- 环境搭建
- 项目结构
- 开发流程
- 调试方法

#### API 文档
- API 接口说明
- IPC 方法说明
- 数据结构定义

---

## 🎉 完成标志

### 构建成功标志
- ✅ TypeScript 编译通过
- ✅ Electron 构建成功
- ✅ 前端构建成功
- ✅ 安装程序生成成功

### 测试成功标志
- ✅ 安装测试通过
- ✅ 功能测试通过
- ✅ 性能测试通过
- ✅ 用户体验良好

### 发布成功标志
- ✅ 安装程序可用
- ✅ 文档完善
- ✅ 版本标签创建
- ✅ 更新服务器配置（可选）

---

## 📈 后续工作

### 持续维护
- 收集用户反馈
- 修复 bug
- 优化性能
- 添加新功能

### 版本迭代
- 定期发布更新
- 保持依赖更新
- 改进用户体验
- 增强安全性

---

## 📞 支持

### 技术支持
- 邮箱: support@yourcompany.com
- 文档: https://docs.yourcompany.com
- 社区: https://community.yourcompany.com

### 问题反馈
- GitHub Issues
- 用户反馈表单
- 技术支持邮箱
