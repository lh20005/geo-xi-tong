# Design Document

## Overview

This design addresses the article generation visibility issue by improving error handling, implementing retry mechanisms, increasing timeout limits, and enhancing the user interface to provide clear feedback about task status and results. The solution focuses on making failures visible, recoverable, and providing users with direct access to generated articles.

## Architecture

The solution involves modifications to three main layers:

1. **Service Layer** (`articleGenerationService.ts`): Enhanced error handling, retry logic, and timeout configuration
2. **API Layer** (`articleGeneration.ts` routes): New endpoints and improved error responses
3. **Frontend Layer** (`ArticleGenerationPage.tsx`): Enhanced UI for task status display, retry functionality, and navigation to articles

The architecture maintains the existing async task execution pattern but adds robustness through retry mechanisms and better error propagation.

## Components and Interfaces

### 1. AIService Enhancements

**Location**: `server/src/services/aiService.ts`

**Changes**:
- Increase default timeout from 60s to 120s
- Implement retry logic with exponential backoff
- Add detailed error logging

**Interface**:
```typescript
interface AIServiceConfig {
  provider: string;
  apiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  timeout?: number; // New: configurable timeout
  maxRetries?: number; // New: configurable retry attempts
}

class AIService {
  private async callAIWithRetry(
    prompt: string,
    retries: number = 2
  ): Promise<string>;
}
```

### 2. ArticleGenerationService Enhancements

**Location**: `server/src/services/articleGenerationService.ts`

**Changes**:
- Modify `generateSingleArticle` to use retry logic
- Improve error messages with context
- Continue generating articles even when individual articles fail
- Update task status logic to distinguish between partial and complete failure

**Interface**:
```typescript
interface ArticleGenerationResult {
  success: boolean;
  articleId?: number;
  error?: string;
}

class ArticleGenerationService {
  async generateSingleArticle(...): Promise<ArticleGenerationResult>;
  async retryTask(taskId: number): Promise<void>; // Already exists, ensure it works correctly
}
```

### 3. Frontend Task Display

**Location**: `client/src/pages/ArticleGenerationPage.tsx`

**Changes**:
- Add visual indicators for task status (success, failed, running)
- Display error messages for failed tasks
- Add "Retry" button for failed tasks
- Add "View Articles" button for completed tasks with generated articles
- Implement auto-refresh for running tasks

**New Components**:
```typescript
interface TaskStatusBadge {
  status: 'pending' | 'running' | 'completed' | 'failed';
  generatedCount: number;
  requestedCount: number;
}

interface TaskActions {
  onRetry: (taskId: number) => void;
  onViewArticles: (taskId: number) => void;
}
```

### 4. Article List Filtering

**Location**: `client/src/pages/ArticleListPage.tsx`

**Changes**:
- Support URL query parameter for filtering by task ID
- Display filter indicator when viewing task-specific articles
- Add "Clear Filter" button to return to all articles view

## Data Models

No changes to database schema are required. The existing models support all necessary functionality:

- `generation_tasks` table already has `status`, `error_message`, `generated_count` fields
- `articles` table already has `task_id` foreign key for filtering

## Error Handling

### 1. AI API Timeout Errors

**Strategy**: Retry with exponential backoff

```typescript
async function callAIWithRetry(prompt: string, maxRetries: number = 2): Promise<string> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await this.callAI(prompt);
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const waitTime = 5000 * (attempt + 1); // 5s, 10s
        await new Promise(resolve => setTimeout(resolve, waitTime));
        console.log(`Retry attempt ${attempt + 1} after ${waitTime}ms`);
      }
    }
  }
  
  throw new Error(`AI call failed after ${maxRetries + 1} attempts: ${lastError.message}`);
}
```

### 2. Partial Task Failure

**Strategy**: Continue processing remaining articles, mark task as completed if at least one article succeeds

```typescript
// In executeTask method
let successCount = 0;
let failureCount = 0;
const errors: string[] = [];

for (let i = 0; i < actualCount; i++) {
  try {
    await this.generateSingleArticle(...);
    successCount++;
  } catch (error) {
    failureCount++;
    errors.push(`Article ${i + 1}: ${error.message}`);
    // Continue to next article
  }
}

if (successCount > 0) {
  await this.updateTaskStatus(taskId, 'completed', successCount);
} else {
  await this.updateTaskStatus(taskId, 'failed', 0, errors.join('; '));
}
```

### 3. Frontend Error Display

**Strategy**: Show user-friendly error messages with actionable guidance

```typescript
function getErrorGuidance(errorMessage: string): string {
  if (errorMessage.includes('timeout')) {
    return '建议：请检查网络连接或稍后重试';
  }
  if (errorMessage.includes('API')) {
    return '建议：请检查AI配置是否正确';
  }
  return '建议：请查看错误详情或联系管理员';
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: Failed task status display
*For any* task with status='failed', the rendered task list UI should contain visual failure indicators (error badge, red color, or error icon)
**Validates: Requirements 1.1, 2.1**

Property 2: Error message visibility
*For any* task with a non-null error_message field, the rendered task detail view should contain the error message text
**Validates: Requirements 1.2**

Property 3: Zero articles means failure
*For any* task execution that generates zero articles, the final task status should be 'failed' not 'completed'
**Validates: Requirements 1.4**

Property 4: Retry preserves configuration
*For any* task, after calling the retry endpoint, all configuration fields (distillation_id, album_id, knowledge_base_id, article_setting_id, requested_count) should remain unchanged from their original values
**Validates: Requirements 2.3**

Property 5: Retry clears error state
*For any* task with status='failed' and non-null error_message, after calling the retry endpoint, the task status should be 'pending' and error_message should be null
**Validates: Requirements 2.2, 2.4**

Property 6: AI retry attempts
*For any* AI API call that consistently fails, the system should make exactly 3 total attempts (1 initial + 2 retries) before throwing an error
**Validates: Requirements 3.2**

Property 7: Failure continues processing
*For any* task generating multiple articles where one article generation fails, the system should continue processing remaining articles and the final generated_count should reflect only successful generations
**Validates: Requirements 3.4, 4.4**

Property 8: Progress calculation accuracy
*For any* task that has generated N articles out of M requested, the progress field should equal Math.round((N/M) * 100)
**Validates: Requirements 4.1**

Property 9: Progress display format
*For any* running task, the rendered UI should contain text matching the pattern "{generated_count} of {requested_count}"
**Validates: Requirements 4.2**

Property 10: View articles button visibility
*For any* task with generated_count > 0, the rendered task detail view should contain a "View Articles" button or link
**Validates: Requirements 5.1**

Property 11: Article filtering correctness
*For any* task ID used as a filter, the returned article list should contain only articles where article.task_id equals the filter value
**Validates: Requirements 5.3**

## Testing Strategy

### Unit Tests

1. **AIService Retry Logic**
   - Test successful call on first attempt
   - Test successful call after retry
   - Test failure after all retries exhausted
   - Test timeout handling

2. **Task Status Updates**
   - Test task marked as completed when all articles succeed
   - Test task marked as completed when some articles succeed
   - Test task marked as failed when all articles fail
   - Test error message aggregation

3. **Article Filtering**
   - Test filtering articles by task ID
   - Test displaying all articles when no filter applied
   - Test empty state when task has no articles

### Integration Tests

1. **End-to-End Task Execution**
   - Create task with valid configuration
   - Verify articles are generated
   - Verify task status is updated correctly
   - Verify articles are visible in article list

2. **Retry Functionality**
   - Create a failed task
   - Retry the task
   - Verify task status resets
   - Verify articles are generated on retry

3. **Error Scenarios**
   - Simulate AI API timeout
   - Verify retry attempts
   - Verify error message is captured
   - Verify user can see error in UI

## Implementation Notes

1. **Timeout Configuration**: The timeout increase from 60s to 120s should be configurable via environment variable for flexibility

2. **Retry Delays**: The 5-second delay between retries is a balance between quick recovery and avoiding overwhelming the API

3. **Progress Updates**: Auto-refresh every 5 seconds provides good user feedback without excessive server load

4. **Navigation**: Use React Router's `useNavigate` with query parameters to filter articles by task ID

5. **Backward Compatibility**: All changes are backward compatible with existing tasks and articles in the database
