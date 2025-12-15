# Requirements Document

## Introduction

修复蒸馏结果模块中批量删除功能的问题。当用户选中结果并点击"删除选中"按钮后，系统提示"无效的记录id"错误。需要诊断并修复ID传递和验证过程中的问题。

## Glossary

- **System**: 蒸馏结果管理系统
- **Topic**: 蒸馏生成的话题记录
- **Topic ID**: 话题记录的唯一标识符，应为正整数
- **Selected Row Keys**: 用户在表格中选中的行的键值数组
- **Batch Delete**: 批量删除操作，一次删除多个话题记录

## Requirements

### Requirement 1

**User Story:** 作为用户，我想要能够选中多个蒸馏结果并批量删除它们，以便清理不需要的话题记录。

#### Acceptance Criteria

1. WHEN 用户在蒸馏结果表格中选中一个或多个话题 THEN System SHALL 正确捕获所选话题的ID值
2. WHEN 用户点击"删除选中"按钮 THEN System SHALL 将所选话题的ID数组发送到服务端API
3. WHEN 服务端接收到删除请求 THEN System SHALL 验证所有ID都是有效的正整数
4. WHEN 所有ID验证通过 THEN System SHALL 从数据库中删除对应的话题记录
5. WHEN 删除操作成功 THEN System SHALL 返回成功响应并显示删除的记录数量

### Requirement 2

**User Story:** 作为开发者，我想要系统能够正确处理ID类型转换，以便避免类型不匹配导致的验证失败。

#### Acceptance Criteria

1. WHEN 前端表格组件生成行键 THEN System SHALL 确保行键类型与数据源ID字段类型一致
2. WHEN 前端发送删除请求 THEN System SHALL 将所有ID转换为数字类型
3. WHEN 服务端验证ID THEN System SHALL 正确识别数字类型的ID
4. IF ID为字符串类型 THEN System SHALL 尝试转换为数字类型后再验证
5. IF ID无法转换为有效数字 THEN System SHALL 返回明确的错误信息

### Requirement 3

**User Story:** 作为用户，我想要在删除操作失败时看到清晰的错误提示，以便了解问题所在并采取相应措施。

#### Acceptance Criteria

1. WHEN 删除操作因ID验证失败而失败 THEN System SHALL 显示具体的错误原因
2. WHEN 删除操作因数据库错误而失败 THEN System SHALL 显示用户友好的错误消息
3. WHEN 删除操作部分成功 THEN System SHALL 显示成功删除的记录数量和失败的原因
4. WHEN 用户未选中任何记录就点击删除 THEN System SHALL 显示提示信息要求先选择记录
5. WHEN 错误发生时 THEN System SHALL 在控制台记录详细的错误信息以便调试
