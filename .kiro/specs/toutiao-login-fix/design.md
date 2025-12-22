# Design Document: Toutiao Login Fix

## Overview

本设计文档描述如何修复Windows登录管理器的头条号登录问题。核心策略是参考网页端的成功经验，简化登录检测逻辑，优先使用URL变化检测，移除不必要的页面加载等待。

## Architecture

### 系统组件

```
┌─────────────────────────────────────────────────────────────┐
│                    Windows Login Manager                     │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Login        │───▶│ Login        │───▶│ User Info    │ │
│  │ Manager      │    │ Detector     │    │ Extractor    │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            BrowserView (Electron)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend API                             │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │ Platforms    │───▶│ Database     │                      │
│  │ API          │    │ (PostgreSQL) │                      │
│  └──────────────┘    └──────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### 登录流程

```
用户点击登录
    ↓
创建BrowserView
    ↓
导航到登录页面
    ↓
等待1秒（让页面开始加载）
    ↓
开始登录检测（不等待页面完全加载）
    ├─ 策略1: URL变化检测（主要）
    │   └─ 任何URL变化都视为登录成功
    ├─ 策略2: URL模式匹配（备用）
    │   └─ 匹配successUrls中的模式
    └─ 策略3: 元素检测（备用）
        └─ 检测loginSuccess选择器
    ↓
登录成功
    ↓
提取用户信息
    ↓
捕获Cookie和Storage
    ↓
保存账号信息
    ↓
同步到后端
    ↓
完成
```

## Components and Interfaces

### 1. Login Manager

**职责：** 协调整个登录流程

**关键方法：**

```typescript
interface LoginManager {
  /**
   * 使用浏览器登录平台
   * @param parentWindow 父窗口
   * @param platform 平台配置
   * @returns 登录结果
   */
  loginWithBrowser(
    parentWindow: BrowserWindow,
    platform: Platform
  ): Promise<LoginResult>;

  /**
   * 取消登录
   */
  cancelLogin(): Promise<void>;

  /**
   * 获取登录状态
   */
  isLoggingIn(): boolean;
}
```

**修改点：**

1. 移除`waitForLoad()`调用
2. 添加1秒延迟让页面开始加载
3. 从正确位置读取`successUrls`配置

**修改前：**
```typescript
// ❌ 等待页面加载完成
await browserViewManager.waitForLoad();
```

**修改后：**
```typescript
// ✅ 不等待页面加载完成（参考网页端）
// 等待一小段时间让页面开始加载
await new Promise(resolve => setTimeout(resolve, 1000));
```

**配置读取修改：**

**修改前：**
```typescript
const detectionConfig: LoginDetectionConfig = {
  successUrls: platform.detection?.successUrls,  // ❌ undefined
};
```

**修改后：**
```typescript
const detectionConfig: LoginDetectionConfig = {
  // 优先从 selectors.successUrls 读取（新格式）
  successUrls: (platform.selectors as any).successUrls || platform.detection?.successUrls,
};
```

### 2. Login Detector

**职责：** 检测登录状态

**关键方法：**

```typescript
interface LoginDetector {
  /**
   * 等待登录成功
   * @param view BrowserView实例
   * @param config 检测配置
   * @returns 检测结果
   */
  waitForLoginSuccess(
    view: BrowserView,
    config: LoginDetectionConfig
  ): Promise<LoginDetectionResult>;

  /**
   * 取消检测
   */
  cancelDetection(): void;

  /**
   * 检查登录状态
   */
  checkLoginStatus(
    view: BrowserView,
    config: LoginDetectionConfig
  ): Promise<boolean>;
}
```

**检测策略（优先级从高到低）：**

1. **URL变化检测**（最可靠）
   - 记录初始URL
   - 监听`did-navigate`和`did-navigate-in-page`事件
   - 定期轮询检查URL变化（防止事件丢失）
   - 任何URL变化都视为登录成功（排除about:blank和chrome-error）

2. **URL模式匹配**（备用）
   - 如果配置了`successUrls`
   - 检查当前URL是否匹配任一模式
   - 支持通配符和简单包含匹配

3. **元素检测**（备用）
   - 如果配置了`successSelectors`
   - 定期检查元素是否存在
   - 找到任一元素即判定成功

**关键改进：**

```typescript
// 策略1：检测URL是否发生变化（最可靠）
if (currentUrl !== initialUrl) {
  // 排除错误页面
  if (currentUrl.includes('about:blank') || currentUrl.includes('chrome-error://')) {
    return;
  }
  
  // ✅ 登录成功！
  resolve({
    success: true,
    method: 'url',
    message: 'Login successful (URL changed)',
    url: currentUrl,
  });
}
```

### 3. User Info Extractor

**职责：** 提取用户信息

**关键方法：**

```typescript
interface UserInfoExtractor {
  /**
   * 提取用户信息
   * @param view BrowserView实例
   * @param selectors 选择器配置
   * @returns 用户信息
   */
  extractUserInfo(
    view: BrowserView,
    selectors: PlatformSelectors
  ): Promise<UserInfo>;

  /**
   * 检查元素是否存在
   */
  elementExists(
    view: BrowserView,
    selector: string
  ): Promise<boolean>;
}
```

**提取策略：**

1. 按优先级尝试所有`username`选择器
2. 找到第一个有内容的元素即返回
3. 所有选择器都失败则返回空字符串

### 4. Platform Config API

**职责：** 提供平台配置

**端点：** `GET /api/platforms/:platformId`

**响应格式：**

```typescript
interface PlatformConfig {
  platform_id: string;
  platform_name: string;
  login_url: string;
  selectors: {
    username: string[];        // 用户名选择器
    loginSuccess: string[];    // 登录成功选择器
    successUrls: string[];     // 登录成功URL模式（新增）
  };
  enabled: boolean;
}
```

**头条号配置示例：**

```json
{
  "platform_id": "toutiao",
  "platform_name": "头条号",
  "login_url": "https://mp.toutiao.com/auth/page/login",
  "selectors": {
    "username": [
      ".auth-avator-name",
      ".user-name",
      ".username",
      ".account-name",
      "[class*=\"username\"]",
      "[class*=\"user-name\"]",
      ".semi-navigation-header-username"
    ],
    "loginSuccess": [
      ".user-avatar",
      ".auth-avator-name",
      ".semi-navigation-header-username"
    ],
    "successUrls": [
      "mp.toutiao.com/profile_v4",
      "mp.toutiao.com/creator"
    ]
  },
  "enabled": true
}
```

## Data Models

### LoginDetectionConfig

```typescript
interface LoginDetectionConfig {
  successUrls?: string[];        // 登录成功URL模式
  successSelectors?: string[];   // 登录成功元素选择器
  failureSelectors?: string[];   // 登录失败元素选择器
  timeout?: number;              // 超时时间（毫秒）
}
```

### LoginDetectionResult

```typescript
interface LoginDetectionResult {
  success: boolean;                           // 是否成功
  method: 'url' | 'selector' | 'timeout' | 'failure';  // 检测方法
  message: string;                            // 消息
  url?: string;                               // 当前URL
}
```

### Platform

```typescript
interface Platform {
  platform_id: string;
  platform_name: string;
  login_url: string;
  selectors: {
    username: string[];
    loginSuccess: string[];
    successUrls?: string[];  // 可选，新增字段
  };
  detection?: LoginDetectionConfig;  // 旧格式，向后兼容
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: URL变化检测成功率

*For any* 登录流程，当用户完成登录且URL从初始登录页变化到非错误页面时，登录检测器应该在2秒内检测到登录成功。

**Validates: Requirements 3.1, 9.5**

### Property 2: 配置读取正确性

*For any* 平台配置，当从API获取配置后，successUrls应该优先从platform.selectors.successUrls读取，如果不存在则从platform.detection.successUrls读取。

**Validates: Requirements 5.1, 5.2**

### Property 3: 页面加载错误不中断流程

*For any* 登录流程，当页面触发ERR_ABORTED或其他加载错误时，登录管理器应该继续执行登录检测流程而不是抛出异常。

**Validates: Requirements 4.2, 4.3**

### Property 4: 用户信息提取回退机制

*For any* 用户名选择器列表，当第一个选择器失败时，应该按顺序尝试后续选择器，直到找到有内容的元素或所有选择器都失败。

**Validates: Requirements 6.2**

### Property 5: 取消登录清理资源

*For any* 进行中的登录流程，当调用cancelLogin时，应该停止所有检测定时器、销毁BrowserView并设置isLoginInProgress为false。

**Validates: Requirements 8.2, 8.3, 8.4**

### Property 6: API配置完整性

*For any* 平台配置API响应，当平台ID为toutiao时，响应应该包含selectors.username（7个选择器）、selectors.loginSuccess（3个选择器）和selectors.successUrls（2个URL模式）。

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 7: 日志记录完整性

*For any* 登录流程，应该记录以下关键事件：开始登录（平台ID和URL）、URL变化（初始和当前）、选择器检测结果、登录成功/失败（方法和原因）。

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

### Property 8: 与网页端行为一致性

*For any* 登录检测策略，Windows端应该与网页端使用相同的方法：优先URL变化检测、不等待页面加载、5分钟超时、忽略页面加载错误。

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

## Error Handling

### 错误类型

1. **配置错误**
   - 数据库缺少selectors字段
   - API返回不完整配置
   - 处理：记录错误日志，使用默认配置或返回友好错误消息

2. **页面加载错误**
   - ERR_ABORTED
   - ERR_CONNECTION_REFUSED
   - ERR_TIMED_OUT
   - 处理：忽略错误，继续登录检测（不中断流程）

3. **检测超时**
   - 5分钟内未检测到登录成功
   - 处理：返回超时错误，清理资源

4. **用户信息提取失败**
   - 所有选择器都失败
   - 处理：返回"Failed to extract user information"错误

5. **用户取消**
   - 用户主动取消登录
   - 处理：清理资源，返回"Login cancelled"消息（不是错误）

### 错误恢复策略

```typescript
try {
  // 登录流程
} catch (error) {
  // 1. 记录详细错误日志
  log.error('Login failed:', error);
  
  // 2. 清理资源
  await browserViewManager.destroyBrowserView();
  this.isLoginInProgress = false;
  
  // 3. 区分取消和错误
  if (error.message.includes('No BrowserView available')) {
    return { success: false, message: 'Login cancelled' };
  }
  
  // 4. 返回友好错误消息
  return {
    success: false,
    error: error.message,
    message: 'Login failed'
  };
}
```

## Testing Strategy

### Unit Tests

1. **配置读取测试**
   - 测试从selectors.successUrls读取
   - 测试从detection.successUrls回退
   - 测试两者都不存在的情况

2. **URL匹配测试**
   - 测试通配符匹配
   - 测试简单包含匹配
   - 测试错误URL过滤

3. **用户信息提取测试**
   - 测试第一个选择器成功
   - 测试回退到后续选择器
   - 测试所有选择器失败

4. **取消登录测试**
   - 测试取消时清理资源
   - 测试取消时停止检测
   - 测试取消后的状态

### Property-Based Tests

每个property-based测试应该运行至少100次迭代，使用随机生成的输入数据。

#### Property Test 1: URL变化检测

```typescript
/**
 * Feature: toutiao-login-fix, Property 1: URL变化检测成功率
 * Validates: Requirements 3.1, 9.5
 */
test('URL change detection should succeed within 2 seconds', async () => {
  // 生成随机的初始URL和目标URL
  const initialUrl = generateRandomLoginUrl();
  const targetUrl = generateRandomSuccessUrl();
  
  // 模拟URL变化
  const startTime = Date.now();
  const result = await simulateUrlChange(initialUrl, targetUrl);
  const detectionTime = Date.now() - startTime;
  
  // 验证
  expect(result.success).toBe(true);
  expect(result.method).toBe('url');
  expect(detectionTime).toBeLessThan(2000);
});
```

#### Property Test 2: 配置读取优先级

```typescript
/**
 * Feature: toutiao-login-fix, Property 2: 配置读取正确性
 * Validates: Requirements 5.1, 5.2
 */
test('successUrls should be read from correct location', async () => {
  // 生成随机配置
  const platform = generateRandomPlatformConfig();
  
  // 读取配置
  const successUrls = readSuccessUrls(platform);
  
  // 验证优先级
  if (platform.selectors.successUrls) {
    expect(successUrls).toEqual(platform.selectors.successUrls);
  } else if (platform.detection?.successUrls) {
    expect(successUrls).toEqual(platform.detection.successUrls);
  } else {
    expect(successUrls).toBeUndefined();
  }
});
```

#### Property Test 3: 页面加载错误处理

```typescript
/**
 * Feature: toutiao-login-fix, Property 3: 页面加载错误不中断流程
 * Validates: Requirements 4.2, 4.3
 */
test('page load errors should not interrupt login flow', async () => {
  // 生成随机错误类型
  const errorType = generateRandomLoadError();
  
  // 模拟页面加载错误
  const result = await simulatePageLoadError(errorType);
  
  // 验证流程继续
  expect(result.flowContinued).toBe(true);
  expect(result.exceptionThrown).toBe(false);
});
```

#### Property Test 4: 用户信息提取回退

```typescript
/**
 * Feature: toutiao-login-fix, Property 4: 用户信息提取回退机制
 * Validates: Requirements 6.2
 */
test('username extraction should try all selectors in order', async () => {
  // 生成随机选择器列表和成功索引
  const selectors = generateRandomSelectors();
  const successIndex = Math.floor(Math.random() * selectors.length);
  
  // 模拟提取
  const result = await extractUsernameWithFailures(selectors, successIndex);
  
  // 验证尝试顺序
  expect(result.attemptedSelectors).toEqual(selectors.slice(0, successIndex + 1));
  expect(result.success).toBe(true);
});
```

#### Property Test 5: 取消登录清理

```typescript
/**
 * Feature: toutiao-login-fix, Property 5: 取消登录清理资源
 * Validates: Requirements 8.2, 8.3, 8.4
 */
test('cancel login should clean up all resources', async () => {
  // 启动登录流程
  const loginProcess = startLoginProcess();
  
  // 随机时间后取消
  await sleep(Math.random() * 1000);
  await cancelLogin();
  
  // 验证清理
  expect(loginProcess.timersCleared).toBe(true);
  expect(loginProcess.browserViewDestroyed).toBe(true);
  expect(loginProcess.isLoginInProgress).toBe(false);
});
```

### Integration Tests

1. **完整登录流程测试**
   - 启动Windows登录管理器
   - 模拟用户登录
   - 验证账号保存成功

2. **API集成测试**
   - 验证API返回正确配置
   - 验证配置被正确使用

3. **数据库集成测试**
   - 验证数据库包含正确配置
   - 验证迁移脚本执行成功

### Manual Testing

1. **真实登录测试**
   - 打开Windows登录管理器
   - 点击头条号登录
   - 在浏览器中完成登录
   - 验证登录成功并保存账号

2. **错误场景测试**
   - 测试网络错误
   - 测试页面加载错误
   - 测试超时场景
   - 测试取消登录

3. **日志验证**
   - 检查日志输出是否完整
   - 检查错误信息是否清晰
   - 检查调试信息是否有用

## Implementation Notes

### 关键修改点

1. **login-manager.ts**
   - 移除`waitForLoad()`调用
   - 添加1秒延迟
   - 修正`successUrls`读取位置

2. **login-detector.ts**
   - 已经实现了正确的URL变化检测
   - 已经实现了取消功能
   - 无需修改

3. **数据库迁移**
   - 009迁移：添加selectors字段
   - 010迁移：添加successUrls配置
   - 需要验证是否已执行

### 验证步骤

1. **验证数据库配置**
   ```sql
   SELECT platform_id, login_url, selectors 
   FROM platforms_config 
   WHERE platform_id = 'toutiao';
   ```

2. **验证API响应**
   ```bash
   curl http://localhost:3000/api/platforms/toutiao | jq '.selectors'
   ```

3. **测试登录流程**
   - 启动应用
   - 执行登录
   - 检查日志

### 向后兼容性

- 保留`platform.detection`字段支持
- 优先使用新格式`platform.selectors.successUrls`
- 回退到旧格式`platform.detection.successUrls`
- 两者都不存在时使用纯URL变化检测

## References

- [TOUTIAO_LOGIN_COMPLETE_FIX.md](../../dev-docs/TOUTIAO_LOGIN_COMPLETE_FIX.md)
- [TOUTIAO_LOGIN_FINAL_FIX.md](../../dev-docs/TOUTIAO_LOGIN_FINAL_FIX.md)
- [TOUTIAO_LOGIN_FIX.md](../../dev-docs/TOUTIAO_LOGIN_FIX.md)
- [AccountService.ts](../../server/src/services/AccountService.ts)
- [login-manager.ts](../../windows-login-manager/electron/login/login-manager.ts)
- [login-detector.ts](../../windows-login-manager/electron/login/login-detector.ts)
