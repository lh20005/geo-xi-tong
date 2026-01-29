# Electron 桌面应用打包发布规范

## 版本管理

### 当前版本
```
1.3.0
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
| 1.3.0 | 2026-01-29 | Minor | 升级服务器，更新后台服务 |
| 1.2.9 | 2026-01-28 | Patch | 修复 Windows 安装或升级后无法自动打开浏览器的问题 |
| 1.2.8 | 2026-01-28 | Patch | 修复任务失败重试时后续任务提前执行的问题 |
| 1.2.7 | 2026-01-24 | Patch | 修复批次发布任务定时间隔问题 |
| 1.2.6 | 2026-01-22 | Patch | 修复 Windows 上页面缩放无法保持的问题 |
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

#### 自动验证（推荐）

打包完成后自动执行验证脚本：
```bash
npm run verify:browsers
```

此脚本会检查：
- 各平台是否包含正确的浏览器目录
- 是否误打入其他平台的浏览器
- 浏览器可执行文件是否存在

**注意：`npm run build:all` 命令已自动包含验证步骤。**

#### 手动验证方法

Windows:
```bash
# 检查 release/win-unpacked/resources/playwright-browsers/chromium-1200/chrome-win64/chrome.exe
```

macOS Intel:
```bash
# 检查 release/mac/Ai智软精准GEO优化系统.app/Contents/Resources/playwright-browsers/chromium-1200/chrome-mac-x64/
```

macOS ARM:
```bash
# 检查 release/mac-arm64/Ai智软精准GEO优化系统.app/Contents/Resources/playwright-browsers/chromium-1200/chrome-mac-arm64/
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

## macOS latest-mac.yml 合并（强制）

### 问题说明

**重要：分别打包 macOS Intel 和 ARM 版本时，后打包的版本会覆盖 `latest-mac.yml`！**

这会导致只有一个架构的用户能收到更新提示，另一个架构的用户无法检测到新版本。

### 解决方案

每次打包完成后，必须手动合并 `latest-mac.yml`，确保包含两个架构的文件信息。

### 正确的 latest-mac.yml 格式

```yaml
version: {version}
files:
  - url: Ai智软精准GEO优化系统-{version}-mac.zip        # Intel 版本
    sha512: {intel_sha512}
    size: {intel_size}
  - url: Ai智软精准GEO优化系统-{version}-arm64-mac.zip  # ARM 版本
    sha512: {arm_sha512}
    size: {arm_size}
path: Ai智软精准GEO优化系统-{version}-arm64-mac.zip
sha512: {arm_sha512}
releaseNotes: |
  ...
releaseDate: '...'
```

### 合并步骤

1. 先打包 Intel 版本：`npm run build:mac-x64`
2. 记录生成的 `latest-mac.yml` 中 Intel zip 的 sha512 和 size
3. 再打包 ARM 版本：`npm run build:mac-arm`（会覆盖 yml 文件）
4. 手动编辑 `latest-mac.yml`，在 `files` 数组开头添加 Intel 版本的条目

### 获取 sha512 的命令

```bash
# macOS/Linux
shasum -a 512 "release/Ai智软精准GEO优化系统-{version}-mac.zip" | awk '{print $1}' | xxd -r -p | base64

# 获取文件大小
stat -f%z "release/Ai智软精准GEO优化系统-{version}-mac.zip"
```

### 验证 latest-mac.yml

上传前检查 `latest-mac.yml` 的 `files` 数组必须包含两个条目：
- `*-mac.zip`（Intel）
- `*-arm64-mac.zip`（ARM）

---

## 服务器自托管配置

| 配置项 | 值 |
|--------|-----|
| 服务器 | 101.35.116.9 |
| 访问域名 | https://www.jzgeo.cc |
| 发布目录 | /var/www/geo-system/releases/ |
| Nginx 路径 | /releases/ |

### 上传文件清单
每次发布需上传到服务器 `/var/www/geo-system/releases/` 目录：
```
releases/
├── Ai智软精准GEO优化系统 Setup {version}.exe      # Windows（自动更新）
├── Ai智软精准GEO优化系统-{version}-mac.zip        # macOS Intel（自动更新）
├── Ai智软精准GEO优化系统-{version}-arm64-mac.zip  # macOS ARM（自动更新）
├── latest.yml                                      # Windows 更新元数据
├── latest-mac.yml                                  # macOS 更新元数据
└── latest/                                         # 营销页面下载（固定链接）
    ├── GEO优化系统-Windows.exe
    ├── GEO优化系统-Mac-Intel.dmg
    └── GEO优化系统-Mac-Apple.dmg
```

### 上传命令
```bash
# 上传更新元数据和安装包
scp -i "私钥路径" release/latest.yml release/latest-mac.yml release/*.exe release/*-mac.zip ubuntu@101.35.116.9:/var/www/geo-system/releases/

# 上传 latest/ 目录固定链接文件
scp -i "私钥路径" release/latest/* ubuntu@101.35.116.9:/var/www/geo-system/releases/latest/
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

### 3. 清理服务器旧文件
上传前先删除服务器上的旧版本文件，避免混淆：
```bash
ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@101.35.116.9 "rm -f /var/www/geo-system/releases/*.exe /var/www/geo-system/releases/*.zip /var/www/geo-system/releases/*.yml"
```

### 4. 上传到服务器

**上传更新元数据（yml 文件）：**
```bash
scp -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" windows-login-manager/release/latest.yml windows-login-manager/release/latest-mac.yml ubuntu@101.35.116.9:/var/www/geo-system/releases/
```

**上传 Windows 安装包：**
```bash
scp -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" "windows-login-manager/release/Ai智软精准GEO优化系统 Setup {version}.exe" ubuntu@101.35.116.9:/var/www/geo-system/releases/
```

**上传 macOS 更新包（zip）：**
```bash
scp -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" "windows-login-manager/release/Ai智软精准GEO优化系统-{version}-mac.zip" "windows-login-manager/release/Ai智软精准GEO优化系统-{version}-arm64-mac.zip" ubuntu@101.35.116.9:/var/www/geo-system/releases/
```

**上传 latest/ 目录固定链接文件（手动下载用）：**
```bash
scp -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" windows-login-manager/release/latest/* ubuntu@101.35.116.9:/var/www/geo-system/releases/latest/
```

### 5. 验证
访问以下链接确认上传成功：
- https://www.jzgeo.cc/releases/latest.yml
- https://www.jzgeo.cc/releases/latest-mac.yml
- https://www.jzgeo.cc/releases/latest/GEO优化系统-Windows.exe

### 6. 存档
将历次打包文件归档到 `打包历史/` 目录，按照"打包的日期+修复内容简介"为文件夹名称存放。

---

## 服务器文件对应关系

| 本地文件 | 服务器路径 | 用途 |
|---------|-----------|------|
| `release/latest.yml` | `/var/www/geo-system/releases/latest.yml` | Windows 自动更新元数据 |
| `release/latest-mac.yml` | `/var/www/geo-system/releases/latest-mac.yml` | macOS 自动更新元数据 |
| `release/Ai智软精准GEO优化系统 Setup {version}.exe` | `/var/www/geo-system/releases/` | Windows 自动更新安装包 |
| `release/Ai智软精准GEO优化系统-{version}-mac.zip` | `/var/www/geo-system/releases/` | macOS Intel 自动更新包 |
| `release/Ai智软精准GEO优化系统-{version}-arm64-mac.zip` | `/var/www/geo-system/releases/` | macOS ARM 自动更新包 |
| `release/latest/GEO优化系统-Windows.exe` | `/var/www/geo-system/releases/latest/` | 营销页面下载（固定链接） |
| `release/latest/GEO优化系统-Mac-Intel.dmg` | `/var/www/geo-system/releases/latest/` | 营销页面下载（固定链接） |
| `release/latest/GEO优化系统-Mac-Apple.dmg` | `/var/www/geo-system/releases/latest/` | 营销页面下载（固定链接） |

---

## 发布检查清单

- [ ] 版本号已更新 (`package.json`)
- [ ] CHANGELOG.md 已更新
- [ ] 代码已提交并打 tag
- [ ] 浏览器已下载（`npm run download:browsers`）
- [ ] Windows exe 已打包
- [ ] macOS dmg + zip 已打包（两种架构）
- [ ] **运行 `npm run verify:browsers` 验证浏览器打包正确**
- [ ] **latest-mac.yml 已合并（包含 Intel 和 ARM 两个 zip 文件条目）**
- [ ] latest.yml 和 latest-mac.yml 包含正确的 releaseNotes
- [ ] 服务器旧文件已清理
- [ ] 所有文件已上传到服务器 `/var/www/geo-system/releases/` 目录
- [ ] latest/ 目录已更新固定链接文件
- [ ] 验证下载链接可访问（yml 和 exe）
- [ ] 更新本规则文件中的版本历史
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

### 3. 上传到服务器
使用 scp 命令上传 `release/` 目录下的文件到服务器：
```bash
# 上传更新元数据和安装包
scp -i "私钥路径" release/latest.yml release/latest-mac.yml "release/Ai智软精准GEO优化系统 Setup *.exe" release/*-mac.zip ubuntu@101.35.116.9:/var/www/geo-system/releases/

# 上传 latest/ 目录固定链接文件
scp -i "私钥路径" release/latest/* ubuntu@101.35.116.9:/var/www/geo-system/releases/latest/
```

### 4. 更新 latest/ 目录
将最新版本的安装包复制到 `latest/` 目录并重命名为固定文件名。

### 5. 验证
访问以下链接确认上传成功：
- https://www.jzgeo.cc/releases/latest.yml
- https://www.jzgeo.cc/releases/latest-mac.yml

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
- [ ] **运行 `npm run verify:browsers` 验证浏览器打包正确**
- [ ] **latest-mac.yml 已合并（包含 Intel 和 ARM 两个 zip 文件条目）**
- [ ] latest.yml 和 latest-mac.yml 包含正确的 releaseNotes
- [ ] 所有文件已上传到服务器 `/var/www/geo-system/releases/` 目录
- [ ] latest/ 目录已更新固定链接文件
- [ ] 验证下载链接可访问
- [ ] 验证 Windows 自动更新功能
- [ ] 验证 macOS 自动更新功能（Intel 和 ARM 都要验证）
- [ ] 更新本规则文件中的版本历史
