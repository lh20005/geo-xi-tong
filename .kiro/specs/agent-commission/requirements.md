# Requirements Document

## Introduction

本文档定义了 GEO 优化系统的代理商分佣模块需求。该模块基于现有的邀请系统，扩展为完整的代理商分佣体系，允许用户申请成为代理商，通过邀请码邀请新用户，并在被邀请用户下单后获得佣金分成。佣金通过微信支付分账功能直接分到代理商的个人微信零钱账户。

## Glossary

- **Agent**: 代理商，申请成为代理商的用户，可以通过邀请码邀请新用户并获得佣金
- **Commission**: 佣金，代理商从被邀请用户订单中获得的分成金额
- **Profit_Sharing**: 微信支付分账功能，用于将订单资金分给分账接收方
- **Receiver**: 分账接收方，在微信支付系统中注册的可接收分账资金的账户
- **OpenID**: 微信用户在特定公众号/小程序下的唯一标识
- **Settlement_Period**: 结算周期，T+1 表示订单支付成功后次日结算
- **Commission_Rate**: 佣金比例，代理商从订单金额中获得的百分比

## Requirements

### Requirement 1: 代理商申请

**User Story:** As a 普通用户, I want to 申请成为代理商, so that 我可以通过邀请新用户获得佣金收入。

#### Acceptance Criteria

1. WHEN 用户点击"成为代理商"按钮 THEN THE Agent_System SHALL 立即创建代理商记录并设置状态为已激活
2. THE Agent_System SHALL 为每个代理商设置默认佣金比例（30%）
3. IF 用户已经是代理商 THEN THE Agent_System SHALL 显示代理商中心而非申请按钮
4. THE Agent_System SHALL 无需管理员审核，用户自助申请即可成为代理商

### Requirement 2: 微信账户绑定

**User Story:** As a 代理商, I want to 绑定我的微信零钱账户, so that 我可以接收佣金分成。

#### Acceptance Criteria

1. WHEN 代理商点击"绑定微信账户" THEN THE Agent_System SHALL 生成微信公众号网页授权二维码
2. WHEN 代理商使用微信扫码 THEN THE Agent_System SHALL 通过 snsapi_base 静默授权获取用户的 OpenID
3. THE Agent_System SHALL 调用微信支付"添加分账接收方"API 将代理商注册为分账接收方（类型为 PERSONAL_OPENID）
4. WHEN 添加分账接收方成功 THEN THE Agent_System SHALL 更新代理商的微信绑定状态
5. IF 添加分账接收方失败 THEN THE Agent_System SHALL 显示错误信息并允许重试
6. THE Agent_System SHALL 支持代理商更换绑定的微信账户
7. THE Agent_System SHALL 使用与微信支付相同的 AppID 进行授权

### Requirement 3: 分账订单处理

**User Story:** As a 系统, I want to 在订单支付时标记分账, so that 订单资金可以被分账给代理商。

#### Acceptance Criteria

1. WHEN 被邀请用户创建订单 THEN THE Payment_System SHALL 检查该用户是否有关联的代理商
2. IF 用户有关联的代理商且代理商已激活 THEN THE Payment_System SHALL 在支付请求中设置 profit_sharing=true
3. THE Payment_System SHALL 在订单记录中保存代理商ID和预计佣金金额
4. WHEN 订单支付成功 THEN THE Commission_System SHALL 创建佣金记录，状态为待结算

### Requirement 4: 佣金计算与结算

**User Story:** As a 系统, I want to 自动计算和结算佣金, so that 代理商可以按时收到佣金。

#### Acceptance Criteria

1. THE Commission_System SHALL 按照公式计算佣金：佣金 = 订单金额 × 佣金比例
2. THE Commission_System SHALL 在订单支付成功后 T+1 日自动执行分账
3. WHEN 执行分账 THEN THE Commission_System SHALL 调用微信支付"请求分账"API
4. WHEN 分账成功 THEN THE Commission_System SHALL 更新佣金记录状态为已结算
5. IF 分账失败 THEN THE Commission_System SHALL 记录失败原因并支持重试
6. THE Commission_System SHALL 在分账完成后调用"解冻剩余资金"API

### Requirement 5: 订单退款处理

**User Story:** As a 系统, I want to 在订单退款时处理佣金, so that 佣金计算准确无误。

#### Acceptance Criteria

1. IF 订单在分账前发生退款 THEN THE Commission_System SHALL 取消对应的佣金记录
2. IF 订单在分账后发生退款 THEN THE Commission_System SHALL 标记佣金记录为需回退
3. THE Commission_System SHALL 不支持分账给个人的资金回退（微信支付限制）
4. WHEN 订单部分退款 THEN THE Commission_System SHALL 按比例调整佣金金额

### Requirement 6: 代理商数据统计

**User Story:** As a 代理商, I want to 查看我的收益统计, so that 我可以了解我的推广效果。

#### Acceptance Criteria

1. THE Agent_Dashboard SHALL 显示累计收益、已结算金额、待结算金额
2. THE Agent_Dashboard SHALL 显示邀请用户数量和付费用户数量
3. THE Agent_Dashboard SHALL 显示佣金明细列表，包含订单信息、金额、状态
4. THE Agent_Dashboard SHALL 支持按时间范围筛选佣金记录
5. THE Agent_Dashboard SHALL 实时更新统计数据

### Requirement 7: 管理员代理商管理

**User Story:** As a 管理员, I want to 管理代理商, so that 我可以查看代理商情况、调整佣金比例、处理异常。

#### Acceptance Criteria

1. THE Admin_Panel SHALL 显示所有代理商列表，包含状态、佣金比例、累计收益
2. THE Admin_Panel SHALL 支持调整单个代理商的佣金比例
3. THE Admin_Panel SHALL 支持暂停/恢复代理商资格
4. THE Admin_Panel SHALL 支持删除代理商（需处理关联数据）
5. THE Admin_Panel SHALL 显示代理商的邀请用户列表和佣金明细

### Requirement 8: 数据存储

**User Story:** As a 系统架构师, I want to 设计合理的数据结构, so that 系统可以高效存储和查询代理商数据。

#### Acceptance Criteria

1. THE Database SHALL 存储代理商记录：user_id, status, commission_rate, wechat_openid, wechat_name, total_earnings, created_at
2. THE Database SHALL 存储佣金记录：agent_id, order_id, invited_user_id, order_amount, commission_rate, commission_amount, status, settled_at
3. THE Database SHALL 存储分账记录：commission_id, transaction_id, out_order_no, wechat_order_id, status, fail_reason
4. THE Database SHALL 在 agents 表的 user_id 字段创建唯一索引
5. THE Database SHALL 在 commission_records 表的 order_id 字段创建索引
6. THE Database SHALL 在 commission_records 表的 agent_id 和 status 字段创建复合索引

### Requirement 9: 安全与风控

**User Story:** As a 系统管理员, I want to 确保分账系统安全, so that 资金安全得到保障。

#### Acceptance Criteria

1. THE Agent_System SHALL 验证代理商身份后才允许绑定微信账户
2. THE Commission_System SHALL 限制单日分账总额不超过配置上限
3. THE Commission_System SHALL 记录所有分账操作的审计日志
4. IF 检测到异常分账行为 THEN THE Commission_System SHALL 自动暂停并通知管理员
5. THE Agent_System SHALL 使用微信支付公钥加密敏感信息（如姓名）
