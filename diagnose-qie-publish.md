# 企鹅号发布问题诊断

## 问题现象
点击发布任务按钮后，没有按照设定的自动发布执行，什么都没做。

## 诊断步骤

### 1. 检查服务器日志
```bash
tail -f server.log | grep -E "企鹅号|qie|任务"
```

### 2. 检查浏览器控制台
- 打开浏览器开发者工具
- 查看 Network 标签
- 点击发布任务按钮
- 查看是否有 API 请求发出
- 查看请求的响应

### 3. 检查任务是否创建
在浏览器控制台执行：
```javascript
// 查看最近的发布任务
fetch('/api/publishing/tasks?page=1&pageSize=10', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(d => console.log(d))
```

### 4. 手动触发任务执行
如果任务已创建但未执行，可以手动触发：
```javascript
// 替换 TASK_ID 为实际的任务ID
fetch('/api/publishing/tasks/TASK_ID/execute', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(d => console.log(d))
```

### 5. 检查适配器是否正确加载
在服务器启动日志中查找：
```
✅ 注册平台适配器: 企鹅号
```

### 6. 检查账号Cookie是否有效
```javascript
// 测试账号登录
fetch('/api/accounts/ACCOUNT_ID/test-login', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(d => console.log(d))
```

## 可能的原因

### 1. 前端未发送请求
- 检查按钮的 onClick 事件是否绑定
- 检查是否有 JavaScript 错误阻止执行
- 检查网络请求是否发出

### 2. 后端未收到请求
- 检查路由是否正确
- 检查认证中间件是否通过
- 检查参数验证是否通过

### 3. 任务创建失败
- 检查文章ID是否存在
- 检查账号ID是否存在
- 检查用户权限

### 4. 任务执行失败
- 检查适配器是否注册
- 检查Cookie是否有效
- 检查浏览器是否启动

### 5. 适配器执行失败
- 检查选择器是否正确
- 检查页面结构是否变化
- 检查网络连接

## 快速测试命令

### 测试1: 检查服务器是否运行
```bash
curl http://localhost:3000/api/health
```

### 测试2: 检查认证是否正常
```bash
# 替换 YOUR_TOKEN 为实际的token
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/accounts
```

### 测试3: 创建测试任务
```bash
# 替换参数为实际值
curl -X POST http://localhost:3000/api/publishing/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "article_id": 1,
    "account_id": 1,
    "platform_id": "qie"
  }'
```

## 下一步行动

1. **立即检查**: 打开浏览器控制台，点击发布按钮，查看是否有请求发出
2. **查看日志**: 检查 server.log 是否有任何错误信息
3. **测试账号**: 先使用"测试登录"功能确认账号Cookie有效
4. **简化测试**: 创建一个最简单的测试文章，只包含标题和少量文字，不包含图片

## 临时解决方案

如果自动发布不工作，可以：
1. 使用"测试登录"打开浏览器
2. 手动复制文章内容
3. 手动粘贴到企鹅号编辑器
4. 手动点击发布

## 需要提供的信息

请提供以下信息以便进一步诊断：
1. 浏览器控制台的截图（Network标签）
2. 服务器日志的最后100行
3. 点击发布按钮后是否有任何提示或错误
4. 文章ID和账号ID
5. 是否使用了批量发布还是单个发布
