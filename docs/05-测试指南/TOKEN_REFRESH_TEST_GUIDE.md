# Token 刷新功能测试指南

**日期**: 2026-01-17  
**目的**: 验证 Token 刷新无限循环问题已修复  
**预计时间**: 10 分钟

---

## 测试前准备

### 1. 确保代码已更新

```bash
cd windows-login-manager
git pull  # 或确认已有最新代码
```

### 2. 重新构建应用

```bash
npm run build
# 或在开发模式下运行
npm run dev
```

---

## 测试场景

### 场景 1: 正常 Token 刷新（推荐）

**目的**: 验证 token 过期后能自动刷新

**步骤**:

1. **登录应用**
   - 打开 Windows 桌面客户端
   - 使用测试账号登录（如 `admin` / `admin123`）
   - 确认登录成功，能看到 Dashboard

2. **模拟 Token 过期**
   
   打开浏览器开发者工具（F12），在 Console 中执行：
   
   ```javascript
   // 清除当前 token，但保留 refresh token
   localStorage.setItem('auth_token', 'invalid_token_for_testing');
   console.log('Token 已设置为无效值，下次请求将触发刷新');
   ```

3. **触发 API 请求**
   - 刷新页面（F5）或点击任意菜单项
   - 观察 Console 日志

4. **预期结果**
   
   ✅ **成功标志**:
   ```
   [API Client] ❌ 响应错误: {url: '/xxx', status: 401}
   [API Client] 🔄 检测到 401，尝试刷新 token...
   [API Client] 🔄 使用 refresh token 刷新...
   [API Client] ✅ Token 刷新成功
   [API Client] ✅ 响应成功: /xxx 200
   ```
   
   - 页面正常加载数据
   - 没有出现无限循环的刷新请求
   - 用户无需重新登录

---

### 场景 2: Refresh Token 过期

**目的**: 验证 refresh token 过期时能正确登出

**步骤**:

1. **登录应用**

2. **清除 Refresh Token**
   
   在 Console 中执行：
   
   ```javascript
   // 清除所有 token
   localStorage.removeItem('auth_token');
   localStorage.removeItem('refresh_token');
   console.log('所有 token 已清除');
   ```

3. **触发 API 请求**
   - 刷新页面或点击菜单

4. **预期结果**
   
   ✅ **成功标志**:
   ```
   [API Client] ❌ 响应错误: {url: '/xxx', status: 401}
   [API Client] 🔄 检测到 401，尝试刷新 token...
   [API Client] ❌ Token 刷新失败: 没有 refresh token
   [App] 收到 auth:logout 事件
   [App] 执行登出
   ```
   
   - 自动跳转到登录页
   - 显示"登录已过期，请重新登录"提示
   - 没有出现无限循环

---

### 场景 3: 并发请求测试

**目的**: 验证多个请求同时触发时只刷新一次

**步骤**:

1. **登录应用**

2. **模拟 Token 过期**
   
   ```javascript
   localStorage.setItem('auth_token', 'invalid_token_for_testing');
   ```

3. **打开 Dashboard**
   - Dashboard 会同时发起多个 API 请求
   - 观察 Network 面板和 Console

4. **预期结果**
   
   ✅ **成功标志**:
   ```
   [API Client] 🔄 检测到 401，尝试刷新 token...
   [API Client] 🔄 Token 刷新中，请求加入队列...
   [API Client] 🔄 Token 刷新中，请求加入队列...
   [API Client] ✅ Token 刷新成功
   [API Client] ✅ 响应成功: /dashboard/metrics 200
   [API Client] ✅ 响应成功: /dashboard/trends 200
   [API Client] ✅ 响应成功: /subscription/current 200
   ```
   
   - **只有一个** `/api/auth/refresh` 请求
   - 其他请求等待刷新完成后自动重试
   - 所有请求最终都成功

---

### 场景 4: 服务器 Refresh Token 失效

**目的**: 验证服务器端 refresh token 失效时的处理

**步骤**:

1. **登录应用**

2. **在服务器端清除会话**
   
   ```bash
   # SSH 到服务器
   ssh -i "私钥路径" ubuntu@124.221.247.107
   
   # 连接数据库
   sudo -u postgres psql -d geo_system
   
   # 清除所有会话（测试用）
   DELETE FROM sessions WHERE user_id = 1;
   
   # 退出
   \q
   exit
   ```

3. **在客户端触发请求**
   - 刷新页面或点击菜单

4. **预期结果**
   
   ✅ **成功标志**:
   ```
   [API Client] 🔄 检测到 401，尝试刷新 token...
   [API Client] 🔄 使用 refresh token 刷新...
   [API Client] ❌ 响应错误: {url: '/auth/refresh', status: 401}
   [API Client] ❌ Refresh token 已失效，需要重新登录
   [App] 收到 auth:logout 事件
   ```
   
   - 自动跳转到登录页
   - 没有无限循环

---

## 常见问题排查

### 问题 1: 仍然出现无限循环

**症状**: Console 中看到大量重复的刷新请求

**排查步骤**:

1. 确认代码已更新：
   ```bash
   cd windows-login-manager
   git log --oneline -1  # 查看最新提交
   ```

2. 清除缓存并重新构建：
   ```bash
   rm -rf dist dist-electron
   npm run build
   ```

3. 检查 `src/api/client.ts` 是否包含以下代码：
   ```typescript
   // 如果是刷新接口本身返回 401，直接登出
   if (originalRequest.url?.includes('/auth/refresh')) {
     // ...
   }
   ```

### 问题 2: Token 刷新失败但没有登出

**症状**: 看到刷新失败的日志，但仍停留在当前页面

**排查步骤**:

1. 检查 App.tsx 是否监听了 `auth:logout` 事件：
   ```typescript
   window.addEventListener('auth:logout', handleAuthLogout as EventListener);
   ```

2. 在 Console 中手动触发事件测试：
   ```javascript
   window.dispatchEvent(new CustomEvent('auth:logout', { 
     detail: { message: '测试登出' } 
   }));
   ```

### 问题 3: 刷新成功但请求仍然失败

**症状**: 看到"Token 刷新成功"，但后续请求仍返回 401

**可能原因**:
- 服务器端 token 验证逻辑有问题
- 新 token 没有正确保存

**排查步骤**:

1. 检查 token 是否保存成功：
   ```javascript
   console.log('Auth Token:', localStorage.getItem('auth_token'));
   console.log('Refresh Token:', localStorage.getItem('refresh_token'));
   ```

2. 检查服务器日志：
   ```bash
   ssh -i "私钥路径" ubuntu@124.221.247.107
   pm2 logs geo-server --lines 50
   ```

---

## 性能验证

### 检查点 1: 刷新请求次数

**标准**: 在并发场景下，只应该有 **1 个** `/api/auth/refresh` 请求

**验证方法**:
1. 打开 Network 面板
2. 过滤 `refresh`
3. 触发并发请求
4. 统计 refresh 请求数量

### 检查点 2: 响应时间

**标准**: Token 刷新应在 **1 秒内** 完成

**验证方法**:
1. 在 Network 面板查看 `/api/auth/refresh` 的响应时间
2. 应该在 100-500ms 之间

### 检查点 3: 用户体验

**标准**: 用户应该 **无感知** token 刷新过程

**验证方法**:
- 页面不应该出现加载失败
- 不应该显示错误提示
- 数据应该正常加载

---

## 测试报告模板

```markdown
## Token 刷新功能测试报告

**测试日期**: 2026-01-17  
**测试人员**: [你的名字]  
**测试环境**: Windows 桌面客户端 v1.0.0

### 测试结果

| 场景 | 状态 | 备注 |
|------|------|------|
| 场景 1: 正常 Token 刷新 | ✅ 通过 / ❌ 失败 | |
| 场景 2: Refresh Token 过期 | ✅ 通过 / ❌ 失败 | |
| 场景 3: 并发请求测试 | ✅ 通过 / ❌ 失败 | |
| 场景 4: 服务器 Token 失效 | ✅ 通过 / ❌ 失败 | |

### 性能指标

- Refresh 请求次数: [数量]
- 平均响应时间: [毫秒]
- 用户体验评分: [1-5 分]

### 问题记录

[如有问题，在此记录]

### 总体评价

[通过 / 需要修复]
```

---

## 下一步

测试通过后：

1. ✅ 关闭相关 Issue
2. ✅ 更新版本号
3. ✅ 通知团队成员
4. ✅ 部署到生产环境

测试失败时：

1. ❌ 记录详细错误信息
2. ❌ 提交 Bug 报告
3. ❌ 继续修复
