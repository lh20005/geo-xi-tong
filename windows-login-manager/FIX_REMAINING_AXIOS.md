# Fix Remaining Axios Usage

## Pages Still Using Raw Axios

The following pages need to be updated to use `apiClient` instead of raw `axios`:

1. ✅ **PermissionsPage.tsx** - FIXED
2. **SecurityConfigPage.tsx** - 4 axios calls
3. **AuditLogsPage.tsx** - 2 axios calls  
4. **SecurityDashboardPage.tsx** - 2 axios calls
5. **UserCenterPage.tsx** - 6 axios calls
6. **ConversionTargetPage.tsx** - needs inspection
7. **DistillationHistoryEnhancedPage.tsx** - needs inspection
8. **TopicsPage.tsx** - needs inspection
9. **ArticlePage.tsx** - needs inspection
10. **PaymentPage.tsx** - needs inspection
11. **AlbumDetailPage.tsx** - needs inspection
12. **ArticleGenerationPage.tsx** - already has apiClient import, check for remaining axios

## Fix Pattern

### 1. Replace imports:
```typescript
// OLD:
import axios from 'axios';
import { API_BASE_URL } from '../config/env';

// NEW:
import { apiClient } from '../api/client';
```

### 2. Replace API calls:
```typescript
// OLD:
const token = localStorage.getItem('auth_token');
const response = await axios.get(`${API_BASE_URL}/endpoint`, {
  headers: { Authorization: `Bearer ${token}` }
});

// NEW:
const response = await apiClient.get('/endpoint');
```

### 3. Remove `/api` prefix from URLs (apiClient adds it automatically)

### 4. Remove manual token handling (apiClient handles it automatically)

## Priority Order

1. Admin pages (Security, Permissions, Audit) - CRITICAL
2. User-facing pages (UserCenter, Payment) - HIGH
3. Content pages (Articles, Topics, Albums) - MEDIUM
4. Other pages - LOW
