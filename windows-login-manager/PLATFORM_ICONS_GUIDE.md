# 平台图标使用指南

## 概述

平台管理页面已重新设计，使用真实的平台图标，卡片尺寸缩小到原来的四分之一，提供更紧凑、更美观的界面。

## 主要改进

### 1. 卡片尺寸优化
- **原尺寸**: 每行4个卡片（lg屏幕）
- **新尺寸**: 每行8个卡片（xl屏幕），卡片高度和内边距都大幅减小
- **响应式布局**:
  - xs (手机): 每行2个
  - sm (平板): 每行3个
  - md (小屏): 每行4个
  - lg (中屏): 每行6个
  - xl (大屏): 每行8个

### 2. 真实平台图标
- 优先使用本地图标（`/platform-icons/平台ID.png`）
- 自动回退到在线图标
- 最终回退到首字母显示

### 3. 视觉优化
- 图标尺寸: 48x48px（原64x64px）
- 卡片内边距: 12px 8px（原24px 16px）
- 字体大小: 12px（原15px）
- 更紧凑的间距和布局

## 如何添加平台图标

### 方法1: 自动下载（推荐）

```bash
cd windows-login-manager
node scripts/download-platform-icons.js
```

这个脚本会自动下载所有配置的平台图标到 `public/platform-icons/` 目录。

### 方法2: 手动添加

1. 准备48x48px或更高分辨率的PNG图标
2. 将文件命名为平台ID（如 `toutiao.png`）
3. 放入 `windows-login-manager/public/platform-icons/` 目录

### 方法3: 使用在线图标

如果不想下载本地图标，系统会自动使用在线图标作为备用。

## 支持的平台

当前已配置的平台图标：

- **baijiahao** - 百家号（使用本地图标 `/images/baijiahao.png`）
- **toutiao** - 头条号（使用本地图标 `/images/toutiaohao.png`）
- **weixin** - 微信公众号
- **zhihu** - 知乎
- **douyin** - 抖音
- **xiaohongshu** - 小红书
- **bilibili** - B站
- **kuaishou** - 快手
- **baidu** - 百度
- **sohu** - 搜狐
- **sina** - 新浪
- **wangyi** - 网易
- **qq** - 腾讯
- **taobao** - 淘宝
- **jd** - 京东
- **pinduoduo** - 拼多多

## 图标加载策略

系统采用三级回退机制：

1. **本地图标**: `/platform-icons/平台ID.png`
2. **在线图标**: 从配置的CDN URL加载
3. **首字母**: 如果前两者都失败，显示平台名称首字母

## 添加新平台

如果需要添加新平台的图标：

1. 在 `getPlatformIcon()` 函数中添加本地路径（已自动处理）
2. 在 `getOnlinePlatformIcon()` 函数中添加在线URL
3. 将图标文件放入 `public/platform-icons/` 目录

示例：

```typescript
const getOnlinePlatformIcon = (platformId: string): string => {
  const onlineIconMap: Record<string, string> = {
    // ... 现有配置
    'newplatform': 'https://example.com/newplatform-icon.png'
  };
  
  return onlineIconMap[platformId] || '';
};
```

## 图标规格建议

- **尺寸**: 48x48px 或 96x96px（支持高清屏）
- **格式**: PNG（推荐）或 SVG
- **背景**: 透明或白色
- **文件大小**: < 50KB

## 测试

重启开发服务器后访问平台管理页面：

```bash
cd windows-login-manager
npm run dev
```

访问 `http://localhost:5174/platform-management` 查看效果。

## 故障排除

### 图标不显示

1. 检查图标文件是否存在于 `public/platform-icons/` 目录
2. 检查文件名是否与平台ID匹配
3. 检查浏览器控制台是否有加载错误
4. 清除浏览器缓存后重试

### 图标显示为首字母

这是正常的回退行为，说明：
- 本地图标文件不存在
- 在线图标加载失败
- 平台ID未配置图标URL

解决方法：添加对应的图标文件或配置在线URL。

## 性能优化

- 本地图标加载速度更快，建议使用本地图标
- 图标文件应优化压缩，保持在50KB以内
- 使用WebP格式可以进一步减小文件大小
