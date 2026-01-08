# Implementation Plan: 代理商分佣模块

## Overview

本实现计划将代理商分佣模块分为 6 个主要阶段：数据库设计、后端服务、微信支付集成、前端界面、定时任务、管理后台。采用增量开发方式，每个阶段完成后进行测试验证。

**核心设计要点**：
- 代理商申请无需审核，自助申请即可激活
- 默认佣金比例：30%（微信支付最大分账比例）
- 微信授权方式：公众号网页授权（snsapi_base 静默授权）
- 分账接收方类型：PERSONAL_OPENID（个人微信零钱）

## Tasks

- [x] 1. 数据库设计与迁移
  - [x] 1.1 创建代理商相关数据库迁移文件
    - 创建 agents 表（代理商信息，status 默认为 'active'）
    - 创建 commission_records 表（佣金记录）
    - 创建 profit_sharing_records 表（分账记录）
    - 添加必要的索引
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [x] 1.2 修改 orders 表添加分账相关字段
    - 添加 agent_id 字段（关联代理商）
    - 添加 profit_sharing 字段（是否分账订单）
    - 添加 expected_commission 字段（预计佣金）
    - _Requirements: 3.3_

- [x] 2. 后端核心服务实现
  - [x] 2.1 创建 AgentService 代理商服务
    - 实现 applyAgent 申请成为代理商（自动激活，无需审核）
    - 实现 getAgentByUserId 获取代理商信息
    - 实现 updateAgentStatus 更新代理商状态（管理员：暂停/恢复）
    - 实现 getAgentStats 获取统计数据
    - 实现 updateCommissionRate 调整佣金比例（管理员）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2_
  - [x]* 2.2 编写 AgentService 属性测试
    - **Property 1: 代理商创建默认值正确性（30% 佣金，active 状态）**
    - **Property 2: 代理商状态转换合法性（active ↔ suspended）**
    - **Validates: Requirements 1.2, 1.4, 7.3**
  - [x] 2.3 创建 CommissionService 佣金服务
    - 实现 calculateCommission 佣金计算
    - 实现 createCommission 创建佣金记录
    - 实现 listCommissions 获取佣金列表
    - 实现 handleRefund 处理退款
    - _Requirements: 4.1, 3.4, 6.3, 6.4, 5.1, 5.2, 5.4_
  - [x]* 2.4 编写 CommissionService 属性测试
    - **Property 3: 佣金计算准确性**
    - **Property 7: 退款佣金处理正确性**
    - **Property 8: 部分退款佣金调整正确性**
    - **Validates: Requirements 4.1, 5.1, 5.2, 5.4**

- [x] 3. Checkpoint - 核心服务测试
  - 确保所有属性测试通过
  - 验证数据库迁移正确执行
  - 如有问题请询问用户

- [x] 4. 微信支付分账集成
  - [x] 4.1 创建 WechatAuthService 微信授权服务
    - 实现 generateAuthUrl 生成授权链接（snsapi_base 静默授权）
    - 实现 handleAuthCallback 处理授权回调获取 OpenID
    - 实现 generateAuthQRCode 生成授权二维码数据
    - 使用与微信支付相同的 AppID
    - _Requirements: 2.1, 2.2, 2.7_
  - [x] 4.2 创建 ProfitSharingService 分账服务
    - 实现 addReceiver 添加分账接收方（type: PERSONAL_OPENID）
    - 实现 deleteReceiver 删除分账接收方
    - 实现 requestProfitSharing 请求分账
    - 实现 queryProfitSharing 查询分账结果
    - 实现 unfreezeRemaining 解冻剩余资金
    - _Requirements: 2.3, 4.3, 4.6_
  - [x] 4.3 修改 PaymentService 支持分账订单
    - 在创建订单时检查是否有关联代理商
    - 设置 profit_sharing=true 参数
    - 保存代理商ID和预计佣金到订单
    - **不影响现有套餐支付功能**
    - _Requirements: 3.1, 3.2, 3.3_
  - [x]* 4.4 编写分账订单属性测试
    - **Property 4: 分账订单标记正确性**
    - **Property 5: 佣金记录创建完整性**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  - [x] 4.5 修改支付回调处理创建佣金记录
    - 在订单支付成功后检查是否为分账订单
    - 创建佣金记录，状态为 pending
    - 设置结算日期为 T+1
    - _Requirements: 3.4, 4.2_

- [x] 5. 代理商 API 路由
  - [x] 5.1 创建 agent.ts 路由文件
    - POST /api/agent/apply - 申请成为代理商（自动激活）
    - GET /api/agent/status - 获取代理商状态
    - GET /api/agent/stats - 获取统计数据
    - GET /api/agent/commissions - 获取佣金列表
    - _Requirements: 1.1, 1.3, 6.1, 6.2, 6.3_
  - [x] 5.2 创建微信授权绑定 API
    - GET /api/agent/bindWechat/qrcode - 获取授权二维码
    - GET /api/agent/bindWechat/callback - 授权回调处理
    - POST /api/agent/bindWechat/unbind - 解绑微信账户
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6_
  - [x] 5.3 实现微信授权绑定流程
    - 生成 snsapi_base 授权链接
    - 处理授权回调获取 OpenID
    - 调用 addReceiver 添加分账接收方
    - 更新代理商微信绑定信息
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 6. Checkpoint - API 测试
  - 使用 Postman 或 curl 测试所有 API
  - 验证微信授权流程（可使用测试账号）
  - 如有问题请询问用户

- [x] 7. 定时任务实现
  - [x] 7.1 实现 T+1 佣金结算定时任务
    - 在 SchedulerService 中添加结算任务
    - 每日凌晨执行，处理前一天的待结算佣金
    - 调用 ProfitSharingService 执行分账
    - 更新佣金记录状态
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  - [x]* 7.2 编写结算任务属性测试
    - **Property 6: T+1 结算时间正确性**
    - **Validates: Requirements 4.2**
  - [x] 7.3 实现分账结果查询和重试机制
    - 查询处理中的分账单状态
    - 对失败的分账单进行重试
    - 记录失败原因
    - _Requirements: 4.5_

- [x] 8. 前端代理商中心
  - [x] 8.1 创建代理商相关 API 客户端
    - 在 client/src/api/ 下创建 agent.ts
    - 封装所有代理商相关 API 调用
    - _Requirements: 1.1, 2.1, 6.1_
  - [x] 8.2 修改 UserCenterPage 添加代理商功能
    - 在邀请系统 Tab 下添加代理商区域
    - 未申请时显示"成为代理商"按钮
    - 已申请显示代理商状态和统计
    - _Requirements: 1.1, 1.3, 6.1_
  - [x] 8.3 创建代理商申请组件 AgentApplyCard
    - 显示代理商权益说明（30% 佣金）
    - 一键申请按钮（无需审核）
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 8.4 创建代理商仪表盘组件 AgentDashboard
    - 显示累计收益、已结算、待结算
    - 显示邀请用户数和付费用户数
    - 显示微信绑定状态
    - _Requirements: 6.1, 6.2_
  - [x] 8.5 创建微信绑定组件 WechatBindCard
    - 显示绑定状态和微信昵称
    - 绑定/更换绑定按钮
    - 扫码授权弹窗（显示二维码）
    - _Requirements: 2.1, 2.4, 2.6_
  - [x] 8.6 创建佣金明细组件 CommissionList
    - 佣金记录表格
    - 时间范围筛选
    - 状态筛选
    - _Requirements: 6.3, 6.4_

- [x] 9. Checkpoint - 前端功能测试
  - 测试代理商申请流程（一键激活）
  - 测试微信扫码绑定流程
  - 测试数据展示正确性
  - 如有问题请询问用户

- [x] 10. 管理后台代理商管理
  - [x] 10.1 创建管理员代理商 API 路由
    - GET /api/admin/agents - 获取代理商列表
    - GET /api/admin/agents/:id - 获取代理商详情
    - PUT /api/admin/agents/:id/status - 暂停/恢复代理商
    - PUT /api/admin/agents/:id/rate - 调整佣金比例
    - DELETE /api/admin/agents/:id - 删除代理商
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x]* 10.2 编写管理员操作属性测试
    - **Property 10: 管理员操作权限正确性**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
  - [x] 10.3 创建管理后台代理商页面
    - 代理商列表表格
    - 状态筛选和搜索
    - 暂停/恢复操作按钮
    - _Requirements: 7.1, 7.3_
  - [x] 10.4 创建代理商详情弹窗
    - 显示代理商基本信息
    - 显示邀请用户列表
    - 显示佣金明细
    - 调整佣金比例表单
    - _Requirements: 7.2, 7.5_

- [x] 11. 安全与风控
  - [x] 11.1 实现分账限额检查
    - 检查单日分账总额
    - 检查单笔分账不超过 30%
    - _Requirements: 9.2, 11 (Property 11)_
  - [x]* 11.2 编写安全属性测试
    - **Property 9: 代理商统计数据一致性**
    - **Property 11: 分账金额限制正确性**
    - **Validates: Requirements 6.1, 9.2**
  - [x] 11.3 实现审计日志
    - 记录所有分账操作
    - 记录管理员操作
    - _Requirements: 9.3_
  - [x] 11.4 实现异常检测
    - 检测异常分账行为
    - 自动暂停并通知管理员
    - _Requirements: 9.4_

- [x] 12. Final Checkpoint - 完整流程测试
  - 测试完整的代理商申请→绑定微信→邀请→下单→分账流程
  - 测试退款场景的佣金处理
  - 测试管理员所有操作
  - 确保所有属性测试通过
  - 如有问题请询问用户

## Notes

- Tasks marked with `*` are optional property-based tests
- 微信支付分账功能需要商户已开通分账权限（用户已确认开通）
- 分账接收方类型使用 PERSONAL_OPENID（个人微信零钱）
- **默认分账比例为 30%**（微信支付最大分账比例）
- **代理商申请无需审核**，用户自助申请即可激活
- **微信授权使用 snsapi_base 静默授权**，用户扫码即可完成绑定
- **使用与微信支付相同的 AppID** 进行授权
- T+1 结算：订单支付成功后次日凌晨执行分账
- 分账给个人的资金不支持回退（微信支付限制）
- **本模块不影响现有套餐支付功能**

## API 端点汇总

### 代理商 API（/api/agent）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/agent/apply | 申请成为代理商（自动激活） |
| GET | /api/agent/status | 获取代理商状态 |
| GET | /api/agent/stats | 获取统计数据 |
| GET | /api/agent/commissions | 获取佣金列表 |
| GET | /api/agent/bindWechat/qrcode | 获取微信授权二维码 |
| GET | /api/agent/bindWechat/callback | 微信授权回调 |
| POST | /api/agent/bindWechat/unbind | 解绑微信账户 |

### 管理员 API（/api/admin/agents）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/agents | 获取代理商列表 |
| GET | /api/admin/agents/:id | 获取代理商详情 |
| PUT | /api/admin/agents/:id/status | 暂停/恢复代理商 |
| PUT | /api/admin/agents/:id/rate | 调整佣金比例 |
| DELETE | /api/admin/agents/:id | 删除代理商 |

## 微信支付 API 调用

| API | 用途 |
|-----|------|
| POST /v3/profitsharing/receivers/add | 添加分账接收方（PERSONAL_OPENID） |
| POST /v3/profitsharing/receivers/delete | 删除分账接收方 |
| POST /v3/profitsharing/orders | 请求分账 |
| GET /v3/profitsharing/orders/{out_order_no} | 查询分账结果 |
| POST /v3/profitsharing/orders/unfreeze | 解冻剩余资金 |
