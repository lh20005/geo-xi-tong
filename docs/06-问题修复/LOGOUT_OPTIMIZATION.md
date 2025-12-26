# 退出登录优化说明

## 📋 优化内容

### 0. 端口配置说明

**实际端口配置：**
- Landing 网站: `http://localhost:8080`
- Client 应用: `http://localhost:5173`
- Server API: `http://localhost:3000`

### 1. 统一环境配置

#### Client 应用 (`client/src/config/env.ts`)
- ✅ 新增 `landingUrl` 配置项
- ✅ 支持通过 `VITE_LANDING_URL` 环境变量配置
- ✅ 开发环境默认: `http://localhost:8080`
- ✅ 生产环境默认: `https://your-domain.com`

#### Landing 应用 (`landing/src/config/env.ts`)
- ✅ 新建配置文件
- ✅ 新增 `clientUrl` 配置项
- ✅ 支持通过 `VITE_CLIENT_URL` 环境变量配置
- ✅ 开发环境默认: `http://localhost:5173`
- ✅ 生产环境默认: `https://app.your-domain.com`

### 2. 优化退出体验

#### Client 应用退出流程
1. 点击"退出登录"按钮
2. 弹出确认对话框（避免误操作）
3. 确认后清除所有认证信息
4. 显示"已退出登录"提示
5. 延迟 500ms 后跳转到 Landing 首页

#### Landing 应用登录流程
1. 输入用户名密码
2. 提交登录请求
3. 登录成功后显示成功提示（带动画）
4. 延迟 800ms 后跳转到 Client 应用
5. 统一使用 `auth_token`、`refresh_token`、`user_info` 作为 localStorage key

### 3. 视觉优化

#### Landing 登录页面
- ✅ 错误提示带图标
- ✅ 成功提示带图标和动画
- ✅ 登录按钮加载状态带旋转动画
- ✅ 按钮交互效果（hover、active）

#### Client 退出功能
- ✅ 确认对话框防止误操作
- ✅ 成功提示消息
- ✅ 平滑的跳转体验

## 🚀 快速启动

### 启动所有服务

```bash
# 1. 启动后端服务（已启动）
cd server && npm run dev

# 2. 启动客户端应用（已启动）
cd client && npm run dev

# 3. 启动 Landing 网站（已启动）
cd landing && npm run dev
```

### 访问地址
- **Landing 网站**: http://localhost:8080
- **Client 应用**: http://localhost:5173
- **Server API**: http://localhost:3000

## 🔧 环境变量配置

### 开发环境
无需配置，使用默认值即可。

### 生产环境

#### Client 应用 (`.env`)
```bash
VITE_API_URL=https://your-domain.com/api
VITE_WS_URL=wss://your-domain.com/ws
VITE_LANDING_URL=https://your-domain.com
```

#### Landing 应用 (`.env`)
```bash
VITE_API_URL=https://your-domain.com/api
VITE_CLIENT_URL=https://app.your-domain.com
```

## 🎯 最佳实践参考

### 业界标准
- **Notion**: 退出后回到 notion.so 首页
- **Figma**: 退出后回到 figma.com 首页
- **Linear**: 退出后回到 linear.app 首页
- **Slack**: 退出后回到 slack.com 首页

### 为什么跳转到 Landing 首页？
1. ✅ **用户体验连贯** - 用户可能想重新登录或浏览其他内容
2. ✅ **避免空白页面** - 不会让用户看到浏览器空白页
3. ✅ **营销机会** - 继续展示产品价值，吸引用户再次登录
4. ✅ **符合 Web 应用习惯** - 大多数 SaaS 产品都采用这种方式

## 📝 技术细节

### localStorage Key 统一
- `auth_token` - 访问令牌
- `refresh_token` - 刷新令牌
- `user_info` - 用户信息（JSON 字符串）

### 跳转延迟说明
- **登录成功**: 800ms 延迟，让用户看到成功提示
- **退出登录**: 500ms 延迟，让用户看到退出提示

### 错误处理
- 网络错误显示友好提示
- 登录失败显示服务器返回的错误信息
- 所有错误都有视觉反馈（图标 + 颜色）

## 🚀 测试建议

### 测试场景
1. ✅ 在 Client 应用点击退出，确认跳转到 Landing 首页
2. ✅ 在 Landing 页面登录，确认跳转到 Client 应用
3. ✅ 退出时点击"取消"，确认不会退出
4. ✅ 登录失败时显示错误提示
5. ✅ 登录成功时显示成功提示

### 环境测试
1. ✅ 开发环境（默认配置）
2. ✅ 生产环境（自定义域名）
3. ✅ 跨域场景（不同域名）

## 📦 文件变更清单

### 新增文件
- `landing/src/config/env.ts` - Landing 环境配置
- `landing/.env.example` - Landing 环境变量示例
- `LOGOUT_OPTIMIZATION.md` - 本文档

### 修改文件
- `client/src/config/env.ts` - 新增 landingUrl 配置
- `client/src/components/Layout/Header.tsx` - 优化退出逻辑
- `client/.env.example` - 新增 VITE_LANDING_URL 说明
- `landing/src/pages/LoginPage.tsx` - 优化登录体验

## 🎨 用户体验提升

### 退出流程
```
用户点击退出 
  ↓
确认对话框（防误操作）
  ↓
清除认证信息
  ↓
显示成功提示
  ↓
跳转到 Landing 首页（营销机会）
```

### 登录流程
```
用户输入账号密码
  ↓
提交登录请求
  ↓
显示加载动画
  ↓
登录成功提示（带图标）
  ↓
跳转到 Client 应用
```

## ✨ 优化亮点

1. **环境配置统一** - 通过环境变量灵活配置不同环境
2. **用户体验优化** - 确认对话框、成功提示、加载动画
3. **视觉反馈完善** - 所有操作都有明确的视觉反馈
4. **符合业界标准** - 参考主流 SaaS 产品的最佳实践
5. **代码可维护性** - 配置集中管理，易于修改和扩展
