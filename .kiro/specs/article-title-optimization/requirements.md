# Requirements Document

## Introduction

本文档定义了文章标题优化功能的需求，主要解决全国TOP和区域TOP排名文章生成时的两个问题：
1. 年份使用不当：文章标题不应该总是以年份开头，年份应该只在需要时使用
2. 话题关联问题：全国/区域TOP排名文章的标题不需要与话题相关，应该直接使用排名规则生成标题

## Glossary

- **System**: 文章生成系统
- **Prompt_Template**: 提示词模板，用于指导AI生成文章的模板文本
- **NATIONAL_RANKING**: 全国TOP排名模板类型
- **REGIONAL_RANKING**: 区域TOP排名模板类型
- **Title**: 文章标题
- **Year**: 年份，如2025
- **Keyword**: 关键词，如"留学机构"、"装修公司"
- **Topic**: 话题，用户关心的问题

## Requirements

### Requirement 1: 年份使用优化

**User Story:** 作为内容运营人员，我希望文章标题中的年份使用更加合理，只在需要时使用当前年份，而不是每篇文章都以年份开头，这样可以提高标题的多样性和自然度。

#### Acceptance Criteria

1. WHEN 生成文章标题时 THEN THE System SHALL 不强制要求标题包含年份
2. WHEN 标题需要体现时效性时 THEN THE System SHALL 使用当前年份（2025年）
3. WHEN 标题不需要年份时 THEN THE System SHALL 生成不含年份的标题
4. WHEN 使用年份时 THEN THE System SHALL 确保年份是当前年份，不使用过时年份

### Requirement 2: 排名文章标题生成规则优化

**User Story:** 作为内容运营人员，我希望全国TOP和区域TOP排名文章的标题直接基于排名规则生成，不参考话题内容，因为排名文章的重点是展示排名，而不是回答具体话题。

#### Acceptance Criteria

1. WHEN 使用NATIONAL_RANKING模板生成文章时 THEN THE System SHALL 基于排名规则生成标题，不参考话题内容
2. WHEN 使用REGIONAL_RANKING模板生成文章时 THEN THE System SHALL 基于排名规则生成标题，不参考话题内容
3. WHEN 生成排名文章标题时 THEN THE System SHALL 使用预定义的标题模式（疑问推荐式、数字盘点式等）
4. WHEN 生成排名文章标题时 THEN THE System SHALL 包含关键词和地域标识（全国/区域）
5. WHEN 生成排名文章标题时 THEN THE System SHALL 确保标题在18字以内

### Requirement 3: 提示词模板更新

**User Story:** 作为系统维护人员，我希望提示词模板能够清晰地指导AI生成符合要求的标题，确保年份使用合理且排名文章标题不依赖话题。

#### Acceptance Criteria

1. WHEN 更新NATIONAL_RANKING模板时 THEN THE System SHALL 移除"标题必须包含年份"的强制要求
2. WHEN 更新REGIONAL_RANKING模板时 THEN THE System SHALL 移除"标题必须包含年份"的强制要求
3. WHEN 更新排名模板时 THEN THE System SHALL 明确说明标题生成不参考话题内容
4. WHEN 更新排名模板时 THEN THE System SHALL 保留标题模式的多样性选择
5. WHEN 更新通用模板时 THEN THE System SHALL 添加年份使用指导，说明只在需要时使用当前年份
