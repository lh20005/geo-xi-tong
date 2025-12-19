# Requirements Document

## Introduction

本需求文档旨在解决文章生成时字数严重超出用户提示词要求的问题。

**问题现状：**
- 用户在提示词中要求"700-800字"
- 系统在AI服务层硬编码了token限制（max_tokens: 1000，约650-800字）
- **实际生成的文章却达到1800-2000字或更多**

这说明token限制根本没有生效，或者AI模型忽略了token限制。需要深入调查根本原因。

## Glossary

- **AI_Service**: AI服务模块，负责调用不同的AI提供商API
- **Token**: AI模型的基本处理单位，中文约1.5-2字符=1 token
- **Max_Tokens**: AI API的输出长度限制参数
- **Article_Generation_Service**: 文章生成服务，负责协调文章生成流程
- **Prompt_Template**: 用户自定义的文章生成提示词模板

## Requirements

### Requirement 1: 调查Token限制失效的根本原因

**User Story:** 作为系统开发者，我需要找出为什么设置了max_tokens=1000但生成的文章仍然达到1800-2000字的根本原因。

#### Acceptance Criteria

1. WHEN调查AI API响应时，THE System SHALL记录实际返回的token使用情况
2. WHEN调查AI API请求时，THE System SHALL验证max_tokens参数是否正确传递到API
3. WHEN调查AI模型行为时，THE System SHALL测试不同的max_tokens值是否能影响输出长度
4. WHEN调查提示词影响时，THE System SHALL测试提示词中的字数要求是否与max_tokens冲突
5. WHEN发现根本原因后，THE System SHALL记录详细的诊断报告

### Requirement 2: 实现有效的字数控制机制

**User Story:** 作为用户，我希望系统能够严格控制生成文章的字数，确保符合我在提示词中的要求。

#### Acceptance Criteria

1. WHEN用户提示词要求"700-800字"时，THE System SHALL生成字数在630-880字范围内的文章（±10%误差）
2. WHEN用户提示词要求"不少于X字"时，THE System SHALL生成字数不少于X字的文章
3. WHEN用户提示词要求"约X字"时，THE System SHALL生成字数在0.9X-1.1X范围内的文章
4. WHEN AI模型不遵守token限制时，THE System SHALL在提示词中添加更强的字数约束指令
5. WHEN生成的文章超出要求时，THE System SHALL记录警告并考虑截断或重新生成

### Requirement 3: 增强提示词字数约束

**User Story:** 作为用户，我希望AI模型能够严格遵守我在提示词中设置的字数要求。

#### Acceptance Criteria

1. WHEN构建AI提示词时，THE System SHALL在提示词开头和结尾都强调字数限制
2. WHEN用户要求"700-800字"时，THE System SHALL在提示词中明确说明"严格控制在700-800字，不得超过800字"
3. WHEN用户要求特定字数时，THE System SHALL在提示词中添加"超过字数限制的内容将被截断"的警告
4. WHEN提示词包含字数要求时，THE System SHALL移除任何可能导致AI生成更多内容的指令（如"详细说明"、"深入分析"等）

### Requirement 4: 完整的诊断和日志系统

**User Story:** 作为开发者，我需要详细的日志来诊断为什么字数控制失效。

#### Acceptance Criteria

1. WHEN发送AI请求时，THE System SHALL记录：完整的提示词、max_tokens设置、API请求体
2. WHEN收到AI响应时，THE System SHALL记录：响应字符数、响应token数（如果API返回）、finish_reason
3. WHEN字数超出要求时，THE System SHALL记录：要求字数、实际字数、超出百分比、提示词内容
4. WHEN测试不同max_tokens值时，THE System SHALL记录每次测试的结果对比
5. WHEN AI模型返回finish_reason时，THE System SHALL检查是否为"length"（达到token限制）还是"stop"（自然结束）

### Requirement 5: 后处理和截断机制

**User Story:** 作为系统，当AI模型不遵守字数限制时，我需要有后处理机制来确保最终输出符合要求。

#### Acceptance Criteria

1. WHEN生成的文章超出要求字数20%以上时，THE System SHALL记录警告并考虑截断
2. WHEN需要截断文章时，THE System SHALL在完整句子处截断，保持文章完整性
3. WHEN截断后字数仍超出要求时，THE System SHALL继续向前截断直到符合要求
4. WHEN文章被截断时，THE System SHALL在日志中记录原始长度和截断后长度
5. WHEN文章字数不足要求时，THE System SHALL记录警告但不进行填充（保持内容质量）
