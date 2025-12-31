# 搜狐号登录问题诊断

## 问题描述
点击登录搜狐号，几秒钟就关闭了。

## 可能的原因

### 1. 持久化 partition 中有旧的 Cookie
由于我们刚刚改为使用持久化 partition，如果之前有登录过（即使是临时 partition），可能在持久化 partition 中也有一些 Cookie 残留，导致：
- 检测到用户名元素（误判为登录成功）
- 立即关闭登录窗口
- 但实际上 Cookie 可能不完整或已过期

### 2. URL 检测逻辑问题
搜狐号的登录检测逻辑：
1. 检查 URL 是否到达 `contentManagement/first/page`
2. 检查用户名元素是否出现

如果 URL 快速跳转，可能触发了登录成功检测。

### 3. 登录检测过于敏感
检测间隔是 1 秒，可能在页面还没完全加载时就检测到了某些元素。

## 诊断步骤

### 步骤 1：清除持久化 partition 数据
```bash
# 清除搜狐号的持久化数据
rm -rf ~/Library/Application\ Support/windows-login-manager/Partitions/persist_souhu

# 或者清除所有平台的数据
rm -rf ~/Library/Application\ Support/windows-login-manager/Partitions/
```

### 步骤 2：查看应用日志
```bash
# 查看日志目录
ls -la ~/Library/Logs/windows-login-manager/

# 如果日志文件存在，实时查看
tail -f ~/Library/Logs/windows-login-manager/main.log | grep -E "Souhu|搜狐"
```

### 步骤 3：检查控制台输出
在终端中运行应用，查看控制台输出：
```bash
cd windows-login-manager
npm run dev
```

观察控制台中的日志，特别是：
- `[Souhu] 开始登录流程`
- `[Souhu] 等待登录成功...`
- `[Souhu] 登录成功！用户名: xxx`
- `[Souhu] 登录完成`

### 步骤 4：检查是否有错误
如果看到错误信息，记录下来：
- 网络错误
- JavaScript 执行错误
- Cookie 获取错误
- 同步到后端失败

## 临时解决方案

### 方案 1：增加登录检测的等待时间
修改 `souhu-login-manager.ts`，增加检测间隔：

```typescript
private readonly CHECK_INTERVAL = 2000; // 从 1000ms 改为 2000ms
```

### 方案 2：添加更严格的 URL 检查
确保只有在完全正确的 URL 时才判断登录成功。

### 方案 3：添加额外的验证
在检测到登录成功后，再次验证：
- Cookie 是否存在
- 用户名是否有效
- 页面是否完全加载

## 快速测试命令

```bash
# 1. 清除数据
rm -rf ~/Library/Application\ Support/windows-login-manager/Partitions/persist_souhu

# 2. 重启应用
cd windows-login-manager
npm run dev

# 3. 在另一个终端查看日志（如果有）
tail -f ~/Library/Logs/windows-login-manager/main.log | grep Souhu

# 4. 点击登录搜狐号，观察控制台输出
```

## 预期的正常流程

```
1. 点击"搜狐号"卡片
   └─> [Souhu] 开始登录流程
   
2. 打开登录页面
   └─> [Souhu] 创建 WebView
   └─> [Souhu] 使用持久化 partition: persist:souhu
   └─> [Souhu] WebView 创建成功
   
3. 等待用户登录
   └─> [Souhu] 等待登录成功...
   └─> [Souhu] 当前在中间页面 (clientAuth)，继续等待...
   
4. 登录成功
   └─> [Souhu] URL 检测通过: https://mp.sohu.com/mpfe/v4/contentManagement/first/page
   └─> [Souhu] 登录成功！用户名: xxx
   
5. 提取信息
   └─> [Souhu] 登录成功，等待页面完全加载...
   └─> [Souhu] 等待页面稳定...
   └─> [Souhu] 最终 URL 验证通过
   └─> [Souhu] 提取用户信息...
   └─> [Souhu] 用户信息提取成功: xxx
   
6. 保存账号
   └─> [Souhu] 等待凭证完全设置...
   └─> [Souhu] 捕获登录凭证...
   └─> [Souhu] 账号已同步到后端
   └─> [Souhu] 账号保存成功
   └─> [Souhu] 登录完成
```

## 如果窗口立即关闭

可能的日志：
```
[Souhu] 开始登录流程
[Souhu] 创建 WebView
[Souhu] 使用持久化 partition: persist:souhu
[Souhu] WebView 创建成功
[Souhu] 等待登录成功...
[Souhu] URL 检测通过: https://mp.sohu.com/mpfe/v4/contentManagement/first/page  ← 立即检测到
[Souhu] 登录成功！用户名: xxx  ← 误判
[Souhu] 登录完成  ← 立即关闭
```

这说明持久化 partition 中有旧的 Cookie，导致页面直接跳转到登录成功页面。

## 解决方法

### 最简单的方法：清除数据
```bash
rm -rf ~/Library/Application\ Support/windows-login-manager/Partitions/persist_souhu
```

然后重新登录。

### 如果还是有问题
可能需要修改登录检测逻辑，添加更多验证步骤。
