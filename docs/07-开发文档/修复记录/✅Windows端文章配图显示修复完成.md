# ✅ Windows端文章配图显示修复完成

## 问题描述
在 Windows 端文章管理页面查看文章时，无法看到文章配图。

## 根本原因
数据库中存储的图片 URL 是相对路径（如 `/uploads/gallery/xxx.jpg`），但在 Windows 端显示时没有转换为完整的 URL，导致浏览器无法正确加载图片。

## 修复方案

### 修改 ArticlePreview 组件 (`windows-login-manager/src/components/ArticlePreview.tsx`)

**核心改动**：
1. 添加服务器 URL 状态管理
2. 从 Electron 配置获取服务器地址
3. 将相对路径转换为完整 URL
4. 添加图片加载错误处理

```typescript
const [serverUrl, setServerUrl] = useState<string>('http://localhost:3000');

useEffect(() => {
  // 从 IPC 获取服务器配置
  const loadServerUrl = async () => {
    try {
      if (window.electron?.getConfig) {
        const config = await window.electron.getConfig();
        if (config?.serverUrl) {
          setServerUrl(config.serverUrl);
        }
      }
    } catch (error) {
      console.error('获取服务器配置失败:', error);
    }
  };
  
  loadServerUrl();
}, []);

// 处理图片 URL - 将相对路径转换为完整 URL
const getFullImageUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  
  // 如果已经是完整 URL，直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // 如果是相对路径，添加服务器地址
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${serverUrl}${path}`;
};
```

## 技术细节

### 图片 URL 的三种情况

1. **完整 URL**
   ```
   http://example.com/image.jpg
   https://cdn.example.com/image.jpg
   ```
   → 直接使用

2. **绝对路径**
   ```
   /uploads/gallery/image.jpg
   ```
   → 转换为：`http://localhost:3000/uploads/gallery/image.jpg`

3. **相对路径**
   ```
   uploads/gallery/image.jpg
   ```
   → 转换为：`http://localhost:3000/uploads/gallery/image.jpg`

### 服务器 URL 获取流程

```
React 组件
  ↓ useEffect
window.electron.getConfig()
  ↓ IPC 调用
Electron 主进程
  ↓ storageManager
读取配置文件
  ↓ 返回
serverUrl: "http://localhost:3000"
```

### 错误处理

```typescript
<img 
  src={fullImageUrl} 
  alt="文章配图" 
  onError={(e) => {
    console.error('图片加载失败:', fullImageUrl);
    // 图片加载失败时隐藏
    (e.target as HTMLImageElement).style.display = 'none';
  }}
/>
```

## 影响范围

此修复影响所有使用 `ArticlePreview` 组件的页面：

1. **文章管理页面** - 查看文章详情
2. **发布任务页面** - 预览待发布文章
3. **发布记录页面** - 查看已发布文章
4. **其他使用文章预览的地方**

## 测试步骤

### 1. 准备测试数据
确保有包含配图的文章：
- 通过文章生成任务创建文章（会自动从图库选择配图）
- 或手动编辑文章添加配图

### 2. 测试查看功能
1. 打开文章管理页面
2. 点击任意文章的"查看"按钮
3. 确认配图正常显示

### 3. 测试不同场景
- ✅ 本地服务器（localhost:3000）
- ✅ 远程服务器（配置了自定义服务器地址）
- ✅ 图片加载失败时的处理

### 4. 检查控制台
- 查看图片 URL 是否正确转换
- 确认没有 404 错误
- 如有加载失败，查看错误日志

## 数据库中的图片路径格式

### 图库图片
```sql
SELECT filepath FROM gallery_images;
-- 结果示例：
-- 1234567890-abc123.jpg
-- 存储在数据库中的相对路径

-- 实际文件位置：
-- server/uploads/gallery/1234567890-abc123.jpg

-- 数据库中存储的完整路径：
-- /uploads/gallery/1234567890-abc123.jpg
```

### 文章表中的图片 URL
```sql
SELECT image_url FROM articles WHERE image_url IS NOT NULL;
-- 结果示例：
-- /uploads/gallery/1234567890-abc123.jpg
```

## 相关代码位置

### 前端组件
- `windows-login-manager/src/components/ArticlePreview.tsx` - 文章预览组件
- `windows-login-manager/src/pages/ArticleListPage.tsx` - 文章列表页面

### 后端路由
- `server/src/routes/article.ts` - 文章 API 路由
- `server/src/routes/gallery.ts` - 图库 API 路由

### 图片服务
- `server/src/services/ImageUploadService.ts` - 图片上传服务
- `server/src/services/articleGenerationService.ts` - 文章生成服务（选择配图）

## 注意事项

1. **服务器地址配置**
   - 确保 Electron 配置中的 serverUrl 正确
   - 默认值：`http://localhost:3000`

2. **图片文件存在性**
   - 图片文件必须实际存在于服务器的 `uploads/gallery/` 目录
   - 如果文件不存在，图片会自动隐藏

3. **跨域问题**
   - 如果服务器和客户端不在同一域，需要配置 CORS
   - 本地开发环境通常不会有此问题

4. **图片大小**
   - 组件会自动限制图片最大高度为 400px
   - 使用 `object-fit: contain` 保持比例

## 后续优化建议

1. **图片缓存**
   - 可以考虑添加图片缓存机制
   - 减少重复加载

2. **加载状态**
   - 添加图片加载中的占位符
   - 提升用户体验

3. **图片压缩**
   - 服务器端可以提供不同尺寸的图片
   - 根据显示需求加载合适大小

4. **懒加载**
   - 对于文章列表，可以实现图片懒加载
   - 提升页面加载速度

## 状态
✅ 修复完成
🔄 等待测试验证
📝 建议测试多种场景
