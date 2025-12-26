# Token 自动刷新和过期处理优化

## 问题背景

之前的系统存在以下用户体验问题：
1. Token 过期后需要手动清除 localStorage
2. 没有自动刷新机制
3. 跳转到错误的登录页面
4. 没有友好的过期提示

## 优化内容

### 1. 自动 Token 刷新机制

**工作原理：**
- 当 Access Token 过期（401错误）时，自动使用 Refresh Token 刷新
- 刷新成功后，自动重试原始请求
- 用户无感知，继续正常使用

**实现位置：** `client/src/api/client.ts`

```typescript
// 响应拦截器自动处理 401 错误
if (error.response?.status === 401 && !originalRequest._retry) {
  // 尝试刷新 token
  const response = await axios.post('/api/auth/refresh', { refreshToken });
  const newToken = response.data.data.token;
  localStorage.setItem('auth_token', newToken);
  
  // 重试原始请求
  return apiClient.request(originalRequest);
}
```

### 2. Refresh Token 过期处理

**当 Refresh Token 也过期时：**
1. 自动清除所有认证信息
2. 显示友好的过期提示
3. 自动跳转到登录页面
4. 传递过期消息参数

**实现：**
```typescript
// 清除认证信息
localStorage.removeItem('auth_token');
localStorage.removeItem('refresh_token');
localStorage.removeItem('user_info');

// 跳转到登录页并显示提示
const landingUrl = import.meta.env.VITE_LANDING_URL || 'http://localhost:8080';
window.location.href = `${landingUrl}/login?expired=true&message=${encodeURIComponent(message)}`;
```

### 3. 登录页面过期提示

**功能：**
- 检测 URL 参数中的过期标识
- 显示黄色警告提示框
- 5秒后自动消失
- 提示用户重新登录

**实现位置：** `landing/src/pages/LoginPage.tsx`

```typescript
// 检查是否是因为 token 过期跳转过来的
const expired = searchParams.get('expired');
const message = searchParams.get('message');

if (expired === 'true' && message) {
  setExpiredMessage(decodeURIComponent(message));
  // 5秒后清除提示
  setTimeout(() => setExpiredMessage(''), 5000);
}
```

### 4. 环境配置

**新增配置项：** `VITE_LANDING_URL`

**配置文件：** `client/.env.example`

```env
# Landing页面URL（登录页面地址）
# 开发环境: http://localhost:8080
# 生产环境: https://your-domain.com
VITE_LANDING_URL=http://localhost:8080
```

## Token 有效期说明

### Access Token
- **有效期：** 1小时
- **用途：** API 请求认证
- **刷新：** 过期后自动使用 Refresh Token 刷新

### Refresh Token
- **有效期：** 7天
- **用途：** 刷新 Access Token
- **存储：** 数据库 + localStorage
- **过期：** 需要重新登录

## 用户体验流程

### 场景一：Access Token 过期（正常使用中）

```
用户操作 → API 请求 → 401 错误
    ↓
自动刷新 Token
    ↓
重试原始请求
    ↓
用户无感知，继续使用 ✅
```

### 场景二：Refresh Token 也过期（长时间未使用）

```
用户操作 → API 请求 → 401 错误
    ↓
尝试刷新 Token → 失败
    ↓
清除认证信息
    ↓
跳转到登录页 + 显示提示
    ↓
用户重新登录 ✅
```

### 场景三：首次访问或未登录

```
用户访问 → 检测无 Token
    ↓
跳转到登录页
    ↓
用户登录 ✅
```

## 部署到生产环境

### 1. 配置环境变量

**客户端 `.env`：**
```env
VITE_LANDING_URL=https://your-domain.com
```

**服务端 `.env`：**
```env
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
```

### 2. Token 有效期调整（可选）

如果需要调整 token 有效期，修改 `server/src/services/TokenService.ts`：

```typescript
// Access Token 有效期（默认 1 小时）
const ACCESS_TOKEN_EXPIRES_IN = '1h';

// Refresh Token 有效期（默认 7 天）
const REFRESH_TOKEN_EXPIRES_IN = '7d';
```

**建议配置：**
- **开发环境：** Access Token 1小时，Refresh Token 7天
- **生产环境：** Access Token 1小时，Refresh Token 30天（可选）

### 3. 安全建议

1. **使用 HTTPS**
   - 生产环境必须使用 HTTPS
   - 防止 token 被窃取

2. **定期更换密钥**
   - JWT_SECRET 和 JWT_REFRESH_SECRET 应定期更换
   - 更换后所有用户需要重新登录

3. **监控异常登录**
   - 记录登录 IP 和设备信息
   - 检测异常登录行为

4. **会话管理**
   - 限制同时登录设备数量
   - 提供远程登出功能

## 测试验证

### 测试 Access Token 自动刷新

1. 登录系统
2. 等待 1 小时（或修改 token 有效期为 1 分钟测试）
3. 执行任意操作
4. 验证：操作成功，无需重新登录

### 测试 Refresh Token 过期

1. 登录系统
2. 手动删除或修改 refresh_token
3. 执行任意操作
4. 验证：自动跳转到登录页，显示过期提示

### 测试过期提示

1. 访问：`http://localhost:8080/login?expired=true&message=登录已过期`
2. 验证：显示黄色警告提示框
3. 验证：5秒后提示自动消失

## 常见问题

### Q1: 为什么不延长 Access Token 有效期？

**A:** 
- Access Token 有效期短是安全最佳实践
- 即使被窃取，影响时间也很短
- Refresh Token 机制保证了用户体验

### Q2: Refresh Token 存储在哪里？

**A:**
- 客户端：localStorage（方便访问）
- 服务端：数据库（可以撤销）
- 双重存储保证安全性和可控性

### Q3: 如何强制用户重新登录？

**A:**
```sql
-- 删除用户的所有 refresh token
DELETE FROM refresh_tokens WHERE user_id = ?;
```

### Q4: 多设备登录如何处理？

**A:**
- 每个设备有独立的 refresh token
- 可以在数据库中查看所有活跃会话
- 可以单独撤销某个设备的会话

### Q5: Token 刷新失败怎么办？

**A:**
- 系统会自动清除认证信息
- 跳转到登录页并显示提示
- 用户重新登录即可

## 监控和日志

### 关键日志

```typescript
// Token 刷新成功
console.log('[Auth] Token 刷新成功，重试原始请求');

// Token 刷新失败
console.error('[Auth] Token 刷新失败:', error);

// 跳转到登录页
console.log('[Auth] 没有 refresh token，跳转到登录页');
```

### 监控指标

1. **Token 刷新成功率**
   - 正常应该 > 95%
   - 低于 90% 需要检查

2. **Token 过期频率**
   - 监控用户重新登录频率
   - 评估是否需要调整有效期

3. **异常登录检测**
   - 短时间内多次登录
   - 不同地区同时登录

## 总结

### 优化前
- ❌ Token 过期需要手动清除
- ❌ 没有自动刷新
- ❌ 跳转到错误页面
- ❌ 没有友好提示

### 优化后
- ✅ 自动刷新 Access Token
- ✅ 自动清除过期认证信息
- ✅ 正确跳转到登录页
- ✅ 显示友好的过期提示
- ✅ 用户体验流畅

### 用户体验提升
- **正常使用：** 完全无感知，自动刷新
- **长时间未用：** 友好提示，引导重新登录
- **安全性：** 保持短期 token，降低风险
- **可维护性：** 集中处理，易于调试

---

**相关文件：**
- `client/src/api/client.ts` - Token 刷新逻辑
- `landing/src/pages/LoginPage.tsx` - 过期提示
- `server/src/routes/auth.ts` - 刷新接口
- `server/src/services/TokenService.ts` - Token 生成和验证
