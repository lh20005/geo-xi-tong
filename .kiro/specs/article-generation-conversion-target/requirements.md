# Requirements Document

## Introduction

本文档定义了在文章生成任务配置对话框中添加转化目标选择功能的需求。该功能允许用户在创建文章生成任务时选择一个转化目标（企业客户信息），以便生成的文章能够针对特定的目标客户进行定制化内容生成。

## Glossary

- **TaskConfigModal**: 任务配置对话框组件，用于配置文章生成任务的各项参数
- **ConversionTarget**: 转化目标，包含企业客户的详细信息（公司名称、行业、规模等）
- **ArticleGenerationTask**: 文章生成任务，包含蒸馏历史、图库、知识库、文章设置和转化目标等配置
- **FormItem**: 表单项，Ant Design表单中的单个输入字段
- **Select**: 下拉选择组件，用于从列表中选择一个选项

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望在创建文章生成任务时能够选择一个转化目标，以便生成的文章能够针对特定的目标客户进行定制化。

#### Acceptance Criteria

1. WHEN TaskConfigModal打开时，THEN TaskConfigModal SHALL在"选择蒸馏历史"字段之后显示"选择转化目标"字段
2. WHEN TaskConfigModal加载时，THEN TaskConfigModal SHALL从API获取所有可用的ConversionTarget列表
3. WHEN用户点击"选择转化目标"下拉框时，THEN TaskConfigModal SHALL显示所有可用的ConversionTarget选项
4. WHEN ConversionTarget列表为空时，THEN TaskConfigModal SHALL在下拉框中显示"暂无转化目标"提示
5. WHEN用户选择一个ConversionTarget时，THEN TaskConfigModal SHALL将选中的ConversionTarget ID保存到表单状态中

### Requirement 2

**User Story:** 作为用户，我希望转化目标选择字段的交互体验与其他字段保持一致，以便我能够快速熟悉和使用该功能。

#### Acceptance Criteria

1. WHEN用户与"选择转化目标"字段交互时，THEN TaskConfigModal SHALL提供与其他Select字段相同的交互行为
2. WHEN用户未选择ConversionTarget就提交表单时，THEN TaskConfigModal SHALL显示"请选择转化目标"的验证错误信息
3. WHEN ConversionTarget选项显示时，THEN TaskConfigModal SHALL显示公司名称和行业信息
4. WHEN用户在下拉框中搜索时，THEN TaskConfigModal SHALL支持按公司名称进行模糊搜索
5. WHEN用户取消对话框时，THEN TaskConfigModal SHALL清除所有表单字段包括ConversionTarget选择

### Requirement 3

**User Story:** 作为用户，我希望选择的转化目标能够正确保存到文章生成任务中，以便后续生成文章时能够使用该信息。

#### Acceptance Criteria

1. WHEN用户提交任务配置时，THEN TaskConfigModal SHALL将选中的ConversionTarget ID包含在TaskConfig对象中
2. WHEN TaskConfig提交到父组件时，THEN TaskConfigModal SHALL确保conversionTargetId字段存在且为有效的数字类型
3. WHEN API调用失败时，THEN TaskConfigModal SHALL显示错误信息并保持对话框打开状态
4. WHEN任务创建成功后，THEN TaskConfigModal SHALL重置表单并关闭对话框

### Requirement 4

**User Story:** 作为开发者，我希望转化目标数据能够通过统一的API接口获取，以便保持代码的一致性和可维护性。

#### Acceptance Criteria

1. WHEN TaskConfigModal需要获取ConversionTarget列表时，THEN TaskConfigModal SHALL调用fetchConversionTargets API函数
2. WHEN API返回ConversionTarget数据时，THEN fetchConversionTargets SHALL返回包含id、company_name和industry字段的对象数组
3. WHEN API调用失败时，THEN fetchConversionTargets SHALL抛出包含错误信息的异常
4. WHEN多个数据源同时加载时，THEN TaskConfigModal SHALL使用Promise.all并行加载所有数据以提高性能

### Requirement 5

**User Story:** 作为用户，我希望在数据加载过程中能够看到加载状态，以便了解系统正在处理我的请求。

#### Acceptance Criteria

1. WHEN TaskConfigModal正在加载数据时，THEN TaskConfigModal SHALL显示加载指示器覆盖整个表单区域
2. WHEN数据加载完成时，THEN TaskConfigModal SHALL隐藏加载指示器并显示可交互的表单
3. WHEN数据加载失败时，THEN TaskConfigModal SHALL隐藏加载指示器并显示错误提示信息
