# 头条号登录失败故障排查指南

## 当前状态

✅ 数据库配置已更新  
✅ API 返回正确的选择器配置  
❌ Windows 端仍然显示 "Login failed"

## 可能的原因

### 1. 登录检测超时

**症状：** 登录完成后等待很久，最后显示 "Login failed"

**原因：** 登录检测器在 5 分钟内没有检测到登录成功的标志

**检查方法：**
```bash
# 查看 Windows 登录管理器的控制台输出
# 应该看到类似的日志：
[LoginDetector] Starting login detection...
[LoginDetector] Login detection timeout  # ❌ 这表示超时了
```

**可能的子原因：**

#### 1.1 登录成功选择器不匹配

头条号登录后的页面元素可能与配置的选择器不匹配。

**当前配置的选择器：**
```json
{
  "loginSuccess": [
    ".user-avatar",
    ".auth-avator-name",
    ".semi-navigation-header-username"
  ]
}
```

**验证方法：**
1. 在浏览器中手动登录头条号：https://mp.toutiao.com/auth/page/login
2. 登录成功后，打开浏览器开发者工具（F12）
3. 在 Console 中运行：
```javascript
// 检查每个选择器是否存在
console.log('.user-avatar:', document.querySelector('.user-avatar'));
console.log('.auth-avator-name:', document.querySelector('.auth-avator-name'));
console.log('.semi-navigation-header-username:', document.querySelector('.semi-navigation-header-username'));
```

4. 如果所有选择器都返回 `null`，说明选择器已过时

**解决方法：**
如果选择器过时，需要找到新的选择器：
1. 在开发者工具中，点击左上角的"选择元素"按钮
2. 点击页面上显示用户名的元素
3. 在 Elements 面板中查看该元素的 class 或 id
4. 更新数据库配置

#### 1.2 页面加载慢

**症状：** 登录后页面跳转慢，或者元素加载慢

**解决方法：**
- 检查网络连接
- 等待更长时间（当前超时时间是 5 分钟）

#### 1.3 登录后跳转到了意外的页面

**症状：** 登录成功，但跳转到了其他页面（如引导页、设置页等）

**检查方法：**
查看登录后的 URL 是否包含 `mp.toutiao.com`

**解决方法：**
可能需要配置 `successUrls` 来匹配登录后的 URL

### 2. 用户信息提取失败

**症状：** 登录检测成功，但提取用户信息失败

**日志特征：**
```
[LoginDetector] Login success detected by element
[UserInfoExtractor] Failed to extract username
❌ Failed to extract user information
```

**原因：** 用户名选择器不匹配

**当前配置的选择器：**
```json
{
  "username": [
    ".auth-avator-name",
    ".user-name",
    ".username",
    ".account-name",
    "[class*=\"username\"]",
    "[class*=\"user-name\"]",
    ".semi-navigation-header-username"
  ]
}
```

**验证方法：**
在登录成功后的页面，运行：
```javascript
// 检查每个选择器
const selectors = [
  '.auth-avator-name',
  '.user-name',
  '.username',
  '.account-name',
  '[class*="username"]',
  '[class*="user-name"]',
  '.semi-navigation-header-username'
];

selectors.forEach(selector => {
  const el = document.querySelector(selector);
  console.log(selector, ':', el ? el.textContent : 'NOT FOUND');
});
```

**解决方法：**
如果所有选择器都失败，需要找到新的选择器并更新数据库。

### 3. BrowserView 问题

**症状：** 登录窗口没有正确显示，或者无法交互

**可能原因：**
- Electron BrowserView API 问题
- 窗口管理问题
- 权限问题

**检查方法：**
查看 Windows 登录管理器的控制台是否有错误信息

### 4. 网络连接问题

**症状：** 无法加载登录页面

**检查方法：**
```bash
# 测试是否能访问头条号
curl -I https://mp.toutiao.com/auth/page/login
```

### 5. Cookie/Session 问题

**症状：** 登录后立即退出登录状态

**可能原因：**
- Cookie 没有正确保存
- Session 过期
- 头条号的安全策略

## 调试步骤

### 步骤 1：启用详细日志

在 Windows 登录管理器中添加更多日志输出。

**修改文件：** `windows-login-manager/electron/login/login-detector.ts`

在 `waitForLoginSuccess` 方法中添加：
```typescript
// 定期检查元素
this.detectionInterval = setInterval(async () => {
  // ... 现有代码 ...
  
  // 添加详细日志
  log.info(`[Debug] Checking login status...`);
  log.info(`[Debug] Current URL: ${view.webContents.getURL()}`);
  
  if (config.successSelectors) {
    for (const selector of config.successSelectors) {
      const exists = await userInfoExtractor.elementExists(view, selector);
      log.info(`[Debug] Selector ${selector}: ${exists ? 'FOUND' : 'NOT FOUND'}`);
      // ... 现有代码 ...
    }
  }
}, 500);
```

### 步骤 2：手动测试选择器

创建测试脚本：`test-selectors.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>选择器测试</title>
</head>
<body>
  <h1>头条号选择器测试</h1>
  <ol>
    <li>在浏览器中打开头条号并登录：<a href="https://mp.toutiao.com/auth/page/login" target="_blank">https://mp.toutiao.com/auth/page/login</a></li>
    <li>登录成功后，打开开发者工具（F12）</li>
    <li>复制下面的代码到 Console 中运行</li>
  </ol>
  
  <h2>测试代码：</h2>
  <pre><code>
// 测试登录成功选择器
console.log('=== 测试登录成功选择器 ===');
const loginSuccessSelectors = [
  '.user-avatar',
  '.auth-avator-name',
  '.semi-navigation-header-username'
];

loginSuccessSelectors.forEach(selector => {
  const el = document.querySelector(selector);
  console.log(`${selector}:`, el ? '✅ FOUND' : '❌ NOT FOUND');
  if (el) {
    console.log('  内容:', el.textContent?.trim());
  }
});

// 测试用户名选择器
console.log('\n=== 测试用户名选择器 ===');
const usernameSelectors = [
  '.auth-avator-name',
  '.user-name',
  '.username',
  '.account-name',
  '[class*="username"]',
  '[class*="user-name"]',
  '.semi-navigation-header-username'
];

usernameSelectors.forEach(selector => {
  const el = document.querySelector(selector);
  console.log(`${selector}:`, el ? '✅ FOUND' : '❌ NOT FOUND');
  if (el) {
    console.log('  内容:', el.textContent?.trim());
  }
});

// 查找所有可能包含用户名的元素
console.log('\n=== 查找可能的用户名元素 ===');
const possibleElements = document.querySelectorAll('[class*="user"], [class*="name"], [class*="avatar"]');
console.log(`找到 ${possibleElements.length} 个可能的元素`);
possibleElements.forEach((el, i) => {
  if (el.textContent && el.textContent.trim().length > 0 && el.textContent.trim().length < 50) {
    console.log(`${i + 1}. ${el.className}:`, el.textContent.trim());
  }
});
  </code></pre>
</body>
</html>
```

### 步骤 3：检查实际的 HTML 结构

如果选择器测试失败，需要检查实际的 HTML 结构：

1. 登录头条号
2. 打开开发者工具
3. 在 Elements 面板中，找到显示用户名的元素
4. 右键点击 → Copy → Copy selector
5. 使用复制的选择器更新数据库配置

### 步骤 4：更新选择器配置

如果发现新的选择器，更新数据库：

```sql
-- 更新头条号的选择器
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{loginSuccess}',
  '["新选择器1", "新选择器2", "新选择器3"]'::jsonb
)
WHERE platform_id = 'toutiao';

-- 或者完全替换
UPDATE platforms_config 
SET selectors = '{
  "username": ["新的用户名选择器"],
  "loginSuccess": ["新的登录成功选择器"]
}'::jsonb
WHERE platform_id = 'toutiao';
```

## 临时解决方案

如果选择器确实过时了，可以临时使用 URL 检测：

**修改：** `windows-login-manager/electron/ipc/handler.ts`

```typescript
// 在 login-platform 处理器中
const platform = platforms.find((p) => p.platform_id === platformId);

// 添加临时的 detection 配置
if (platformId === 'toutiao') {
  platform.detection = {
    successUrls: ['mp.toutiao.com/profile_v4'],  // 登录后的 URL 模式
    timeout: 300000
  };
}
```

这样登录检测器会通过 URL 变化来判断登录成功，而不依赖页面元素。

## 获取详细日志

### macOS/Linux
```bash
# 查看实时日志
tail -f ~/Library/Logs/windows-login-manager/main.log

# 或者
tail -f ~/.config/windows-login-manager/logs/main.log
```

### Windows
```powershell
# 打开日志文件
notepad %USERPROFILE%\AppData\Roaming\windows-login-manager\logs\main.log
```

## 联系支持

如果以上方法都无法解决问题，请提供以下信息：

1. **完整的错误日志**（从开始登录到失败的所有日志）
2. **API 配置**（`curl http://localhost:3000/api/platforms/toutiao` 的输出）
3. **浏览器测试结果**（运行上面的选择器测试代码的输出）
4. **登录后的 URL**（登录成功后浏览器地址栏的 URL）
5. **页面截图**（登录成功后的页面截图）

---

**更新日期：** 2025-12-22  
**版本：** 1.0
