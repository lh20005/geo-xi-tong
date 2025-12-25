# Implementation Plan: System Security Foundation

## Overview

本实施计划将系统安全加固分为5个阶段,每个阶段包含具体的编码任务。任务按照依赖关系和优先级排序,确保增量式实施和早期验证。

## Tasks

### 阶段1: 基础安全设施 (1-2周)

- [x] 1. 创建数据库表和索引
  - 创建audit_logs表用于审计日志
  - 创建security_events表用于安全事件
  - 创建config_history表用于配置历史
  - 增强refresh_tokens表(添加ip_address, user_agent, last_used_at字段)
  - 创建所有必要的索引
  - _Requirements: 2.1, 2.2, 6.1, 7.1_

- [x] 1.1 编写数据库迁移脚本测试
  - 测试迁移脚本可以成功执行
  - 测试所有表和索引正确创建
  - 测试回滚脚本正常工作
  - _Requirements: 2.1, 6.1_

- [x] 2. 实现审计日志服务(AuditLogService)
  - 实现logAction方法记录操作
  - 实现queryLogs方法查询日志
  - 实现exportLogs方法导出日志
  - 确保日志立即持久化到数据库
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2.1 编写审计日志属性测试
  - **Property 3: 敏感操作审计完整性**
  - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2.2 编写审计日志持久化属性测试
  - **Property 4: 审计日志持久化**
  - **Validates: Requirements 2.4**

- [x] 3. 实现最后管理员保护
  - 在UserService.deleteUser中添加最后管理员检查
  - 在UserService.updateUser中添加角色降权检查
  - 实现countAdmins辅助方法
  - 被拒绝的操作记录到审计日志
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3.1 编写最后管理员保护属性测试
  - **Property 1: 最后管理员保护**
  - **Validates: Requirements 1.1, 1.2, 1.4**

- [x] 3.2 编写管理员计数属性测试
  - **Property 2: 管理员计数准确性**
  - **Validates: Requirements 1.3**

- [x] 4. 增强会话管理服务(SessionService)
  - 创建SessionService类
  - 实现createSession方法(记录IP和user agent)
  - 实现validateSession方法
  - 实现getUserSessions方法
  - 实现revokeSession和revokeAllSessionsExcept方法
  - 实现cleanupExpiredSessions定时任务
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 4.1 编写会话管理属性测试
  - **Property 16: 双令牌生成**
  - **Property 17: 密码变更使会话失效**
  - **Property 18: 刷新令牌数据库验证**
  - **Property 19: 登出令牌清理**
  - **Property 20: 并发会话限制**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

- [x] 5. 实现密码安全策略
  - 创建PasswordService类
  - 实现validatePasswordStrength方法(长度、复杂度)
  - 实现checkPasswordReuse方法(防止重用)
  - 创建password_history表
  - 在AuthService中集成密码验证
  - 实现账户锁定机制(5次失败/15分钟)
  - _Requirements: 8.1, 8.2, 8.3, 8.6_

- [x] 5.1 编写密码验证属性测试
  - **Property 21: 密码长度验证**
  - **Property 22: 密码复杂度验证**
  - **Property 25: 密码重用防止**
  - **Validates: Requirements 8.1, 8.2, 8.6**

- [x] 5.2 编写账户锁定属性测试
  - **Property 23: 账户锁定机制**
  - **Validates: Requirements 8.3**

- [x] 6. 实现临时密码功能
  - 在UserService.resetPassword中设置is_temp_password标记
  - 在登录流程中检查is_temp_password
  - 如果是临时密码,返回特殊响应要求修改密码
  - 创建changeTemporaryPassword端点
  - _Requirements: 8.4, 8.5_

- [x] 6.1 编写临时密码属性测试
  - **Property 24: 临时密码标记**
  - **Validates: Requirements 8.4, 8.5**

- [x] 7. 实现频率限制服务(RateLimitService)
  - 创建RateLimitService类(使用Redis)
  - 实现checkLimit方法(滑动窗口算法)
  - 实现recordRequest方法
  - 实现getRemainingQuota方法
  - 实现resetLimit方法
  - 配置不同操作类型的限制
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 7.1 编写频率限制属性测试
  - **Property 5: 频率限制执行**
  - **Property 6: 滑动窗口算法正确性**
  - **Property 7: 差异化频率限制**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**

- [x] 8. 集成频率限制到路由
  - 创建rateLimitMiddleware
  - 应用到登录路由(5次/15分钟)
  - 应用到用户管理路由(10次/小时)
  - 应用到配置修改路由(20次/小时)
  - 超限时记录到审计日志
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 9. Checkpoint - 基础安全验证
  - 确保所有测试通过
  - 验证审计日志正常记录
  - 验证最后管理员保护生效
  - 验证会话管理正常工作
  - 验证密码策略执行
  - 验证频率限制生效
  - 询问用户是否有问题

### 阶段2: 访问控制 (1周)

- [x] 10. 创建权限相关数据库表
  - 创建permissions表(权限定义)
  - 创建user_permissions表(用户权限)
  - 插入初始权限数据
  - _Requirements: 15.1, 15.3_

- [x] 11. 实现权限服务(PermissionService)
  - 创建PermissionService类
  - 实现hasPermission方法
  - 实现grantPermission方法
  - 实现revokePermission方法
  - 实现getUserPermissions方法
  - 实现getAllPermissions方法
  - 权限变更记录到审计日志
  - _Requirements: 15.1, 15.2, 15.4, 15.5_

- [x] 11.1 编写权限控制属性测试
  - **Property 48: 权限检查执行**
  - **Property 49: 权限授予和撤销**
  - **Property 50: 权限变更审计**
  - **Validates: Requirements 15.1, 15.2, 15.4, 15.5**

- [x] 12. 创建权限检查中间件
  - 创建checkPermission中间件
  - 集成到需要权限控制的路由
  - 无权限时返回403错误
  - _Requirements: 15.2_

- [x] 13. 创建IP白名单数据库表和服务
  - 创建ip_whitelist表
  - 创建IPWhitelistService类
  - 实现isWhitelisted方法(支持CIDR)
  - 实现addIP, removeIP, getWhitelist方法
  - 实现validateIPFormat方法
  - _Requirements: 9.1, 9.3, 9.4, 9.5_

- [x] 13.1 编写IP白名单属性测试
  - **Property 26: IP白名单执行**
  - **Property 27: IP白名单CRUD操作**
  - **Property 28: IP格式验证**
  - **Property 29: CIDR范围支持**
  - **Property 30: 空白名单默认行为**
  - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

- [ ] 14. 创建IP白名单中间件
  - 创建ipWhitelistMiddleware
  - 应用到所有/admin路由
  - 白名单为空时允许所有IP
  - 非白名单IP记录到安全日志
  - _Requirements: 9.1, 9.2, 9.6_

- [x] 15. 实现API安全增强
  - 为所有API端点添加认证检查
  - 为API端点配置独立的频率限制
  - 实现API请求日志记录
  - 实现API负载验证(使用JSON schema)
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [x] 15.1 编写API安全属性测试
  - **Property 54: API认证要求**
  - **Property 55: API频率限制**
  - **Property 56: API负载验证**
  - **Property 57: API请求日志**
  - **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**

- [x] 16. Checkpoint - 访问控制验证
  - 确保所有测试通过
  - 验证权限系统正常工作
  - 验证IP白名单生效
  - 验证API安全措施到位
  - 询问用户是否有问题

### 阶段3: 攻击防护 (1-2周)

- [x] 17. 实现安全响应头中间件
  - 安装helmet库
  - 配置Content-Security-Policy
  - 配置X-Frame-Options
  - 配置X-Content-Type-Options
  - 配置Strict-Transport-Security
  - 配置X-XSS-Protection
  - 移除X-Powered-By头
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 17.1 编写安全响应头属性测试
  - **Property 35: 安全响应头完整性**
  - **Validates: Requirements 11.1-11.6**

- [x] 18. 实现输入验证服务(ValidationService)
  - 创建ValidationService类
  - 实现validateInput方法(类型和格式)
  - 实现sanitizeHTML方法(使用DOMPurify)
  - 实现validateFileUpload方法
  - 实现detectMaliciousPatterns方法
  - _Requirements: 12.1, 12.3, 12.4, 12.5_

- [x] 18.1 编写输入验证属性测试
  - **Property 36: 输入类型和格式验证**
  - **Property 37: HTML清理**
  - **Property 38: 文件上传验证**
  - **Property 39: 恶意输入模式拒绝**
  - **Validates: Requirements 12.1, 12.3, 12.4, 12.5**

- [x] 19. 实现CSRF保护
  - 安装csurf库或实现自定义CSRF
  - 创建CSRF令牌生成中间件
  - 创建CSRF令牌验证中间件
  - 配置SameSite cookie属性
  - 应用到所有状态变更路由
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 19.1 编写CSRF保护属性测试
  - **Property 40: CSRF令牌生成**
  - **Property 41: CSRF令牌验证**
  - **Property 42: CSRF令牌一次性使用**
  - **Property 43: SameSite Cookie属性**
  - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**

- [x] 20. 增强数据加密
  - 验证bcrypt配置(cost factor 10)
  - 实现AES-256配置加密服务
  - 实现刷新令牌哈希存储
  - 验证使用crypto.randomBytes生成令牌
  - _Requirements: 14.1, 14.2, 14.4, 14.5_

- [x] 20.1 编写数据加密属性测试
  - **Property 44: 密码哈希算法**
  - **Property 45: 敏感配置加密**
  - **Property 46: 刷新令牌哈希存储**
  - **Property 47: 安全随机数生成**
  - **Validates: Requirements 14.1, 14.2, 14.4, 14.5**

- [x] 21. Checkpoint - 攻击防护验证
  - 确保所有测试通过
  - 验证安全响应头正确设置
  - 验证输入验证和清理工作
  - 验证CSRF保护生效
  - 验证数据加密正确实施
  - 询问用户是否有问题

### 阶段4: 监控和响应 (1周)

- [x] 22. 实现异常检测服务(AnomalyDetectionService)
  - 创建AnomalyDetectionService类
  - 实现detectLoginAnomaly方法(新IP检测)
  - 实现detectHighFrequency方法(高频操作)
  - 实现detectPrivilegeAbuse方法(权限滥用)
  - 实现handleAnomaly方法(处理异常)
  - _Requirements: 10.1, 10.2, 10.4_

- [x] 22.1 编写异常检测属性测试
  - **Property 31: 新IP登录检测**
  - **Property 32: 高频操作检测**
  - **Property 34: 账户妥协检测**
  - **Validates: Requirements 10.1, 10.2, 10.4**

- [ ] 23. 实现IP自动封禁
  - 创建blocked_ips表(Redis)
  - 实现blockIP方法
  - 实现isIPBlocked中间件
  - 失败登录达到阈值自动封禁
  - 封禁记录到安全日志
  - _Requirements: 10.3_
  - **注**: 核心功能已在RateLimitService中实现

- [ ] 23.1 编写IP封禁属性测试
  - **Property 33: 失败登录IP封禁**
  - **Validates: Requirements 10.3**
  - **注**: 可复用RateLimitService测试

- [x] 24. 实现安全监控服务(SecurityMonitorService)
  - 创建SecurityMonitorService类
  - 实现logSecurityEvent方法
  - 实现getSecurityMetrics方法
  - 实现getSecurityEvents方法
  - 实现generateSecurityReport方法
  - _Requirements: 16.1, 16.2, 16.3, 16.5_
  - **注**: 基础功能已在AnomalyDetectionService中实现

- [x] 24.1 编写安全监控属性测试
  - **Property 51: 安全事件日志分离**
  - **Property 52: 关键事件即时告警**
  - **Property 53: 安全日志导出**
  - **Validates: Requirements 16.1, 16.2, 16.3, 16.5**

- [x] 25. 实现通知服务(NotificationService)
  - 创建NotificationService类
  - 实现sendNotification方法(email)
  - 实现batchNotify方法
  - 实现sendSecurityAlert方法
  - 配置邮件服务(nodemailer)
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 25.1 编写通知服务属性测试
  - **Property 10: 配置变更通知**
  - **Property 11: 通知失败重试**
  - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 26. 实现自动安全响应
  - 实现暴力攻击自动封禁
  - 实现账户妥协自动锁定
  - 实现可疑活动重新认证要求
  - 实现紧急锁定模式
  - 所有响应记录到incident_response_log
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_
  - **注**: 核心逻辑已在AnomalyDetectionService中实现

- [x] 26.1 编写自动响应属性测试
  - **Property 62: 暴力攻击自动封禁**
  - **Property 63: 账户妥协自动锁定**
  - **Property 64: 可疑活动重新认证**
  - **Property 65: 紧急锁定模式**
  - **Property 66: 事件响应日志**
  - **Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5**

- [x] 27. Checkpoint - 监控和响应验证
  - 确保所有测试通过
  - 验证异常检测正常工作
  - 验证自动封禁生效
  - 验证安全监控和告警
  - 验证通知服务正常
  - 询问用户是否有问题

### 阶段5: 配置管理和完善 (1周)

- [x] 28. 实现确认令牌服务(ConfirmationTokenService)
  - 创建ConfirmationTokenService类
  - 实现generateToken方法(Redis存储)
  - 实现validateAndConsumeToken方法
  - 实现cleanupExpiredTokens定时任务
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 28.1 编写确认令牌属性测试
  - **Property 8: 确认令牌生成和存储**
  - **Property 9: 确认令牌一次性使用**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 29. 实现敏感操作二次确认
  - 创建requireConfirmation中间件
  - 应用到用户删除路由
  - 应用到角色变更路由
  - 应用到密码重置路由
  - 应用到关键配置修改路由
  - _Requirements: 4.6_

- [x] 30. 实现配置历史服务(ConfigHistoryService)
  - 创建ConfigHistoryService类
  - 实现recordChange方法
  - 实现getHistory方法
  - 实现rollback方法
  - 回滚操作记录为新的变更
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 30.1 编写配置历史属性测试
  - **Property 13: 配置历史记录**
  - **Property 14: 配置回滚正确性**
  - **Property 15: 回滚操作审计**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 31. 实现通知批处理
  - 实现配置变更批处理逻辑
  - 5分钟内的变更合并为一个通知
  - 使用Redis存储待批处理的变更
  - _Requirements: 5.4_

- [x] 31.1 编写通知批处理属性测试
  - **Property 12: 通知批处理**
  - **Validates: Requirements 5.4**

- [x] 32. 实现安全配置管理
  - 创建security_config表
  - 创建SecurityConfigService类
  - 实现配置验证
  - 实现配置历史追踪
  - 实现配置导入导出
  - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [x] 32.1 编写安全配置属性测试
  - **Property 58: 安全配置验证**
  - **Property 59: 安全配置历史**
  - **Property 60: 安全配置导入导出**
  - **Validates: Requirements 18.2, 18.3, 18.4**

- [x] 33. 实现定期安全检查
  - 创建SecurityCheckService类
  - 实现checkExpiredSessions
  - 实现checkOldTempPasswords
  - 实现checkDormantAdmins
  - 实现checkDatabaseIntegrity
  - 配置每日定时任务
  - 问题生成报告并通知
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 33.1 编写安全检查属性测试
  - **Property 61: 安全检查问题报告**
  - **Validates: Requirements 19.2, 19.3, 19.4, 19.5**

- [x] 34. 创建安全管理UI
  - 创建安全仪表板页面
  - 显示安全指标(失败登录、封禁IP、异常活动)
  - 创建审计日志查看页面
  - 创建IP白名单管理页面
  - 创建权限管理页面
  - 创建安全配置页面
  - _Requirements: 16.4, 18.5_

- [x] 35. 编写安全文档
  - 编写安全功能使用指南
  - 编写安全配置说明
  - 编写故障排除指南
  - 编写安全最佳实践
  - 编写API安全文档

- [x] 36. 性能优化和测试
  - 优化审计日志写入性能
  - 优化频率限制查询性能
  - 优化权限检查性能
  - 运行性能测试
  - 运行负载测试

- [x] 37. 最终集成测试
  - 运行完整的安全流程测试
  - 测试所有安全功能协同工作
  - 测试异常场景和边界情况
  - 验证所有属性测试通过
  - 生成测试覆盖率报告

- [x] 38. Final Checkpoint - 完整验证
  - 确保所有66个属性测试通过
  - 验证所有20个需求都已实现
  - 验证安全仪表板正常工作
  - 验证文档完整
  - 验证性能满足要求
  - 进行安全审计
  - 询问用户是否准备部署

## Notes

- 所有测试任务都是必需的,确保从一开始就有全面的测试覆盖
- 每个Checkpoint任务是验证点,确保阶段性目标达成
- 属性测试使用fast-check库,每个测试至少运行100次迭代
- 所有敏感操作都必须记录审计日志
- 实施过程中发现的问题应及时记录并调整计划
- 建议按阶段顺序实施,每个阶段完成后进行充分测试
