# Requirements Document

## Introduction

本文档定义了文章生成任务列表页面的UI改进需求。目标是优化任务列表的列显示，增加关键业务信息的可见性，同时移除冗余信息，提升用户体验和页面美观度。

## Glossary

- **ArticleGenerationPage**: 文章生成任务管理页面，显示所有文章生成任务的列表
- **GenerationTask**: 文章生成任务实体，包含任务配置、状态、进度等信息
- **ConversionTarget**: 转化目标实体，包含公司名称、行业、联系方式等营销转化信息
- **Distillation**: 蒸馏结果实体，包含关键词和AI提供商信息
- **TaskTable**: 任务列表表格组件，展示任务数据的表格视图

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望在任务列表中看到转化目标信息，以便快速了解每个任务的营销目标。

#### Acceptance Criteria

1. WHEN the TaskTable renders THEN the system SHALL display a "转化目标" column immediately after the "状态" column
2. WHEN a GenerationTask has a conversion_target_id THEN the system SHALL display the company_name from the associated ConversionTarget
3. WHEN a GenerationTask has no conversion_target_id THEN the system SHALL display "-" in the "转化目标" column
4. WHEN the TaskTable loads task data THEN the system SHALL fetch conversion target information through JOIN queries or separate API calls
5. WHEN the conversion target name exceeds the column width THEN the system SHALL apply ellipsis with tooltip for full text display

### Requirement 2

**User Story:** 作为用户，我希望在任务列表中看到关键词信息，以便快速识别每个任务的主题内容。

#### Acceptance Criteria

1. WHEN the TaskTable renders THEN the system SHALL display a "关键词" column after the "转化目标" column
2. WHEN a GenerationTask has a distillation_id THEN the system SHALL display the keyword from the associated Distillation
3. WHEN the TaskTable loads task data THEN the system SHALL fetch distillation keyword through JOIN queries or separate API calls
4. WHEN the keyword is displayed THEN the system SHALL render it as a blue Tag component for visual emphasis
5. WHEN the keyword exceeds reasonable length THEN the system SHALL apply ellipsis with tooltip for full text display

### Requirement 3

**User Story:** 作为用户，我希望在任务列表中看到蒸馏结果的AI提供商信息，以便了解使用的AI模型。

#### Acceptance Criteria

1. WHEN the TaskTable renders THEN the system SHALL display a "蒸馏结果" column after the "关键词" column
2. WHEN a GenerationTask has a distillation_id THEN the system SHALL display the provider from the associated Distillation
3. WHEN the provider is "deepseek" THEN the system SHALL display a purple Tag with text "DeepSeek"
4. WHEN the provider is "gemini" THEN the system SHALL display a green Tag with text "Gemini"
5. WHEN the provider is any other value THEN the system SHALL display a default colored Tag with the provider name

### Requirement 4

**User Story:** 作为用户，我希望移除不常用的列信息，以便页面更加简洁和聚焦于核心信息。

#### Acceptance Criteria

1. WHEN the TaskTable renders THEN the system SHALL NOT display the "更新时间" column
2. WHEN the TaskTable renders THEN the system SHALL NOT display the "错误信息" column
3. WHEN a task has error information THEN the system SHALL still provide access to error details through task detail view or tooltip
4. WHEN the columns are removed THEN the system SHALL maintain all existing functionality for viewing task details

### Requirement 5

**User Story:** 作为用户，我希望任务列表的列宽分配合理，以便充分利用页面宽度并达到美观效果。

#### Acceptance Criteria

1. WHEN the TaskTable renders THEN the system SHALL distribute column widths to utilize available page width effectively
2. WHEN the TaskTable renders THEN the system SHALL allocate appropriate width for each column based on content type and importance
3. WHEN the page width changes THEN the system SHALL maintain responsive layout without horizontal scrolling for standard screen sizes
4. WHEN columns contain variable-length content THEN the system SHALL apply consistent spacing and alignment
5. WHEN the table renders THEN the system SHALL maintain visual balance and readability across all columns

### Requirement 6

**User Story:** 作为开发者，我希望确保新增列的数据与生成任务时的配置数据保持一致，以便用户看到准确的信息。

#### Acceptance Criteria

1. WHEN the system fetches task list data THEN the system SHALL include conversion_target_id, distillation_id in the query results
2. WHEN the system displays conversion target name THEN the system SHALL retrieve it from the conversion_targets table using the conversion_target_id
3. WHEN the system displays keyword and provider THEN the system SHALL retrieve them from the distillations table using the distillation_id
4. WHEN task data is updated THEN the system SHALL reflect changes in the displayed columns immediately upon refresh
5. WHEN foreign key relationships are broken THEN the system SHALL handle missing data gracefully by displaying fallback values

### Requirement 7

**User Story:** 作为用户，我希望新的列布局在不同屏幕尺寸下都能正常显示，以便在各种设备上使用。

#### Acceptance Criteria

1. WHEN the TaskTable renders on desktop screens THEN the system SHALL display all columns without horizontal scrolling
2. WHEN the TaskTable renders on smaller screens THEN the system SHALL enable horizontal scrolling while maintaining column structure
3. WHEN the user scrolls horizontally THEN the system SHALL keep the "操作" column fixed on the right
4. WHEN the table width exceeds viewport THEN the system SHALL provide clear visual indicators for scrollable content
5. WHEN columns are resized THEN the system SHALL maintain minimum readable width for each column
