# Source Map 安全说明

## ❓ 什么是 Source Map

Source Map 是一个映射文件，用于将压缩/混淆后的代码还原为原始源代码。

### 示例

**原始代码（src/App.tsx）：**
```typescript
function calculatePrice(basePrice: number, discount: number) {
  const finalPrice = basePrice * (1 - discount);
  console.log('Calculating price:', basePrice, discount);
  return finalPrice;
}
```

**编译后的代码（dist/assets/index-abc123.js）：**
```javascript
function a(b,c){const d=b*(1-c);return console.log("Calculating price:",b,c),d}
```

**Source Map 文件（dist/assets/index-abc123.js.map）：**
```json
{
  "version": 3,
  "sources": ["../../src/App.tsx"],
  "sourcesContent": ["function calculatePrice(basePrice: number, discount: number) {\n  const finalPrice = basePrice * (1 - discount);\n  console.log('Calculating price:', basePrice, discount);\n  return finalPrice;\n}"],
  "mappings": "AAAA,SAASA,eAAeC,EAAWC,GAC/B,MAAMC,EAAaF,GAAY,EAAIC,GAEnC,OADAC,QAAQC,IAAI,oBAAqBH,EAAWC,GACrCC"
}
```

**关键点：** `sourcesContent` 字段包含了**完整的原始源代码**！

## 🔴 为什么必须禁用

### 1. 暴露完整源代码

如果启用 Source Map，攻击者可以：

```bash
# 1. 访问你的网站
https://your-domain.com

# 2. 打开浏览器开发者工具，查看加载的文件
# 发现：index-abc123.js.map

# 3. 直接下载 Source Map
curl https://your-domain.com/assets/index-abc123.js.map > source.map

# 4. 使用工具还原源代码
npm install -g source-map-explorer
source-map-explorer source.map

# 5. 获得完整的 TypeScript/React 源代码！
```

### 2. 暴露的信息

通过 Source Map，攻击者可以看到：

- ✅ **完整的源代码**（包括注释）
- ✅ **文件结构**（目录组织）
- ✅ **变量名**（原始命名）
- ✅ **函数逻辑**（业务逻辑）
- ✅ **API 接口**（所有调用）
- ✅ **算法实现**（核心代码）

### 3. 实际案例

**启用 Source Map 的风险：**

```typescript
// src/utils/payment.ts
export function calculateDiscount(userId: number, amount: number) {
  // VIP 用户享受 20% 折扣
  if (userId === 1) {
    return amount * 0.8;
  }
  
  // 内部测试账号，免费
  if (userId === 999) {
    return 0;
  }
  
  return amount;
}
```

**如果有 Source Map：**
- 攻击者可以看到完整代码
- 发现 `userId === 999` 可以免费
- 注册账号并修改 userId 为 999
- 免费使用服务！

**如果没有 Source Map：**
```javascript
// 编译后的代码（混淆）
function a(b,c){return 1===b?0.8*c:999===b?0:c}
```
- 攻击者很难理解逻辑
- 即使理解了，也不知道具体的判断条件

## ✅ 如何禁用 Source Map

### 方法 1：修改 vite.config.ts（推荐）

```typescript
// client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,  // ← 关键：禁用 Source Map
    
    // 额外的安全配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

### 方法 2：环境变量控制

```typescript
// client/vite.config.ts
export default defineConfig({
  build: {
    // 开发环境启用，生产环境禁用
    sourcemap: process.env.NODE_ENV !== 'production'
  }
});
```

### 方法 3：构建命令参数

```bash
# package.json
{
  "scripts": {
    "build": "vite build --sourcemap=false"
  }
}
```

## 🔍 验证是否禁用

### 1. 检查构建产物

```bash
# 编译前端
cd client
npm run build

# 检查 dist 目录
ls -la dist/assets/

# 应该只有 .js 和 .css 文件
# 不应该有 .js.map 或 .css.map 文件
```

**正确的输出：**
```
index-abc123.js
index-abc123.css
logo-def456.png
```

**错误的输出（有 Source Map）：**
```
index-abc123.js
index-abc123.js.map  ← 危险！
index-abc123.css
index-abc123.css.map ← 危险！
```

### 2. 检查部署后的网站

```bash
# 访问你的网站
curl https://your-domain.com

# 查看 HTML 源代码，找到 JS 文件路径
# 例如：/assets/index-abc123.js

# 尝试访问 Source Map
curl -I https://your-domain.com/assets/index-abc123.js.map

# 应该返回 404 Not Found
```

### 3. 浏览器开发者工具检查

1. 打开你的网站
2. 按 F12 打开开发者工具
3. 切换到 "Sources" 或 "源代码" 标签
4. 查看左侧文件列表

**正确（无 Source Map）：**
```
your-domain.com
  └── assets
      ├── index-abc123.js  (混淆后的代码)
      └── index-abc123.css
```

**错误（有 Source Map）：**
```
your-domain.com
  └── assets
      ├── index-abc123.js
      └── webpack://
          └── src/          ← 危险！可以看到源代码
              ├── App.tsx
              ├── main.tsx
              └── ...
```

## 📊 编译后部署 vs Docker 部署

### 两者都需要禁用 Source Map！

| 部署方式 | 是否需要禁用 | 原因 |
|---------|------------|------|
| 编译后部署 | ✅ 必须 | 前端代码会发送到浏览器 |
| Docker 部署 | ✅ 必须 | 前端代码会发送到浏览器 |
| 开发环境 | ❌ 不需要 | 方便调试 |

**关键点：** 无论后端如何部署，前端代码都会被发送到用户浏览器，所以必须禁用 Source Map。

## 🎯 完整的安全配置

### client/vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  
  build: {
    // ========== 安全配置 ==========
    
    // 1. 禁用 Source Map（最重要！）
    sourcemap: false,
    
    // 2. 代码混淆
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,      // 删除 console.log
        drop_debugger: true,     // 删除 debugger
        pure_funcs: [            // 删除指定函数
          'console.log',
          'console.info',
          'console.debug'
        ]
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false          // 删除注释
      }
    },
    
    // 3. 分块策略（可选，提高加载速度）
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd', '@ant-design/icons']
        }
      }
    },
    
    // 4. 资源内联阈值（可选）
    assetsInlineLimit: 4096,
    
    // 5. CSS 代码分割（可选）
    cssCodeSplit: true
  }
});
```

## 🧪 测试清单

### 部署前测试

```bash
# 1. 清理旧的构建产物
rm -rf client/dist

# 2. 构建生产版本
cd client
npm run build

# 3. 检查是否有 .map 文件
find dist -name "*.map"
# 应该输出：空（没有任何 .map 文件）

# 4. 检查文件大小（混淆后应该更小）
du -sh dist/assets/*.js

# 5. 尝试查看源代码（应该是混淆的）
cat dist/assets/index-*.js | head -20
```

### 部署后测试

```bash
# 1. 尝试访问 Source Map
curl -I https://your-domain.com/assets/index-abc123.js.map
# 应该返回：404 Not Found

# 2. 检查 JS 文件内容
curl https://your-domain.com/assets/index-abc123.js | head -20
# 应该看到混淆后的代码，不是原始代码

# 3. 检查是否有 sourceMappingURL 注释
curl https://your-domain.com/assets/index-abc123.js | grep sourceMappingURL
# 应该输出：空（没有这个注释）
```

### 浏览器测试

1. 打开网站
2. F12 打开开发者工具
3. 切换到 "Sources" 标签
4. 查看 JS 文件内容
5. 应该看到混淆后的代码，不是原始的 TypeScript

## ⚠️ 常见错误

### 错误 1：只在生产环境禁用

```typescript
// ❌ 错误：容易忘记设置环境变量
export default defineConfig({
  build: {
    sourcemap: process.env.NODE_ENV !== 'production'
  }
});

// ✅ 正确：明确禁用
export default defineConfig({
  build: {
    sourcemap: false
  }
});
```

### 错误 2：忘记删除旧的 .map 文件

```bash
# 如果之前构建过启用 Source Map 的版本
# 旧的 .map 文件可能还在服务器上

# 解决方法：清理旧文件
ssh user@server
rm -f /var/www/app/client/dist/assets/*.map
```

### 错误 3：Nginx 没有禁止访问 .map 文件

```nginx
# 即使没有生成 .map 文件，也应该在 Nginx 中禁止访问
location ~ \.map$ {
    deny all;
    return 404;
}
```

## 📝 总结

### 关键要点

1. **必须禁用** - 无论哪种部署方式
2. **前端代码会暴露** - 但可以混淆
3. **Source Map 会暴露完整源代码** - 包括注释和逻辑
4. **简单配置** - 只需要一行：`sourcemap: false`
5. **必须验证** - 部署后检查是否真的禁用了

### 安全等级

| 配置 | 安全等级 | 说明 |
|------|---------|------|
| 启用 Source Map | 🔴 危险 | 完整源代码暴露 |
| 禁用 Source Map，无混淆 | 🟡 中等 | 代码可读性较高 |
| 禁用 Source Map + 混淆 | 🟢 安全 | 推荐配置 |
| 禁用 Source Map + 混淆 + 删除 console | 🟢 很安全 | 最佳配置 |

### 立即行动

```bash
# 1. 修改配置
vim client/vite.config.ts
# 添加：sourcemap: false

# 2. 重新构建
cd client
npm run build

# 3. 验证
find dist -name "*.map"
# 应该没有输出

# 4. 部署
# ... 按照你选择的部署方式
```

**记住：Source Map 是开发工具，不是生产工具！**
