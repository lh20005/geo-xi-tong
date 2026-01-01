# 登录状态检测实现总结

## 问题

你提出的问题：**如何判断登录的平台已经掉线？**

例如，抖音平台已经掉线，在测试登录的时候已经不能使用Cookie登录。

## 解决方案

参考 `/Downloads/geo/resources/app-extracted/src/api/script/` 中的登录器代码，实现了完整的登录状态检测机制。

## 核心改进

### 1. 创建了 LoginStatusChecker 服务

**文件**: `server/src/services/LoginStatusChecker.ts`

提供了6个核心方法：

```typescript
// 1. 单次检查登录状态
static async checkLoginStatus(page: Page, adapter: PlatformAdapter): Promise<boolean>

// 2. 持续检查登录状态（定时轮询，参考登录器的 setInterval 模式）
static async waitForLogin(page: Page, adapter: PlatformAdapter, intervalMs: number = 2000, maxAttempts: number = 30): Promise<boolean>

// 3. 验证Cookie是否有效（在发布前检查）⭐ 最重要
static async verifyCookieValid(page: Page, adapter: PlatformAdapter): Promise<boolean>

// 4. 提取用户信息
static async extractUserInfo(page: Page, adapter: PlatformAdapter): Promise<UserInfo | null>

// 5. 检测平台是否掉线
static async isOnline(page: Page, adapter: PlatformAdapter): Promise<boolean>

// 6. 监控登录状态（持续监控）
static startMonitoring(page: Page, adapter: PlatformAdapter, onStatusChange: (isOnline: boolean) => void, intervalMs: number = 10000): () => void
```

### 2. 改进了 DouyinAdapter

添加了 `checkLoginStatus()` 方法，参考 `dy.js` 的检测逻辑：

```typescript
/**
 * 检查登录状态（参考 dy.js 的检测逻辑）
 * 检查多个关键元素来确认是否已登录
 */
private async checkLoginStatus(page: Page): Promise<boolean> {
  // 方法1：检查用户头像（参考 dy.js 中的 .img-PeynF_）
  const hasAvatar = await page.locator('.img-PeynF_').isVisible({ timeout: 3000 }).catch(() => false);
  if (hasAvatar) {
    return true;
  }

  // 方法2：检查用户名（参考 dy.js 中的 .name-_lSSDc）
  const hasName = await page.locator('.name-_lSSDc').isVisible({ timeout: 3000 }).catch(() => false);
  if (hasName) {
    return true;
  }

  // 方法3：检查"高清发布"按钮
  const hasPublishButton = await page.getByRole('button', { name: '高清发布' }).isVisible({ timeout: 3000 }).catch(() => false);
  if (hasPublishButton) {
    return true;
  }

  // 方法4：检查账号ID（参考 dy.js 中的 .unique_id-EuH8eA）
  const hasAccount = await page.locator('.unique_id-EuH8eA').isVisible({ timeout: 3000 }).catch(() => false);
  if (hasAccount) {
    return true;
  }

  return false;
}
```

### 3. 改进了发布流程

在 `PublishingExecutor.ts` 中，Cookie登录后**立即验证登录状态**：

```typescript
// 设置Cookie
await context.addCookies(normalizedCookies);

// 导航到发布页面
await browserAutomationService.navigateTo(page, adapter.getPublishUrl(), taskId);

// 🔍 关键改进：验证Cookie是否有效（检测是否掉线）
await publishingService.logMessage(taskId, 'info', '🔍 验证登录状态...');
loginSuccess = await browserAutomationService.executeWithRetry(
  () => adapter.performLogin(page!, account.credentials),
  1, // 只尝试1次，因为Cookie要么有效要么无效
  taskId
);

if (loginSuccess) {
  await publishingService.logMessage(taskId, 'info', `✅ ${adapter.platformName} Cookie有效，已登录`);
} else {
  await publishingService.logMessage(taskId, 'error', `❌ ${adapter.platformName} Cookie已失效或平台已掉线`);
  throw new Error(`${adapter.platformName} Cookie已失效，请重新登录`);
}
```

## 参考代码分析

### 登录器的检测模式

参考代码使用 `setInterval` 定时检查DOM元素：

```javascript
// dy.js - 抖音登录器
_interval = setInterval(() => {
    var avatar = document.querySelector('.img-PeynF_')
    
    if (avatar !== null && avatar !== undefined) {
        console.log("登录成功")
        // 提取用户信息
        var value = {
            avatar: srcValue,
            account: account.textContent,
            name: name.textContent,
            cookie: document.cookie,
        }
        ipcRenderer.sendToHost('checkLogin', value)
        clearInterval(_interval);
    } else {
        console.log("还未登录成功")
    }
}, 1000) // 每1秒检查一次
```

**核心思路**：
1. 每1秒检查一次特定的DOM元素（如用户头像）
2. 如果元素存在 = 已登录
3. 如果元素不存在 = 未登录或已掉线

### 我们的实现

我们采用了相同的思路，但做了改进：

1. **多重验证**：检查多个关键元素（头像、用户名、账号ID、发布按钮）
2. **主动检测**：在发布前主动检测，而不是等到发布失败
3. **灵活配置**：支持单次检测、持续监控、定时轮询等多种模式

## 检测流程对比

### 之前的流程 ❌

```
1. 设置Cookie
2. 导航到发布页面
3. 假设已登录 ✅
4. 开始发布
5. 发布失败 ❌ （此时才发现掉线）
```

### 现在的流程 ✅

```
1. 设置Cookie
2. 导航到发布页面
3. 🔍 检查登录状态
   - 检查用户头像
   - 检查用户名
   - 检查账号ID
   - 检查发布按钮
4. 如果已登录 ✅
   - 继续发布
5. 如果未登录 ❌
   - 立即报错：Cookie已失效
   - 提示用户重新登录
```

## 各平台检测选择器

根据参考代码，整理了所有平台的检测选择器：

| 平台 | 参考文件 | 检测元素 | 选择器 |
|------|---------|---------|--------|
| 抖音 | dy.js | 用户头像 | `.img-PeynF_` |
| | | 用户名 | `.name-_lSSDc` |
| | | 账号ID | `.unique_id-EuH8eA` |
| 头条 | tt.js | 用户名 | `.auth-avator-name` |
| | | 用户头像 | `.auth-avator-img` |
| 小红书 | xhs.js | 用户名 | `.account-name` |
| | | 用户头像 | `.avatar img` |
| 搜狐号 | sh.js | 用户名 | `.user-name` |
| | | 用户头像 | `.user-pic` |
| 网易号 | wy.js | 用户区域 | `.topBar__user>span` |
| | | 用户头像 | `.topBar__user>span>img` |
| 百家号 | bjh.js | 用户头像 | `.UjPPKm89R4RrZTKhwG5H` |
| | | 用户名 | `.user-name` |
| 知乎 | zh.js | 用户头像 | `img.AppHeader-profileAvatar` |
| CSDN | csdn.js | 头像容器 | `.hasAvatar` |
| 简书 | js.js | 用户头像 | `.avatar>img` |
| 微信公众号 | wxgzh.js | 用户名 | `.weui-desktop_name` |
| 企鹅号 | qeh.js | 用户名 | `span.usernameText-cls2j9OE` |
| 哔哩哔哩 | bili.js | 入口文本 | `span.right-entry-text` |

## 使用示例

### 1. 在发布前检测（推荐）

```typescript
// 在 performLogin 中调用 checkLoginStatus
async performLogin(page: Page, credentials: any): Promise<boolean> {
  // 设置Cookie
  await context.addCookies(credentials.cookies);
  
  // 导航到发布页面
  await page.goto(this.getPublishUrl());
  
  // 🔍 检查登录状态
  const isLoggedIn = await this.checkLoginStatus(page);
  
  if (!isLoggedIn) {
    throw new Error('Cookie已失效或平台已掉线');
  }
  
  return true;
}
```

### 2. 持续监控（可选）

```typescript
import { LoginStatusChecker } from './services/LoginStatusChecker';

// 开始监控
const stopMonitoring = LoginStatusChecker.startMonitoring(
  page,
  adapter,
  (isOnline) => {
    if (!isOnline) {
      console.log('⚠️ 检测到平台掉线！');
      // 执行掉线处理逻辑
    }
  },
  10000 // 每10秒检查一次
);

// 发布完成后停止监控
stopMonitoring();
```

### 3. 定时轮询（参考登录器模式）

```typescript
// 等待登录成功（每2秒检查一次，最多尝试30次）
const loginSuccess = await LoginStatusChecker.waitForLogin(
  page,
  adapter,
  2000,  // 检查间隔
  30     // 最大尝试次数
);

if (!loginSuccess) {
  throw new Error('登录超时');
}
```

## 文件清单

### 新创建的文件

1. `server/src/services/LoginStatusChecker.ts` - 登录状态检测服务
2. `LOGIN_STATUS_DETECTION.md` - 详细技术文档
3. `LOGIN_DETECTION_SUMMARY.md` - 本文档

### 修改的文件

1. `server/src/services/adapters/DouyinAdapter.ts` - 添加了 `checkLoginStatus()` 方法
2. `server/src/services/PublishingExecutor.ts` - 在Cookie登录后添加了状态验证

## 下一步建议

### 1. 为所有平台添加检测方法 ⭐ 优先

为每个Adapter添加 `checkLoginStatus()` 方法：

```typescript
// 示例：ToutiaoAdapter
private async checkLoginStatus(page: Page): Promise<boolean> {
  // 检查用户名（参考 tt.js）
  const hasName = await page.locator('.auth-avator-name').isVisible({ timeout: 3000 }).catch(() => false);
  if (hasName) return true;

  // 检查用户头像
  const hasAvatar = await page.locator('.auth-avator-img').isVisible({ timeout: 3000 }).catch(() => false);
  if (hasAvatar) return true;

  return false;
}
```

### 2. 添加自动重试机制

当检测到掉线时，自动尝试重新登录：

```typescript
if (!isLoggedIn) {
  console.log('检测到掉线，尝试重新登录...');
  
  // 清除旧Cookie
  await context.clearCookies();
  
  // 重新登录
  const loginSuccess = await adapter.performLogin(page, credentials);
  
  if (!loginSuccess) {
    throw new Error('重新登录失败');
  }
}
```

### 3. 添加掉线通知

当检测到掉线时，通知用户：

```typescript
if (!isLoggedIn) {
  await notificationService.send({
    type: 'warning',
    title: '平台掉线',
    message: `${adapter.platformName} 账号已掉线，请重新登录`
  });
}
```

## 技术亮点

1. **参考了真实的登录器代码**：完全基于 `/Downloads/geo/resources/app-extracted/src/api/script/` 中的实现
2. **多重验证机制**：检查多个关键元素，提高检测准确性
3. **主动检测**：在发布前主动检测，避免浪费时间
4. **灵活配置**：支持单次检测、持续监控、定时轮询等多种模式
5. **类型安全**：使用TypeScript，确保类型安全

## 总结

### ✅ 已实现

1. 创建了 `LoginStatusChecker` 服务
2. 改进了 `DouyinAdapter` 的登录检测
3. 在发布流程中添加了Cookie验证
4. 参考了所有平台的登录器代码
5. TypeScript编译通过

### 🎯 核心改进

**之前**：假设Cookie永远有效，直到发布失败才发现掉线

**现在**：在发布前主动检测登录状态，及时发现掉线问题

### 💡 效果

- ✅ 提前发现掉线问题
- ✅ 避免浪费时间和资源
- ✅ 提供更好的用户体验
- ✅ 支持自动重试和恢复（待实现）

### 📝 待完善

1. 为其他11个平台添加 `checkLoginStatus()` 方法
2. 添加自动重试机制
3. 添加掉线通知功能
4. 添加持续监控功能（可选）
