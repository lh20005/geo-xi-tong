# Requirements Document

## Introduction

本需求旨在优化GEO优化系统中蒸馏功能的用户体验和信息架构。当前"蒸馏历史"功能位于"蒸馏结果"模块中，但从用户工作流程来看，历史记录的查看和管理更适合放在"关键词蒸馏"模块中。本次重构将把"蒸馏历史"功能从"蒸馏结果"页面迁移到"关键词蒸馏"页面，同时保持"蒸馏结果项目"（当前选中的蒸馏结果详情）继续留在"蒸馏结果"页面。

## Glossary

- **蒸馏历史 (Distillation History)**: 系统中所有历史蒸馏记录的列表，包括关键词、话题数量、AI模型、创建时间等信息，以及查看、编辑、删除等操作功能
- **蒸馏结果项目 (Distillation Result Item)**: 当前选中的单条蒸馏记录的详细信息，包括关键词和生成的所有问题列表
- **关键词蒸馏模块 (Keyword Distillation Module)**: 位于 `/distillation` 路由的页面，用户在此输入关键词并执行蒸馏操作
- **蒸馏结果模块 (Distillation Results Module)**: 位于 `/distillation-results` 路由的页面，用于展示蒸馏结果和管理历史记录
- **DistillationPage**: 关键词蒸馏页面的React组件
- **DistillationResultsPage**: 蒸馏结果页面的React组件
- **LocalStorage**: 浏览器本地存储，用于保存当前选中的蒸馏结果数据

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望在"关键词蒸馏"页面中查看和管理所有历史蒸馏记录，以便在执行新蒸馏操作的同时快速访问历史数据。

#### Acceptance Criteria

1. WHEN a user navigates to the Keyword Distillation Module THEN the system SHALL display the Distillation History table below the keyword input section
2. WHEN the Distillation History table is displayed THEN the system SHALL show all columns including keyword, topic count, AI model, creation time, and action buttons
3. WHEN a user clicks the view details button in the Distillation History THEN the system SHALL load the selected record and navigate to the Distillation Results Module
4. WHEN a user clicks the edit button in the Distillation History THEN the system SHALL open a modal to edit the keyword and update the record upon confirmation
5. WHEN a user clicks the delete button in the Distillation History THEN the system SHALL show a confirmation modal and delete the record upon confirmation

### Requirement 2

**User Story:** 作为用户，我希望"蒸馏结果"页面只显示当前选中的蒸馏结果详情，以便专注于查看和处理单个蒸馏结果。

#### Acceptance Criteria

1. WHEN a user navigates to the Distillation Results Module without a selected record THEN the system SHALL display an empty state with a message prompting the user to select a record from the Keyword Distillation Module
2. WHEN a user navigates to the Distillation Results Module with a selected record THEN the system SHALL display only the Distillation Result Item card without the Distillation History table
3. WHEN the Distillation Result Item is displayed THEN the system SHALL show the keyword, all generated questions, and action buttons for viewing topics and generating articles
4. WHEN a user clicks the edit keyword button in the Distillation Result Item THEN the system SHALL open a modal to edit the keyword and update both the display and LocalStorage upon confirmation
5. WHEN a user clicks the delete button in the Distillation Result Item THEN the system SHALL show a confirmation modal, delete the record, clear LocalStorage, and display the empty state upon confirmation

### Requirement 3

**User Story:** 作为用户，我希望在"关键词蒸馏"页面执行蒸馏操作后，系统能够自动导航到"蒸馏结果"页面并显示新生成的结果，以便立即查看蒸馏成果。

#### Acceptance Criteria

1. WHEN a user successfully completes a distillation operation in the Keyword Distillation Module THEN the system SHALL save the result to LocalStorage
2. WHEN the distillation result is saved to LocalStorage THEN the system SHALL automatically navigate to the Distillation Results Module
3. WHEN the system navigates to the Distillation Results Module after distillation THEN the system SHALL display the newly generated Distillation Result Item
4. WHEN the distillation operation fails THEN the system SHALL display an error message and remain on the Keyword Distillation Module

### Requirement 4

**User Story:** 作为用户，我希望在"关键词蒸馏"页面中管理历史记录时，能够批量删除所有记录，以便快速清理不需要的数据。

#### Acceptance Criteria

1. WHEN the Distillation History table contains one or more records THEN the system SHALL display a delete all button in the table header
2. WHEN a user clicks the delete all button THEN the system SHALL show a confirmation modal with a warning message
3. WHEN a user confirms the delete all operation THEN the system SHALL delete all distillation records from the database
4. WHEN all records are deleted THEN the system SHALL clear LocalStorage if the deleted records include the currently selected record
5. WHEN the delete all operation completes THEN the system SHALL display a success message showing the count of deleted records

### Requirement 5

**User Story:** 作为用户，我希望系统在页面加载时能够正确恢复之前选中的蒸馏结果，以便在刷新页面或重新访问时继续查看之前的工作。

#### Acceptance Criteria

1. WHEN the Distillation Results Module loads THEN the system SHALL attempt to load the selected record from LocalStorage
2. WHEN a valid record is found in LocalStorage THEN the system SHALL display the Distillation Result Item with the saved data
3. WHEN no record is found in LocalStorage THEN the system SHALL display the empty state
4. WHEN the Keyword Distillation Module loads THEN the system SHALL load and display the Distillation History table
5. WHEN a record in the Distillation History matches the currently selected record in LocalStorage THEN the system SHALL highlight that row in the table

### Requirement 6

**User Story:** 作为开发者，我希望代码重构过程中保持所有现有功能和数据完整性，以确保用户体验不受影响。

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the system SHALL preserve all existing API endpoints without modification
2. WHEN the refactoring is complete THEN the system SHALL preserve all database operations without modification
3. WHEN the refactoring is complete THEN the system SHALL preserve all LocalStorage operations without modification
4. WHEN the refactoring is complete THEN the system SHALL preserve all existing functionality including view, edit, delete, and delete all operations
5. WHEN the refactoring is complete THEN the system SHALL maintain the same user interaction patterns for all operations
