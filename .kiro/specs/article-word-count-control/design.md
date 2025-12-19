# Design Document

## Overview

本设计文档描述如何修复文章生成时字数严重超出要求的问题。

**问题分析：**
1. 当前代码设置了 `max_tokens: 1000`（约650-800字）
2. 但实际生成的文章达到1800-2000字
3. 说明token限制没有生效，或AI模型忽略了限制

**可能的原因：**
1. AI模型（DeepSeek/Gemini/Ollama）不严格遵守max_tokens限制
2. 提示词中的"详细说明"等指令与字数限制冲突
3. max_tokens参数没有正确传递到API
4. API返回的finish_reason不是"length"而是"stop"，说明模型自然结束而非达到限制

**解决方案：**
1. 增强提示词中的字数约束（多次强调、明确警告）
2. 添加详细的诊断日志（记录API请求/响应、finish_reason）
3. 实现后处理截断机制（当AI不遵守限制时）
4. 测试不同的max_tokens值和提示词组合

## Architecture

### 当前架构问题

```
用户提示词（要求700-800字）
    ↓
Article Generation Service
    ↓
AI Service（设置 max_tokens: 1000）
    ↓
AI API（忽略限制，生成1800-2000字）
    ↓
结果：字数严重超出要求
```

**问题根源：**
- AI模型不严格遵守max_tokens
- 提示词中的指令可能与字数限制冲突
- 缺少后处理截断机制

### 改进后架构

```
用户提示词（要求700-800字）
    ↓
Article Generation Service
    ├─ 提取字数要求：700-800字
    ├─ 增强提示词：多次强调字数限制
    └─ 计算max_tokens：800 * 1.5 = 1200
    ↓
AI Service
    ├─ 记录请求：提示词、max_tokens
    ├─ 调用API：传递max_tokens
    └─ 记录响应：字符数、finish_reason
    ↓
AI API（生成文章）
    ↓
Post-Processing
    ├─ 检查字数：实际 vs 要求
    ├─ 如果超出20%：截断到要求范围
    └─ 记录日志：原始长度、截断后长度
    ↓
结果：字数符合要求（700-800字）
```

## Components and Interfaces

### 1. AIService 类修改

**当前接口：**
```typescript
class AIService {
  constructor(config: AIConfig)
  async generateArticle(keyword, topics, requirements, knowledgeContext): Promise<string>
  private async callDeepSeek(prompt): Promise<string>
  private async callGemini(prompt): Promise<string>
  private async callOllama(prompt): Promise<string>
}
```

**新增接口：**
```typescript
interface AIResponse {
  content: string;
  finishReason?: string; // 'stop' | 'length' | 'content_filter'
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
}

interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  timeout?: number;
  maxRetries?: number;
  maxTokens?: number; // 可选的token限制
}

class AIService {
  // 新增：从提示词提取字数要求
  private extractWordCountFromPrompt(prompt: string): { min?: number; max?: number } | null
  
  // 新增：增强提示词的字数约束
  private enhanceWordCountConstraint(prompt: string, wordCount: { min?: number; max?: number }): string
  
  // 新增：计算合适的token限制
  private calculateMaxTokens(wordCount?: { min?: number; max?: number }): number
  
  // 修改：返回详细的响应信息
  private async callDeepSeek(prompt: string, maxTokens?: number): Promise<AIResponse>
  private async callGemini(prompt: string, maxTokens?: number): Promise<AIResponse>
  private async callOllama(prompt: string, maxTokens?: number): Promise<AIResponse>
}
```

### 2. ArticleGenerationService 类修改

**新增方法：**
```typescript
class ArticleGenerationService {
  // 新增：从文章设置提示词中提取字数要求
  private extractWordCountRequirement(prompt: string): { min?: number; max?: number } | null
  
  // 新增：后处理截断文章
  private truncateArticleToWordCount(content: string, maxWords: number): string
  
  // 新增：检查文章字数是否符合要求
  private validateArticleWordCount(content: string, requirement: { min?: number; max?: number }): {
    valid: boolean;
    actualCount: number;
    exceedsBy?: number;
  }
}
```

### 3. 新增：WordCountValidator 工具类

```typescript
class WordCountValidator {
  // 计算中文文章的字数（排除标点和空格）
  static countWords(text: string): number
  
  // 在完整句子处截断文章
  static truncateAtSentence(text: string, maxWords: number): string
  
  // 检查字数是否在范围内
  static isWithinRange(count: number, min?: number, max?: number, tolerance: number = 0.1): boolean
}
```

## Data Models

### Token计算规则

```typescript
interface TokenCalculationRule {
  // 中文字符到token的转换系数（考虑到AI可能超出）
  chineseCharToToken: 1.5;
  
  // 默认token限制（当无法确定字数要求时）
  defaultMaxTokens: 2000; // 约1300字，比较保守
  
  // 各AI提供商的最大token限制
  providerLimits: {
    deepseek: 8000;
    gemini: 8000;
    ollama: 8000; // 取决于模型
  };
}
```

### 字数提取规则

支持的提示词模式：
- "不少于X字" → { min: X, max: undefined }
- "X-Y字" → { min: X, max: Y }
- "约X字" → { min: X * 0.9, max: X * 1.1 }
- "X字左右" → { min: X * 0.9, max: X * 1.1 }
- "控制在X字" → { min: X * 0.9, max: X * 1.1 }
- "不超过X字" → { min: undefined, max: X }

正则表达式：
```typescript
const patterns = [
  { regex: /不少于\s*(\d+)\s*字/, type: 'min' },
  { regex: /(\d+)\s*-\s*(\d+)\s*字/, type: 'range' },
  { regex: /约\s*(\d+)\s*字/, type: 'approx' },
  { regex: /(\d+)\s*字左右/, type: 'approx' },
  { regex: /控制在\s*(\d+)\s*字/, type: 'approx' },
  { regex: /不超过\s*(\d+)\s*字/, type: 'max' }
];
```

### 提示词增强策略

当检测到字数要求时，在提示词中添加强约束：

```typescript
function enhancePrompt(originalPrompt: string, wordCount: { min?: number; max?: number }): string {
  let enhanced = originalPrompt;
  
  // 在开头添加强约束
  if (wordCount.max) {
    enhanced = `【重要】本文必须严格控制字数，不得超过${wordCount.max}字。超出部分将被截断。\n\n` + enhanced;
  }
  
  // 在结尾再次强调
  if (wordCount.max) {
    enhanced += `\n\n【再次提醒】文章总字数必须控制在${wordCount.max}字以内，请精简表达，避免冗余。`;
  }
  
  // 移除可能导致冗长的指令
  enhanced = enhanced.replace(/详细(说明|阐述|分析)/g, '简要$1');
  enhanced = enhanced.replace(/深入(探讨|分析)/g, '简要$1');
  
  return enhanced;
}
```

### 截断策略

```typescript
interface TruncationStrategy {
  // 在完整句子处截断（优先）
  sentenceBoundary: boolean;
  
  // 保留的最小字数百分比
  minRetainPercentage: 0.8;
  
  // 句子结束标记
  sentenceEnders: ['。', '！', '？', '；'];
  
  // 段落结束标记（次优）
  paragraphEnders: ['\n\n', '\n'];
}
```

## Correctness Properties

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### Property 1: 字数提取准确性

*对于任何* 包含字数要求的提示词（"X-Y字"、"约X字"、"不少于X字"等格式），系统应该能够正确提取字数范围，且提取的min/max值应该与提示词中的数字匹配

**Validates: Requirements 3.1, 3.2**

### Property 2: 提示词增强完整性

*对于任何* 包含字数要求的提示词，增强后的提示词应该在开头和结尾都包含字数限制的强调，且应该移除"详细"、"深入"等可能导致冗长的词汇

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 3: Token计算合理性

*对于任何* 给定的字数要求max，计算的token限制应该在 max * 1.2 到 max * 2.0 之间（考虑中文token转换和安全余量），且不应超过AI提供商的最大限制

**Validates: Requirements 2.1, 2.2**

### Property 4: 截断保持完整性

*对于任何* 需要截断的文章，截断后的内容应该在完整句子处结束（以。！？；结尾），且字数应该不超过要求的max值

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 5: 字数验证准确性

*对于任何* 生成的文章，如果要求"X-Y字"，则字数应该在 X * 0.9 到 Y * 1.1 范围内（±10%容差），或者经过截断后符合要求

**Validates: Requirements 2.1, 2.3**

### Property 6: 日志完整性

*对于任何* 文章生成请求，系统应该记录：提取的字数要求、计算的max_tokens、AI响应的finish_reason、实际生成的字符数、是否进行了截断

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 7: API响应解析正确性

*对于任何* AI API响应，系统应该能够正确提取finish_reason字段，并根据其值（"length"表示达到token限制，"stop"表示自然结束）记录不同的日志

**Validates: Requirements 1.5, 4.5**

## Error Handling

### 1. 字数严重超出要求

```typescript
const wordCount = WordCountValidator.countWords(content);
const requirement = this.extractWordCountRequirement(prompt);

if (requirement?.max && wordCount > requirement.max * 1.2) {
  console.warn(`[字数控制] 生成的文章字数 ${wordCount} 超出要求 ${requirement.max} 的20%以上`);
  console.warn(`[字数控制] finish_reason: ${response.finishReason}`);
  
  if (response.finishReason === 'stop') {
    console.warn(`[字数控制] AI模型自然结束（未达到token限制），说明提示词约束无效`);
  }
  
  // 执行截断
  content = this.truncateArticleToWordCount(content, requirement.max);
  console.log(`[字数控制] 已截断文章，新字数: ${WordCountValidator.countWords(content)}`);
}
```

### 2. 字数提取失败

```typescript
const wordCount = this.extractWordCountFromPrompt(prompt);
if (wordCount === null) {
  console.log('[字数控制] 未能从提示词提取字数要求，使用默认限制');
  maxTokens = DEFAULT_MAX_TOKENS; // 2000 tokens
} else {
  console.log(`[字数控制] 提取到字数要求: min=${wordCount.min}, max=${wordCount.max}`);
  maxTokens = this.calculateMaxTokens(wordCount);
}
```

### 3. Token限制超出API最大值

```typescript
if (calculatedTokens > providerMaxTokens) {
  console.warn(`[Token计算] 计算的token限制 ${calculatedTokens} 超出 ${provider} 的最大限制 ${providerMaxTokens}`);
  console.warn(`[Token计算] 将使用最大限制，但可能无法满足字数要求`);
  maxTokens = providerMaxTokens;
}
```

### 4. AI API返回错误

```typescript
catch (error) {
  if (error.message.includes('max_tokens') || error.message.includes('token limit')) {
    console.error('[AI调用] Token限制错误:', error.message);
    console.error('[AI调用] 请求的max_tokens:', maxTokens);
    throw new Error(`Token限制设置错误: ${error.message}`);
  }
  throw error;
}
```

### 5. 截断失败（文章太短）

```typescript
if (requirement?.max && content.length < requirement.max * 0.5) {
  console.warn(`[字数控制] 无法截断：文章太短 (${wordCount}字)，要求至少 ${requirement.max * 0.5}字`);
  // 不进行截断，返回原文
  return content;
}
```

## Testing Strategy

### Unit Tests

1. **字数提取测试**
   - 测试各种字数表达格式的提取
   - 测试边界情况（0字、超大数字）
   - 测试无字数要求的提示词

2. **Token计算测试**
   - 测试不同字数的token计算
   - 测试超出最大限制的处理
   - 测试默认值的使用

3. **API调用测试**
   - 测试各AI提供商的token参数传递
   - 测试token限制错误的重试机制

### Property-Based Tests

每个correctness property都应该有对应的property-based test，使用随机生成的输入验证属性在所有情况下都成立。

**测试配置：**
- 最小迭代次数：100次
- 测试框架：fast-check (TypeScript)
- 标签格式：`Feature: article-word-count-control, Property {N}: {property_text}`

### Integration Tests

1. **端到端文章生成测试**
   - 创建包含字数要求的文章设置
   - 生成文章
   - 验证生成的文章字数符合要求（±10%误差）

2. **多提供商兼容性测试**
   - 测试DeepSeek、Gemini、Ollama三个提供商
   - 验证每个提供商都能正确处理token限制

## Implementation Notes

### 实施阶段

**阶段1：诊断和日志增强（高优先级）**
1. 修改AI API调用，记录完整的请求和响应
2. 提取并记录finish_reason字段
3. 记录实际生成的字符数和token使用情况
4. 运行测试，收集诊断数据

**阶段2：提示词增强（高优先级）**
1. 实现字数提取逻辑
2. 实现提示词增强逻辑（添加强约束、移除冗长指令）
3. 测试不同提示词组合的效果

**阶段3：后处理截断（中优先级）**
1. 实现WordCountValidator工具类
2. 实现智能截断逻辑（在句子边界）
3. 集成到文章生成流程

**阶段4：Token限制优化（低优先级）**
1. 根据诊断数据调整token计算公式
2. 测试不同max_tokens值的效果
3. 优化默认值

### 代码位置

- `server/src/services/aiService.ts`：主要修改位置
  - 修改callDeepSeek/callGemini/callOllama方法
  - 添加extractWordCountFromPrompt方法
  - 添加enhanceWordCountConstraint方法
  - 修改返回类型为AIResponse

- `server/src/services/articleGenerationService.ts`：集成位置
  - 调用增强的AI服务
  - 实现后处理截断
  - 添加字数验证

- `server/src/utils/wordCountValidator.ts`：新增工具类
  - 字数计算
  - 智能截断

### 测试策略

1. **单元测试**：测试字数提取、提示词增强、截断逻辑
2. **集成测试**：测试完整的文章生成流程
3. **诊断测试**：收集不同配置下的实际效果数据

### 关键指标

- finish_reason分布（length vs stop）
- 字数超出百分比
- 截断频率
- 用户满意度
