# Authentication Fix Summary

## Problem
Multiple client pages are using raw `axios` instead of the configured `apiClient`, causing 401 Unauthorized errors because authentication headers aren't being sent.

## Root Cause
The `apiClient` in `client/src/api/client.ts` is properly configured with:
- Request interceptor that adds `Authorization: Bearer ${token}` header
- Response interceptor that handles 401 errors and token refresh
- Base URL `/api` already configured

However, many pages are importing and using raw `axios` directly, bypassing this authentication setup.

## Solution
Replace all instances of:
```typescript
import axios from 'axios';
// ...
axios.get('/api/endpoint')
```

With:
```typescript
import { apiClient } from '../api/client';
// ...
apiClient.get('/endpoint')  // Note: no /api prefix needed
```

## Files Fixed ✅
1. ✅ client/src/pages/ConversionTargetPage.tsx
2. ✅ client/src/pages/DistillationPage.tsx
3. ✅ client/src/pages/GalleryPage.tsx
4. ✅ client/src/pages/TopicsPage.tsx
5. ✅ client/src/pages/AlbumDetailPage.tsx
6. ✅ client/src/pages/ArticlePage.tsx
7. ✅ client/src/pages/KnowledgeBasePage.tsx
8. ✅ client/src/pages/KnowledgeBaseDetailPage.tsx
9. ✅ client/src/api/articleGenerationApi.ts
10. ✅ client/src/api/distillationApi.ts
11. ✅ client/src/services/websocket.ts (WebSocket authentication)
12. ✅ server/src/routes/articleGeneration.ts (database column fix)

## Files Still Need Fixing ⚠️
The following files still import raw axios and need to be updated:

### High Priority (Core Features)
- ~~client/src/pages/ArticlePage.tsx~~ ✅ FIXED
- client/src/pages/ArticleGenerationPage.tsx
- ~~client/src/pages/TopicsPage.tsx~~ ✅ FIXED
- ~~client/src/pages/KnowledgeBasePage.tsx~~ ✅ FIXED
- ~~client/src/pages/KnowledgeBaseDetailPage.tsx~~ ✅ FIXED
- ~~client/src/pages/AlbumDetailPage.tsx~~ ✅ FIXED
- client/src/pages/DistillationHistoryEnhancedPage.tsx

### Medium Priority (Admin Features)
- client/src/pages/UserCenterPage.tsx
- client/src/pages/PlanManagementPage.tsx
- client/src/pages/ProductManagementPage.tsx
- client/src/pages/OrderManagementPage.tsx

### Lower Priority (Security/Admin)
- client/src/pages/SecurityConfigPage.tsx
- client/src/pages/PermissionsPage.tsx
- client/src/pages/AuditLogsPage.tsx
- client/src/pages/SecurityDashboardPage.tsx
- client/src/pages/PaymentPage.tsx

## Quick Fix Pattern

For each file:
1. Replace import: `import axios from 'axios';` → `import { apiClient } from '../api/client';`
2. Replace all calls: `axios.get('/api/...` → `apiClient.get('/...`
3. Replace all calls: `axios.post('/api/...` → `apiClient.post('/...`
4. Replace all calls: `axios.patch('/api/...` → `apiClient.patch('/...`
5. Replace all calls: `axios.delete('/api/...` → `apiClient.delete('/...`
6. Replace all calls: `axios.put('/api/...` → `apiClient.put('/...`
7. Remove `/api` prefix from all URLs (apiClient already has baseURL: '/api')

## Note on API_BASE_URL
Some files use `${API_BASE_URL}/endpoint` pattern. These should also be migrated to use `apiClient` for consistency, but may require additional testing as they might be calling external services.
