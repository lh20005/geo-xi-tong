# 平台登录状态检测机制

## 问题背景

当平台账号掉线（Cookie过期、被强制登出等）时，系统无法及时发现，导致：
- 发布任务失败
- 浪费时间和资源
- 用户体验差

## 参考代码分析

参考 `/Downloads/geo/resources/app-extracted/src/api/script/` 中的登录器代码，他们使用**定时轮询检测**的方式：

### 抖音登录器 (dy.js)

```javascript
const { ipcRenderer } = require('electron')

let _interval = '';
ipcRenderer.on('checkLogin', (event, args) => {
    console.log('checkLogin 收到主进程消息:', args)
    _interval = setInterval(() => {
        //判断抖音是否登录成功
        console.log("判断抖音是否登录成功")
       
        var avatar = document.querySelector('.img-PeynF_')

        if (avatar !== null && avatar !== undefined) {
            console.log("登录成功")
            let srcValue = null
            try{
                srcValue = avatar.getAttribute('src');
            }catch(error){
                console.log("获取图片失败")
            }
      
            let account = document.querySelector('.unique_id-EuH8eA')
            console.log("account:", account.textContent);

            let name = document.querySelector('.name-_lSSDc')
            console.log("name:", name.textContent);

            var value = {
                avatar: srcValue,
                account: account.textContent,
                name: name.textContent,
                cookie: document.cookie,
                follower_count:'',
            }

            console.log('checkLogin end', value)
            ipcRenderer.sendToHost('checkLogin', value)
            clearInterval(_interval);
        } else {
            console.log("还未登录成功")
        }
    }, 1000) // 每1秒检查一次
})
```

### 核心思路

1. **定时检查**：每1-2秒检查一次特定的DOM元素
2. **多重验证**：检查多个关键元素（头像、用户名、账号ID等）
3. **状态判断**：
   - 元素存在 = 已登录
   - 元素不存在 = 未登录或已掉线

## 我们的实现

### 1. LoginStatusChecker 服务

创建了专门的登录状态检测服务：`server/src/services/LoginStatusChecker.ts`

#### 核心方法

```typescript
// 1. 单次检查登录状态
static async checkLoginStatus(page: Page, adapter: PlatformAdapter): Promise<boolean>

// 2. 持续检查登录状态（定时轮询）
static async waitForLogin(page: Page, adapter: PlatformAdapter, intervalMs: number = 2000, maxAttempts: number = 30): Promise<boolean>

// 3. 验证Cookie是否有效（在发布前检查）
static async verifyCookieValid(page: Page, adapter: PlatformAdapter): Promise<boolean>

// 4. 提取用户信息
static async extractUserInfo(page: Page, adapter: PlatformAdapter): Promise<UserInfo | null>

// 5. 检测平台是否掉线
static async isOnline(page: Page, adapter: PlatformAdapter): Promise<boolean>

// 6. 监控登录状态（持续监控）
static startMonitoring(page: Page, adapter: PlatformAdapter, onStatusChange: (isOnline: boolean) => void, intervalMs: number = 10000): () => void
```

### 2. 改进的 DouyinAdapter

在 `DouyinAdapter` 中添加了 `checkLoginStatus()` 方法，参考 dy.js 的检测逻辑：

```typescript
/**
 * 检查登录状态（参考 dy.js 的检测逻辑）
 * 检查多个关键元素来确认是否已登录
 */
private async checkLoginStatus(page: Page): Promise<boolean> {
  try {
    await this.log('info', '🔍 检查抖音登录状态...');

    // 方法1：检查用户头像（参考 dy.js 中的 .img-PeynF_）
    const hasAvatar = await page.locator('.img-PeynF_').isVisible({ timeout: 3000 }).catch(() => false);
    if (hasAvatar) {
      await this.log('info', '✅ 检测到用户头像，已登录');
      return true;
    }

    // 方法2：检查用户名（参考 dy.js 中的 .name-_lSSDc）
    const hasName = await page.locator('.name-_lSSDc').isVisible({ timeout: 3000 }).catch(() => false);
    if (hasName) {
      await this.log('info', '✅ 检测到用户名，已登录');
      return true;
    }

    // 方法3：检查"高清发布"按钮
    const hasPublishButton = await page.getByRole('button', { name: '高清发布' }).isVisible({ timeout: 3000 }).catch(() => false);
    if (hasPublishButton) {
      await this.log('info', '✅ 检测到发布按钮，已登录');
      return true;
    }

    // 方法4：检查账号ID（参考 dy.js 中的 .unique_id-EuH8eA）
    const hasAccount = await page.locator('.unique_id-EuH8eA').isVisible({ timeout: 3000 }).catch(() => false);
    if (hasAccount) {
      await this.log('info', '✅ 检测到账号ID，已登录');
      return true;
    }

    await this.log('warning', '❌ 未检测到登录标志，可能未登录或已掉线');
    return false;

  } catch (error: any) {
    await this.log('error', '登录状态检查失败', { error: error.message });
    return false;
  }
}
```

### 3. 改进的发布流程

在 `PublishingExecutor.ts` 中，Cookie登录后立即验证登录状态：

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

## 检测机制对比

### 参考代码（登录器）

| 特点 | 说明 |
|------|------|
| 检测方式 | 定时轮询（setInterval） |
| 检测频率 | 每1秒检查一次 |
| 检测元素 | 用户头像、用户名、账号ID |
| 检测时机 | 登录过程中持续检测 |
| 停止条件 | 检测到登录成功后停止 |

### 我们的实现

| 特点 | 说明 |
|------|------|
| 检测方式 | 多重验证（多个元素） |
| 检测频率 | 发布前检测 + 可选持续监控 |
| 检测元素 | 用户头像、用户名、账号ID、发布按钮 |
| 检测时机 | Cookie登录后、发布前、发布过程中（可选） |
| 停止条件 | 检测到掉线或发布完成 |

## 各平台检测选择器

### 抖音 (douyin)

参考 `dy.js`：

```typescript
// 用户头像
'.img-PeynF_'

// 用户名
'.name-_lSSDc'

// 账号ID
'.unique_id-EuH8eA'

// 发布按钮
'button:has-text("高清发布")'
```

### 头条 (toutiao)

参考 `tt.js`：

```typescript
// 用户名
'.auth-avator-name'

// 用户头像
'.auth-avator-img'

// 粉丝数
'.data-board-item-primary'
```

### 小红书 (xiaohongshu)

参考 `xhs.js`：

```typescript
// 用户名
'.account-name'

// 用户头像
'.avatar img'

// 账号信息
'.others.description-text div'
```

### 搜狐号 (souhu)

参考 `sh.js`：

```typescript
// 用户名
'.user-name'

// 用户头像
'.user-pic'
```

### 网易号 (wangyi)

参考 `wy.js`：

```typescript
// 顶部用户区域
'.topBar__user>span'

// 用户头像
'.topBar__user>span>img'

// 粉丝数
'.homeV4__board__card__data__value'
```

### 百家号 (baijiahao)

参考 `bjh.js`：

```typescript
// 用户头像
'.UjPPKm89R4RrZTKhwG5H'

// 用户名
'.user-name'
```

### 知乎 (zhihu)

参考 `zh.js`：

```typescript
// 用户头像
'img.AppHeader-profileAvatar'

// API验证
'https://www.zhihu.com/api/v4/me?include=is_realname'
```

### CSDN

参考 `csdn.js`：

```typescript
// 头像容器
'.hasAvatar'

// API验证
'https://g-api.csdn.net/community/toolbar-api/v1/get-user-info'
```

### 简书 (jianshu)

参考 `js.js`：

```typescript
// 用户头像
'.avatar>img'

// 用户名
'.main-top .name'

// 粉丝数
'.main-top .meta-block p'
```

### 微信公众号 (wechat)

参考 `wxgzh.js`：

```typescript
// 用户名
'.weui-desktop_name'

// 用户头像
'.weui-desktop-account__img'

// 粉丝数
'.weui-desktop-user_sum span'
```

### 企鹅号 (qie)

参考 `qeh.js`：

```typescript
// 用户名
'span.usernameText-cls2j9OE'

// 用户头像
'div.omui-avatar img'

// 粉丝数
'div.omui-total__num>a'
```

### 哔哩哔哩 (bilibili)

参考 `bili.js`：

```typescript
// 右侧入口文本
'span.right-entry-text'

// API验证
'https://api.bilibili.com/x/web-interface/nav'
```

## 使用示例

### 1. 基础检测

```typescript
import { LoginStatusChecker } from './services/LoginStatusChecker';

// 检查登录状态
const isLoggedIn = await LoginStatusChecker.checkLoginStatus(page, adapter);

if (!isLoggedIn) {
  console.log('平台已掉线，需要重新登录');
}
```

### 2. 持续监控

```typescript
// 开始监控登录状态
const stopMonitoring = LoginStatusChecker.startMonitoring(
  page,
  adapter,
  (isOnline) => {
    if (!isOnline) {
      console.log('检测到平台掉线！');
      // 执行掉线处理逻辑
    }
  },
  10000 // 每10秒检查一次
);

// 发布完成后停止监控
stopMonitoring();
```

### 3. 验证Cookie

```typescript
// 在发布前验证Cookie是否有效
const isCookieValid = await LoginStatusChecker.verifyCookieValid(page, adapter);

if (!isCookieValid) {
  throw new Error('Cookie已失效，请重新登录');
}
```

## 改进建议

### 1. 为所有平台添加检测方法

建议为每个Adapter添加 `checkLoginStatus()` 方法，参考对应的登录器代码：

```typescript
// 示例：ToutiaoAdapter
private async checkLoginStatus(page: Page): Promise<boolean> {
  // 检查用户名（参考 tt.js）
  const hasName = await page.locator('.auth-avator-name').isVisible({ timeout: 3000 }).catch(() => false);
  if (hasName) {
    return true;
  }

  // 检查用户头像
  const hasAvatar = await page.locator('.auth-avator-img').isVisible({ timeout: 3000 }).catch(() => false);
  if (hasAvatar) {
    return true;
  }

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
  
  if (loginSuccess) {
    console.log('重新登录成功');
  } else {
    throw new Error('重新登录失败');
  }
}
```

### 3. 添加掉线通知

当检测到掉线时，通知用户：

```typescript
if (!isLoggedIn) {
  // 发送通知给用户
  await notificationService.send({
    type: 'warning',
    title: '平台掉线',
    message: `${adapter.platformName} 账号已掉线，请重新登录`
  });
}
```

## 总结

### ✅ 已实现

1. 创建了 `LoginStatusChecker` 服务
2. 改进了 `DouyinAdapter` 的登录检测
3. 在发布流程中添加了Cookie验证
4. 参考了所有平台的登录器代码

### ⚠️ 待完善

1. 为其他11个平台添加 `checkLoginStatus()` 方法
2. 添加自动重试机制
3. 添加掉线通知功能
4. 添加持续监控功能（可选）

### 💡 核心改进

**之前**：假设Cookie永远有效，直到发布失败才发现掉线
**现在**：在发布前主动检测登录状态，及时发现掉线问题

这样可以：
- 提前发现掉线问题
- 避免浪费时间和资源
- 提供更好的用户体验
- 支持自动重试和恢复
