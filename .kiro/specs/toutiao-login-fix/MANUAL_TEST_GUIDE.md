# 头条号登录修复 - 手动测试指南

## 测试目的

验证 Windows 登录管理器的头条号登录功能是否正常工作。

## 前置条件

1. 后端服务正常运行
2. Windows 登录管理器已构建
3. 有可用的头条号账号（用于测试）

## 测试环境准备

### 1. 启动后端服务

```bash
cd server
npm run dev
```

**验证：**
- 服务在 http://localhost:3000 运行
- 数据库连接成功
- 没有错误日志

### 2. 启动 Windows 登录管理器

```bash
cd windows-login-manager
npm run dev
```

**验证：**
- 应用程序窗口打开
- 没有启动错误
- 可以看到平台列表

## 测试场景

### 场景 1：正常登录流程 ✅

**目标：** 验证完整的登录流程

**步骤：**
1. 打开 Windows 登录管理器
2. 点击"添加账号"或"登录"按钮
3. 从平台列表中选择"头条号"
4. 等待浏览器视图加载登录页面
5. 在浏览器中输入用户名和密码
6. 点击登录按钮
7. 完成任何验证码（如果有）
8. 等待跳转到个人主页

**预期结果：**
- ✅ 浏览器视图正确显示头条号登录页面
- ✅ 可以正常输入用户名和密码
- ✅ 登录后 URL 从 `mp.toutiao.com/auth/page/login` 变化到 `mp.toutiao.com/profile_v4` 或 `mp.toutiao.com/creator`
- ✅ 应用检测到登录成功（显示成功消息）
- ✅ 提取到用户名
- ✅ 账号保存到本地
- ✅ 账号同步到后端
- ✅ 浏览器视图自动关闭
- ✅ 账号列表中显示新添加的账号

**检查日志：**
```
[info] Starting login for platform: toutiao
[info] BrowserView created, waiting for user login...
[info] Starting login detection... Initial URL: https://mp.toutiao.com/auth/page/login
[info] Login success detected by URL change: https://mp.toutiao.com/auth/page/login -> https://mp.toutiao.com/profile_v4/...
[info] Login detected, capturing data...
[info] Captured X cookies
[info] Storage data captured
[info] User info extracted: [username]
[info] Account saved locally
[info] Account synced to backend
[info] Login completed successfully
```

### 场景 2：页面加载错误处理 ✅

**目标：** 验证页面加载错误不会中断登录流程

**步骤：**
1. 在网络不稳定的环境下测试
2. 或者使用开发者工具模拟慢速网络
3. 开始登录流程
4. 观察是否有 ERR_ABORTED 或其他加载错误

**预期结果：**
- ✅ 即使出现页面加载错误，登录流程继续
- ✅ 不显示错误消息给用户
- ✅ URL 变化检测正常工作
- ✅ 最终登录成功

**检查日志：**
- 不应该有"waitForLoad failed"错误
- 应该继续执行 URL 检测

### 场景 3：取消登录 ✅

**目标：** 验证用户可以取消登录流程

**步骤：**
1. 开始登录流程
2. 在登录页面加载后，点击"取消"按钮
3. 或者关闭浏览器视图

**预期结果：**
- ✅ 浏览器视图立即关闭
- ✅ 显示"Login cancelled"消息（不是错误）
- ✅ 不保存任何账号信息
- ✅ 应用返回到正常状态
- ✅ 可以重新开始登录

**检查日志：**
```
[info] Cancelling login...
[info] Login detection cancelled by user
[info] Login cancelled successfully
```

### 场景 4：登录超时 ⏱️

**目标：** 验证超时处理

**步骤：**
1. 开始登录流程
2. 不完成登录，等待 5 分钟

**预期结果：**
- ✅ 5 分钟后显示超时错误
- ✅ 浏览器视图自动关闭
- ✅ 清理所有资源
- ✅ 可以重新开始登录

**检查日志：**
```
[warn] Login detection timeout
```

### 场景 5：用户信息提取失败 ❌

**目标：** 验证用户信息提取失败的处理

**步骤：**
1. 登录成功但页面结构异常（很少见）
2. 或者修改选择器使其无法匹配

**预期结果：**
- ✅ 显示"Failed to extract user information"错误
- ✅ 不保存账号
- ✅ 浏览器视图关闭
- ✅ 可以重新尝试

**检查日志：**
```
[warn] Failed to extract username
[info] Failed to extract user information
```

### 场景 6：重复登录同一账号 🔄

**目标：** 验证重复登录处理

**步骤：**
1. 登录一个头条号账号
2. 再次登录相同的账号

**预期结果：**
- ✅ 更新现有账号信息
- ✅ 不创建重复账号
- ✅ 更新时间戳

### 场景 7：多账号登录 👥

**目标：** 验证可以登录多个头条号账号

**步骤：**
1. 登录第一个头条号账号
2. 登录第二个头条号账号
3. 登录第三个头条号账号

**预期结果：**
- ✅ 所有账号都成功保存
- ✅ 账号列表显示所有账号
- ✅ 每个账号有独立的凭证

## 验证检查清单

### 数据库验证

**检查 platforms_config 表：**
```sql
SELECT platform_id, login_url, selectors 
FROM platforms_config 
WHERE platform_id = 'toutiao';
```

**预期结果：**
- ✅ login_url = 'https://mp.toutiao.com/auth/page/login'
- ✅ selectors.username 包含 7 个选择器
- ✅ selectors.loginSuccess 包含 3 个选择器
- ✅ selectors.successUrls 包含 2 个 URL 模式

**检查 platform_accounts 表：**
```sql
SELECT * FROM platform_accounts 
WHERE platform_id = 'toutiao';
```

**预期结果：**
- ✅ 账号已保存
- ✅ credentials 字段包含完整数据
- ✅ real_username 字段有值

### API 验证

**测试 API 端点：**
```bash
curl http://localhost:3000/api/platforms/toutiao | jq
```

**预期响应：**
```json
{
  "platform_id": "toutiao",
  "platform_name": "头条号",
  "login_url": "https://mp.toutiao.com/auth/page/login",
  "selectors": {
    "username": [...],
    "loginSuccess": [...],
    "successUrls": [...]
  },
  "enabled": true
}
```

### 日志验证

**关键日志检查：**
- ✅ 记录平台 ID 和登录 URL
- ✅ 记录初始 URL
- ✅ 记录 URL 变化
- ✅ 记录登录成功方法（url 或 selector）
- ✅ 记录用户名提取
- ✅ 记录账号保存
- ✅ 记录同步结果

**错误日志检查：**
- ❌ 不应该有"waitForLoad failed"
- ❌ 不应该有"successUrls is undefined"
- ❌ 不应该有未捕获的异常

## 性能验证

### 登录速度

**测量指标：**
- 从点击登录到浏览器视图显示：< 2 秒
- 从完成登录到检测成功：< 2 秒
- 从检测成功到保存完成：< 3 秒
- 总登录时间（用户操作除外）：< 5 秒

### 资源清理

**验证：**
- ✅ 登录完成后 BrowserView 被销毁
- ✅ 取消登录后 BrowserView 被销毁
- ✅ 超时后 BrowserView 被销毁
- ✅ 没有内存泄漏
- ✅ 没有未清理的定时器

## 常见问题排查

### 问题 1：登录成功但显示失败

**可能原因：**
- successUrls 配置不正确
- URL 检测逻辑有问题

**排查步骤：**
1. 检查日志中的 URL 变化
2. 验证 successUrls 配置
3. 检查是否匹配 URL 模式

### 问题 2：无法提取用户名

**可能原因：**
- 页面结构变化
- 选择器不匹配

**排查步骤：**
1. 检查日志中的选择器尝试
2. 在浏览器中验证选择器
3. 更新选择器配置

### 问题 3：页面加载错误

**可能原因：**
- 网络问题
- 页面触发 ERR_ABORTED

**排查步骤：**
1. 检查是否移除了 waitForLoad
2. 验证 1 秒延迟是否存在
3. 确认 URL 检测继续工作

### 问题 4：取消登录后无法重新登录

**可能原因：**
- isLoginInProgress 未重置
- BrowserView 未销毁

**排查步骤：**
1. 检查 cancelLogin 方法
2. 验证资源清理
3. 检查状态重置

## 测试报告模板

```markdown
# 头条号登录测试报告

## 测试信息
- 测试日期：YYYY-MM-DD
- 测试人员：[姓名]
- 测试环境：Windows [版本]
- 应用版本：[版本号]

## 测试结果

### 场景 1：正常登录
- [ ] 通过
- [ ] 失败
- 备注：

### 场景 2：页面加载错误
- [ ] 通过
- [ ] 失败
- 备注：

### 场景 3：取消登录
- [ ] 通过
- [ ] 失败
- 备注：

### 场景 4：登录超时
- [ ] 通过
- [ ] 失败
- 备注：

### 场景 5：用户信息提取失败
- [ ] 通过
- [ ] 失败
- 备注：

### 场景 6：重复登录
- [ ] 通过
- [ ] 失败
- 备注：

### 场景 7：多账号登录
- [ ] 通过
- [ ] 失败
- 备注：

## 发现的问题

1. [问题描述]
   - 严重程度：高/中/低
   - 复现步骤：
   - 预期结果：
   - 实际结果：

## 总体评价

- [ ] 所有测试通过，可以发布
- [ ] 部分测试失败，需要修复
- [ ] 大部分测试失败，需要重新开发

## 建议

[测试建议和改进意见]
```

## 自动化测试建议

虽然当前是手动测试，但建议未来添加自动化测试：

1. **单元测试**
   - 配置读取逻辑
   - URL 匹配逻辑
   - 用户信息提取逻辑

2. **集成测试**
   - 模拟登录流程
   - 测试 API 集成
   - 测试数据库操作

3. **端到端测试**
   - 使用 Playwright 或 Puppeteer
   - 模拟真实用户操作
   - 验证完整流程

## 总结

完成所有测试场景后，应该能够确认：

✅ 头条号登录功能正常工作
✅ 所有错误场景都得到正确处理
✅ 日志记录完整清晰
✅ 性能符合预期
✅ 资源正确清理

如果所有测试通过，头条号登录修复就完成了！🎉
