# Requirements Document

## Introduction

Windows端删除账号后，网页端无法实时同步更新，必须手动刷新页面才能看到账号被删除。这个问题影响用户体验，需要确保WebSocket实时同步功能正常工作。

## Glossary

- **Windows_Client**: Windows桌面登录管理器应用
- **Web_Client**: 浏览器端的网页应用
- **WebSocket_Service**: 服务端WebSocket服务，负责实时推送事件
- **Account_Deletion**: 删除平台账号的操作
- **Real_Time_Sync**: 通过WebSocket实现的实时数据同步

## Requirements

### Requirement 1: 用户认证系统

**User Story:** 作为系统管理员，我希望有一个统一的用户认证系统，以便Windows端和网页端用户使用相同的账号登录。

#### Acceptance Criteria

1. THE 系统 SHALL 提供用户注册和登录功能
2. WHEN 用户登录成功 THEN 系统 SHALL 返回JWT访问令牌和刷新令牌
3. THE 用户密码 SHALL 使用bcrypt加密存储
4. WHEN 访问令牌过期 THEN 系统 SHALL 支持使用刷新令牌获取新的访问令牌
5. THE 系统 SHALL 记录用户最后登录时间

### Requirement 2: 网页端登录界面

**User Story:** 作为网页端用户，我希望能够通过登录界面输入用户名和密码登录系统。

#### Acceptance Criteria

1. THE 网页端 SHALL 提供登录页面
2. WHEN 用户未登录 THEN 系统 SHALL 自动跳转到登录页面
3. WHEN 用户登录成功 THEN 系统 SHALL 保存访问令牌到localStorage
4. WHEN 用户登录失败 THEN 系统 SHALL 显示错误提示
5. THE 登录页面 SHALL 包含用户名和密码输入框

### Requirement 3: 账号删除事件广播

**User Story:** 作为系统管理员，我希望当任何客户端删除账号时，所有已认证的客户端都能实时收到通知，以便保持数据一致性。

#### Acceptance Criteria

1. WHEN Windows_Client 删除账号 THEN WebSocket_Service SHALL 广播 account.deleted 事件
2. WHEN Web_Client 删除账号 THEN WebSocket_Service SHALL 广播 account.deleted 事件
3. WHEN account.deleted 事件被广播 THEN 事件数据 SHALL 包含被删除账号的ID
4. WHEN 删除操作失败 THEN WebSocket_Service SHALL NOT 广播 account.deleted 事件
5. WHEN 广播事件 THEN 系统 SHALL 只向已认证的客户端发送

### Requirement 4: WebSocket连接管理

**User Story:** 作为Web_Client用户，我希望应用能自动建立和维护WebSocket连接，以便接收实时更新。

#### Acceptance Criteria

1. WHEN Web_Client 加载 THEN 系统 SHALL 使用访问令牌初始化WebSocket连接
2. WHEN WebSocket连接断开 THEN 系统 SHALL 自动尝试重新连接
3. WHEN WebSocket连接成功 THEN 系统 SHALL 显示连接状态指示器
4. WHEN WebSocket认证失败 THEN 系统 SHALL 记录错误日志并提示用户
5. WHEN 用户未登录 THEN 系统 SHALL NOT 尝试建立WebSocket连接

### Requirement 5: 事件订阅和处理

**User Story:** 作为Web_Client，我希望能订阅账号相关事件，以便在账号变更时更新UI。

#### Acceptance Criteria

1. WHEN WebSocket认证成功 THEN Web_Client SHALL 订阅 accounts 频道
2. WHEN 收到 account.deleted 事件 THEN Web_Client SHALL 从本地状态中移除对应账号
3. WHEN 收到 account.deleted 事件 THEN Web_Client SHALL 显示通知消息
4. WHEN 收到 account.deleted 事件 THEN Web_Client SHALL 更新UI显示

### Requirement 6: 路由一致性

**User Story:** 作为开发者，我希望Windows_Client和Web_Client使用相同的API路由，以便简化维护和调试。

#### Acceptance Criteria

1. THE 删除账号API路由 SHALL 为 `/api/publishing/accounts/:id`
2. WHEN Windows_Client 调用删除API THEN 请求路径 SHALL 匹配服务端路由
3. WHEN Web_Client 调用删除API THEN 请求路径 SHALL 匹配服务端路由
4. THE 服务端 SHALL 在同一个路由处理器中处理所有删除请求

### Requirement 7: 生产环境安全

**User Story:** 作为系统管理员，我希望系统在生产环境中使用安全的通信协议，以保护用户数据。

#### Acceptance Criteria

1. WHEN 部署到生产环境 THEN 系统 SHALL 使用HTTPS协议
2. WHEN 部署到生产环境 THEN WebSocket SHALL 使用WSS协议
3. THE 系统 SHALL 通过Nginx反向代理处理HTTPS和WSS请求
4. THE JWT密钥 SHALL 从环境变量读取，不得硬编码

### Requirement 8: 调试和监控

**User Story:** 作为开发者，我希望能够追踪WebSocket事件的发送和接收，以便快速定位问题。

#### Acceptance Criteria

1. WHEN WebSocket事件被广播 THEN 服务端 SHALL 记录日志
2. WHEN Web_Client 收到WebSocket事件 THEN 客户端 SHALL 记录日志
3. WHEN WebSocket连接状态变化 THEN 系统 SHALL 记录状态变化日志
4. THE 日志 SHALL 包含时间戳、事件类型和相关数据
5. THE 日志 SHALL NOT 包含敏感信息（如密码、完整token）
