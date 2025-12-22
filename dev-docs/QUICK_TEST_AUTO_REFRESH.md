# 账号自动刷新功能快速测试

## 快速测试步骤

### 1. 启动所有服务

```bash
# 终端1: 启动后端
cd server
npm run dev

# 终端2: 启动前端
cd client
npm run dev

# 终端3: 启动Windows登录管理器（可选）
cd windows-login-manager
npm run dev
```

### 2. 运行测试脚本

```bash
./test-account-auto-refresh.sh
```

### 3. 测试自动更新（5分钟）

#### 步骤：
1. 打开浏览器：http://localhost:5173
2. 登录系统
3. 进入"平台管理"页面
4. 检查右上角WebSocket状态：应显示 ✅ "已连接"
5. 打开Windows登录管理器
6. 选择一个平台进行登录
7. 完成登录

#### 预期结果：
- ✅ 网页端自动显示："检测到新账号创建，正在刷新列表..."
- ✅ 账号列表自动更新
- ✅ 新账号出现在列表中
- ✅ 无需手动刷新

### 4. 测试手动刷新（2分钟）

#### 测试位置1：平台管理页面
1. 在"账号管理"卡片右上角
2. 点击"刷新列表"按钮
3. 观察按钮loading状态
4. 列表重新加载

#### 测试位置2：账号管理模态框
1. 点击任意平台卡片
2. 在弹出的模态框中
3. 点击"刷新列表"按钮
4. 看到"账号列表已刷新"提示

## 验证清单

- [ ] WebSocket连接成功（显示"已连接"）
- [ ] Windows端登录后网页端自动刷新
- [ ] 显示正确的提示消息
- [ ] 平台管理页面刷新按钮工作
- [ ] 账号管理模态框刷新按钮工作
- [ ] 刷新时显示loading状态
- [ ] 断线后能自动重连

## 常见问题

### WebSocket显示"未连接"
**原因**：后端服务未启动或网络问题
**解决**：
```bash
# 检查后端服务
lsof -i :3000

# 重启后端
cd server && npm run dev
```

### 自动更新不工作
**原因**：WebSocket未连接或事件未触发
**解决**：
1. 检查浏览器控制台
2. 查看后端日志
3. 使用手动刷新作为备选

### 刷新按钮无响应
**原因**：API请求失败
**解决**：
1. 检查网络连接
2. 查看浏览器控制台错误
3. 确认后端API正常

## 测试数据

### 测试账号信息
- 平台：头条、抖音、小红书等
- 账号名：任意
- 登录方式：浏览器登录

### 预期WebSocket消息
```json
{
  "type": "account.created",
  "data": {
    "id": 123,
    "platform_id": "toutiao",
    "account_name": "测试账号",
    "real_username": "user123"
  },
  "timestamp": "2025-12-22T10:30:00.000Z"
}
```

## 性能指标

- WebSocket连接时间：< 1秒
- 自动刷新延迟：< 2秒
- 手动刷新时间：< 1秒
- 重连时间：< 5秒

## 完成标准

✅ 所有验证清单项通过
✅ 无控制台错误
✅ 用户体验流畅
✅ 提示消息清晰

## 相关文档

- 详细实现文档：`dev-docs/ACCOUNT_AUTO_REFRESH_FEATURE.md`
- WebSocket服务：`server/src/services/WebSocketService.ts`
- 前端客户端：`client/src/services/websocket.ts`
