# Requirements Document

## Introduction

本需求文档定义了关键词蒸馏页面的持久化显示和管理功能改进。当前系统存在蒸馏结果在页面切换后丢失的问题，且缺少对蒸馏历史记录的管理功能。本需求旨在解决这些问题，提供完整的蒸馏结果持久化和管理能力。

## Glossary

- **蒸馏系统 (Distillation System)**: 处理关键词蒸馏请求、存储结果和管理历史记录的系统
- **蒸馏结果 (Distillation Result)**: 用户输入关键词后AI生成的相关问题列表
- **蒸馏历史 (Distillation History)**: 系统中所有历史蒸馏记录的集合
- **用户界面 (User Interface)**: 用户与蒸馏系统交互的前端页面
- **本地存储 (Local Storage)**: 浏览器提供的客户端数据持久化机制
- **蒸馏记录 (Distillation Record)**: 包含关键词、生成的问题、创建时间等信息的单条蒸馏数据

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望蒸馏结果在页面切换后仍然保持显示，这样我可以在不同页面间导航而不丢失当前的工作成果。

#### Acceptance Criteria

1. WHEN 用户完成一次关键词蒸馏 THEN 蒸馏系统 SHALL 将蒸馏结果存储到本地存储中
2. WHEN 用户离开蒸馏页面后再返回 THEN 蒸馏系统 SHALL 从本地存储中恢复并显示最近的蒸馏结果
3. WHEN 页面组件初始化时 THEN 蒸馏系统 SHALL 检查本地存储并自动加载已保存的蒸馏结果
4. WHEN 蒸馏结果被成功恢复 THEN 用户界面 SHALL 显示与原始蒸馏完成时相同的结果内容和格式
5. WHEN 用户执行新的蒸馏操作 THEN 蒸馏系统 SHALL 用新结果替换本地存储中的旧结果

### Requirement 2

**User Story:** 作为用户，我希望能够查看蒸馏历史记录的详细内容，这样我可以回顾之前生成的问题列表。

#### Acceptance Criteria

1. WHEN 用户点击蒸馏历史记录中的某一条 THEN 蒸馏系统 SHALL 在蒸馏结果区域显示该记录的完整问题列表
2. WHEN 历史记录被选中并显示 THEN 用户界面 SHALL 高亮显示当前选中的历史记录行
3. WHEN 蒸馏历史为空 THEN 用户界面 SHALL 显示友好的空状态提示信息

### Requirement 3

**User Story:** 作为用户，我希望能够删除单条蒸馏历史记录，这样我可以清理不需要的记录。

#### Acceptance Criteria

1. WHEN 用户在蒸馏结果区域点击删除按钮 THEN 蒸馏系统 SHALL 删除当前显示的蒸馏记录
2. WHEN 用户在蒸馏历史表格中点击删除按钮 THEN 蒸馏系统 SHALL 删除对应的历史记录
3. WHEN 删除操作执行前 THEN 用户界面 SHALL 显示确认对话框要求用户确认删除操作
4. WHEN 删除操作成功完成 THEN 蒸馏系统 SHALL 从数据库中移除该记录
5. WHEN 删除操作成功完成 THEN 用户界面 SHALL 刷新蒸馏历史列表并显示成功提示
6. WHEN 当前显示的蒸馏结果被删除 THEN 蒸馏系统 SHALL 清空蒸馏结果显示区域
7. WHEN 删除操作失败 THEN 用户界面 SHALL 显示错误提示信息

### Requirement 4

**User Story:** 作为用户，我希望能够编辑蒸馏记录的关键词，这样我可以修正输入错误或优化关键词描述。

#### Acceptance Criteria

1. WHEN 用户在蒸馏结果区域点击编辑按钮 THEN 用户界面 SHALL 显示包含当前关键词的编辑对话框
2. WHEN 用户在蒸馏历史表格中点击编辑按钮 THEN 用户界面 SHALL 显示包含该记录关键词的编辑对话框
3. WHEN 用户在编辑对话框中修改关键词并确认 THEN 蒸馏系统 SHALL 更新数据库中的关键词字段
4. WHEN 编辑操作成功完成 THEN 用户界面 SHALL 刷新显示并显示成功提示
5. WHEN 用户提交空白关键词 THEN 蒸馏系统 SHALL 拒绝更新并显示验证错误提示
6. WHEN 编辑操作失败 THEN 用户界面 SHALL 显示错误提示信息

### Requirement 5

**User Story:** 作为用户，我希望能够一次性删除所有蒸馏历史记录，这样我可以快速清理所有数据。

#### Acceptance Criteria

1. WHEN 用户点击全部删除按钮 THEN 用户界面 SHALL 显示确认对话框警告此操作不可恢复
2. WHEN 用户确认全部删除操作 THEN 蒸馏系统 SHALL 删除数据库中所有蒸馏记录
3. WHEN 全部删除操作成功完成 THEN 蒸馏系统 SHALL 清空蒸馏历史列表
4. WHEN 全部删除操作成功完成 THEN 蒸馏系统 SHALL 清空蒸馏结果显示区域
5. WHEN 全部删除操作成功完成 THEN 蒸馏系统 SHALL 清除本地存储中的蒸馏结果数据
6. WHEN 全部删除操作成功完成 THEN 用户界面 SHALL 显示成功提示信息
7. WHEN 全部删除操作失败 THEN 用户界面 SHALL 显示错误提示信息

### Requirement 6

**User Story:** 作为用户，我希望在蒸馏结果和历史记录区域看到清晰的操作按钮，这样我可以方便地管理我的蒸馏数据。

#### Acceptance Criteria

1. WHEN 蒸馏结果显示时 THEN 用户界面 SHALL 在结果卡片底部显示删除和编辑按钮
2. WHEN 蒸馏历史列表显示时 THEN 用户界面 SHALL 在列表上方显示全部删除按钮
3. WHEN 蒸馏历史表格中有记录时 THEN 用户界面 SHALL 在每行的操作列显示编辑和删除按钮
4. WHEN 按钮被点击时 THEN 用户界面 SHALL 提供视觉反馈表明操作正在进行
5. WHEN 没有蒸馏结果显示时 THEN 用户界面 SHALL 隐藏蒸馏结果区域的管理按钮

### Requirement 7

**User Story:** 作为系统，我需要提供后端API支持蒸馏记录的管理操作，这样前端可以执行删除和编辑功能。

#### Acceptance Criteria

1. WHEN 接收到删除单条记录的请求 THEN 蒸馏系统 SHALL 验证记录ID的有效性
2. WHEN 删除单条记录请求有效 THEN 蒸馏系统 SHALL 从数据库中删除该记录及其关联的话题数据
3. WHEN 接收到更新关键词的请求 THEN 蒸馏系统 SHALL 验证记录ID和新关键词的有效性
4. WHEN 更新关键词请求有效 THEN 蒸馏系统 SHALL 在数据库中更新对应记录的关键词字段
5. WHEN 接收到删除所有记录的请求 THEN 蒸馏系统 SHALL 删除数据库中所有蒸馏记录及其关联数据
6. WHEN API操作成功 THEN 蒸馏系统 SHALL 返回成功状态码和确认消息
7. WHEN API操作失败 THEN 蒸馏系统 SHALL 返回适当的错误状态码和错误描述
