# Bilibili 登录调试指南

## 问题描述
Bilibili 无法保存用户信息

## 已完成的修复

### 1. 参照 GEO 应用 bili.js 的实现
- ✅ 使用 API `https://api.bilibili.com/x/web-interface/nav` 获取用户信息
- ✅ 检查间隔改为 1000ms（参照 bili.js）
- ✅ 使用 `userData.data.uname`（不使用可选链）
- ✅ 添加详细的日志输出

### 2. 关键代码对比

**参考项目 bili.js:**
```javascript
const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    method: 'GET',
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': navigator.userAgent
    }
});

if (response.ok) {
    const userData = await response.json();
    if (userData && userData.data.uname) {
        // 成功获取用户名
        var value = {
            avatar: userData.data.face || '',
            account: '',
            name: userData.data.uname,
            cookie: document.cookie,
            follower_count: ''
        }
    }
}
```

**我们的实现:**
```typescript
const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    method: 'GET',
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': navigator.userAgent
    }
});

if (response.ok) {
    const userData = await response.json();
    if (userData && userData.data && userData.data.uname) {
        return {
            username: userData.data.uname,
            avatar: userData.data.face || ''
        };
    }
}
```

## 调试步骤

### 1. 打开开发者工具
在 Windows 登录管理器中，按 `Cmd+Option+I`（Mac）或 `Ctrl+Shift+I`（Windows）打开开发者工具

### 2. 查看控制台日志
登录 Bilibili 时，应该看到以下日志：

```
[Bilibili] 开始登录流程
[Bilibili] 创建 WebView
[Bilibili] WebView 创建成功
[Bilibili] 等待登录成功...
[Bilibili] 登录成功检测到元素
[Bilibili] 等待页面稳定（3秒）...
[Bilibili] 页面稳定完成
[Bilibili] 提取用户信息（参照bili.js）...
[Bilibili] 开始获取用户信息（参照bili.js）
[Bilibili] API返回数据: {...}
[Bilibili] 登录成功，用户信息: xxx
[Bilibili] 用户名提取成功: xxx
[Bilibili] 捕获登录凭证...
[Bilibili] 捕获 X 个 Cookies
[Bilibili] 同步账号到后端...
[Bilibili] 账号同步成功
[Bilibili] 保存账号到本地...
[Bilibili] 账号保存成功
[Bilibili] 登录成功完成
```

### 3. 检查关键点

#### 检查点 1: 登录检测
如果看到 `[Bilibili] 登录成功检测到元素`，说明登录检测正常

#### 检查点 2: API 调用
如果看到 `[Bilibili] API返回数据:`，检查返回的数据结构：
- 应该包含 `data.uname` 字段
- 应该包含 `data.face` 字段（头像）

#### 检查点 3: 用户信息提取
如果看到 `[Bilibili] 用户名提取成功: xxx`，说明用户信息提取成功

#### 检查点 4: 后端同步
如果看到 `[Bilibili] 账号同步成功`，说明后端同步成功

### 4. 常见问题排查

#### 问题 1: API 返回数据中没有用户名
**日志:** `[Bilibili] API返回数据中没有用户名，userData: {...}`

**原因:** API 返回的数据结构不符合预期

**解决方案:**
1. 检查 API 返回的完整数据结构
2. 确认是否已登录（Cookie 是否有效）
3. 尝试手动访问 `https://api.bilibili.com/x/web-interface/nav` 查看返回数据

#### 问题 2: API 请求失败
**日志:** `[Bilibili] API请求失败，状态码: xxx`

**原因:** API 请求被拒绝

**解决方案:**
1. 检查网络连接
2. 确认 Cookie 是否有效
3. 检查是否被 Bilibili 限流

#### 问题 3: 无法提取用户信息
**日志:** `[Bilibili] 无法提取用户信息，登录流程终止`

**原因:** `extractUserInfo()` 返回 null

**解决方案:**
1. 检查上述 API 相关问题
2. 增加等待时间，确保页面完全加载
3. 检查 WebView 是否正常工作

#### 问题 4: 后端同步失败
**日志:** `[Bilibili] 账号同步失败: xxx`

**原因:** 后端 API 调用失败

**解决方案:**
1. 检查后端服务是否正常运行
2. 检查网络连接
3. 查看后端日志

## 手动测试 API

在浏览器中登录 Bilibili 后，打开控制台执行：

```javascript
fetch('https://api.bilibili.com/x/web-interface/nav', {
    method: 'GET',
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json'
    }
})
.then(response => response.json())
.then(data => {
    console.log('API 返回数据:', data);
    console.log('用户名:', data.data?.uname);
    console.log('头像:', data.data?.face);
});
```

预期输出：
```json
{
    "code": 0,
    "message": "0",
    "data": {
        "uname": "你的用户名",
        "face": "头像URL",
        ...
    }
}
```

## 下一步

如果问题仍然存在，请提供：
1. 完整的控制台日志
2. API 返回的完整数据结构
3. 错误信息（如果有）

这将帮助我们进一步诊断问题。
