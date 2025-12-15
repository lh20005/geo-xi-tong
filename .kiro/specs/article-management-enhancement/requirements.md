# Requirements Document

## Introduction

本需求文档描述了文章管理模块的增强功能，包括统计数据展示、筛选搜索功能和批量操作功能。该增强将参考蒸馏结果模块的最佳实践，为文章管理提供更强大和便捷的管理能力。

## Glossary

- **文章管理模块 (Article Management Module)**: 用于展示、管理和操作所有文章的功能模块
- **文章 (Article)**: 由AI生成的内容，包含标题、内容、关键词、发布状态等信息
- **统计数据 (Statistics)**: 文章的数量统计信息，包括总数、已发布数、未发布数、按关键词分组的数量等
- **筛选功能 (Filter Function)**: 根据话题、发布状态等条件过滤文章列表的功能
- **批量操作 (Batch Operation)**: 通过复选框选择多条记录进行批量删除的功能
- **系统 (System)**: GEO优化系统的前端和后端应用

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望看到文章的统计数据，以便快速了解文章的整体情况

#### Acceptance Criteria

1. WHEN 用户访问文章管理页面 THEN 系统 SHALL 在页面顶部显示统计卡片，包含总文章数、已发布数和未发布数
2. WHEN 统计数据更新（新增、删除、发布状态变更）THEN 系统 SHALL 自动刷新统计卡片的数值
3. WHEN 用户点击统计卡片 THEN 系统 SHALL 自动应用对应的筛选条件
4. WHEN 统计数据为零 THEN 系统 SHALL 显示数字0而不是空白或错误

### Requirement 2

**User Story:** 作为用户，我希望查看按关键词分组的文章数量统计，以便了解各关键词的文章分布情况

#### Acceptance Criteria

1. WHEN 用户访问文章管理页面 THEN 系统 SHALL 显示按关键词分组的文章数量列表
2. WHEN 关键词分组列表超过10条 THEN 系统 SHALL 提供分页或滚动功能
3. WHEN 用户点击某个关键词统计项 THEN 系统 SHALL 筛选显示该关键词的所有文章
4. WHEN 关键词对应的文章数量变化 THEN 系统 SHALL 更新该关键词的统计数值

### Requirement 3

**User Story:** 作为开发者，我需要统计数据的API接口，以便其他模块可以调用获取文章统计信息

#### Acceptance Criteria

1. WHEN 系统提供统计API THEN 系统 SHALL 创建GET /api/articles/stats端点返回总数、已发布数和未发布数
2. WHEN 系统提供关键词统计API THEN 系统 SHALL 创建GET /api/articles/stats/keywords端点返回按关键词分组的统计数据
3. WHEN API接收到请求 THEN 系统 SHALL 在500毫秒内返回统计数据
4. WHEN 数据库查询失败 THEN 系统 SHALL 返回500状态码和错误详情

### Requirement 4

**User Story:** 作为用户，我希望按发布状态筛选文章，以便快速查看已发布或未发布的文章

#### Acceptance Criteria

1. WHEN 用户访问文章管理页面 THEN 系统 SHALL 在表格上方显示发布状态筛选下拉框
2. WHEN 用户选择"已发布"筛选项 THEN 系统 SHALL 只显示is_published为true的文章
3. WHEN 用户选择"未发布"筛选项 THEN 系统 SHALL 只显示is_published为false的文章
4. WHEN 用户选择"全部"筛选项 THEN 系统 SHALL 显示所有文章
5. WHEN 筛选条件改变 THEN 系统 SHALL 重置分页到第一页

### Requirement 5

**User Story:** 作为用户，我希望按话题（蒸馏关键词）筛选文章，以便查看特定话题下的所有文章

#### Acceptance Criteria

1. WHEN 用户访问文章管理页面 THEN 系统 SHALL 在表格上方显示话题筛选下拉框
2. WHEN 话题下拉框打开 THEN 系统 SHALL 显示所有有文章关联的蒸馏关键词列表
3. WHEN 用户选择某个话题 THEN 系统 SHALL 只显示该distillation_id对应的文章
4. WHEN 用户清除话题筛选 THEN 系统 SHALL 显示所有文章
5. WHEN 筛选条件改变 THEN 系统 SHALL 重置分页到第一页

### Requirement 6

**User Story:** 作为用户，我希望通过关键词搜索文章，以便快速找到特定关键词的文章

#### Acceptance Criteria

1. WHEN 用户访问文章管理页面 THEN 系统 SHALL 在表格上方显示关键词搜索输入框
2. WHEN 用户输入关键词并按回车或点击搜索按钮 THEN 系统 SHALL 显示keyword字段包含该关键词的文章
3. WHEN 用户清空搜索框 THEN 系统 SHALL 显示所有文章
4. WHEN 搜索条件改变 THEN 系统 SHALL 重置分页到第一页
5. WHEN 搜索关键词包含特殊字符 THEN 系统 SHALL 正确转义并执行搜索

### Requirement 7

**User Story:** 作为用户，我希望在文章列表中使用复选框选择多条记录，以便进行批量操作

#### Acceptance Criteria

1. WHEN 用户访问文章管理页面 THEN 系统 SHALL 在表格每行前面显示复选框
2. WHEN 用户点击表头的复选框 THEN 系统 SHALL 选中或取消选中当前页的所有文章
3. WHEN 用户点击某行的复选框 THEN 系统 SHALL 切换该行的选中状态
4. WHEN 用户切换分页 THEN 系统 SHALL 保持已选中记录的状态
5. WHEN 用户应用筛选条件 THEN 系统 SHALL 清空所有选中状态

### Requirement 8

**User Story:** 作为用户，我希望批量删除选中的文章，以便快速清理不需要的内容

#### Acceptance Criteria

1. WHEN 用户选中一条或多条文章 THEN 系统 SHALL 在表格上方显示"删除选中"按钮
2. WHEN 用户未选中任何文章 THEN 系统 SHALL 禁用"删除选中"按钮
3. WHEN 用户点击"删除选中"按钮 THEN 系统 SHALL 显示确认对话框，列出将要删除的文章数量
4. WHEN 用户确认批量删除 THEN 系统 SHALL 删除所有选中的文章及其关联数据
5. WHEN 批量删除完成 THEN 系统 SHALL 刷新文章列表和统计数据

### Requirement 9

**User Story:** 作为用户，我希望一键删除所有文章，以便快速清空所有数据

#### Acceptance Criteria

1. WHEN 用户访问文章管理页面 THEN 系统 SHALL 在表格上方显示"删除所有"按钮
2. WHEN 文章列表为空 THEN 系统 SHALL 禁用"删除所有"按钮
3. WHEN 用户点击"删除所有"按钮 THEN 系统 SHALL 显示确认对话框，提示将删除所有文章
4. WHEN 用户确认删除所有 THEN 系统 SHALL 删除数据库中的所有文章记录
5. WHEN 删除所有完成 THEN 系统 SHALL 刷新页面显示空状态

### Requirement 10

**User Story:** 作为用户，我希望删除操作能够正确维护数据一致性，以便确保关联数据的完整性

#### Acceptance Criteria

1. WHEN 系统删除文章 THEN 系统 SHALL 同时更新对应蒸馏结果的usage_count计数
2. WHEN 系统批量删除文章 THEN 系统 SHALL 在单个事务中完成所有删除操作
3. WHEN 删除操作失败 THEN 系统 SHALL 回滚所有更改并保持数据一致性
4. WHEN 删除文章 THEN 系统 SHALL 通过数据库级联删除自动清理关联的distillation_usage记录
5. WHEN 批量删除包含不存在的文章ID THEN 系统 SHALL 跳过不存在的ID并继续删除其他文章

### Requirement 11

**User Story:** 作为用户，我希望筛选和搜索功能可以组合使用，以便更精确地定位目标文章

#### Acceptance Criteria

1. WHEN 用户同时应用多个筛选条件 THEN 系统 SHALL 使用AND逻辑组合所有条件
2. WHEN 用户同时使用发布状态筛选和话题筛选 THEN 系统 SHALL 显示同时满足两个条件的文章
3. WHEN 用户同时使用关键词搜索和筛选条件 THEN 系统 SHALL 显示同时满足搜索和筛选的文章
4. WHEN 用户清除某个筛选条件 THEN 系统 SHALL 保持其他筛选条件不变并刷新结果

### Requirement 12

**User Story:** 作为用户，我希望系统记住我的筛选条件，以便刷新页面后保持筛选状态

#### Acceptance Criteria

1. WHEN 用户应用筛选条件 THEN 系统 SHALL 将筛选状态保存到URL查询参数
2. WHEN 用户刷新页面 THEN 系统 SHALL 从URL查询参数恢复筛选条件
3. WHEN 用户分享带筛选参数的URL THEN 系统 SHALL 为其他用户应用相同的筛选条件
4. WHEN URL参数无效 THEN 系统 SHALL 使用默认筛选条件并显示所有文章
