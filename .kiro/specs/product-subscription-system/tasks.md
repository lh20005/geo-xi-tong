# Implementation Plan: 商品管理与订阅系统

## Overview

本实施计划将商品管理与订阅系统的设计转化为可执行的开发任务。采用增量开发方式，优先实现核心功能，确保每个阶段都能交付可用的功能模块。

## Tasks

- [x] 1. 数据库设计与初始化
  - 创建 subscription_plans 表（套餐配置）
  - 创建 plan_features 表（功能配额）
  - 创建 user_subscriptions 表（用户订阅）
  - 创建 orders 表（订单）
  - 创建 user_usage 表（使用量统计）
  - 创建 product_config_history 表（配置历史）
  - 添加索引和外键约束
  - 初始化默认套餐数据（免费版、专业版、企业版）
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.8, 10.9_

- [x] 2. 功能配额定义与配置
  - [x] 2.1 创建功能配额定义文件
    - 定义 4 个功能配额（articles_per_day, publish_per_day, platform_accounts, keyword_distillation）
    - 定义套餐代码常量
    - 定义重置周期（daily, monthly, never）
    - _Requirements: 6.1, 6.3, 6.5, 6.7_
  
  - [x] 2.2 创建环境变量配置模板
    - 创建 .env.example 文件
    - 添加微信支付配置项（WECHAT_PAY_APP_ID, WECHAT_PAY_MCH_ID, WECHAT_PAY_API_V3_KEY 等）
    - 添加配置说明注释
    - _Requirements: 4.1, 4.2_

- [x] 3. 订阅服务核心功能
  - [x] 3.1 实现 SubscriptionService 基础方法
    - 实现 getPlanConfig（获取套餐配置，带 Redis 缓存）
    - 实现 getAllActivePlans（获取所有激活套餐）
    - 实现 getUserActiveSubscription（获取用户当前订阅）
    - _Requirements: 5.1, 5.2_
  
  - [x] 3.2 实现配额检查功能
    - 实现 canUserPerformAction（检查用户是否可执行操作）
    - 实现 getUserUsage（获取用户使用量）
    - 实现 checkQuota 中间件
    - _Requirements: 6.1, 6.3, 6.5, 6.7_
  
  - [x] 3.3 实现使用量记录功能
    - 实现 recordUsage（记录用户使用量）
    - 实现 getUserUsageStats（获取使用统计）
    - 支持每日/每月配额重置
    - _Requirements: 6.10, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 3.4 编写订阅服务单元测试
    - 测试配额检查逻辑
    - 测试使用量记录
    - 测试缓存机制
    - _Requirements: 6.1, 6.10_

- [x] 4. 微信支付集成
  - [x] 4.1 选择微信支付 SDK
    - **注意**：微信官方（wechatpay-apiv3）仅提供 Java、PHP、Go 的官方 SDK，没有 Node.js 官方 SDK
    - **方案选择**：
      1. 使用微信官方 wechatpay-axios-plugin（基于 axios 的插件，由微信团队维护）
      2. 或根据微信官方文档自行实现签名和验签逻辑
    - 推荐使用 wechatpay-axios-plugin（npm install wechatpay-axios-plugin）
    - 配置支付参数从环境变量读取
    - _Requirements: 3.2, 4.1_
  
  - [x] 4.2 实现 PaymentService
    - 实现 createWeChatPayOrder（创建预支付订单）
    - 实现 handleWeChatPayNotify（处理支付回调）
    - 实现 queryOrderStatus（查询订单状态）
    - 实现签名验证和幂等性处理
    - _Requirements: 3.2, 3.3, 3.5, 3.6_
  
  - [x] 4.3 创建支付相关 API 路由
    - POST /api/orders（创建订单）
    - POST /api/payment/wechat/notify（支付回调）
    - GET /api/orders/:orderNo/status（查询订单状态）
    - _Requirements: 3.1, 3.4, 3.8_
  
  - [x] 4.4 编写支付服务单元测试
    - 测试订单创建
    - 测试签名验证
    - 测试幂等性处理
    - _Requirements: 3.2, 3.5_

- [x] 5. 订单处理与订阅开通
  - [x] 5.1 实现 OrderService
    - 实现 createOrder（创建订单）
    - 实现 updateOrderStatus（更新订单状态）
    - 实现 closeExpiredOrders（关闭超时订单）
    - _Requirements: 3.1, 3.6, 7.6_
  
  - [x] 5.2 实现订阅开通逻辑
    - 实现 activateSubscription（开通订阅）
    - 支付成功后自动调用
    - 使用数据库事务确保原子性
    - _Requirements: 3.7_
  
  - [x] 5.3 编写订单服务单元测试
    - 测试订单创建
    - 测试订阅开通
    - 测试事务回滚
    - _Requirements: 3.7_

- [x] 6. Checkpoint - 核心功能验证
  - 确保所有测试通过
  - 验证支付流程（使用微信支付沙箱环境）
  - 验证订阅开通流程
  - 验证配额检查功能
  - 如有问题，请向用户反馈

- [x] 7. 商品配置管理（管理员功能）
  - [x] 7.1 实现 ProductService
    - 实现 updatePlan（更新套餐配置）
    - 实现 recordConfigChange（记录配置变更）
    - 实现 getConfigHistory（获取配置历史）
    - 实现 rollbackConfig（回滚配置）
    - _Requirements: 1.6, 8.1, 8.2, 8.3_
  
  - [x] 7.2 创建商品管理 API 路由
    - GET /api/admin/products（获取所有套餐）
    - PUT /api/admin/products/:id（更新套餐）
    - GET /api/admin/products/:id/history（获取配置历史）
    - POST /api/admin/products/:id/rollback（回滚配置）
    - 应用 authenticate 和 requireAdmin 中间件
    - 应用 rateLimit 中间件（价格修改限流）
    - 应用 requireConfirmation 中间件（敏感操作）
    - _Requirements: 1.1, 1.4, 1.5, 1.7, 2.1, 2.2, 2.3, 2.4_
  
  - [x] 7.3 实现配置变更通知
    - 实现 notifyConfigChange（通知所有管理员）
    - 支持邮件通知
    - 支持 WebSocket 实时推送
    - _Requirements: 1.6, 2.6, 8.6_
  
  - [x] 7.4 编写商品管理单元测试
    - 测试权限验证
    - 测试配置更新
    - 测试历史记录
    - 测试回滚功能
    - _Requirements: 2.1, 8.1, 8.3_



- [x] 8. 商品配置前端页面（管理员）
  - [x] 8.1 创建商品管理页面组件
    - 创建 ProductManagementPage.tsx
    - 显示套餐卡片列表
    - 实现编辑对话框
    - 实现二次确认对话框
    - _Requirements: 1.2, 1.3, 1.4, 1.7_
  
  - [x] 8.2 添加管理员菜单入口
    - 在 Sidebar 组件中添加"商品管理"菜单项
    - 仅对 admin 角色显示
    - _Requirements: 1.1_
  
  - [x] 8.3 实现配置历史查看页面
    - 在 ProductManagementPage 中实现历史记录查看
    - 显示历史记录列表
    - 支持回滚操作
    - _Requirements: 8.2, 8.3, 8.4_
  
  - [x] 8.4 编写前端组件测试
    - 测试权限控制（非 admin 不显示菜单）
    - 测试编辑对话框
    - 测试确认对话框
    - _Requirements: 1.1, 1.4, 1.7_

- [x] 9. 用户个人中心 - 订阅信息
  - [x] 9.1 创建订阅信息 API
    - GET /api/user/subscription（获取当前订阅）
    - PUT /api/user/subscription/auto-renew（切换自动续费）
    - _Requirements: 5.1, 5.2_
  
  - [x] 9.2 创建订阅信息卡片组件
    - 创建 UserCenterPage.tsx
    - 显示套餐名称、到期时间、自动续费状态
    - 支持升级、续费操作
    - 显示到期提醒（7天内）
    - _Requirements: 5.1, 5.2, 5.7_
  
  - [x] 9.3 编写订阅信息测试
    - 测试订阅信息展示
    - 测试自动续费切换
    - _Requirements: 5.1, 5.2_

- [x] 10. 用户个人中心 - 使用统计
  - [x] 10.1 创建使用统计 API
    - GET /api/user/usage-stats（获取使用统计）
    - 返回所有功能的使用量和剩余量
    - _Requirements: 5.3, 5.4, 5.5, 5.6_
  
  - [x] 10.2 创建配额进度条组件
    - 在 UserCenterPage 中实现配额进度条
    - 显示进度条（70%橙色、90%红色）
    - 显示重置时间
    - 显示配额预警
    - _Requirements: 5.3, 5.4, 5.5, 5.6_
  
  - [x] 10.3 实现 WebSocket 实时更新
    - 配额变化时推送更新
    - 前端接收并更新 UI
    - _Requirements: 6.10_
  
  - [x] 10.4 编写使用统计测试
    - 测试统计数据准确性
    - 测试进度条颜色
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

- [x] 11. 用户个人中心 - 订单记录
  - [x] 11.1 创建订单查询 API
    - GET /api/user/orders（获取订单列表，支持分页和筛选）
    - GET /api/user/orders/:orderNo（获取订单详情）
    - POST /api/user/orders/:orderNo/invoice（申请发票）
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 11.2 创建订单列表组件
    - 在 UserCenterPage 中实现订单列表
    - 显示订单列表
    - 支持状态筛选
    - 支持查看详情和申请发票
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 11.3 编写订单查询测试
    - 测试订单列表查询
    - 测试分页和筛选
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 12. 套餐升级与降级
  - [x] 12.1 实现升级降级逻辑
    - 实现 upgradePlan（升级套餐，计算差价）
    - 实现 downgradePlan（降级套餐，到期后生效）
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [x] 12.2 创建升级降级 API
    - POST /api/user/subscription/upgrade（升级套餐）
    - POST /api/user/subscription/downgrade（降级套餐）
    - _Requirements: 9.1, 9.3_
  
  - [x] 12.3 创建升级引导 UI
    - 配额不足时显示升级弹窗
    - 对比当前套餐和推荐套餐
    - 一键升级，自动计算差价
    - _Requirements: 9.1, 9.2_
  
  - [x] 12.4 编写升级降级测试
    - 测试差价计算
    - 测试升级立即生效
    - 测试降级延迟生效
    - _Requirements: 9.1, 9.2, 9.5_

- [x] 13. Checkpoint - 用户功能验证
  - 确保所有测试通过
  - 验证个人中心各功能正常
  - 验证升级降级流程
  - 验证实时更新功能
  - 如有问题，请向用户反馈

- [x] 14. 定时任务与自动化
  - [x] 14.1 实现订单超时关闭任务
    - 创建定时任务（每5分钟执行）
    - 关闭创建超过30分钟的 pending 订单
    - _Requirements: 7.6_
  
  - [x] 14.2 实现配额重置任务
    - 创建每日重置任务（每天00:00执行）
    - 重置 articles_per_day 和 publish_per_day
    - 创建每月重置任务（每月1日00:00执行）
    - 重置 keyword_distillation
    - _Requirements: 6.9_
  
  - [x] 14.3 实现订阅到期检查任务
    - 创建定时任务（每天执行）
    - 检查即将到期的订阅（7天内）
    - 发送续费提醒通知
    - 自动降级到期订阅
    - _Requirements: 5.7, 5.8_
  
  - [x] 14.4 编写定时任务测试
    - 测试订单关闭逻辑
    - 测试配额重置逻辑
    - 测试到期检查逻辑
    - _Requirements: 6.9, 5.8, 7.6_

- [x] 15. 管理员订单管理
  - [x] 15.1 创建订单管理 API
    - GET /api/admin/orders（获取所有订单，支持筛选）
    - GET /api/admin/orders/:orderNo（获取订单详情）
    - PUT /api/admin/orders/:orderNo（手动处理异常订单）
    - GET /api/admin/orders/stats（获取统计数据）
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7_
  
  - [x] 15.2 创建订单管理页面
    - 创建 OrderManagementPage.tsx
    - 显示订单列表和筛选
    - 显示统计数据（今日收入、本月收入）
    - 支持查看详情和手动处理
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 15.3 编写订单管理测试
    - 测试订单查询和筛选
    - 测试统计数据准确性
    - _Requirements: 7.1, 7.2, 7.5_

- [x] 16. 安全加固与审计
  - [x] 16.1 实现操作审计日志
    - 所有配置变更记录到 product_config_history
    - 所有敏感操作记录到 admin_logs
    - 记录操作人、时间、IP、变更内容
    - _Requirements: 1.6, 2.5_
  
  - [x] 16.2 实现异常检测
    - 检测短时间内多次失败的支付尝试
    - 检测异常的配额使用模式
    - 触发安全告警
    - _Requirements: 2.7_
  
  - [x] 16.3 密钥安全检查
    - 启动时验证支付配置完整性
    - 日志中脱敏处理密钥信息
    - API 响应中不暴露密钥
    - _Requirements: 4.3, 4.4, 4.5, 4.6_
  
  - [x] 16.4 编写安全测试
    - 测试权限验证
    - 测试审计日志
    - 测试密钥不泄露
    - _Requirements: 2.1, 2.5, 4.3, 4.4_

- [x] 17. 属性测试实现
  - [x] 17.1 编写订单号唯一性属性测试
    - **Property 10: 订单号唯一性**
    - **Validates: Requirements 3.1**
  
  - [x] 17.2 编写配额检查属性测试
    - **Property 19: 配额检查先于功能执行**
    - **Validates: Requirements 6.1, 6.3, 6.5, 6.7**
  
  - [x] 17.3 编写配额耗尽拒绝属性测试
    - **Property 20: 配额耗尽拒绝请求**
    - **Validates: Requirements 6.2, 6.4, 6.6, 6.8**
  
  - [x] 17.4 编写使用量记录属性测试
    - **Property 22: 使用量记录增量**
    - **Validates: Requirements 6.10**
  
  - [x] 17.5 编写配置变更历史属性测试
    - **Property 23: 配置变更创建历史记录**
    - **Validates: Requirements 8.1**
  
  - [x] 17.6 编写配置回滚属性测试
    - **Property 25: 配置回滚恢复旧值**
    - **Validates: Requirements 8.3, 8.5**

- [x] 18. Final Checkpoint - 完整系统测试
  - 运行所有单元测试
  - 运行所有属性测试
  - 运行集成测试
  - 验证完整购买流程（创建订单 → 支付 → 开通订阅 → 使用功能 → 配额限制）
  - 验证管理员配置流程（修改配置 → 记录日志 → 通知 → 回滚）
  - 验证用户个人中心所有功能
  - 检查测试覆盖率（目标 80%）
  - 如有问题，请向用户反馈

## Notes

- 所有测试任务都是必需的，确保全面的测试覆盖
- 每个任务都引用了具体的需求编号，便于追溯
- Checkpoint 任务确保增量验证，及时发现问题
- 属性测试使用 fast-check 框架，每个测试最少 100 次迭代
- 关键路径（支付、订阅、配额）必须有完整的测试覆盖

