# Requirements Document

## Introduction

修复抖音平台登录后无法获取账号信息的问题。参照头条号的成功实现，更新抖音平台的用户名提取选择器配置。

## Glossary

- **System**: 账号服务系统（AccountService）
- **Platform**: 发布平台（如抖音、头条号）
- **Username_Selector**: 用于提取用户名的CSS选择器
- **Real_Username**: 平台真实用户名（从页面提取的用户显示名称）

## Requirements

### Requirement 1: 修复抖音用户名提取

**User Story:** 作为系统管理员，我想要在抖音平台登录后正确获取账号信息，以便用户可以看到真实的用户名。

#### Acceptance Criteria

1. WHEN 用户通过浏览器登录抖音平台 THEN THE System SHALL 使用有效的CSS选择器提取用户名
2. WHEN 主选择器失效 THEN THE System SHALL 自动尝试备用选择器
3. WHEN 所有选择器都失败 THEN THE System SHALL 保存页面HTML用于调试并记录详细日志
4. THE System SHALL 优先使用与头条号相同的通用选择器（`.semi-navigation-header-username`）
5. WHEN 提取到用户名 THEN THE System SHALL 将其保存到数据库的 `real_username` 字段

### Requirement 2: 选择器优先级优化

**User Story:** 作为开发者，我想要优化选择器的尝试顺序，以便更快地找到有效的选择器。

#### Acceptance Criteria

1. THE System SHALL 将通用选择器（`.semi-navigation-header-username`）放在选择器列表的前面
2. THE System SHALL 保留特定平台的选择器作为备用
3. WHEN 选择器配置更新 THEN THE System SHALL 不影响其他平台的用户名提取功能

### Requirement 3: 调试信息增强

**User Story:** 作为开发者，我想要获得详细的调试信息，以便快速定位选择器失效的原因。

#### Acceptance Criteria

1. WHEN 尝试每个选择器 THEN THE System SHALL 记录选择器名称和尝试结果
2. WHEN 所有选择器失败 THEN THE System SHALL 保存完整的页面HTML到debug目录
3. THE System SHALL 在日志中输出当前页面URL和标题
4. THE System SHALL 提供清晰的错误提示和修复建议
