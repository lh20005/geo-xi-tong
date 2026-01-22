# Electron 桌面应用打包发布规范

## 版本管理

### 当前版本
```
1.2.5
```

### 版本号规则（语义化版本）
| 类型 | 说明 | 示例 |
|------|------|------|
| Major | 重大功能更新、架构变更、不兼容变更 | 1.0.0 → 2.0.0 |
| Minor | 新功能、向后兼容的功能增强 | 1.0.0 → 1.1.0 |
| Patch | Bug 修复、小改进、性能优化 | 1.0.0 → 1.0.1 |

### 版本历史
| 版本 | 发布日期 | 类型 | 说明 |
|------|----------|------|------|
| 1.2.5 | 2026-01-22 | Patch | 修复 Windows 安装时"无法关闭"问题（增强进程关闭机制） |
| 1.2.4 | 2026-01-22 | Patch | 优化升级软件页面更新内容显示 |
| 1.2.3 | 2026-01-22 | Patch | 修复 Windows 更新时"无法关闭"问题 |
| 1.2.2 | 2026-01-22 | Patch | 修复内置浏览器无法正确加载的问题 |
| 1.2.1 | 2026-01-22 | Patch | 内置 Chromium 浏览器、修复缩放和下载链接问题 |
| 1.2.0 | 2026-01-22 | Minor | 新增发布平台支持 |
| 1.1.7 | 2026-01-22 | Patch | 修复浏览器启动失败和批次定时间隔问题 |
| 1.1.6 | 2026-01-21 | Patch | 修复 macOS 更新检测失败问题 |
| 1.1.5 | 2026-01-21 | Patch | 修复升级时"无法关闭"问题 |
| 1.1.4 | 2026-01-21 | Patch | 优化缓存规则 |
| 1.1.3 | 2026-01-21 | Patch | 修复存储文件损坏问题、增强打包安全性 |
| 1.1.2 | 2026-01-21 | Patch | 修复自动更新功能 |
| 1.1.1 | 2026-01-21 | Patch | 内容转化漏斗图优化 |
| 1.0.0 | 2026-01-21 | 初始版本 | 首次发布 |

---

## macOS 自动更新限制（重要）

由于没有 Apple Developer 证书，macOS 的自动更新功能受限：

| 功能 | Windows | macOS |
|------|---------|-------|
| 检测新版本 | ✅ 支持 | ✅ 支持 |
| 自动下载 | ✅ 支持 | ✅ 支持 |
| 自动安装 | ✅ 支持 | ❌ 不支持（签名验证失败） |
| 手动下载安装 | ✅ 支持 | ✅ 支持 |

**macOS 用户更新流程：**
1. 应用会检测到新版本并显示更新提示
2. 自动安装会失败（显示签名验证错误）
3. 用户需要点击"手动下载安装包"下载 DMG 文件
4. 手动安装新版本

**如需完整的 macOS 自动更新功能，需要：**
- 购买 Apple Developer Program 会员（$99/年）
- 使用证书对应用进行代码签名
- 进行公证（Notarization）

---

## 打包要求

### 必须同时打包的平台
每次发布必须打包以下版本：

| 平台 | 文件类型 | 用途 |
|------|----------|------|
| Windows x64 | `.exe` | 安装包（自动更新 + 手动下载） |
| macOS Intel (x64) | `.dmg` + `.zip` | dmg 用于手动下载，zip 用于自动更新 |
| macOS Apple Silicon (arm64) | `.dmg` + `.zip` | dmg 用于手动下载，zip 用于自动更新 |

**重要：macOS 自动更新必须使用 `.zip` 文件，`.dmg` 仅用于手动下载安装。**

### 打包命令
```bash
cd windows-login-manager


# 必须打包，每个软件包必须分别打包
npm run build:win      # Windows x64
npm run build:mac-x64  # macOS Intel 单独
npm run build:mac-arm  # macOS Apple Silicon 单独
```

---

## 内置浏览器打包规范（重要）

### 浏览器目录结构

每个平台的 Chromium 浏览器存放在独立目录：

```
playwright-browsers/
├── win/                    # Windows x64
│   └── chromium-1200/
│       └── chrome-win64/
│           └── chrome.exe
├── mac-x64/                # macOS Intel
│   └── chromium-1200/
│       └── chrome-mac-x64/
│           └── Google Chrome for Testing.app/
└── mac-arm64/              # macOS Apple Silicon
    └── chromium-1200/
        └── chrome-mac-arm64/
            └── Google Chrome for Testing.app/
```

### 打包前准备

浏览器已预先下载到 `playwright-browsers/` 目录，**无需每次打包前下载**。

如需重新下载（首次或浏览器版本更新时）：
```bash
npm run download:browsers
```

### 分平台打包机制

**重要：必须分平台打包，每个平台使用对应的浏览器！**

打包脚本 `scripts/build-platform.js` 会：
1. 检查目标平台的浏览器是否存在
2. 将对应平台的浏览器复制到 `playwright-browsers-target/` 目录
3. 执行 electron-builder 打包（使用 `extraResources` 将浏览器打包进去）

### 打包后验证（强制）

**每次打包后必须验证浏览器是否正确打包！**

#### Windows 验证方法
```bash
# 解压 exe 安装包或查看安装后的目录
# 检查 resources/playwright-browsers/chromium-1200/chrome-win64/chrome.exe 是否存在
```

#### macOS 验证方法
```bash
# 挂载 DMG 或解压 ZIP
# 检查 Contents/Resources/playwright-browsers/chromium-1200/ 目录

# macOS ARM 应包含：chrome-mac-arm64/Google Chrome for Testing.app
# macOS Intel 应包含：chrome-mac-x64/Google Chrome for Testing.app
```

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 浏览器启动失败 | 打包时使用了错误平台的浏览器 | 使用分平台打包命令 |
| 找不到浏览器 | 浏览器未下载或路径错误 | 运行 `npm run download:browsers` |
| 打包体积过大 | 包含了多个平台的浏览器 | 确保只打包目标平台的浏览器 |

---

### 打包输出文件
打包完成后，`release/` 目录会生成：
```
release/
├── Ai智软精准GEO优化系统 Setup {version}.exe      # Windows
├── Ai智软精准GEO优化系统-{version}.dmg            # macOS Intel (手动下载)
├── Ai智软精准GEO优化系统-{version}-arm64.dmg      # macOS ARM (手动下载)
├── Ai智软精准GEO优化系统-{version}-mac.zip        # macOS Intel (自动更新)
├── Ai智软精准GEO优化系统-{version}-arm64-mac.zip  # macOS ARM (自动更新)
├── latest.yml                                      # Windows 更新元数据
└── latest-mac.yml                                  # macOS 更新元数据
```

---

## 腾讯云 COS 配置

| 配置项 | 值 |
|--------|-----|
| 存储桶名称 | geo-1301979637 |
| 地域 | ap-shanghai |
| 访问域名 | https://geo-1301979637.cos.ap-shanghai.myqcloud.com |
| 发布目录 | /releases/ |
| 访问权限 | 私有读写 + Policy 允许 `releases/*` 公开读取 |

### COS 权限配置
存储桶设置为"私有读写"，通过 Policy 策略允许 `releases/` 目录公开读取：
- 策略 ID：geo
- 效力：允许
- 用户：所有用户 (*)
- 资源：`geo-1301979637/releases/*`
- 操作：GetObject

### 上传文件清单
每次发布需上传到 `/releases/` 目录：
```
releases/
├── Ai智软精准GEO优化系统 Setup {version}.exe      # Windows（自动更新）
├── Ai智软精准GEO优化系统-{version}-mac.zip        # macOS Intel（自动更新）
├── Ai智软精准GEO优化系统-{version}-arm64-mac.zip  # macOS ARM（自动更新）
├── Ai智软精准GEO优化系统-{version}.dmg            # macOS Intel（手动下载）
├── Ai智软精准GEO优化系统-{version}-arm64.dmg      # macOS ARM（手动下载）
├── latest.yml                                      # Windows 更新元数据
├── latest-mac.yml                                  # macOS 更新元数据
└── latest/                                         # 营销页面下载（固定链接）
    ├── GEO优化系统-Windows.exe
    ├── GEO优化系统-Mac-Intel.dmg
    └── GEO优化系统-Mac-Apple.dmg
```

### latest/ 目录说明（重要）

营销页面的下载链接指向 `latest/` 目录，使用固定文件名，**无需随版本更新**。

每次发布新版本后，需要将打包文件复制到 `latest/` 目录并重命名：

| 原始文件名 | latest/ 目录文件名 |
|-----------|-------------------|
| `Ai智软精准GEO优化系统 Setup {version}.exe` | `GEO优化系统-Windows.exe` |
| `Ai智软精准GEO优化系统-{version}.dmg` | `GEO优化系统-Mac-Intel.dmg` |
| `Ai智软精准GEO优化系统-{version}-arm64.dmg` | `GEO优化系统-Mac-Apple.dmg` |

**此步骤由 Kiro 在每次打包发布时自动执行。**

---

## 更新日志规范

### 文件位置
`windows-login-manager/CHANGELOG.md`

### 格式要求
```markdown
## [版本号] - 发布日期

### 新功能
- 功能描述

### 改进
- 改进描述

### 修复
- 修复描述
```

**注意：不要添加"技术特性"部分，yml 文件不需要这些内容。**

### 更新内容显示位置
1. 升级软件页面 - 检测到新版本时显示
2. 系统通知 - 下载完成后通知

---

## 发布流程

### 1. 准备工作
```bash
# 1. 更新 package.json 中的 version
# 2. 更新 CHANGELOG.md
# 3. 提交代码
git add .
git commit -m "chore: release v{version}"
git tag v{version}
git push && git push --tags
```

### 2. 打包
```bash
cd windows-login-manager
npm run build:all
```

### 3. 上传到 COS
通过腾讯云控制台上传 `release/` 目录下的以下文件到 `/releases/`：
- `*.exe` - Windows 安装包
- `*.dmg` - macOS 安装包（手动下载用）
- `*.zip` - macOS 更新包（自动更新用）
- `latest.yml` - Windows 更新元数据
- `latest-mac.yml` - macOS 更新元数据

### 4. 更新 latest/ 目录
将最新版本的安装包复制到 `latest/` 目录并重命名为固定文件名。

### 5. 验证
访问以下链接确认上传成功：
- https://geo-1301979637.cos.ap-shanghai.myqcloud.com/releases/latest.yml
- https://geo-1301979637.cos.ap-shanghai.myqcloud.com/releases/latest-mac.yml

## 存档流程
将历次打包文件归档到 `打包历史/` 目录，并且按照“打包的日期+修复内容简介”为文件夹的名称归档存放。

---

## 发布检查清单

- [ ] 版本号已更新 (`package.json`)
- [ ] CHANGELOG.md 已更新
- [ ] 代码已提交并打 tag
- [ ] 浏览器已下载（`npm run download:browsers`）
- [ ] Windows exe 已打包
- [ ] macOS dmg + zip 已打包（两种架构）
- [ ] **验证 Windows 包含 chrome-win64/chrome.exe**
- [ ] **验证 macOS Intel 包含 chrome-mac-x64/**
- [ ] **验证 macOS ARM 包含 chrome-mac-arm64/**
- [ ] latest.yml 和 latest-mac.yml 包含正确的 releaseNotes
- [ ] 所有文件已上传到 COS `/releases/` 目录
- [ ] latest/ 目录已更新固定链接文件
- [ ] 验证下载链接可访问
- [ ] 验证 Windows 自动更新功能
- [ ] 验证 macOS 自动更新功能
- [ ] 更新本规则文件中的版本历史
