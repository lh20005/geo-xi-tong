# Requirements Document

## Introduction

本需求文档描述了将"关键词蒸馏"模块中的"蒸馏结果"功能独立出来，创建一个新的侧边栏模块的需求。新模块将专注于展示、管理和操作历史蒸馏结果，而原"关键词蒸馏"模块将专注于执行新的蒸馏操作。

## Glossary

- **蒸馏结果模块 (Distillation Results Module)**: 独立的功能模块，用于展示和管理所有历史蒸馏记录及其生成的话题
- **关键词蒸馏模块 (Keyword Distillation Module)**: 原有模块，专注于执行新的关键词蒸馏操作
- **蒸馏记录 (Distillation Record)**: 包含关键词、生成的话题列表、AI提供商和创建时间的数据记录
- **话题 (Topic)**: 由AI根据关键词生成的用户可能提出的问题
- **系统 (System)**: GEO优化系统的前端和后端应用

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望在侧边栏看到独立的"蒸馏结果"菜单项，以便快速访问所有历史蒸馏记录

#### Acceptance Criteria

1. WHEN 用户查看侧边栏 THEN 系统 SHALL 在"关键词蒸馏"菜单项下方显示"蒸馏结果"菜单项
2. WHEN 用户点击"蒸馏结果"菜单项 THEN 系统 SHALL 导航到蒸馏结果页面
3. WHEN 用户在蒸馏结果页面 THEN 系统 SHALL 高亮显示"蒸馏结果"菜单项

### Requirement 2

**User Story:** 作为用户，我希望在蒸馏结果页面看到所有历史记录的列表，以便浏览和管理过往的蒸馏结果

#### Acceptance Criteria

1. WHEN 用户访问蒸馏结果页面 THEN 系统 SHALL 显示包含关键词、话题数量、AI模型和创建时间的历史记录表格
2. WHEN 历史记录超过10条 THEN 系统 SHALL 提供分页功能
3. WHEN 没有历史记录 THEN 系统 SHALL 显示空状态提示信息
4. WHEN 用户刷新页面 THEN 系统 SHALL 重新加载最新的历史记录列表

### Requirement 3

**User Story:** 作为用户，我希望查看某条蒸馏记录的详细话题列表，以便了解该关键词生成的所有问题

#### Acceptance Criteria

1. WHEN 用户点击历史记录的"查看详情"按钮 THEN 系统 SHALL 在页面上方显示该记录的完整话题列表
2. WHEN 显示话题列表 THEN 系统 SHALL 展示关键词、话题数量和所有生成的问题
3. WHEN 话题列表超过一定高度 THEN 系统 SHALL 提供滚动功能
4. WHEN 用户选择不同的历史记录 THEN 系统 SHALL 更新显示的话题列表内容

### Requirement 4

**User Story:** 作为用户，我希望从蒸馏结果页面直接跳转到话题详情或文章生成页面，以便继续后续工作流程

#### Acceptance Criteria

1. WHEN 用户在详情区域点击"查看话题"按钮 THEN 系统 SHALL 导航到该蒸馏记录的话题页面
2. WHEN 用户在详情区域点击"生成文章"按钮 THEN 系统 SHALL 导航到该蒸馏记录的文章生成页面
3. WHEN 没有选中任何记录 THEN 系统 SHALL 隐藏操作按钮

### Requirement 5

**User Story:** 作为用户，我希望编辑历史记录的关键词，以便修正或优化关键词描述

#### Acceptance Criteria

1. WHEN 用户点击"编辑"按钮 THEN 系统 SHALL 显示包含当前关键词的编辑对话框
2. WHEN 用户输入新关键词并确认 THEN 系统 SHALL 更新数据库中的关键词
3. WHEN 关键词为空或仅包含空格 THEN 系统 SHALL 拒绝更新并显示错误提示
4. WHEN 更新成功 THEN 系统 SHALL 刷新历史记录列表和详情显示

### Requirement 6

**User Story:** 作为用户，我希望删除单条或所有蒸馏记录，以便清理不需要的数据

#### Acceptance Criteria

1. WHEN 用户点击单条记录的"删除"按钮 THEN 系统 SHALL 显示确认对话框
2. WHEN 用户确认删除单条记录 THEN 系统 SHALL 从数据库删除该记录及其关联的话题
3. WHEN 用户点击"全部删除"按钮 THEN 系统 SHALL 显示确认对话框
4. WHEN 用户确认删除所有记录 THEN 系统 SHALL 从数据库删除所有蒸馏记录及其关联的话题
5. WHEN 删除当前显示的记录 THEN 系统 SHALL 清空详情显示区域

### Requirement 7

**User Story:** 作为用户，我希望系统保持原有的数据结构和API接口，以便确保数据一致性和兼容性

#### Acceptance Criteria

1. WHEN 系统迁移功能 THEN 系统 SHALL 使用现有的distillations和topics数据表
2. WHEN 系统调用API THEN 系统 SHALL 使用现有的/api/distillation路由
3. WHEN 系统处理数据 THEN 系统 SHALL 保持与原模块相同的数据格式和算法
4. WHEN 系统存储状态 THEN 系统 SHALL 使用LocalStorage保存当前选中的记录

### Requirement 8

**User Story:** 作为用户，我希望"关键词蒸馏"页面简化为只包含蒸馏操作，以便专注于创建新的蒸馏任务

#### Acceptance Criteria

1. WHEN 用户访问关键词蒸馏页面 THEN 系统 SHALL 只显示关键词输入和蒸馏按钮
2. WHEN 蒸馏完成 THEN 系统 SHALL 显示成功消息并提示用户前往蒸馏结果页面查看
3. WHEN 蒸馏完成 THEN 系统 SHALL 移除页面上的蒸馏结果展示区域
4. WHEN 蒸馏完成 THEN 系统 SHALL 移除页面上的历史记录表格
