# 百家号Cookie保存问题修复

## 问题描述
百家号登录后无法保存登录信息，导致每次都需要重新登录。

## 根本原因
通过分析GEO原始脚本 (`/Downloads/geo/resources/app-extracted/src/api/script/bjh.js`)，发现关键问题：

1. **Cookie获取方式错误**：原代码使用 Electron 的 `session.cookies.get()` API，但百家号的某些关键Cookie可能无法通过此方式获取
2. **原始脚本使用 `document.cookie`**：GEO原始脚本直接使用 `cookie: document.cookie` 获取Cookie字符串

## 修复方案

### 1. Cookie获取优化
```typescript
// 优先使用 document.cookie（参考GEO原始脚本）
const cookieString = await webViewManager.executeJavaScript(`
  (function() {
    return document.cookie;
  })();
`);

// 解析 Cookie 字符串
const cookies = cookieString.split(';').map(pair => {
  const [name, value] = pair.trim().split('=');
  return { name, value, domain: '.baidu.com', ... };
});

// 额外获取 httpOnly Cookie（document.cookie 无法获取）
const sessionCookies = await session.cookies.get({});
const httpOnlyCookies = sessionCookies.filter(c => c.httpOnly);
```

### 2. 用户名提取修复
```typescript
// 原始脚本使用 .text 而不是 .textContent
const nameText = nameElement.text || nameElement.textContent || '';

// 按照原始脚本处理：split(',')[1]
const username = nameText.split(',')[1]?.trim() || nameText.trim();
```

### 3. 登录等待优化
- 检测到登录成功后，额外等待5秒确保Cookie完全设置
- 页面稳定等待时间增加到3秒

## 关键改进

### Cookie获取策略
1. **主要方式**：使用 `document.cookie` 获取所有非httpOnly Cookie
2. **补充方式**：使用 `session.cookies.get()` 获取 httpOnly Cookie
3. **合并去重**：将两种方式获取的Cookie合并，避免重复

### 日志增强
- 打印 `document.cookie` 长度
- 打印解析得到的Cookie数量
- 打印关键Cookie名称（BDUSS、STOKEN、BAIDUID等）
- 打印httpOnly Cookie数量

## 测试步骤

1. 重新启动Windows登录管理器
2. 选择百家号平台登录
3. 完成登录后，查看控制台日志：
   ```
   [Baijiahao] document.cookie 长度: 1234
   [Baijiahao] 解析得到 15 个Cookie
   [Baijiahao] 关键Cookie: BDUSS, STOKEN, BAIDUID
   [Baijiahao] 额外获取到 3 个 httpOnly Cookie
   [Baijiahao] 最终获取到 18 个Cookie（包含httpOnly）
   ```
4. 检查后端数据库，确认Cookie已正确保存
5. 尝试使用保存的账号发布文章，验证登录状态

## 参考资料

### GEO原始脚本关键代码
```javascript
// bjh.js
var value = {
    avatar: srcValue,
    account: '',
    name: name.split(',')[1],
    cookie: document.cookie,  // 关键：使用 document.cookie
    platform: 'bjh'
}
```

### 百度Cookie说明
- **BDUSS**：百度通行证Cookie，最重要的认证Cookie
- **STOKEN**：安全令牌，用于某些敏感操作
- **BAIDUID**：百度用户ID
- **BIDUPSID**：百度用户会话ID

## 修复文件
- `windows-login-manager/electron/login/baijiahao-login-manager.ts`

## 常见问题

### WebView加载错误（errorCode: -3）
这是正常现象，不影响Cookie获取：
- **原因**：登录成功后页面跳转，导致之前的加载被中止（ERR_ABORTED）
- **解决**：已在 `webview-manager.ts` 中忽略此错误
- **日志**：`[WebView] Load aborted (page navigation), this is normal`

### Cookie为空
如果日志显示 `document.cookie` 为空：
1. 检查是否真的登录成功（查看页面是否显示用户信息）
2. 等待时间是否足够（已设置5秒额外等待）
3. 查看是否有httpOnly Cookie（会通过session API获取）

### 用户名提取失败
如果无法提取用户名：
1. 检查 `.user-name` 元素是否存在
2. 查看控制台日志中的"原始用户名文本"
3. 确认是否需要 `split(',')[1]` 处理

## 编译命令
```bash
cd windows-login-manager
npm run build:electron
```

## 修复历史
- **v1.0** (2025-01-02): 初始修复，使用 `document.cookie` 获取Cookie
- **v1.1** (2025-01-02): 添加WebView错误处理，忽略页面跳转导致的加载中止错误
