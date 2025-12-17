# Cookie自动登录修复完成 ✅

## 问题描述

点击发布任务的"执行"按钮后，浏览器弹出但仍然显示登录页面，需要手动输入用户名和密码，没有使用已保存的Cookie实现免登录。

## 问题诊断

### 1. 数据检查
- ✅ Cookie已正确保存到数据库（30个Cookie）
- ✅ 账号凭证包含cookies字段
- ✅ 凭证解密正常

### 2. 代码流程问题

**原来的流程**:
```
1. 启动浏览器
2. 导航到登录页面 ← 问题在这里！
3. 调用adapter.performLogin()
4. 适配器尝试使用Cookie
```

**问题**: 先导航到登录页面，然后才尝试Cookie登录，这样Cookie可能无法正确应用。

## 修复方案

### 修改1: PublishingExecutor.ts

改进登录流程，根据是否有Cookie选择不同的策略：

**修改前**:
```typescript
// 直接导航到登录页面
await browserAutomationService.navigateTo(
  page,
  adapter.getLoginUrl(),
  taskId
);

const loginSuccess = await adapter.performLogin(page!, account.credentials);
```

**修改后**:
```typescript
// 如果有Cookie，先导航到主页
if (account.credentials.cookies && account.credentials.cookies.length > 0) {
  await publishingService.logMessage(taskId, 'info', `使用Cookie登录（${account.credentials.cookies.length}个Cookie）`);
  
  // 导航到主页（不是登录页）
  const homeUrl = adapter.getPublishUrl().split('/').slice(0, 3).join('/');
  await browserAutomationService.navigateTo(page, homeUrl, taskId);
  
  // 执行登录（适配器会使用Cookie）
  const loginSuccess = await adapter.performLogin(page!, account.credentials);
  
  if (!loginSuccess) {
    throw new Error('Cookie登录失败');
  }
} else {
  // 没有Cookie，使用表单登录
  await browserAutomationService.navigateTo(page, adapter.getLoginUrl(), taskId);
  const loginSuccess = await adapter.performLogin(page!, account.credentials);
  
  if (!loginSuccess) {
    throw new Error('表单登录失败');
  }
}
```

### 修改2: ToutiaoAdapter.ts

简化适配器的登录逻辑，因为页面已经在正确的位置：

**修改前**:
```typescript
if (credentials.cookies && credentials.cookies.length > 0) {
  console.log('[头条号] 使用Cookie登录');
  
  // 先导航到主页
  await page.goto('https://mp.toutiao.com/', { waitUntil: 'networkidle2' });
  
  // 设置Cookie
  const loginSuccess = await this.loginWithCookies(page, credentials.cookies);
  // ...
}
```

**修改后**:
```typescript
if (credentials.cookies && credentials.cookies.length > 0) {
  console.log('[头条号] 使用Cookie登录');
  
  // 页面已经在主页了，直接设置Cookie
  const loginSuccess = await this.loginWithCookies(page, credentials.cookies);
  
  if (loginSuccess) {
    const verified = await this.verifyCookieLogin(page);
    if (verified) {
      console.log('✅ 头条号Cookie登录成功');
      return true;
    }
  }
  
  // Cookie登录失败，导航到登录页
  console.log('[头条号] Cookie登录失败，尝试表单登录');
  await page.goto(this.getLoginUrl(), { waitUntil: 'networkidle2' });
}
```

## 修复的关键点

### 1. 正确的Cookie登录流程

```
有Cookie的情况:
1. 启动浏览器
2. 导航到主页（https://mp.toutiao.com/）
3. 设置Cookie
4. 刷新页面
5. 验证登录状态
6. 如果成功，直接进入发布流程

没有Cookie的情况:
1. 启动浏览器
2. 导航到登录页面
3. 填写表单
4. 提交登录
```

### 2. 为什么要先导航到主页？

- Cookie需要在正确的域名下设置
- 登录页面可能有特殊的安全机制
- 主页设置Cookie后刷新，更接近真实用户行为

### 3. 验证登录状态

```typescript
protected async verifyCookieLogin(page: Page): Promise<boolean> {
  try {
    const selectors = this.getLoginSelectors();
    if (selectors.successIndicator) {
      // 等待登录成功的标识元素出现
      await page.waitForSelector(selectors.successIndicator, { timeout: 5000 });
      return true;
    }
    return true;
  } catch (error) {
    console.error('[Cookie登录验证] 失败:', error);
    return false;
  }
}
```

## 测试步骤

### 1. 确保服务器已重载

服务器使用 `tsx watch`，应该自动重载。如果没有，手动重启：

```bash
# 在服务器终端按 Ctrl+C
cd server
npm run dev
```

### 2. 创建新的发布任务

1. 访问 http://localhost:5173/publishing-tasks
2. 选择文章和平台（确保平台已通过浏览器登录保存了Cookie）
3. 点击"创建发布任务"

### 3. 执行任务

1. 在任务列表中找到新任务
2. 点击"执行"按钮
3. 确认对话框中点击"确定"

### 4. 预期结果

- ✅ Chrome浏览器窗口弹出
- ✅ 自动导航到平台主页（不是登录页）
- ✅ 自动设置Cookie
- ✅ 页面刷新后显示已登录状态
- ✅ 自动导航到发布页面
- ✅ 自动填写并发布文章
- ❌ **不应该**看到登录表单

### 5. 查看日志

点击任务的"日志"按钮，应该看到：

```
[info] 开始执行发布任务
[info] 使用适配器: 头条号
[info] 启动浏览器
[info] 开始登录
[info] 使用Cookie登录（30个Cookie）
[info] 导航到: https://mp.toutiao.com/
[info] 登录成功
[info] 导航到发布页面
[info] 开始发布文章
[info] ✅ 文章发布成功
```

## 故障排查

### 问题1: 仍然显示登录页面

**可能原因**:
- Cookie已过期
- Cookie域名不匹配
- 平台更新了登录机制

**解决方法**:
1. 重新在"平台登录"页面登录
2. 保存新的Cookie
3. 重试发布任务

### 问题2: Cookie登录失败，回退到表单登录

**现象**: 日志显示"Cookie登录失败，尝试表单登录"

**原因**: Cookie验证失败，系统自动回退到表单登录

**解决**: 这是正常的后备机制，会自动填写表单登录

### 问题3: 浏览器启动失败

**错误**: "浏览器启动失败"

**解决**: 参考之前的修复文档 `BROWSER_LAUNCH_FIX.md`

## 相关文件

- ✅ `server/src/services/PublishingExecutor.ts` - 发布执行器（已修改）
- ✅ `server/src/services/adapters/ToutiaoAdapter.ts` - 头条号适配器（已修改）
- ✅ `server/src/services/adapters/PlatformAdapter.ts` - 基类（包含Cookie登录逻辑）
- ✅ `server/src/services/AccountService.ts` - 账号服务（保存Cookie）

## 其他平台

相同的修复逻辑适用于所有平台：
- CSDN
- 掘金
- 知乎
- 简书
- 微信公众号
- 等等...

所有适配器都继承自 `PlatformAdapter`，使用相同的 `loginWithCookies` 方法。

## 优化建议

### 1. Cookie过期检测

可以添加Cookie过期时间检测：

```typescript
// 检查Cookie是否过期
const isExpired = credentials.cookies.some(cookie => {
  if (cookie.expires) {
    return new Date(cookie.expires * 1000) < new Date();
  }
  return false;
});

if (isExpired) {
  console.log('[Cookie] 检测到过期Cookie，使用表单登录');
  // 使用表单登录
}
```

### 2. 自动刷新Cookie

定期执行浏览器登录，刷新Cookie：

```typescript
// 每7天自动刷新一次Cookie
setInterval(async () => {
  const accounts = await accountService.getAllAccounts();
  for (const account of accounts) {
    await accountService.refreshCookies(account.id);
  }
}, 7 * 24 * 60 * 60 * 1000);
```

### 3. Cookie健康检查

在执行任务前检查Cookie是否有效：

```typescript
async checkCookieHealth(accountId: number): Promise<boolean> {
  const account = await accountService.getAccountById(accountId, true);
  if (!account.credentials.cookies) {
    return false;
  }
  
  // 启动浏览器测试Cookie
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setCookie(...account.credentials.cookies);
  await page.goto(platformUrl);
  
  // 检查是否登录
  const isLoggedIn = await page.evaluate(() => {
    // 检查登录状态的逻辑
  });
  
  await browser.close();
  return isLoggedIn;
}
```

## 总结

修复完成后，发布任务执行时会：

1. ✅ 自动使用保存的Cookie登录
2. ✅ 无需手动输入用户名密码
3. ✅ 如果Cookie失败，自动回退到表单登录
4. ✅ 整个过程完全自动化

用户只需要：
1. 首次在"平台登录"页面登录一次
2. 之后所有发布任务都会自动使用Cookie登录
3. Cookie过期后重新登录即可
