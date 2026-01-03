# Bilibili 登录测试步骤

## 当前状态
- ✅ 代码已完全参照 GEO 应用 bili.js 实现
- ✅ TypeScript 已重新编译（11:28）
- ✅ 应用已重新启动

## 立即测试

### 1. 打开 Windows 登录管理器
应用应该已经自动打开

### 2. 打开开发者工具
- **Mac**: `Cmd + Option + I`
- **Windows**: `Ctrl + Shift + I`

### 3. 点击 Bilibili 平台卡片
在平台登录区域找到 Bilibili（哔哩哔哩）卡片并点击

### 4. 观察控制台输出

**应该看到的日志：**
```
[前端] 点击平台卡片: 哔哩哔哩 bilibili
[前端] 调用 IPC loginPlatform...
[Bilibili] 开始登录流程
[Bilibili] 创建 WebView
[Bilibili] WebView 创建成功
[Bilibili] 等待登录成功...
```

**如果看到这些日志，说明 IPC 通信正常，继续登录流程**

### 5. 登录 Bilibili
在打开的浏览器窗口中登录你的 Bilibili 账号

### 6. 等待自动检测
登录成功后，应该看到：
```
[Bilibili] 登录成功检测到元素
[Bilibili] 等待页面稳定（3秒）...
[Bilibili] 页面稳定完成
[Bilibili] 提取用户信息（参照bili.js）...
[Bilibili] 开始获取用户信息（参照bili.js）
[Bilibili] API返回数据: {...}
[Bilibili] 登录成功，用户信息: xxx
[Bilibili] 用户名提取成功: xxx
```

### 7. 验证保存
登录成功后，检查账号列表中是否出现 Bilibili 账号，并且显示正确的用户名

## 如果失败

### 情况 1: 点击后没有任何反应
**可能原因**: IPC 通信问题

**解决方案**:
1. 检查控制台是否有错误
2. 尝试硬刷新页面（Cmd+Shift+R）
3. 完全退出并重启应用

### 情况 2: 打开了浏览器但没有检测到登录
**可能原因**: 登录检测逻辑问题

**解决方案**:
1. 确认已经完全登录（能看到用户头像）
2. 等待更长时间（最多5分钟）
3. 查看控制台是否有错误信息

### 情况 3: 检测到登录但无法提取用户信息
**可能原因**: API 调用失败

**解决方案**:
1. 在浏览器控制台手动测试 API：
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
});
```

2. 检查返回的数据结构是否正确
3. 提供完整的 API 返回数据

### 情况 4: 提取到用户信息但无法保存
**可能原因**: 后端同步失败

**解决方案**:
1. 检查后端服务是否正常运行
2. 查看后端日志
3. 检查网络连接

## 需要提供的信息

如果测试失败，请提供：

1. **前端控制台完整日志**
   - 从点击卡片到失败的所有日志
   - 包括任何错误信息

2. **主进程日志**
   ```bash
   tail -50 ~/Library/Logs/Electron/main.log
   ```

3. **API 测试结果**
   - 手动调用 API 的返回数据

4. **截图**
   - 控制台截图
   - 错误信息截图

## 预期结果

✅ 点击 Bilibili 卡片后，打开登录窗口
✅ 登录成功后，自动检测到登录状态
✅ 成功提取用户名
✅ 账号保存到数据库
✅ 账号列表中显示 Bilibili 账号和用户名

## 修改记录

### 2026-01-03 11:28
- ✅ 完全参照 bili.js 实现用户信息提取
- ✅ 检查间隔改为 1000ms
- ✅ 增加页面稳定等待时间到 3 秒
- ✅ 添加详细的调试日志
- ✅ 重新编译并重启应用
