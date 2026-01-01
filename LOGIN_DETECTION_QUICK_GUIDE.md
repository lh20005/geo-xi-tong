# 登录状态检测快速指南

## 问题

**如何判断平台是否掉线？**

例如：抖音Cookie已过期，但系统不知道，直到发布失败才发现。

## 解决方案

参考 `/Downloads/geo/resources/app-extracted/src/api/script/` 中的登录器代码，实现了登录状态检测。

## 核心原理

### 参考代码（登录器）

```javascript
// dy.js - 每1秒检查一次用户头像
setInterval(() => {
    var avatar = document.querySelector('.img-PeynF_')
    
    if (avatar !== null) {
        console.log("登录成功")
    } else {
        console.log("还未登录成功")
    }
}, 1000)
```

### 我们的实现

```typescript
// DouyinAdapter.ts - 检查多个关键元素
private async checkLoginStatus(page: Page): Promise<boolean> {
  // 检查用户头像
  const hasAvatar = await page.locator('.img-PeynF_').isVisible({ timeout: 3000 });
  if (hasAvatar) return true;

  // 检查用户名
  const hasName = await page.locator('.name-_lSSDc').isVisible({ timeout: 3000 });
  if (hasName) return true;

  // 检查账号ID
  const hasAccount = await page.locator('.unique_id-EuH8eA').isVisible({ timeout: 3000 });
  if (hasAccount) return true;

  return false; // 未检测到任何登录标志 = 已掉线
}
```

## 使用方法

### 1. 在发布前检测（已实现）

```typescript
// PublishingExecutor.ts
// 设置Cookie后立即验证
await context.addCookies(cookies);
await page.goto(adapter.getPublishUrl());

// 🔍 验证登录状态
const isLoggedIn = await adapter.performLogin(page, credentials);

if (!isLoggedIn) {
  throw new Error('Cookie已失效或平台已掉线');
}
```

### 2. 使用 LoginStatusChecker 服务

```typescript
import { LoginStatusChecker } from './services/LoginStatusChecker';

// 检查登录状态
const isLoggedIn = await LoginStatusChecker.checkLoginStatus(page, adapter);

// 验证Cookie
const isCookieValid = await LoginStatusChecker.verifyCookieValid(page, adapter);

// 持续监控
const stopMonitoring = LoginStatusChecker.startMonitoring(
  page,
  adapter,
  (isOnline) => {
    if (!isOnline) {
      console.log('平台已掉线！');
    }
  }
);
```

## 各平台检测选择器

| 平台 | 检测元素 | 选择器 |
|------|---------|--------|
| 抖音 | 用户头像 | `.img-PeynF_` |
| | 用户名 | `.name-_lSSDc` |
| | 账号ID | `.unique_id-EuH8eA` |
| 头条 | 用户名 | `.auth-avator-name` |
| 小红书 | 用户名 | `.account-name` |
| 搜狐号 | 用户名 | `.user-name` |
| 网易号 | 用户区域 | `.topBar__user>span` |
| 百家号 | 用户头像 | `.UjPPKm89R4RrZTKhwG5H` |
| 知乎 | 用户头像 | `img.AppHeader-profileAvatar` |
| CSDN | 头像容器 | `.hasAvatar` |
| 简书 | 用户头像 | `.avatar>img` |
| 微信公众号 | 用户名 | `.weui-desktop_name` |
| 企鹅号 | 用户名 | `span.usernameText-cls2j9OE` |
| 哔哩哔哩 | 入口文本 | `span.right-entry-text` |

## 流程对比

### 之前 ❌

```
设置Cookie → 假设已登录 → 开始发布 → 发布失败（才发现掉线）
```

### 现在 ✅

```
设置Cookie → 🔍 检查登录状态 → 
  ✅ 已登录 → 开始发布
  ❌ 已掉线 → 立即报错，提示重新登录
```

## 下一步

### 为其他平台添加检测

```typescript
// 示例：ToutiaoAdapter
private async checkLoginStatus(page: Page): Promise<boolean> {
  // 参考 tt.js
  const hasName = await page.locator('.auth-avator-name').isVisible({ timeout: 3000 });
  if (hasName) return true;

  const hasAvatar = await page.locator('.auth-avator-img').isVisible({ timeout: 3000 });
  if (hasAvatar) return true;

  return false;
}
```

然后在 `performLogin` 中调用：

```typescript
async performLogin(page: Page, credentials: any): Promise<boolean> {
  // ... 设置Cookie ...
  
  // 🔍 检查登录状态
  const isLoggedIn = await this.checkLoginStatus(page);
  
  if (!isLoggedIn) {
    await this.log('error', 'Cookie已失效或平台已掉线');
    return false;
  }
  
  return true;
}
```

## 文件位置

- **检测服务**: `server/src/services/LoginStatusChecker.ts`
- **抖音示例**: `server/src/services/adapters/DouyinAdapter.ts`
- **发布流程**: `server/src/services/PublishingExecutor.ts`
- **参考代码**: `/Downloads/geo/resources/app-extracted/src/api/script/`

## 相关文档

- `LOGIN_STATUS_DETECTION.md` - 详细技术文档
- `LOGIN_DETECTION_SUMMARY.md` - 实现总结
- `LOGIN_DETECTION_QUICK_GUIDE.md` - 本文档

## 总结

✅ 参考了登录器代码的检测逻辑
✅ 实现了多重验证机制
✅ 在发布前主动检测登录状态
✅ 及时发现Cookie失效和平台掉线
✅ 避免浪费时间和资源
