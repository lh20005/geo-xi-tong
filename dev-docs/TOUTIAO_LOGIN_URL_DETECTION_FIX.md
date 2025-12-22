# 头条号登录检测修复 - URL变化检测

## 问题描述

Windows端头条号登录时，显示"Login failed"错误。错误日志显示：
```
ERR_ABORTED (-3) loading 'https://mp.toutiao.com/passport/sso/login/callback/...'
```

## 根本原因

Windows端的登录检测逻辑与网页端不一致：

### 网页端（工作正常）
- 使用 Puppeteer
- 检测策略：**等待URL发生任何变化**
- 代码：`await page.waitForFunction('window.location.href !== "${initialUrl}"')`
- 简单可靠，不依赖特定URL模式

### Windows端（之前的问题）
- 使用 Electron BrowserView
- 检测策略：**匹配数据库中配置的特定URL模式**
- 问题：头条的登录回调URL会被中止加载（ERR_ABORTED），导致无法匹配到成功URL模式

## 解决方案

修改 `windows-login-manager/electron/login/login-detector.ts` 的 `waitForLoginSuccess` 方法，采用与网页端相同的策略：

### 核心改进

1. **记录初始登录URL**
   ```typescript
   const initialUrl = view.webContents.getURL();
   ```

2. **检测任何URL变化**（主要策略）
   ```typescript
   if (currentUrl !== initialUrl) {
     // 排除错误页面
     if (currentUrl.includes('about:blank') || currentUrl.includes('chrome-error://')) {
       return;
     }
     // 登录成功！
   }
   ```

3. **保留URL模式匹配**（备用策略）
   - 如果配置了 `successUrls`，也会检查
   - 但不再依赖它作为唯一判断标准

4. **保留元素检测**（备用策略）
   - 如果配置了 `successSelectors`，也会检查
   - 作为额外的验证手段

### 检测优先级

1. **URL变化检测**（最高优先级，最可靠）
   - 监听 `did-navigate` 和 `did-navigate-in-page` 事件
   - 每500ms轮询检查（防止事件丢失）
   
2. **URL模式匹配**（次要）
   - 如果URL匹配 `successUrls` 配置

3. **元素检测**（备用）
   - 如果检测到 `successSelectors` 配置的元素

## 修改的文件

- `windows-login-manager/electron/login/login-detector.ts`
  - 修改 `waitForLoginSuccess` 方法
  - 添加初始URL记录
  - 优先检测URL变化
  - 添加详细的日志输出

## 测试步骤

1. **启动服务**
   ```bash
   # 已启动
   # Process 12: 后端服务
   # Process 13: Electron应用
   ```

2. **测试头条号登录**
   - 打开Electron应用
   - 点击"头条号"平台卡片
   - 在浏览器中完成登录
   - 观察是否能正确检测到登录成功

3. **预期结果**
   - 登录后URL从 `https://sso.toutiao.com/...` 变化到 `https://mp.toutiao.com/...`
   - 系统检测到URL变化，判定登录成功
   - 提取用户信息并保存账号
   - 显示"登录成功"消息

## 技术细节

### 为什么URL变化检测更可靠？

1. **不依赖特定URL模式**
   - 平台可能更改登录后的跳转URL
   - 不同账号可能跳转到不同页面
   - URL变化是登录成功的通用标志

2. **避免回调URL加载问题**
   - 头条的回调URL可能被中止加载（ERR_ABORTED）
   - 但URL已经变化，可以被检测到
   - 不需要等待页面完全加载

3. **与网页端一致**
   - 网页端已验证此方法可靠
   - 保持两端逻辑一致，便于维护

### 错误页面过滤

排除以下URL变化：
- `about:blank` - 空白页
- `chrome-error://` - Chrome错误页

这些不是真正的登录成功。

## 日志输出

修改后的日志更详细：

```
[info] Starting login detection... Initial URL: https://sso.toutiao.com/...
[info] Login success detected by URL change: https://sso.toutiao.com/... -> https://mp.toutiao.com/...
```

或者：

```
[info] Login success detected by URL change (polling): https://sso.toutiao.com/... -> https://mp.toutiao.com/...
```

## 相关文档

- `dev-docs/TOUTIAO_LOGIN_FIX.md` - 之前的修复（选择器配置）
- `dev-docs/TOUTIAO_LOGIN_COMPLETE_FIX.md` - 之前的修复（URL检测配置）
- `server/src/services/AccountService.ts` - 网页端登录实现（参考）

## 总结

通过采用与网页端相同的URL变化检测策略，Windows端的登录检测变得更加可靠和简单。不再依赖特定的URL模式配置，避免了回调URL加载问题，提高了登录成功率。
