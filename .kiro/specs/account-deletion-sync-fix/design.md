# Design Document

## Overview

本设计解决Windows端删除账号后网页端无法实时同步的问题。核心问题是网页端的WebSocket连接缺少有效的认证token，导致无法接收服务端广播的账号删除事件。

设计方案包括：
1. 为网页端添加简化的认证机制（或使用匿名WebSocket连接）
2. 确保WebSocket事件广播在所有客户端删除操作后触发
3. 优化网页端的WebSocket连接管理和事件处理
4. 添加详细的日志记录以便调试

## Architecture

### 系统组件

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Windows Client │         │   Web Client     │         │  Server         │
│                 │         │                  │         │                 │
│  ┌───────────┐  │         │  ┌────────────┐  │         │  ┌───────────┐  │
│  │ API Client│──┼────────▶│  │ API Client │──┼────────▶│  │ REST API  │  │
│  └───────────┘  │         │  └────────────┘  │         │  └─────┬─────┘  │
│                 │         │                  │         │        │        │
│  ┌───────────┐  │         │  ┌────────────┐  │         │  ┌─────▼─────┐  │
│  │ WebSocket │──┼────────▶│  │ WebSocket  │──┼────────▶│  │ WebSocket │  │
│  │  Client   │◀─┼─────────┤  │  Client    │◀─┼─────────┤  │  Service  │  │
│  └───────────┘  │         │  └────────────┘  │         │  └───────────┘  │
└─────────────────┘         └──────────────────┘         └─────────────────┘
         │                           │                            │
         │                           │                            │
         └───────────────────────────┴────────────────────────────┘
                    Account Deletion Event Flow
```

### 数据流

**账号删除流程：**

1. 客户端（Windows或Web）调用 DELETE `/api/publishing/accounts/:id`
2. 服务端执行删除操作
3. 删除成功后，服务端通过WebSocket广播 `account.deleted` 事件
4. 所有已连接的客户端接收事件并更新UI

## Components and Interfaces

### 1. 统一用户认证系统

**问题分析：**
- 当前网页端没有登录系统，无法获取auth_token
- WebSocket服务要求认证才能接收广播消息
- Windows端有完整的认证流程
- **安全考虑：** 网页端将部署到腾讯云，需要安全的认证机制

**解决方案：统一认证系统（推荐）**

为网页端和Windows端实现统一的用户认证系统：

#### 1.1 网页端登录页面

创建登录页面，用户输入用户名和密码：

```typescript
// client/src/pages/LoginPage.tsx

import { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const handleLogin = async (values: { username: string; password: string }) => {
    try {
      setLoading(true);
      const response = await apiClient.post('/auth/login', values);
      
      if (response.data.success) {
        // 保存token到localStorage
        const { token, refreshToken, user } = response.data.data;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.setItem('user_info', JSON.stringify(user));
        
        message.success(`欢迎回来，${user.username}！`);
        
        // 跳转到主页
        navigate('/');
      } else {
        message.error(response.data.message || '登录失败');
      }
    } catch (error: any) {
      console.error('登录失败:', error);
      message.error(error.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card
        style={{
          width: 400,
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          borderRadius: 8
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Logo和标题 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 80,
              height: 80,
              margin: '0 auto 16px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              color: '#fff'
            }}>
              <LoginOutlined />
            </div>
            <Title level={2} style={{ marginBottom: 8 }}>
              GEO优化系统
            </Title>
            <Text type="secondary">
              请登录以继续使用
            </Text>
          </div>

          {/* 登录表单 */}
          <Form
            name="login"
            onFinish={handleLogin}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="用户名"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                icon={<LoginOutlined />}
              >
                登录
              </Button>
            </Form.Item>
          </Form>

          {/* 提示信息 */}
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              默认账号: admin / admin123
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
}
```

#### 1.2 路由配置

添加登录路由和路由守卫：

```typescript
// client/src/App.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* 受保护的路由 */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

```typescript
// client/src/components/ProtectedRoute.tsx

import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    // 未登录，跳转到登录页
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}
```

#### 1.3 顶部导航栏用户信息

在Layout中显示当前登录用户和登出按钮：

```typescript
// client/src/components/Layout/Header.tsx

import { Layout, Space, Avatar, Dropdown, Typography } from 'antd';
import { UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { MenuProps } from 'antd';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

export default function Header() {
  const navigate = useNavigate();
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
  
  const handleLogout = () => {
    // 清除所有认证信息
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    
    // 跳转到登录页
    navigate('/login');
  };
  
  const menuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => {
        // 跳转到个人信息页面（可选）
      }
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => {
        // 跳转到设置页面（可选）
      }
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout
    }
  ];
  
  return (
    <AntHeader style={{
      background: '#fff',
      padding: '0 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #f0f0f0'
    }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
        GEO优化系统
      </div>
      
      <Dropdown menu={{ items: menuItems }} placement="bottomRight">
        <Space style={{ cursor: 'pointer' }}>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
          <Text strong>{userInfo.username || '用户'}</Text>
        </Space>
      </Dropdown>
    </AntHeader>
  );
}
```

为所有API请求自动添加认证token：

```typescript
// client/src/api/client.ts

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理token过期
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token过期，尝试刷新
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          const newToken = response.data.data.token;
          localStorage.setItem('auth_token', newToken);
          
          // 重试原始请求
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return apiClient.request(error.config);
        } catch (refreshError) {
          // 刷新失败，跳转到登录页
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        // 没有refreshToken，跳转到登录页
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

#### 1.4 WebSocket认证

使用登录后获取的token进行WebSocket认证：

```typescript
// client/src/pages/PlatformManagementPage.tsx

const initializeWebSocketConnection = () => {
  try {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      console.warn('No auth token, cannot connect to WebSocket');
      return;
    }
    
    const wsClient = initializeWebSocket(wsUrl);
    setupWebSocketListeners(wsClient);
    
    // 使用token连接
    wsClient.connect(token);
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
  }
};
```

### 2. 服务端用户管理

#### 2.1 用户数据库表

创建用户表存储用户信息：

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

-- 创建默认管理员账号
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2b$10$...', 'admin')
ON CONFLICT (username) DO NOTHING;
```

#### 2.2 密码加密

使用bcrypt加密密码：

```typescript
// server/src/services/AuthService.ts

import bcrypt from 'bcrypt';

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
  
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
  
  async createUser(username: string, password: string, email?: string): Promise<User> {
    const passwordHash = await this.hashPassword(password);
    
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING *',
      [username, passwordHash, email]
    );
    
    return result.rows[0];
  }
  
  async validateUser(username: string, password: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const user = result.rows[0];
    const isValid = await this.verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      return null;
    }
    
    // 更新最后登录时间
    await pool.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    return user;
  }
}
```

#### 2.3 改进登录路由

```typescript
// server/src/routes/auth.ts

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    // 验证用户
    const user = await authService.validateUser(username, password);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 生成令牌
    const accessToken = generateAccessToken(user.id, user.username);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      data: {
        token: accessToken,
        refreshToken,
        expiresIn: 3600,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败'
    });
  }
});
```

### 3. WebSocket安全认证

保持WebSocket服务的认证要求，只允许已认证用户接收事件：

```typescript
// server/src/services/WebSocketService.ts

public broadcast(message: any): void {
  this.clients.forEach((client) => {
    // 只向已认证的客户端发送消息
    if (client.userId && client.ws.readyState === WebSocket.OPEN) {
      this.send(client.ws, message);
    }
  });
}

public broadcastAccountEvent(event: 'created' | 'updated' | 'deleted', account: any): void {
  const message = {
    type: `account.${event}`,
    data: account,
    timestamp: new Date().toISOString()
  };

  this.broadcast(message);
  console.log(`[WebSocket] 广播账号事件: account.${event}`, {
    accountId: account.id,
    connectedClients: this.getAuthenticatedClientCount()
  });
}
```

### 4. HTTPS和WSS支持

#### 4.1 生产环境配置

在腾讯云部署时，使用HTTPS和WSS（WebSocket Secure）：

```typescript
// client/src/config/env.ts

export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD ? 'https://your-domain.com/api' : 'http://localhost:3000/api'),
  
  wsUrl: import.meta.env.VITE_WS_URL || 
    (import.meta.env.PROD ? 'wss://your-domain.com/ws' : 'ws://localhost:3000/ws'),
};
```

#### 4.2 Nginx配置（腾讯云）

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # API代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket代理
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket超时设置
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # 静态文件
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }
}
```

## Data Models

### User Model

```typescript
interface User {
  id: number;
  username: string;
  password_hash: string;
  email?: string;
  role: 'admin' | 'user';
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}
```

### WebSocket消息格式

```typescript
interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
  timestamp: string;
}

interface AccountDeletedEvent extends WebSocketMessage {
  type: 'account.deleted';
  data: {
    id: number;
  };
  timestamp: string;
}
```

### 客户端状态

```typescript
interface WebSocketState {
  connected: boolean;
  authenticated: boolean;
  reconnectAttempts: number;
  lastError?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 认证用户才能连接WebSocket

*For any* WebSocket连接请求，只有提供有效认证token的用户才能成功建立连接并接收事件。

**Validates: Requirements 2.1, 2.4**

### Property 2: 删除操作触发广播

*For any* 成功的账号删除操作，WebSocket服务必须广播一个 `account.deleted` 事件，且事件数据包含被删除账号的ID。

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 3: 事件接收触发UI更新

*For any* `account.deleted` 事件被Web客户端接收时，客户端必须从本地状态中移除对应账号并更新UI显示。

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 4: 删除失败不广播事件

*For any* 失败的账号删除操作，WebSocket服务不应该广播 `account.deleted` 事件。

**Validates: Requirements 1.4**

### Property 5: WebSocket自动重连

*For any* WebSocket连接断开事件（非手动断开），客户端应该在指定延迟后自动尝试重新连接，直到达到最大重试次数。

**Validates: Requirements 2.2**

### Property 6: 密码安全存储

*For any* 用户密码，系统必须使用bcrypt加密后存储，不得以明文形式保存。

**Validates: Security Requirements**

### Property 7: Token过期自动刷新

*For any* API请求返回401错误时，客户端应该自动使用refreshToken获取新的accessToken并重试请求。

**Validates: Requirements 2.4**

## Error Handling

### 1. WebSocket连接失败

**场景：** WebSocket无法建立连接

**处理：**
- 记录错误日志
- 显示连接状态为"未连接"
- 自动重试连接（最多5次）
- 降级到轮询模式（可选）

### 2. 认证失败

**场景：** WebSocket认证token无效或过期

**处理：**
- 方案A：允许匿名连接，不需要认证
- 方案B：自动刷新token并重新连接

### 3. 事件处理错误

**场景：** 处理WebSocket事件时发生异常

**处理：**
- 捕获异常并记录日志
- 不中断WebSocket连接
- 显示错误通知给用户

### 4. 账号删除API失败

**场景：** 删除账号API调用失败

**处理：**
- 不广播WebSocket事件
- 返回错误响应给客户端
- 记录详细错误日志

## Testing Strategy

### Unit Tests

**服务端测试：**
1. 测试WebSocket广播功能（认证和匿名客户端）
2. 测试账号删除路由是否正确调用广播
3. 测试删除失败时不广播事件

**客户端测试：**
1. 测试WebSocket连接初始化
2. 测试事件监听器注册
3. 测试接收到删除事件后的状态更新

### Property-Based Tests

**Property 1: 删除操作触发广播**
- 生成随机账号ID
- 模拟删除操作
- 验证WebSocket广播被调用且数据正确

**Property 2: 未认证客户端接收事件**
- 创建匿名WebSocket连接
- 触发账号删除事件
- 验证匿名客户端收到事件

**Property 3: 事件接收触发UI更新**
- 生成随机账号列表
- 模拟接收删除事件
- 验证账号从列表中移除

### Integration Tests

1. **端到端删除同步测试：**
   - 启动服务端和WebSocket服务
   - 连接两个客户端（Windows和Web）
   - 从一个客户端删除账号
   - 验证另一个客户端收到更新

2. **重连测试：**
   - 建立WebSocket连接
   - 模拟服务端断开
   - 验证客户端自动重连

3. **并发删除测试：**
   - 多个客户端同时删除不同账号
   - 验证所有客户端都收到所有删除事件

### Manual Testing

1. 打开网页端平台管理页面
2. 打开浏览器开发者工具，查看Console和Network标签
3. 使用Windows端删除一个账号
4. 验证：
   - 网页端Console显示"Account deleted"日志
   - 网页端显示"账号已被删除"通知
   - 账号从列表中消失（无需刷新）
   - WebSocket连接状态显示为"已连接"

## Implementation Notes

### 推荐方案

采用**统一认证系统方案**，理由：
1. **安全性高** - 所有通信都需要认证，适合云端部署
2. **统一管理** - Windows端和网页端使用相同的用户系统
3. **可扩展** - 未来可以添加用户权限管理、多租户等功能
4. **符合最佳实践** - 标准的JWT认证流程

### 实施步骤

1. **Phase 1: 用户系统**
   - 创建users表
   - 实现用户注册/登录API
   - 添加密码加密

2. **Phase 2: 网页端登录**
   - 创建登录页面
   - 添加路由守卫
   - 实现token管理

3. **Phase 3: WebSocket认证**
   - 确保WebSocket只接受已认证连接
   - 测试事件广播

4. **Phase 4: 生产部署**
   - 配置HTTPS/WSS
   - 设置Nginx反向代理
   - 测试云端环境

### 日志增强

在关键位置添加详细日志：

```typescript
// 服务端
console.log('[Auth] 用户登录:', { username, success: true });
console.log('[WebSocket] 客户端认证:', { userId, username });
console.log('[WebSocket] 广播事件:', { type, data, clientCount });

// 客户端
console.log('[Auth] 登录成功:', { username, tokenExpiry });
console.log('[WebSocket] 接收事件:', { type, data, timestamp });
console.log('[WebSocket] 连接状态:', { connected, authenticated });
```

### 性能考虑

- WebSocket心跳间隔：30秒
- 重连延迟：3秒 * 重试次数
- 最大重连次数：5次
- Token有效期：1小时
- RefreshToken有效期：7天
- 事件广播不阻塞API响应

### 安全考虑

1. **密码安全**
   - 使用bcrypt加密（saltRounds=10）
   - 不在日志中记录密码
   - 强制密码复杂度（可选）

2. **Token安全**
   - 使用HTTPS传输token
   - Token存储在localStorage（考虑使用httpOnly cookie更安全）
   - 定期刷新token
   - 登出时清除所有token

3. **WebSocket安全**
   - 只允许已认证用户连接
   - 使用WSS（WebSocket Secure）
   - 验证所有接收的消息格式
   - 限制连接数量（防止DDoS）

4. **数据安全**
   - 只广播必要的数据（账号ID，不包含凭证）
   - 验证用户权限（未来可扩展）
   - 记录所有敏感操作日志

### 环境变量配置

```env
# .env
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# 生产环境
NODE_ENV=production
API_URL=https://your-domain.com/api
WS_URL=wss://your-domain.com/ws
```
