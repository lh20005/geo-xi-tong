# Token 认证问题调试指南

## 问题现象

商品管理和订单管理页面显示 "401 Unauthorized" 错误，提示"请先登录"。

## 可能的原因

1. Token 没有正确保存到加密存储
2. Token 没有正确从加密存储读取
3. Token 没有正确添加到 API 请求头
4. Token 已过期但刷新失败

## 调试步骤

### 1. 检查控制台日志

打开开发者工具（F12），查看控制台输出，重点关注：

```
[API Client] 获取到的 tokens: 存在/不存在
[API Client] 已添加 Authorization header
[API Client] 请求配置: { url, method, hasAuth }
```

### 2. 检查 Token 是否保存

在登录成功后，检查控制台是否有：
```
[Electron] Tokens saved successfully
```

### 3. 检查 Token 是否能读取

在访问管理页面时，检查控制台是否有：
```
[API Client] 获取到的 tokens: 存在
[API Client] 已添加 Authorization header
```

### 4. 手动测试 Token 存储

在开发者工具的 Console 中执行：

```javascript
// 测试获取 tokens
window.electron.storage.getTokens().then(tokens => {
  console.log('Tokens:', tokens);
});

// 测试保存 tokens
window.electron.storage.saveTokens({
  authToken: 'test-token',
  refreshToken: 'test-refresh-token'
}).then(() => {
  console.log('Tokens saved');
  return window.electron.storage.getTokens();
}).then(tokens => {
  console.log('Retrieved tokens:', tokens);
});
```

## 常见问题和解决方案

### 问题 1: Token 没有保存

**症状：** 登录后立即访问管理页面就报 401 错误

**解决方案：**
1. 检查 `electron/api/client.ts` 的 `login` 方法是否调用了 `storageManager.saveTokens()`
2. 检查 `electron/storage/manager.ts` 的 `saveTokens` 方法是否正常工作
3. 检查加密是否可用：`safeStorage.isEncryptionAvailable()`

### 问题 2: Token 无法读取

**症状：** 控制台显示 "获取到的 tokens: 不存在"

**解决方案：**
1. 检查 IPC handler 是否正确注册：`storage:get-tokens`
2. 检查 preload.ts 是否正确暴露 `window.electron.storage.getTokens()`
3. 尝试清除存储后重新登录：
   ```javascript
   window.electron.storage.clearTokens()
   ```

### 问题 3: Token 格式不正确

**症状：** Token 存在但后端返回 401

**解决方案：**
1. 检查 Token 格式是否为 `Bearer <token>`
2. 检查后端期望的 Token 格式
3. 使用浏览器开发者工具的 Network 标签查看实际发送的请求头

### 问题 4: Token 已过期

**症状：** 登录后一段时间访问管理页面报 401

**解决方案：**
1. 检查 Token 刷新逻辑是否正常工作
2. 检查 `apiClient.interceptors.response` 中的 401 处理
3. 检查 refresh token 是否有效

## 临时解决方案

如果以上方法都无法解决，可以尝试以下临时方案：

### 方案 1: 使用 localStorage 作为备用

修改 `src/api/client.ts`，在 Electron 环境中也使用 localStorage：

```typescript
apiClient.interceptors.request.use(
  async (config) => {
    // 优先使用 localStorage（临时方案）
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    }
    
    // 然后尝试 Electron storage
    if (window.electron) {
      try {
        const tokens = await window.electron.storage.getTokens();
        if (tokens?.authToken) {
          config.headers.Authorization = `Bearer ${tokens.authToken}`;
        }
      } catch (error) {
        console.error('[API] 获取 token 失败:', error);
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);
```

### 方案 2: 在登录时同时保存到 localStorage

修改 `App.tsx` 的 `handleLoginSuccess`：

```typescript
const handleLoginSuccess = (user: any) => {
  setIsAuthenticated(true);
  setUser(user);
  
  // 同步用户信息到 localStorage
  if (user) {
    localStorage.setItem('user_info', JSON.stringify(user));
    window.dispatchEvent(new Event('userInfoUpdated'));
  }
  
  // 同时保存 token 到 localStorage（临时方案）
  if (window.electron) {
    window.electron.storage.getTokens().then(tokens => {
      if (tokens) {
        localStorage.setItem('auth_token', tokens.authToken);
        localStorage.setItem('refresh_token', tokens.refreshToken);
      }
    });
  }
};
```

## 验证修复

修复后，执行以下测试：

1. **登录测试**
   - 清除所有数据
   - 重新登录
   - 检查控制台是否有 "Tokens saved successfully"

2. **访问测试**
   - 登录后立即访问商品管理页面
   - 检查是否能正常加载数据
   - 检查控制台是否有 Authorization header

3. **刷新测试**
   - 刷新页面
   - 再次访问商品管理页面
   - 确认 Token 持久化正常

4. **过期测试**
   - 等待 Token 过期（或手动修改过期时间）
   - 访问管理页面
   - 检查是否自动刷新 Token

## 需要提供的调试信息

如果问题仍然存在，请提供以下信息：

1. 完整的控制台日志（包括所有 [API Client] 开头的日志）
2. Network 标签中失败请求的详细信息（Request Headers）
3. 执行手动测试 Token 存储的结果
4. 操作系统版本和 Electron 版本

---

**更新日期：** 2025-12-28
**状态：** 调试中
