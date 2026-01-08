# Requirements Document

## Introduction

本文档定义了 GEO 优化系统的代理商折扣功能需求。该功能扩展现有的代理商分佣系统，允许管理员为每个套餐设置代理商专属折扣比例。当被代理商邀请码邀请注册的新用户首次购买套餐时，系统将自动应用该折扣，生成优惠后的支付价格。

## Glossary

- **Agent_Discount**: 代理商折扣，管理员为套餐设置的折扣比例，仅适用于被代理商邀请的新用户首次购买
- **Discount_Rate**: 折扣比例，以百分比表示（如 80 表示 8 折，即原价的 80%）
- **First_Purchase**: 首次购买，用户在系统中的第一笔成功支付订单
- **Invited_User**: 被邀请用户，通过代理商邀请码注册的用户
- **Original_Price**: 原价，套餐的标准价格
- **Discounted_Price**: 折扣价，应用代理商折扣后的实际支付价格
- **Plan_Management**: 套餐管理，管理员对套餐配置进行增删改查的功能模块
- **Landing_Page**: 落地页，运行在 8080 端口的营销页面，展示套餐信息和支付入口

## Requirements

### Requirement 1: 套餐代理商折扣配置

**User Story:** As a 管理员, I want to 为每个套餐设置代理商折扣比例, so that 被代理商邀请的新用户首次购买时可以享受优惠。

#### Acceptance Criteria

1. WHEN 管理员编辑套餐时 THEN THE Plan_Management SHALL 显示"代理商折扣"配置项
2. THE Plan_Management SHALL 允许管理员输入 1-100 之间的整数作为折扣比例
3. THE Plan_Management SHALL 将折扣比例解释为原价的百分比（如 80 表示支付原价的 80%，即 8 折）
4. IF 管理员未设置折扣比例 THEN THE Plan_Management SHALL 默认为 100（无折扣）
5. WHEN 管理员保存套餐配置 THEN THE Plan_Management SHALL 将折扣比例持久化到数据库
6. THE Plan_Management SHALL 在套餐列表中显示当前的代理商折扣比例

### Requirement 2: 折扣资格判断

**User Story:** As a 系统, I want to 判断用户是否有资格享受代理商折扣, so that 只有符合条件的用户才能获得优惠。

#### Acceptance Criteria

1. WHEN 用户发起购买请求 THEN THE Discount_System SHALL 检查用户是否通过代理商邀请码注册
2. WHEN 用户发起购买请求 THEN THE Discount_System SHALL 检查用户是否为首次购买
3. IF 用户通过代理商邀请码注册且为首次购买 THEN THE Discount_System SHALL 标记用户有资格享受折扣
4. IF 用户不是通过代理商邀请码注册 THEN THE Discount_System SHALL 标记用户无折扣资格
5. IF 用户已有成功支付的订单记录 THEN THE Discount_System SHALL 标记用户无折扣资格
6. THE Discount_System SHALL 实时查询套餐当前设置的折扣比例，而非使用固定值

### Requirement 3: 折扣价格计算

**User Story:** As a 系统, I want to 正确计算折扣后的价格, so that 用户支付正确的金额。

#### Acceptance Criteria

1. THE Discount_Calculator SHALL 使用公式：折扣价 = 原价 × (折扣比例 / 100)
2. THE Discount_Calculator SHALL 将计算结果四舍五入到分（两位小数）
3. IF 折扣比例为 100 THEN THE Discount_Calculator SHALL 返回原价
4. THE Discount_Calculator SHALL 确保折扣价不小于 0.01 元
5. WHEN 创建支付订单 THEN THE Payment_System SHALL 使用折扣价作为实际支付金额
6. THE Payment_System SHALL 在订单记录中保存原价、折扣比例和折扣价

### Requirement 4: 落地页折扣展示

**User Story:** As a 被邀请用户, I want to 在落地页看到我的专属折扣价格, so that 我知道自己能享受的优惠。

#### Acceptance Criteria

1. WHEN 被邀请用户访问落地页 THEN THE Landing_Page SHALL 检查用户的折扣资格
2. IF 用户有折扣资格 THEN THE Landing_Page SHALL 在套餐卡片上显示原价（划线）和折扣价
3. IF 用户有折扣资格 THEN THE Landing_Page SHALL 显示"专属优惠"标签
4. IF 用户无折扣资格 THEN THE Landing_Page SHALL 只显示原价
5. THE Landing_Page SHALL 实时从后端获取用户的折扣资格和折扣价格
6. WHEN 用户点击购买按钮 THEN THE Landing_Page SHALL 使用折扣价生成支付二维码

### Requirement 5: 支付流程折扣应用

**User Story:** As a 被邀请用户, I want to 在支付时自动应用折扣, so that 我无需手动输入优惠码。

#### Acceptance Criteria

1. WHEN 创建支付订单 THEN THE Payment_System SHALL 自动检查用户折扣资格
2. IF 用户有折扣资格 THEN THE Payment_System SHALL 自动应用当前套餐的折扣比例
3. THE Payment_System SHALL 在微信支付请求中使用折扣后的金额
4. THE Payment_System SHALL 在订单描述中注明"代理商专属优惠"
5. WHEN 支付成功 THEN THE Payment_System SHALL 记录该用户已使用首次购买折扣
6. IF 用户已使用过首次购买折扣 THEN THE Payment_System SHALL 在后续订单中不再应用折扣

### Requirement 6: 折扣使用记录

**User Story:** As a 管理员, I want to 查看折扣使用情况, so that 我可以评估代理商折扣的效果。

#### Acceptance Criteria

1. THE Order_System SHALL 在订单记录中保存是否使用了代理商折扣
2. THE Order_System SHALL 在订单记录中保存折扣前原价和折扣后实付金额
3. THE Admin_Panel SHALL 在订单详情中显示折扣信息
4. THE Admin_Panel SHALL 支持按"是否使用代理商折扣"筛选订单
5. THE Admin_Panel SHALL 统计代理商折扣带来的订单数量和优惠总金额

### Requirement 7: 数据存储

**User Story:** As a 系统架构师, I want to 设计合理的数据结构, so that 系统可以高效存储和查询折扣相关数据。

#### Acceptance Criteria

1. THE Database SHALL 在 subscription_plans 表添加 agent_discount_rate 字段（INTEGER，默认 100）
2. THE Database SHALL 在 orders 表添加 original_price 字段（DECIMAL，原价）
3. THE Database SHALL 在 orders 表添加 discount_rate 字段（INTEGER，使用的折扣比例）
4. THE Database SHALL 在 orders 表添加 is_agent_discount 字段（BOOLEAN，是否使用代理商折扣）
5. THE Database SHALL 在 users 表添加 first_purchase_discount_used 字段（BOOLEAN，是否已使用首次购买折扣）
6. THE Database SHALL 为 agent_discount_rate 字段添加 CHECK 约束（1-100）

### Requirement 8: 边界情况处理

**User Story:** As a 系统, I want to 正确处理各种边界情况, so that 系统稳定可靠。

#### Acceptance Criteria

1. IF 套餐的代理商折扣比例为 NULL THEN THE Discount_System SHALL 视为 100（无折扣）
2. IF 用户的邀请代理商已被暂停 THEN THE Discount_System SHALL 仍然允许用户享受折扣
3. IF 管理员在用户下单过程中修改折扣比例 THEN THE Payment_System SHALL 使用下单时查询到的折扣比例
4. IF 订单支付失败 THEN THE Discount_System SHALL 不标记用户已使用首次购买折扣
5. IF 订单退款 THEN THE Discount_System SHALL 不恢复用户的首次购买折扣资格
6. WHEN 计算折扣价时 THEN THE Discount_Calculator SHALL 处理浮点数精度问题

