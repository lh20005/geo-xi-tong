# 构建说明

## 📦 构建Windows安装包

### 前置条件

1. **Node.js环境**
   - Node.js 18+
   - npm 或 yarn

2. **应用图标** ⚠️ 必需
   - 文件名: `icon.ico`
   - 位置: `build/icon.ico`
   - 尺寸: 256x256或更大
   - 格式: ICO (Windows图标格式)

### 准备图标文件

#### 方法1: 使用在线工具（推荐）

1. 准备一个PNG格式的图标（512x512或1024x1024）
2. 访问以下任一在线转换工具：
   - https://www.icoconverter.com/
   - https://convertio.co/png-ico/
   - https://icoconvert.com/
3. 上传PNG文件，选择多尺寸ICO输出
4. 下载生成的`icon.ico`文件
5. 将文件放到`build/icon.ico`

#### 方法2: 使用ImageMagick

```bash
# 安装ImageMagick
# Windows: https://imagemagick.org/script/download.php
# macOS: brew install imagemagick

# 转换PNG到ICO
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

#### 方法3: 使用在线AI生成

如果没有图标，可以使用AI工具生成：
- DALL-E: https://openai.com/dall-e-2
- Midjourney: https://www.midjourney.com/
- Stable Diffusion: https://stablediffusionweb.com/

提示词示例：
```
"A modern, minimalist app icon for a login manager application, 
featuring a key or lock symbol, blue and white color scheme, 
flat design, professional, clean, 512x512"
```

### 构建步骤

#### 1. 安装依赖

```bash
cd windows-login-manager
npm install
```

#### 2. 验证图标文件

```bash
# Windows
dir build\icon.ico

# macOS/Linux
ls -la build/icon.ico
```

确保文件存在且大小合理（通常50KB-500KB）。

#### 3. 构建应用

```bash
npm run build:win
```

这个命令会：
1. 编译TypeScript代码（`npm run build:electron`）
2. 构建React应用（`vite build`）
3. 打包Electron应用（`electron-builder --win`）

#### 4. 查看构建产物

构建完成后，在`release/`目录下会生成：

```
release/
├── platform-login-manager-1.0.0-setup.exe    # NSIS安装程序
├── platform-login-manager-1.0.0.exe          # 便携版（可选）
└── win-unpacked/                             # 未打包的应用文件
    ├── platform-login-manager.exe
    ├── resources/
    └── ...
```

### 构建配置

构建配置在`package.json`的`build`字段中：

```json
{
  "build": {
    "appId": "com.yourcompany.platform-login-manager",
    "productName": "平台登录管理器",
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
      "createStartMenuShortcut": true,
      "perMachine": false,
      "allowElevation": true,
      "installerIcon": "build/icon.ico",
      "uninstallerIcon": "build/icon.ico",
      "installerHeaderIcon": "build/icon.ico",
      "deleteAppDataOnUninstall": true
    },
    "publish": {
      "provider": "generic",
      "url": "https://your-update-server.com/updates"
    }
  }
}
```

### 测试安装包

#### 1. 安装测试

```bash
# 运行安装程序
release/platform-login-manager-1.0.0-setup.exe
```

测试项目：
- [ ] 安装程序正常启动
- [ ] 可以选择安装位置
- [ ] 创建桌面快捷方式
- [ ] 创建开始菜单快捷方式
- [ ] 安装完成后可以启动应用

#### 2. 应用测试

启动应用后测试：
- [ ] 应用图标正确显示
- [ ] 窗口标题正确
- [ ] 所有页面可以访问
- [ ] 登录功能正常
- [ ] 账号管理功能正常
- [ ] 设置功能正常
- [ ] 日志功能正常

#### 3. 卸载测试

```bash
# 通过控制面板卸载
# 或运行卸载程序
```

测试项目：
- [ ] 卸载程序正常运行
- [ ] 应用文件被删除
- [ ] 快捷方式被删除
- [ ] 用户数据保留（可选）

### 常见问题

#### 问题1: 找不到icon.ico

**错误信息**:
```
Error: Cannot find icon file: build/icon.ico
```

**解决方法**:
1. 确认`build/icon.ico`文件存在
2. 检查文件路径是否正确
3. 确保文件格式是ICO而不是PNG

#### 问题2: 构建失败

**错误信息**:
```
Error: Build failed
```

**解决方法**:
```bash
# 清理并重新构建
rm -rf dist dist-electron release
npm run build:electron
npm run build:win
```

#### 问题3: 安装包太大

**原因**: 包含了不必要的文件

**解决方法**:
1. 检查`package.json`的`files`字段
2. 确保只包含必要的文件
3. 使用`.gitignore`排除不需要的文件

#### 问题4: 应用启动失败

**原因**: 缺少依赖或配置错误

**解决方法**:
1. 检查`package.json`的`dependencies`
2. 确保所有依赖都已安装
3. 检查日志文件: `%APPDATA%/platform-login-manager/logs/`

### 高级配置

#### 自定义安装程序

修改`package.json`的`nsis`配置：

```json
{
  "nsis": {
    "oneClick": false,              // 允许自定义安装
    "perMachine": false,            // 用户级安装
    "allowElevation": true,         // 允许提升权限
    "installerLanguages": ["zh_CN"], // 安装程序语言
    "license": "LICENSE.txt",       // 许可协议
    "warningsAsErrors": false       // 警告不作为错误
  }
}
```

#### 多平台构建

```bash
# 构建Windows版本
npm run build:win

# 构建macOS版本（需要在macOS上）
npm run build:mac

# 构建Linux版本
npm run build:linux

# 构建所有平台
npm run build
```

#### 便携版构建

修改`package.json`的`win.target`：

```json
{
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      },
      {
        "target": "portable",
        "arch": ["x64"]
      }
    ]
  }
}
```

### 发布流程

#### 1. 版本管理

```bash
# 更新版本号
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

#### 2. 构建发布版本

```bash
# 构建
npm run build:win

# 验证构建产物
ls -la release/
```

#### 3. 上传到服务器

```bash
# 上传到更新服务器
scp release/*.exe user@server:/path/to/updates/

# 或使用GitHub Releases
gh release create v1.0.0 release/*.exe
```

#### 4. 更新配置

更新`package.json`的`publish.url`：

```json
{
  "publish": {
    "provider": "generic",
    "url": "https://your-update-server.com/updates"
  }
}
```

### 自动化构建

#### GitHub Actions

创建`.github/workflows/build.yml`：

```yaml
name: Build

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build:win
      - uses: actions/upload-artifact@v2
        with:
          name: windows-installer
          path: release/*.exe
```

### 性能优化

#### 减小安装包大小

1. **使用asar压缩**（默认启用）
2. **排除开发依赖**
3. **使用webpack优化**
4. **压缩资源文件**

#### 加快构建速度

1. **使用缓存**
2. **并行构建**
3. **增量构建**

### 安全建议

1. **代码签名**
   - 获取代码签名证书
   - 配置electron-builder签名

2. **病毒扫描**
   - 构建后扫描安装包
   - 确保无误报

3. **完整性验证**
   - 生成SHA256校验和
   - 提供给用户验证

### 总结

完成以上步骤后，你将获得：
- ✅ 专业的Windows安装程序
- ✅ 正确的应用图标
- ✅ 完整的安装/卸载流程
- ✅ 自动更新支持

**下一步**: 测试安装包并分发给用户！
