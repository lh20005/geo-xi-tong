# Requirements Document

## Introduction

本文档定义了 GEO-SaaS 系统的商品管理与订阅系统需求。该系统允许管理员通过网页端可视化配置商品套餐，用户通过微信支付购买套餐后自动开通对应权限，系统根据套餐配额限制用户的功能使用。

## Glossary

- **System**: GEO-SaaS 商品管理与订阅系统
- **Admin**: 系统管理员，拥有商品配置权限
- **User**: 普通用户，可购买和使用套餐
- **Plan**: 订阅套餐，包含价格和功能配额
- **Feature_Quota**: 功能配额，如每日生成文章数、发布数等
- **Subscription**: 用户订阅记录，关联用户和套餐
- **Order**: 支付订单，记录用户购买行为
- **WeChat_Pay**: 微信支付服务
- **Usage_Record**: 用户功能使用量记录
- **Product_Config_Page**: 商品配置管理页面

## Requirements

### Requirement 1: 商品套餐管理

**User Story:** 作为管理员，我想要通过网页端可视化配置商品套餐，以便灵活调整产品定价和功能配额。

#### Acceptance Criteria

1. WHEN Admin 登录系统 THEN THE System SHALL 在管理员菜单中显示"商品管理"入口
2. WHEN Admin 访问商品管理页面 THEN THE System SHALL 显示所有套餐的卡片列表
3. WHEN Admin 查看套餐卡片 THEN THE System SHALL 显示套餐名称、价格、每日生成文章数、每日发布文章数、可管理平台账号数、关键词蒸馏数
4. WHEN Admin 点击编辑套餐 THEN THE System SHALL 打开编辑对话框并显示当前配置
5. WHEN Admin 修改套餐配置 THEN THE System SHALL 验证输入的有效性
6. WHEN Admin 保存套餐配置 THEN THE System SHALL 记录操作日志并通知其他管理员
7. WHERE 套餐价格变动超过20% THEN THE System SHALL 要求二次确认
8. WHEN Admin 保存配置成功 THEN THE System SHALL 清除相关缓存并立即生效

### Requirement 2: 权限验证与安全

**User Story:** 作为系统架构师，我想要确保只有管理员能访问商品配置功能，以保护系统安全。

#### Acceptance Criteria

1. WHEN 非管理员用户尝试访问商品管理页面 THEN THE System SHALL 返回403错误
2. WHEN 非管理员用户尝试调用商品管理API THEN THE System SHALL 拒绝请求并记录日志
3. WHEN Admin 执行敏感操作 THEN THE System SHALL 验证JWT令牌和管理员角色
4. WHEN Admin 修改价格 THEN THE System SHALL 应用频率限制（每小时最多5次）
5. WHEN Admin 执行任何配置变更 THEN THE System SHALL 记录操作人、时间、IP地址、变更内容
6. WHEN 配置变更完成 THEN THE System SHALL 发送通知给所有管理员
7. WHEN 检测到异常操作 THEN THE System SHALL 触发安全告警

### Requirement 3: 微信支付集成

**User Story:** 作为用户，我想要通过微信支付购买套餐，以便快速开通服务。

#### Acceptance Criteria

1. WHEN User 选择套餐并点击购买 THEN THE System SHALL 创建订单并生成唯一订单号
2. WHEN System 创建订单 THEN THE System SHALL 调用微信支付API创建预支付订单
3. WHEN 微信支付API返回成功 THEN THE System SHALL 返回支付参数给前端
4. WHEN User 在微信中完成支付 THEN THE WeChat_Pay SHALL 发送支付结果通知到系统回调地址
5. WHEN System 接收支付通知 THEN THE System SHALL 验证签名和订单有效性
6. WHEN 支付验证成功 THEN THE System SHALL 更新订单状态为已支付
7. WHEN 订单状态更新为已支付 THEN THE System SHALL 自动为用户开通对应套餐
8. WHEN 支付失败或超时 THEN THE System SHALL 更新订单状态为失败并通知用户

### Requirement 4: 微信支付密钥安全

**User Story:** 作为系统管理员，我想要确保微信支付密钥安全存储，以防止泄露和滥用。

#### Acceptance Criteria

1. THE System SHALL 将微信商户密钥存储在服务器环境变量中
2. THE System SHALL 将微信API证书文件存储在服务器安全目录中
3. THE System SHALL NOT 在前端代码中暴露任何支付密钥
4. THE System SHALL NOT 在日志中记录完整的支付密钥
5. WHEN System 启动时 THEN THE System SHALL 验证支付配置的完整性
6. WHEN 支付配置缺失 THEN THE System SHALL 记录错误并禁用支付功能
7. THE System SHALL 使用HTTPS加密所有支付相关通信

### Requirement 5: 用户订阅管理

**User Story:** 作为用户，我想要查看我的订阅状态和使用情况，以便了解套餐剩余额度。

#### Acceptance Criteria

1. WHEN User 访问个人中心 THEN THE System SHALL 显示当前订阅套餐信息
2. WHEN User 查看订阅详情 THEN THE System SHALL 显示套餐名称、到期时间、功能配额
3. WHEN User 查看使用情况 THEN THE System SHALL 显示每日生成文章数使用量和剩余量
4. WHEN User 查看使用情况 THEN THE System SHALL 显示每日发布文章数使用量和剩余量
5. WHEN User 查看使用情况 THEN THE System SHALL 显示已管理平台账号数和剩余量
6. WHEN User 查看使用情况 THEN THE System SHALL 显示关键词蒸馏数使用量和剩余量
7. WHEN 订阅即将到期（7天内） THEN THE System SHALL 发送续费提醒通知
8. WHEN 订阅到期 THEN THE System SHALL 自动降级为免费套餐

### Requirement 6: 功能配额限制

**User Story:** 作为系统，我需要根据用户订阅的套餐限制功能使用，以确保公平性和商业模式。

#### Acceptance Criteria

1. WHEN User 尝试生成文章 THEN THE System SHALL 检查每日生成文章数配额
2. WHEN User 每日生成文章数达到配额 THEN THE System SHALL 拒绝请求并提示升级套餐
3. WHEN User 尝试发布文章 THEN THE System SHALL 检查每日发布文章数配额
4. WHEN User 每日发布文章数达到配额 THEN THE System SHALL 拒绝请求并提示升级套餐
5. WHEN User 尝试添加平台账号 THEN THE System SHALL 检查可管理平台账号数配额
6. WHEN User 平台账号数达到配额 THEN THE System SHALL 拒绝请求并提示升级套餐
7. WHEN User 尝试关键词蒸馏 THEN THE System SHALL 检查关键词蒸馏数配额
8. WHEN User 关键词蒸馏数达到配额 THEN THE System SHALL 拒绝请求并提示升级套餐
9. WHEN 每日配额重置时间到达（每天00:00） THEN THE System SHALL 重置所有用户的每日配额使用量
10. WHEN User 成功使用功能 THEN THE System SHALL 记录使用量并更新统计

### Requirement 7: 订单管理

**User Story:** 作为管理员，我想要查看和管理所有订单，以便跟踪收入和处理异常。

#### Acceptance Criteria

1. WHEN Admin 访问订单管理页面 THEN THE System SHALL 显示所有订单列表
2. WHEN Admin 查看订单列表 THEN THE System SHALL 显示订单号、用户、套餐、金额、状态、创建时间
3. WHEN Admin 筛选订单 THEN THE System SHALL 支持按状态、日期范围、用户筛选
4. WHEN Admin 点击订单详情 THEN THE System SHALL 显示完整订单信息和支付记录
5. WHEN Admin 查看统计数据 THEN THE System SHALL 显示今日收入、本月收入、订单总数
6. WHEN 订单支付超时（30分钟） THEN THE System SHALL 自动关闭订单
7. WHEN 订单异常 THEN THE System SHALL 允许管理员手动处理

### Requirement 8: 配置历史与回滚

**User Story:** 作为管理员，我想要查看配置变更历史并支持回滚，以便应对误操作。

#### Acceptance Criteria

1. WHEN Admin 修改套餐配置 THEN THE System SHALL 保存配置历史记录
2. WHEN Admin 查看配置历史 THEN THE System SHALL 显示变更时间、操作人、字段名、旧值、新值
3. WHEN Admin 选择历史记录 THEN THE System SHALL 支持回滚到该版本
4. WHEN Admin 执行回滚操作 THEN THE System SHALL 要求二次确认
5. WHEN 回滚确认后 THEN THE System SHALL 恢复配置并记录回滚操作
6. WHEN 回滚完成 THEN THE System SHALL 通知所有管理员
7. THE System SHALL 保留最近50条配置历史记录

### Requirement 9: 套餐升级与降级

**User Story:** 作为用户，我想要升级或降级我的套餐，以便根据需求调整服务。

#### Acceptance Criteria

1. WHEN User 选择升级套餐 THEN THE System SHALL 计算差价并创建补差订单
2. WHEN User 支付补差订单 THEN THE System SHALL 立即升级套餐并延长到期时间
3. WHEN User 选择降级套餐 THEN THE System SHALL 提示降级将在当前订阅到期后生效
4. WHEN User 确认降级 THEN THE System SHALL 记录降级请求
5. WHEN 当前订阅到期 THEN THE System SHALL 自动应用降级套餐
6. WHEN 套餐变更完成 THEN THE System SHALL 发送通知给用户
7. WHEN User 升级到更高套餐 THEN THE System SHALL 保留当前周期的使用量统计

### Requirement 10: 数据库设计

**User Story:** 作为系统架构师，我需要设计合理的数据库结构，以支持商品管理和订阅功能。

#### Acceptance Criteria

1. THE System SHALL 创建subscription_plans表存储套餐基本信息
2. THE System SHALL 创建plan_features表存储套餐功能配额
3. THE System SHALL 创建user_subscriptions表存储用户订阅记录
4. THE System SHALL 创建orders表存储支付订单
5. THE System SHALL 创建user_usage表存储用户功能使用量
6. THE System SHALL 创建product_config_history表存储配置变更历史
7. THE System SHALL 在所有表中添加created_at和updated_at时间戳
8. THE System SHALL 为关键字段创建索引以优化查询性能
9. THE System SHALL 使用外键约束确保数据完整性
10. THE System SHALL 支持事务以确保订单和订阅的原子性操作

