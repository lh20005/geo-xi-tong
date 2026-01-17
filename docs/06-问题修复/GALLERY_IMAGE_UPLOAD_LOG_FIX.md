# 企业图库上传图片日志修复

## 问题描述

**用户**: aizhiruan  
**问题**: 企业图库上传图片后看不到图片

## 问题分析

1. **日志缺失**: 查看 Electron 日志发现没有图片上传相关的日志记录
2. **IPC 未触发**: 说明 `gallery:uploadImage` IPC 处理器根本没有被调用
3. **数据存储**: 图片数据存储在 Windows 端本地 PostgreSQL 数据库（`geo_windows`）

## 根本原因

**日志不足导致无法诊断问题**

- 原有日志只在上传开始时记录，无法判断 IPC 是否被触发
- 缺少用户验证、Service 初始化、数据库查询等关键步骤的日志
- 无法定位是前端调用问题还是后端处理问题

## 修复方案

### 1. 增强日志记录

在 `localGalleryHandlers.ts` 的 `gallery:uploadImage` 处理器中添加详细日志：

```typescript
// 上传图片
ipcMain.handle('gallery:uploadImage', async (_event, albumId: number, files: Array<{...}>) => {
  log.info(`========== 🔥 图片上传 IPC 被调用 ==========`);
  log.info(`📋 参数: albumId=${albumId}, files数量=${files?.length || 0}`);
  
  try {
    const user = await storageManager.getUser();
    if (!user) {
      log.error('❌ 用户未登录');
      return { success: false, error: '用户未登录' };
    }
    log.info(`✅ 用户已登录: User ID=${user.id}, Username=${user.username}`);

    // 设置用户 ID 并获取服务
    log.info(`🔧 设置 ServiceFactory userId=${user.id}`);
    serviceFactory.setUserId(user.id);
    
    log.info(`🔧 获取 AlbumService...`);
    const albumService = serviceFactory.getAlbumService();
    log.info(`🔧 获取 ImageService...`);
    const imageService = serviceFactory.getImageService();
    log.info(`✅ Services 获取成功`);

    log.info(`🔍 查询相册: albumId=${albumId}`);
    const album = await albumService.findById(albumId);
    if (!album) {
      log.error(`❌ 相册不存在: ${albumId}`);
      return { success: false, error: '相册不存在' };
    }
    log.info(`✅ 相册找到:`, album);
    
    // ... 后续处理
  } catch (error: any) {
    log.error('========== ❌ 图片上传失败 ==========');
    log.error('IPC: gallery:uploadImage failed:', error);
    log.error('Error stack:', error.stack);
    return { success: false, error: error.message || '上传图片失败' };
  }
});
```

### 2. 日志级别说明

- 🔥 **IPC 调用**: 标记 IPC 处理器被触发
- ✅ **成功步骤**: 标记关键步骤成功完成
- ❌ **错误**: 标记失败的步骤
- 🔧 **处理中**: 标记正在执行的操作
- 🔍 **查询**: 标记数据库查询操作
- 📋 **参数**: 标记输入参数

## 修复步骤

### 1. 修改源代码

文件: `windows-login-manager/electron/ipc/handlers/localGalleryHandlers.ts`

已添加详细的日志记录，覆盖以下关键步骤：
- IPC 调用触发
- 用户验证
- ServiceFactory 初始化
- 数据库查询
- 文件处理
- 错误捕获

### 2. 编译代码

```bash
cd windows-login-manager
npm run build:electron
```

**编译结果**: ✅ 成功

### 3. 验证编译

```bash
grep -n "🔥 图片上传 IPC 被调用" dist-electron/ipc/handlers/localGalleryHandlers.js
```

**验证结果**: ✅ 日志代码已编译到输出文件

## 下一步诊断步骤

### 1. 重启应用并测试

```bash
# 用户需要：
1. 关闭当前运行的应用
2. 重新启动应用
3. 登录 aizhiruan 账号
4. 进入企业图库
5. 尝试上传图片
```

### 2. 查看日志

```bash
# 实时查看日志
tail -f ~/Library/Application\ Support/ai-geo-system/logs/main.log
```

### 3. 根据日志判断问题

#### 情况 A: 没有看到 "🔥 图片上传 IPC 被调用"
**原因**: 前端没有正确调用 IPC
**检查**: 
- 前端 `uploadImages` 函数是否正确调用
- `window.electronAPI.gallery.uploadImage` 是否存在
- 浏览器控制台是否有错误

#### 情况 B: 看到 "🔥 图片上传 IPC 被调用" 但后续失败
**原因**: 后端处理失败
**检查**: 
- 用户是否登录（看 "✅ 用户已登录" 日志）
- ServiceFactory 是否初始化成功
- 数据库连接是否正常
- 相册是否存在

#### 情况 C: 上传成功但图片不显示
**原因**: 图片显示逻辑问题
**检查**:
- 图片是否正确保存到数据库
- 图片文件是否正确保存到文件系统
- 前端 `getImageSrc` 函数是否正确
- `local-file://` 协议是否正常工作

## 可能的问题和解决方案

### 问题 1: PostgreSQL 数据库未连接

**症状**: 日志显示 "数据库连接池未初始化"

**解决方案**:
```bash
# 检查 PostgreSQL 是否运行
psql -d geo_windows -c "SELECT 1"

# 检查环境变量
cat windows-login-manager/.env | grep DB_
```

### 问题 2: 用户未登录

**症状**: 日志显示 "❌ 用户未登录"

**解决方案**:
- 确认用户已登录
- 检查 `storageManager.getUser()` 是否正常工作

### 问题 3: 相册不存在

**症状**: 日志显示 "❌ 相册不存在"

**解决方案**:
```sql
-- 查询用户的相册
SELECT * FROM albums WHERE user_id = (SELECT id FROM users WHERE username = 'aizhiruan');
```

### 问题 4: 文件路径问题

**症状**: 日志显示文件保存失败

**解决方案**:
- 检查相册目录是否存在
- 检查文件权限
- 检查磁盘空间

## 技术细节

### 日志文件位置

```
~/Library/Application Support/ai-geo-system/logs/main.log
```

### 数据库信息

- **数据库名**: `geo_windows`
- **用户**: `lzc`
- **主机**: `localhost`
- **端口**: `5432`

### 图片存储路径

```
~/Library/Application Support/ai-geo-system/gallery/{albumId}/{filename}
```

### 数据库表结构

```sql
-- 相册表
CREATE TABLE albums (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 图片表
CREATE TABLE images (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    album_id INTEGER,
    filename VARCHAR(255) NOT NULL,
    filepath TEXT NOT NULL,
    mime_type VARCHAR(100),
    size INTEGER,
    usage_count INTEGER DEFAULT 0,
    deleted_at TIMESTAMP,
    is_orphan BOOLEAN DEFAULT FALSE,
    reference_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 修复状态

- [x] 添加详细日志
- [x] 编译代码
- [x] 验证编译结果
- [ ] 用户测试（等待用户重启应用并测试）
- [ ] 根据日志诊断具体问题
- [ ] 修复具体问题

## 注意事项

1. **必须重启应用**: 修改 Electron 主进程代码后必须重启应用才能生效
2. **查看完整日志**: 不要只看最后几行，要查看完整的上传流程日志
3. **保留日志**: 如果问题仍然存在，保留日志文件以便进一步分析

## 相关文件

- `windows-login-manager/electron/ipc/handlers/localGalleryHandlers.ts` - IPC 处理器
- `windows-login-manager/electron/services/ImageServicePostgres.ts` - 图片服务
- `windows-login-manager/electron/services/AlbumServicePostgres.ts` - 相册服务
- `windows-login-manager/electron/database/postgres.ts` - 数据库连接
- `windows-login-manager/src/pages/AlbumDetailPage.tsx` - 前端页面

---

**创建时间**: 2026-01-17  
**修复人员**: Kiro AI  
**状态**: 等待用户测试
