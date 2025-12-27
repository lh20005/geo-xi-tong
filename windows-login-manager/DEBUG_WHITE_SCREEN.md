# 白屏问题调试指南

## 当前状态
- ✅ 后端服务器运行正常 (http://localhost:3000)
- ✅ 桌面客户端运行正常
- ✅ Dashboard 页面加载正常，所有 API 调用成功
- ⚠️ 部分页面点击后显示白屏

## 调试步骤

### 1. 打开开发者工具
在桌面客户端中按 `Cmd+Option+I` (Mac) 或 `Ctrl+Shift+I` (Windows) 打开开发者工具

### 2. 查看控制台错误
1. 点击 Console 标签
2. 点击会白屏的页面
3. 查看是否有红色错误信息
4. 记录错误信息（特别是 Error 和 Failed to load 相关的）

### 3. 常见白屏原因

#### 原因 1: 组件导入错误
**症状**: 控制台显示 "Failed to load module" 或 "Cannot find module"
**解决**: 检查页面文件的 import 语句是否正确

#### 原因 2: API 调用失败
**症状**: 控制台显示 "Network Error" 或 "404 Not Found"
**解决**: 检查后端 API 是否实现了该接口

#### 原因 3: 组件渲染错误
**症状**: 控制台显示 "Cannot read property of undefined" 或 "TypeError"
**解决**: 检查组件代码中的数据访问是否安全

#### 原因 4: 缺少依赖
**症状**: 控制台显示 "X is not defined"
**解决**: 检查 package.json 是否包含所需依赖

### 4. 测试每个页面

请按以下顺序测试每个页面，记录哪些页面正常，哪些白屏：

#### 内容管理
- [ ] 知识库管理 (/knowledge-base)
- [ ] 知识库详情 (/knowledge-base/:id)
- [ ] 关键词蒸馏 (/distillation)
- [ ] 蒸馏结果 (/distillation-results)
- [ ] 话题列表 (/topics)
- [ ] 文章生成 (/article)
- [ ] 文章列表 (/articles)
- [ ] 文章设置 (/article-settings)
- [ ] 文章生成任务 (/article-generation)

#### 平台管理
- [ ] 平台管理 (/platform-management)
- [ ] 转化目标 (/conversion-targets)
- [ ] 发布任务 (/publishing-tasks)
- [ ] 发布记录 (/publishing-records)

#### 媒体管理
- [ ] 图库 (/gallery)
- [ ] 相册详情 (/gallery/:albumId)

#### 系统管理
- [ ] 系统配置 (/config)
- [ ] 安全仪表板 (/security/dashboard)
- [ ] 审计日志 (/security/audit-logs)
- [ ] IP白名单 (/security/ip-whitelist)
- [ ] 权限管理 (/security/permissions)
- [ ] 安全配置 (/security/config)
- [ ] 产品管理 (/products)
- [ ] 订单管理 (/admin/orders)
- [ ] 支付 (/payment)

#### 用户中心
- [ ] 用户中心 (/user-center)
- [ ] 使用手册 (/user-manual)

#### 登录管理器
- [ ] 平台选择 (/platforms)
- [ ] 账号列表 (/accounts)
- [ ] 设置 (/settings)

### 5. 收集信息

请提供以下信息：
1. **白屏的页面列表**（例如：知识库管理、文章列表等）
2. **控制台错误信息**（完整的错误堆栈）
3. **Network 标签中的失败请求**（如果有）

## 临时解决方案

如果某个页面持续白屏，可以尝试：
1. 刷新页面 (Cmd+R 或 Ctrl+R)
2. 重启桌面客户端
3. 清除缓存后重启

## 下一步

收集到错误信息后，我们可以：
1. 修复具体的组件错误
2. 添加错误边界（Error Boundary）
3. 改进错误提示
4. 添加加载状态
