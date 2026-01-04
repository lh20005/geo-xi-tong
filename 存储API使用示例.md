# 存储空间管理 API - 使用示例

## 📖 目录

1. [用户 API](#用户-api)
2. [管理员 API](#管理员-api)
3. [前端集成示例](#前端集成示例)
4. [错误处理](#错误处理)

---

## 用户 API

### 1. 获取存储使用情况

**请求：**
```bash
GET /api/storage/usage
Authorization: Bearer YOUR_TOKEN
```

**响应：**
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "imageStorageBytes": 5242880,
    "documentStorageBytes": 10485760,
    "articleStorageBytes": 2097152,
    "totalStorageBytes": 17825792,
    "imageCount": 10,
    "documentCount": 5,
    "articleCount": 3,
    "storageQuotaBytes": 104857600,
    "purchasedStorageBytes": 0,
    "availableBytes": 87031808,
    "usagePercentage": 17.0
  }
}
```

**前端使用：**
```typescript
import { getStorageUsage } from '../api/storage';

const usage = await getStorageUsage();
console.log(`已使用: ${usage.usagePercentage}%`);
```

---

### 2. 获取存储明细

**请求：**
```bash
GET /api/storage/breakdown
Authorization: Bearer YOUR_TOKEN
```

**响应：**
```json
{
  "success": true,
  "data": {
    "images": {
      "sizeBytes": 5242880,
      "count": 10,
      "percentage": 29.42
    },
    "documents": {
      "sizeBytes": 10485760,
      "count": 5,
      "percentage": 58.82
    },
    "articles": {
      "sizeBytes": 2097152,
      "count": 3,
      "percentage": 11.76
    }
  }
}
```

**前端使用：**
```typescript
import { getStorageBreakdown } from '../api/storage';

const breakdown = await getStorageBreakdown();
console.log(`图片占比: ${breakdown.images.percentage}%`);
```

---

### 3. 检查上传配额

**请求：**
```bash
POST /api/storage/check-quota
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "fileSizeBytes": 5242880,
  "resourceType": "image"
}
```

**响应（允许）：**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "currentUsageBytes": 17825792,
    "quotaBytes": 104857600,
    "availableBytes": 87031808,
    "usagePercentage": 17.0
  }
}
```

**响应（拒绝）：**
```json
{
  "success": false,
  "message": "存储配额不足。当前使用: 95.5 MB, 配额: 100 MB, 需要: 10 MB",
  "data": {
    "allowed": false,
    "currentUsageBytes": 100139008,
    "quotaBytes": 104857600,
    "availableBytes": 4718592,
    "usagePercentage": 95.5,
    "reason": "存储配额不足。当前使用: 95.5 MB, 配额: 100 MB, 需要: 10 MB"
  }
}
```

**前端使用：**
```typescript
import { checkQuota } from '../api/storage';
import { message } from 'antd';

const beforeUpload = async (file: File) => {
  try {
    const result = await checkQuota(file.size, 'image');
    if (!result.allowed) {
      message.error(result.reason);
      return false;
    }
    return true;
  } catch (error) {
    console.error('检查配额失败:', error);
    return true; // 失败时允许上传，由后端再次检查
  }
};
```

---

### 4. 获取存储历史

**请求：**
```bash
GET /api/storage/history?startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer YOUR_TOKEN
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-01-01T00:00:00.000Z",
      "totalBytes": 15728640,
      "imageBytes": 5242880,
      "documentBytes": 8388608,
      "articleBytes": 2097152
    },
    {
      "date": "2026-01-02T00:00:00.000Z",
      "totalBytes": 17825792,
      "imageBytes": 5242880,
      "documentBytes": 10485760,
      "articleBytes": 2097152
    }
  ]
}
```

---

### 5. 获取事务日志

**请求：**
```bash
GET /api/storage/transactions?page=1&pageSize=20
Authorization: Bearer YOUR_TOKEN
```

**响应：**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 123,
        "resourceType": "image",
        "resourceId": 45,
        "operation": "add",
        "sizeBytes": 524288,
        "metadata": {
          "filename": "photo.jpg",
          "mimetype": "image/jpeg"
        },
        "createdAt": "2026-01-04T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

---

### 6. 获取待处理警报

**请求：**
```bash
GET /api/storage/alerts
Authorization: Bearer YOUR_TOKEN
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 1,
      "alertType": "warning",
      "thresholdPercentage": 80,
      "currentUsageBytes": 83886080,
      "quotaBytes": 104857600,
      "isSent": false,
      "createdAt": "2026-01-04T10:00:00.000Z"
    }
  ]
}
```

---

## 管理员 API

### 1. 获取所有用户存储

**请求：**
```bash
GET /api/admin/storage/users?page=1&pageSize=20
Authorization: Bearer ADMIN_TOKEN
```

**响应：**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": 1,
        "username": "user1",
        "email": "user1@example.com",
        "role": "user",
        "imageStorageBytes": 5242880,
        "documentStorageBytes": 10485760,
        "articleStorageBytes": 2097152,
        "totalStorageBytes": 17825792,
        "imageCount": 10,
        "documentCount": 5,
        "articleCount": 3,
        "storageQuotaBytes": 104857600,
        "purchasedStorageBytes": 0,
        "lastUpdatedAt": "2026-01-04T10:30:00.000Z",
        "effectiveQuotaBytes": 104857600,
        "availableBytes": 87031808,
        "usagePercentage": 17.0
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

---

### 2. 获取用户存储明细

**请求：**
```bash
GET /api/admin/storage/breakdown/1
Authorization: Bearer ADMIN_TOKEN
```

**响应：**
```json
{
  "success": true,
  "data": {
    "images": {
      "sizeBytes": 5242880,
      "count": 10,
      "percentage": 29.42
    },
    "documents": {
      "sizeBytes": 10485760,
      "count": 5,
      "percentage": 58.82
    },
    "articles": {
      "sizeBytes": 2097152,
      "count": 3,
      "percentage": 11.76
    }
  }
}
```

---

### 3. 更新用户配额

**请求：**
```bash
PUT /api/admin/storage/quota/1
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "quotaBytes": 1073741824,
  "reason": "升级到专业版"
}
```

**响应：**
```json
{
  "success": true,
  "message": "配额更新成功",
  "data": {
    "userId": 1,
    "oldQuotaBytes": 104857600,
    "newQuotaBytes": 1073741824
  }
}
```

---

### 4. 获取系统统计

**请求：**
```bash
GET /api/admin/storage/stats
Authorization: Bearer ADMIN_TOKEN
```

**响应：**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 100,
      "totalStorageUsed": 1782579200,
      "avgStoragePerUser": 17825792,
      "totalQuotaAllocated": 10485760000
    },
    "distribution": {
      "images": {
        "totalBytes": 524288000,
        "count": 1000
      },
      "documents": {
        "totalBytes": 1048576000,
        "count": 500
      },
      "articles": {
        "totalBytes": 209715200,
        "count": 300
      }
    },
    "alerts": {
      "overQuotaUsers": 5,
      "nearQuotaUsers": 15
    }
  }
}
```

---

### 5. 触发存储对账

**请求：**
```bash
POST /api/admin/storage/reconcile/1
Authorization: Bearer ADMIN_TOKEN
```

**响应：**
```json
{
  "success": true,
  "data": {
    "calculated": {
      "userId": 1,
      "totalStorageBytes": 17825792,
      "imageStorageBytes": 5242880,
      "documentStorageBytes": 10485760,
      "articleStorageBytes": 2097152
    },
    "actual": {
      "userId": 1,
      "totalStorageBytes": 17825792,
      "imageStorageBytes": 5242880,
      "documentStorageBytes": 10485760,
      "articleStorageBytes": 2097152
    },
    "discrepancy": 0
  }
}
```

---

## 前端集成示例

### React Hook 示例

```typescript
import { useState, useEffect } from 'react';
import { getStorageUsage, getStorageBreakdown, StorageUsage, StorageBreakdown } from '../api/storage';
import { message } from 'antd';

export const useStorage = () => {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStorage = async () => {
    setLoading(true);
    try {
      const [usageData, breakdownData] = await Promise.all([
        getStorageUsage(),
        getStorageBreakdown()
      ]);
      setUsage(usageData);
      setBreakdown(breakdownData);
    } catch (error) {
      console.error('加载存储数据失败:', error);
      message.error('加载存储数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStorage();
  }, []);

  return { usage, breakdown, loading, refresh: fetchStorage };
};
```

**使用：**
```typescript
const MyComponent = () => {
  const { usage, breakdown, loading, refresh } = useStorage();

  if (loading) return <Spin />;
  if (!usage) return <div>无数据</div>;

  return (
    <div>
      <p>已使用: {usage.usagePercentage}%</p>
      <Button onClick={refresh}>刷新</Button>
    </div>
  );
};
```

---

### 上传前检查示例

```typescript
import { Upload, message } from 'antd';
import { checkQuota } from '../api/storage';

const ImageUpload = () => {
  const beforeUpload = async (file: File) => {
    // 检查文件大小
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      message.error('图片大小不能超过 50MB');
      return false;
    }

    // 检查配额
    try {
      const result = await checkQuota(file.size, 'image');
      if (!result.allowed) {
        message.error(result.reason || '存储空间不足');
        return false;
      }
    } catch (error) {
      console.error('检查配额失败:', error);
      // 失败时允许上传，由后端再次检查
    }

    return true;
  };

  return (
    <Upload beforeUpload={beforeUpload}>
      <Button>上传图片</Button>
    </Upload>
  );
};
```

---

### WebSocket 监听示例

```typescript
import { useEffect } from 'react';
import { getUserWebSocketService } from '../services/UserWebSocketService';
import { message } from 'antd';

const StoragePage = () => {
  const { usage, refresh } = useStorage();

  useEffect(() => {
    const ws = getUserWebSocketService();

    // 存储更新
    const handleStorageUpdate = (data: any) => {
      console.log('存储更新:', data);
      refresh(); // 刷新数据
    };

    // 存储警报
    const handleStorageAlert = (data: any) => {
      const { alert, message: msg } = data;
      
      if (alert.alertType === 'depleted') {
        message.error(msg, 10);
      } else if (alert.alertType === 'critical') {
        message.warning(msg, 8);
      } else {
        message.info(msg, 5);
      }
    };

    // 配额变更
    const handleQuotaChange = (data: any) => {
      message.success('存储配额已更新');
      refresh();
    };

    ws.on('storage_updated', handleStorageUpdate);
    ws.on('storage_alert', handleStorageAlert);
    ws.on('storage_quota_changed', handleQuotaChange);

    return () => {
      ws.off('storage_updated', handleStorageUpdate);
      ws.off('storage_alert', handleStorageAlert);
      ws.off('storage_quota_changed', handleQuotaChange);
    };
  }, [refresh]);

  return <div>...</div>;
};
```

---

## 错误处理

### 常见错误码

| 状态码 | 说明 | 处理方式 |
|--------|------|----------|
| 400 | 请求参数错误 | 检查请求参数 |
| 401 | 未认证 | 重新登录 |
| 403 | 配额超限 | 提示用户升级或清理 |
| 404 | 资源不存在 | 检查资源 ID |
| 413 | 文件过大 | 提示文件大小限制 |
| 500 | 服务器错误 | 联系管理员 |

### 错误处理示例

```typescript
import axios from 'axios';
import { message } from 'antd';

const handleStorageError = (error: any) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;

    switch (status) {
      case 403:
        // 配额超限
        message.error(data.message || '存储空间不足，请升级套餐');
        // 可以显示升级对话框
        break;
      
      case 413:
        // 文件过大
        message.error(data.message || '文件大小超过限制');
        break;
      
      case 401:
        // 未认证
        message.error('请先登录');
        // 跳转到登录页
        break;
      
      default:
        message.error('操作失败，请稍后重试');
    }
  } else {
    message.error('网络错误，请检查连接');
  }
};

// 使用
try {
  await uploadFile(file);
} catch (error) {
  handleStorageError(error);
}
```

---

## 🎯 最佳实践

1. **上传前检查**：始终在上传前检查配额
2. **错误处理**：提供友好的错误提示
3. **实时更新**：监听 WebSocket 事件
4. **缓存策略**：合理使用缓存减少请求
5. **用户体验**：显示进度和剩余空间

---

**创建时间**：2026-01-04  
**版本**：1.0.0
