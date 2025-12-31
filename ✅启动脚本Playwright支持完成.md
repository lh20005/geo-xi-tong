# ✅ 启动脚本Playwright支持完成

## 问题
从Puppeteer迁移到Playwright后，启动脚本需要确保Playwright浏览器已安装。

## 解决方案

### 1. 检查现状
- ✅ `package.json` 中已经没有 `puppeteer` 依赖
- ✅ `server/package.json` 中已添加 `playwright: ^1.57.0`
- ✅ Playwright 已安装（Version 1.57.0）

### 2. 更新的启动脚本

#### `启动GEO系统.command`
在依赖检查阶段（步骤4）添加了Playwright浏览器检查：
```bash
# 检查并安装Playwright浏览器
echo "   🔍 检查 Playwright 浏览器..."
cd server
if ! npx playwright install --dry-run chromium > /dev/null 2>&1; then
    echo "   🔄 安装 Playwright 浏览器（首次运行需要）..."
    npx playwright install chromium
    echo "   ✅ Playwright 浏览器安装完成"
else
    echo "   ✅ Playwright 浏览器已安装"
fi
cd ..
```

#### `后台启动GEO系统.command`
在数据库迁移后（步骤3.5）添加了Playwright浏览器检查：
```bash
# 3.5 检查Playwright浏览器
echo "🌐 [3.5/6] 检查 Playwright 浏览器..."
cd server
if ! npx playwright install --dry-run chromium > /dev/null 2>&1; then
    echo "   🔄 安装 Playwright 浏览器..."
    npx playwright install chromium > /dev/null 2>&1
    echo "   ✅ Playwright 浏览器安装完成"
else
    echo "   ✅ Playwright 浏览器已就绪"
fi
cd ..
```

### 3. 其他启动脚本
以下脚本不需要修改，因为它们依赖于上述两个主启动脚本：
- ✅ `重启GEO系统.command` - 调用停止和后台启动脚本
- ✅ `停止GEO系统.command` - 只负责停止服务
- ✅ `启动Windows管理器.command` - 只启动Windows管理器

## Playwright vs Puppeteer 的区别

### 浏览器安装
- **Puppeteer**: 安装时自动下载Chromium
- **Playwright**: 需要手动运行 `npx playwright install` 安装浏览器

### 支持的浏览器
- **Puppeteer**: 仅支持 Chromium/Chrome
- **Playwright**: 支持 Chromium, Firefox, WebKit (Safari)

### 当前配置
我们只安装 `chromium`，因为：
1. 体积最小（约170MB）
2. 满足所有平台登录需求
3. 与之前的Puppeteer行为一致

## 首次运行流程

### 新用户首次启动
1. 双击 `启动GEO系统.command`
2. 系统自动检测Playwright浏览器
3. 如果未安装，自动下载安装（约170MB，需要几分钟）
4. 安装完成后正常启动服务

### 已有用户
1. 启动脚本会自动检测
2. 如果已安装，直接跳过
3. 不会重复下载

## 手动安装（可选）

如果需要手动安装Playwright浏览器：

```bash
# 进入server目录
cd server

# 安装所有浏览器
npx playwright install

# 或只安装Chromium
npx playwright install chromium

# 安装浏览器及系统依赖（Linux需要）
npx playwright install --with-deps chromium
```

## 验证安装

```bash
# 检查Playwright版本
cd server
npx playwright --version

# 检查已安装的浏览器
npx playwright install --list

# 测试浏览器（dry-run）
npx playwright install --dry-run chromium
```

## 注意事项

### 1. 磁盘空间
- Chromium 浏览器约 170MB
- 确保有足够的磁盘空间

### 2. 网络连接
- 首次安装需要下载浏览器
- 如果网络较慢，可能需要几分钟
- 下载失败会自动重试

### 3. 系统兼容性
- macOS: 无需额外依赖
- Linux: 可能需要 `--with-deps` 安装系统库
- Windows: 无需额外依赖

### 4. 缓存位置
Playwright浏览器默认安装在：
- macOS/Linux: `~/.cache/ms-playwright/`
- Windows: `%USERPROFILE%\AppData\Local\ms-playwright\`

## 迁移完成检查清单

- ✅ 移除所有 `puppeteer` 依赖
- ✅ 添加 `playwright` 依赖
- ✅ 更新所有适配器代码使用Playwright API
- ✅ 更新启动脚本检查Playwright浏览器
- ✅ 测试所有平台登录功能
- ✅ 更新文档说明

## 相关文档

- `PLAYWRIGHT_MIGRATION_COMPLETED.md` - Playwright迁移完成报告
- `PLAYWRIGHT_MIGRATION_IMPLEMENTATION.md` - 迁移实施细节
- `server/src/services/adapters/README.md` - 适配器开发指南
- `QUICK_START_PLAYWRIGHT.md` - Playwright快速开始指南

## 状态
✅ 完成 - 2024-12-31

启动脚本已更新，支持自动检测和安装Playwright浏览器。用户无需手动操作，首次运行时会自动完成安装。
