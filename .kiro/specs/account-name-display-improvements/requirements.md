# Requirements Document

## Introduction

本规范定义了账号名称显示的改进需求，主要涉及三个页面的账号名称列的调整，统一使用真实用户名显示。

## Glossary

- **System**: 自媒体内容发布管理系统
- **Real_Username**: 从平台页面提取的真实用户名（如"细品茶香韵"）
- **Account_Name**: 用户输入的备注名称
- **Platform_Management_Page**: 平台登录页面
- **Publishing_Tasks_Page**: 发布任务页面
- **Publishing_Records_Page**: 发布记录页面

## Requirements

### Requirement 1: 移除平台管理页面的备注名称列

**User Story:** 作为用户，我希望在平台管理页面的账号管理列表中只看到真实用户名，不需要备注名称列，这样界面更简洁清晰。

#### Acceptance Criteria

1. WHEN 用户查看平台管理页面的账号管理列表 THEN THE System SHALL 只显示"真实用户名"列，不显示"备注名称"列
2. THE System SHALL 保持"真实用户名"列的蓝色粗体样式
3. THE System SHALL 保持其他列（操作、状态等）不变

### Requirement 2: 更新发布任务页面的账号列

**User Story:** 作为用户，我希望在发布任务列表中看到"账号名称"列显示真实用户名，这样我能清楚知道任务使用的是哪个平台账号。

#### Acceptance Criteria

1. WHEN 用户查看发布任务列表 THEN THE System SHALL 将"账号"列改名为"账号名称"
2. THE System SHALL 在"账号名称"列中显示对应账号的真实用户名（real_username）
3. WHEN 真实用户名不存在 THEN THE System SHALL 显示账号的备注名称（account_name）作为后备
4. THE System SHALL 确保列宽度适合显示中文用户名

### Requirement 3: 添加发布记录页面的账号名称列

**User Story:** 作为用户，我希望在发布记录列表中看到"账号名称"列显示真实用户名，这样我能追溯每条记录是用哪个账号发布的。

#### Acceptance Criteria

1. WHEN 用户查看发布记录列表 THEN THE System SHALL 将现有的"账号"列改名为"账号名称"
2. THE System SHALL 在"账号名称"列中显示对应账号的真实用户名（real_username）
3. WHEN 真实用户名不存在 THEN THE System SHALL 显示账号的备注名称（account_name）作为后备
4. WHEN 账号信息不存在 THEN THE System SHALL 显示"-"
5. THE System SHALL 确保列宽度适合显示中文用户名

### Requirement 4: 后端API支持真实用户名

**User Story:** 作为系统，我需要在API响应中包含真实用户名，以便前端能够正确显示。

#### Acceptance Criteria

1. WHEN 获取发布任务列表 THEN THE System SHALL 在响应中包含每个任务关联账号的real_username字段
2. WHEN 获取发布记录列表 THEN THE System SHALL 在响应中包含每条记录关联账号的real_username字段
3. THE System SHALL 通过JOIN查询从platform_accounts表获取real_username
4. WHEN 账号不存在或已删除 THEN THE System SHALL 返回null或空字符串

### Requirement 5: 数据库查询优化

**User Story:** 作为系统，我需要高效地查询账号的真实用户名，避免性能问题。

#### Acceptance Criteria

1. THE System SHALL 使用LEFT JOIN关联platform_accounts表获取账号信息
2. THE System SHALL 在单次查询中获取所有需要的账号信息
3. THE System SHALL 避免N+1查询问题
4. THE System SHALL 确保查询性能不受账号数量影响
