# Design Document

## Overview

This design enhances the article management page by improving data display and database schema. The key improvements include:

1. Fixing the creation time display issue by ensuring consistent field naming
2. Adding a "Distillation Result" column to show the source material used for article generation
3. Adding a "Conversion Target" column to display the intended audience/purpose
4. Removing the "Preview" and "AI Model" columns to streamline the interface
5. Ensuring database schema properly supports these relationships

## Architecture

The enhancement follows a three-tier architecture:

1. **Database Layer**: PostgreSQL schema with proper foreign key relationships
2. **API Layer**: Express.js routes that query and join related tables
3. **UI Layer**: React components using Ant Design for table display

### Data Flow

```
Database (articles + joins) 
  → API Route (/articles) 
  → API Client 
  → ArticleListPage Component 
  → Ant Design Table
```

## Components and Interfaces

### 1. Database Schema Changes

The articles table already has the necessary foreign key relationships:
- `distillation_id` → references `distillations(id)`
- `task_id` → references `generation_tasks(id)`

The `generation_tasks` table has:
- `conversion_target_id` → references `conversion_targets(id)`

No schema changes are required, but we need to update queries to join these tables.

### 2. API Layer Changes

**File**: `server/src/routes/article.ts`

The GET `/articles` endpoint needs to be enhanced to:
- Join with `distillations` table to get distillation keyword
- Join with `generation_tasks` and `conversion_targets` tables to get conversion target name
- Remove the `preview` field from the SELECT clause
- Ensure consistent field naming (use `created_at` consistently)

**Updated Response Schema**:
```typescript
interface ArticleListItem {
  id: number;
  title: string | null;
  keyword: string;
  distillationId: number;
  distillationKeyword: string;  // NEW: from distillations table
  taskId: number | null;
  conversionTargetId: number | null;  // NEW
  conversionTargetName: string | null;  // NEW: from conversion_targets table
  imageUrl: string | null;
  createdAt: string;  // FIXED: consistent naming
  updatedAt: string;
}
```

### 3. UI Layer Changes

**File**: `client/src/pages/ArticleListPage.tsx`

Column configuration changes:
1. Remove `preview` column
2. Remove `provider` (AI Model) column
3. Add `conversionTarget` column before `keyword` column
4. Add `distillationResult` column after `keyword` column
5. Fix `created_at` field reference to use consistent naming

**Updated Column Order**:
1. Conversion Target (NEW)
2. Keywords (existing)
3. Distillation Result (NEW)
4. Creation Time (fixed)
5. Actions (existing)

## Data Models

### Article (Enhanced)

```typescript
interface Article {
  id: number;
  title: string | null;
  keyword: string;
  distillationId: number;
  distillationKeyword: string;  // NEW
  taskId: number | null;
  conversionTargetId: number | null;  // NEW
  conversionTargetName: string | null;  // NEW
  requirements: string | null;
  content: string;
  imageUrl: string | null;
  provider: string;  // Still in DB, just not displayed in list
  createdAt: string;
  updatedAt: string;
}
```

### Database Query Structure

```sql
SELECT 
  a.id,
  a.title,
  a.keyword,
  a.distillation_id,
  d.keyword as distillation_keyword,
  a.task_id,
  gt.conversion_target_id,
  ct.company_name as conversion_target_name,
  a.image_url,
  a.created_at,
  a.updated_at
FROM articles a
LEFT JOIN distillations d ON a.distillation_id = d.id
LEFT JOIN generation_tasks gt ON a.task_id = gt.id
LEFT JOIN conversion_targets ct ON gt.conversion_target_id = ct.id
ORDER BY a.created_at DESC
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptance Criteria Testing Prework

1.1 WHEN the article list page loads THEN the system SHALL display the creation time in the correct format for each article
Thoughts: This is about ensuring that for all articles, the creation time field is properly retrieved from the database and formatted. We can test this by generating random articles and verifying the creation time is present and properly formatted.
Testable: yes - property

1.2 WHEN articles are sorted by creation time THEN the system SHALL order them based on the actual creation timestamp
Thoughts: This is about ensuring the sort order is correct. We can create multiple articles with different timestamps and verify they are returned in the correct order.
Testable: yes - property

1.3 WHEN the creation time is displayed THEN the system SHALL format it in a human-readable format (YYYY-MM-DD HH:mm:ss)
Thoughts: This is about the UI formatting. We can test that the formatting function produces the expected output for various timestamps.
Testable: yes - property

2.1 WHEN the article list page displays THEN the system SHALL show a "Distillation Result" column after the "Keywords" column
Thoughts: This is about UI structure. We can test that the column exists and is in the correct position.
Testable: yes - example

2.2 WHEN an article has an associated distillation result THEN the system SHALL display the distillation result identifier or title
Thoughts: This is a rule that applies to all articles with distillation results. We can generate random articles with distillation results and verify the data is displayed.
Testable: yes - property

2.3 WHEN an article has no associated distillation result THEN the system SHALL display an empty value or placeholder
Thoughts: This is an edge case for articles without distillation results.
Testable: edge-case

2.4 WHEN the database stores article data THEN the system SHALL maintain the relationship between articles and distillations
Thoughts: This is about referential integrity. We can test that foreign key constraints are enforced.
Testable: yes - property

3.1 WHEN the article list page displays THEN the system SHALL show a "Conversion Target" column before the "Keywords" column
Thoughts: This is about UI structure. We can test that the column exists and is in the correct position.
Testable: yes - example

3.2 WHEN an article has an associated conversion target THEN the system SHALL display the conversion target name or identifier
Thoughts: This is a rule that applies to all articles with conversion targets. We can generate random articles with conversion targets and verify the data is displayed.
Testable: yes - property

3.3 WHEN an article has no associated conversion target THEN the system SHALL display an empty value or placeholder
Thoughts: This is an edge case for articles without conversion targets.
Testable: edge-case

3.4 WHEN the database stores article data THEN the system SHALL maintain the relationship between articles and conversion targets
Thoughts: This is about referential integrity through the generation_tasks table. We can test that the join query correctly retrieves conversion target data.
Testable: yes - property

4.1 WHEN the article list page displays THEN the system SHALL NOT show a "Preview" column
Thoughts: This is a specific UI requirement that the preview column should not exist.
Testable: yes - example

4.2 WHEN the article list page displays THEN the system SHALL NOT show an "AI Model" column
Thoughts: This is a specific UI requirement that the AI Model column should not exist.
Testable: yes - example

4.3 WHEN the UI renders the article list THEN the system SHALL maintain proper column alignment and spacing
Thoughts: This is about visual layout which is difficult to test programmatically.
Testable: no

5.1 WHEN the database schema is updated THEN the system SHALL ensure articles table has fields for distillation result references
Thoughts: The schema already has this field (distillation_id). This is about verifying the schema.
Testable: yes - example

5.2 WHEN the database schema is updated THEN the system SHALL ensure articles table has fields for conversion target references
Thoughts: The conversion target is referenced through generation_tasks table. This is about verifying the relationship exists.
Testable: yes - example

5.3 WHEN database queries execute THEN the system SHALL efficiently retrieve article data with related distillation results and conversion targets
Thoughts: This is about query performance and correctness. We can test that the JOIN query returns the correct data for all articles.
Testable: yes - property

5.4 WHEN the database migration runs THEN the system SHALL preserve existing article data without loss
Thoughts: Since we're not modifying the schema, this is about ensuring the new queries don't break existing data. We can test that all existing articles are still retrievable.
Testable: yes - property

### Property Reflection

After reviewing all properties, the following consolidations can be made:

- Properties 2.2 and 3.2 can be combined into a single property about displaying related data
- Properties 2.4 and 3.4 can be combined into a single property about referential integrity
- Properties 5.3 and 5.4 can be combined into a single property about query correctness

### Correctness Properties

Property 1: Creation time display consistency
*For any* article in the database, when retrieved through the API, the creation time field should be present and formatted as a valid ISO timestamp
**Validates: Requirements 1.1, 1.3**

Property 2: Creation time sort order
*For any* set of articles, when retrieved from the API, they should be ordered by creation time in descending order (newest first)
**Validates: Requirements 1.2**

Property 3: Related data display
*For any* article with an associated distillation result or conversion target, when retrieved through the API, the related data (distillation keyword, conversion target name) should be included in the response
**Validates: Requirements 2.2, 3.2**

Property 4: Referential integrity preservation
*For any* article in the database, the foreign key relationships to distillations and generation_tasks (and through it to conversion_targets) should be maintained and correctly joined in queries
**Validates: Requirements 2.4, 3.4**

Property 5: Query correctness and data preservation
*For any* existing article in the database, the enhanced query with JOINs should return all article data without loss, including cases where related tables have NULL foreign keys
**Validates: Requirements 5.3, 5.4**

## Error Handling

### Database Query Errors

- **LEFT JOIN failures**: Use LEFT JOIN instead of INNER JOIN to handle articles without conversion targets
- **NULL handling**: Ensure NULL values for optional relationships are properly handled in the API response
- **Query timeout**: Maintain existing timeout handling in the API client

### UI Error Handling

- **Missing data**: Display empty cells or placeholders (e.g., "-" or "N/A") for NULL values
- **Load failures**: Maintain existing error message display using Ant Design message component
- **Column rendering**: Ensure graceful degradation if data fields are missing

### Data Consistency

- **Field naming**: Ensure consistent use of camelCase in API responses and snake_case in database queries
- **Timestamp formatting**: Handle various timestamp formats from the database
- **Empty strings vs NULL**: Treat both as "no data" in the UI

## Testing Strategy

### Unit Tests

1. **API Route Tests** (`server/src/routes/__tests__/article.test.ts`):
   - Test GET /articles returns articles with joined distillation and conversion target data
   - Test NULL conversion targets are handled correctly
   - Test response includes all required fields with correct naming
   - Test articles without distillation_id or task_id don't cause errors

2. **UI Component Tests** (`client/src/pages/__tests__/ArticleListPage.test.tsx`):
   - Test table renders with correct columns in correct order
   - Test "Preview" and "AI Model" columns are not present
   - Test "Conversion Target" and "Distillation Result" columns are present
   - Test NULL values display appropriately

### Property-Based Tests

Property-based tests will use `fast-check` library for TypeScript. Each test should run a minimum of 100 iterations.

1. **Property 1: Creation time display consistency**
   - Generate random articles with various timestamps
   - Verify all returned articles have valid createdAt fields
   - Tag: **Feature: article-list-enhancement, Property 1: Creation time display consistency**

2. **Property 2: Creation time sort order**
   - Generate random sets of articles with different timestamps
   - Verify they are always returned in descending order by created_at
   - Tag: **Feature: article-list-enhancement, Property 2: Creation time sort order**

3. **Property 3: Related data display**
   - Generate random articles with and without distillation/conversion target associations
   - Verify related data is included when associations exist
   - Tag: **Feature: article-list-enhancement, Property 3: Related data display**

4. **Property 4: Referential integrity preservation**
   - Generate random articles with various foreign key combinations
   - Verify all foreign key relationships are correctly maintained in query results
   - Tag: **Feature: article-list-enhancement, Property 4: Referential integrity preservation**

5. **Property 5: Query correctness and data preservation**
   - Generate random articles including edge cases (NULL foreign keys)
   - Verify all articles are retrievable and no data is lost in JOIN operations
   - Tag: **Feature: article-list-enhancement, Property 5: Query correctness and data preservation**

### Integration Tests

1. **End-to-End Flow**:
   - Create articles with various combinations of distillation results and conversion targets
   - Verify the article list page displays all data correctly
   - Verify sorting and filtering work as expected

2. **Database Migration Verification**:
   - Verify existing articles are still accessible after query changes
   - Verify no data loss occurs
   - Verify indexes are still effective

### Manual Testing Checklist

1. Load article list page and verify column order
2. Verify creation time displays correctly for all articles
3. Verify distillation result displays for articles with distillation_id
4. Verify conversion target displays for articles with task_id and conversion_target_id
5. Verify empty cells for articles without these associations
6. Verify "Preview" and "AI Model" columns are not visible
7. Verify table sorting by creation time works correctly
8. Verify pagination works correctly with new columns
