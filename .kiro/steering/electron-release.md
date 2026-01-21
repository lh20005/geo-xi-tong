# Electron 桌面应用打包发布规范

## 版本管理

### 当前版本
```
1.1.3
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

# 打包所有平台（推荐）
npm run build:all

# 或分别打包
npm run build:win      # Windows x64
npm run build:mac      # macOS (Intel + Apple Silicon，同时生成 dmg 和 zip)
npm run build:mac-x64  # macOS Intel 单独
npm run build:mac-arm  # macOS Apple Silicon 单独
```

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
- [ ] Windows exe 已打包
- [ ] macOS dmg + zip 已打包（两种架构）
- [ ] latest.yml 和 latest-mac.yml 包含正确的 releaseNotes
- [ ] 所有文件已上传到 COS `/releases/` 目录
- [ ] latest/ 目录已更新固定链接文件
- [ ] 验证下载链接可访问
- [ ] 验证 Windows 自动更新功能
- [ ] 验证 macOS 自动更新功能
- [ ] 更新本规则文件中的版本历史
