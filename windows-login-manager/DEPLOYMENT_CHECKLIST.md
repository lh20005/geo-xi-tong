# WebSocket实时同步 - 部署检查清单

## ✅ 部署前检查

### 代码检查
- [x] 所有TypeScript编译通过
- [x] 没有ESLint错误
- [x] 所有文件已保存
- [x] Git提交所有更改

### 功能检查
- [ ] WebSocket Manager正确初始化
- [ ] 主进程正确集成WebSocket
- [ ] IPC Handler正确转发事件
- [ ] Preload脚本正确暴露API
- [ ] 渲染进程正确监听事件

### 配置检查
- [ ] 开发环境服务器URL配置正确
- [ ] 生产环境服务器URL配置正确
- [ ] WebSocket URL派生逻辑正确
- [ ] 认证令牌管理正确

## 🧪 测试检查

### 单元测试
- [ ] WebSocket Manager测试
- [ ] URL派生测试
- [ ] 事件处理测试
- [ ] 缓存更新测试

### 集成测试
- [ ] Windows → Web 同步测试
- [ ] Web → Windows 同步测试
- [ ] 删除同步测试
- [ ] 网络断线重连测试
- [ ] 配置更改重连测试

### 性能测试
- [ ] 同步延迟 < 100ms
- [ ] 连接稳定性 > 99%
- [ ] 重连时间 < 5秒
- [ ] 内存占用 < 1MB

## 🚀 部署步骤

### 1. 后端部署

```bash
# 确保后端WebSocket服务运行
cd server
npm install
npm run build
npm start

# 验证WebSocket服务
# 应该看到：✅ WebSocket服务器初始化成功
```

### 2. Windows客户端部署

```bash
# 构建Windows客户端
cd windows-login-manager
npm install
npm run build

# 生成安装包
npm run dist

# 测试安装包
# 安装并运行，验证WebSocket连接
```

### 3. 网页端部署

```bash
# 构建网页端
cd client
npm install
npm run build

# 部署到服务器
# 上传dist目录到服务器
```

## 🔍 部署后验证

### 1. 后端验证

```bash
# 检查后端日志
tail -f logs/server.log

# 应该看到：
✅ WebSocket服务器初始化成功
✅ Server running on http://localhost:3000
```

### 2. Windows客户端验证

```javascript
// 打开开发者工具（F12）
// 检查WebSocket状态
await window.electronAPI.getWebSocketStatus()

// 应该返回：
{
  connected: true,
  authenticated: true,
  reconnectAttempts: 0
}
```

### 3. 网页端验证

```javascript
// 打开浏览器开发者工具
// 检查控制台日志

// 应该看到：
✅ WebSocket connected
✅ WebSocket authenticated
```

### 4. 端到端验证

1. 在Windows端添加账号
2. 检查网页端是否自动显示
3. 在网页端删除账号
4. 检查Windows端是否自动移除

## 📊 监控指标

### WebSocket连接质量

```javascript
// 定期检查连接状态
setInterval(async () => {
  const status = await window.electronAPI.getWebSocketStatus();
  console.log('WebSocket Status:', status);
  
  // 记录到监控系统
  if (!status.connected) {
    alert('WebSocket disconnected!');
  }
}, 60000); // 每分钟检查一次
```

### 同步延迟监控

```javascript
// 记录同步时间
const startTime = Date.now();
// 执行操作...
// 收到事件
const endTime = Date.now();
const latency = endTime - startTime;

console.log('Sync latency:', latency, 'ms');
// 记录到监控系统
```

## 🛠️ 故障排查

### WebSocket无法连接

**检查清单：**
1. [ ] 后端WebSocket服务是否运行？
2. [ ] 服务器URL配置是否正确？
3. [ ] 访问令牌是否有效？
4. [ ] 防火墙是否阻止连接？
5. [ ] 网络是否正常？

**解决步骤：**
```bash
# 1. 检查后端日志
tail -f logs/server.log

# 2. 检查Windows端日志
# 位置：%APPDATA%/windows-login-manager/logs

# 3. 手动重连
await window.electronAPI.reconnectWebSocket()

# 4. 检查配置
await window.electronAPI.getConfig()
```

### 事件不同步

**检查清单：**
1. [ ] WebSocket是否已连接？
2. [ ] WebSocket是否已认证？
3. [ ] 后端是否广播事件？
4. [ ] 客户端是否接收事件？
5. [ ] 事件处理是否正确？

**解决步骤：**
```javascript
// 1. 检查WebSocket状态
const status = await window.electronAPI.getWebSocketStatus();
console.log('Status:', status);

// 2. 检查事件监听
// 在AppContext中添加日志
window.electronAPI.onAccountEvent((event) => {
  console.log('Event received:', event);
});

// 3. 检查后端日志
// 应该看到：广播账号事件: account.created
```

### 性能问题

**检查清单：**
1. [ ] 网络延迟是否正常？
2. [ ] 事件频率是否过高？
3. [ ] UI更新是否过于频繁？
4. [ ] 内存占用是否正常？

**解决步骤：**
```javascript
// 1. 测量网络延迟
const start = Date.now();
await fetch('http://your-server.com/api/health');
const latency = Date.now() - start;
console.log('Network latency:', latency, 'ms');

// 2. 监控内存占用
console.log('Memory:', process.memoryUsage());

// 3. 优化事件处理
// 考虑批量处理事件，减少UI更新频率
```

## 📝 回滚计划

如果部署出现问题，按以下步骤回滚：

### 1. 停止新版本

```bash
# 停止Windows客户端
# 用户手动关闭应用

# 停止后端服务
pm2 stop server
```

### 2. 恢复旧版本

```bash
# 恢复后端
git checkout <previous-commit>
npm install
npm run build
pm2 start server

# 恢复Windows客户端
# 用户重新安装旧版本
```

### 3. 验证回滚

```bash
# 检查后端日志
tail -f logs/server.log

# 检查Windows客户端
# 确保基本功能正常
```

## 🎯 成功标准

部署成功的标准：

- ✅ 所有测试通过
- ✅ WebSocket连接稳定
- ✅ 同步延迟 < 100ms
- ✅ 无控制台错误
- ✅ 用户反馈良好
- ✅ 监控指标正常

## 📞 支持联系

如果遇到问题：

1. 查看文档：
   - `WEBSOCKET_IMPLEMENTATION_SUMMARY.md`
   - `WEBSOCKET_INTEGRATION_TEST.md`
   - `WEBSOCKET_QUICK_START.md`

2. 检查日志：
   - Windows端：`%APPDATA%/windows-login-manager/logs`
   - 后端：`logs/server.log`

3. 联系技术支持

## 📅 部署时间表

建议部署时间：
- **开发环境：** 立即
- **测试环境：** 1-2天后
- **生产环境：** 测试通过后1周

## ✨ 部署后任务

- [ ] 监控WebSocket连接质量
- [ ] 收集用户反馈
- [ ] 分析性能指标
- [ ] 优化同步延迟
- [ ] 更新文档
- [ ] 培训用户

---

**检查清单版本：** 1.0
**最后更新：** 2024-12-22
**负责人：** 开发团队
