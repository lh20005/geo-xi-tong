# Bug 修复工作流规则

## 服务器数据库/迁移问题修复流程

当发现服务器上因迁移问题导致的数据库错误时，必须按以下顺序处理：

### 1. 先修复服务器问题
- 直接在服务器数据库上执行修复 SQL
- 确保服务器功能恢复正常
- 验证修复是否生效

### 2. 修改本地迁移文件
- 找到导致问题的原始迁移文件
- 修改该迁移文件，使其包含正确的逻辑
- **不要创建新的修复迁移文件**（除非是新功能）

### 3. 清理临时文件
- 如果创建了临时修复迁移文件，在修改原始文件后删除它
- 保持迁移文件的整洁

## 原因

- 避免下次全新部署时重复出现同样的问题
- 保持迁移历史的简洁性
- 确保新环境部署时能一次性正确执行

## 示例

错误做法：
```
发现问题 → 创建 058_fix_xxx.sql → 部署修复
```

正确做法：
```
发现问题 → 服务器直接修复 → 修改原始迁移文件（如 031_xxx.sql）→ 删除临时修复文件
```

## 注意事项

- 修改已执行的迁移文件不会影响已部署的服务器（因为迁移只执行一次）
- 但会确保新环境部署时使用正确的逻辑
- 如果是代码与数据库函数签名不匹配的问题，需要同时检查代码调用方式

---

## Windows 端修复流程（强制）⭐

### 修改 Windows 端代码后必须编译

**Windows 端使用 TypeScript + Electron，修改源代码后必须编译才能生效！**

#### 需要编译的文件类型

修改以下任何文件后都必须重新编译：

1. **Electron 主进程代码**
   - `windows-login-manager/electron/**/*.ts`
   - 包括：services、ipc/handlers、database、adapters 等

2. **Preload 脚本**
   - `windows-login-manager/electron/preload/**/*.ts`

3. **前端 React 代码**（开发模式下自动热更新，生产构建需要编译）
   - `windows-login-manager/src/**/*.tsx`
   - `windows-login-manager/src/**/*.ts`

#### 编译命令

```bash
# 仅编译 Electron 主进程和 Preload（最常用）
cd windows-login-manager
npm run build:electron

# 完整构建（包括前端）
cd windows-login-manager
npm run build
```

#### 编译输出目录

- Electron 主进程：`windows-login-manager/dist-electron/`
- 前端代码：`windows-login-manager/dist/`

#### 验证编译结果

```bash
# 检查编译后的文件是否包含修改
cd windows-login-manager
grep -n "关键字" dist-electron/path/to/file.js
```

### 完整修复流程示例

**Windows 端 Bug 修复标准流程**：

```
1. 发现问题
   ↓
2. 修改源代码（.ts 或 .tsx 文件）
   ↓
3. 编译代码 ⭐ 必须执行
   cd windows-login-manager
   npm run build:electron
   ↓
4. 验证编译结果
   grep -n "修改内容" dist-electron/xxx.js
   ↓
5. 测试修复
   npm run dev
   ↓
6. 创建修复文档
```

### 常见错误

❌ **错误做法**：
```
修改 electron/services/ImageService.ts
→ 直接运行 npm run dev
→ 修改未生效（因为运行的是旧的编译文件）
```

✅ **正确做法**：
```
修改 electron/services/ImageService.ts
→ npm run build:electron（编译）
→ npm run dev（运行）
→ 修改生效
```

### 开发模式说明

- **前端代码**：`npm run dev` 会启动 Vite 开发服务器，支持热更新
- **Electron 主进程**：必须手动编译，不支持热更新
- **IPC Handlers**：必须手动编译，不支持热更新
- **Services**：必须手动编译，不支持热更新

### 快速检查清单

修改 Windows 端代码后，必须确认：

- [ ] 已执行 `npm run build:electron`
- [ ] 编译成功（无错误）
- [ ] 验证编译后的文件包含修改
- [ ] 重启应用测试修复

---

## 服务器端修复流程

### 修改服务器端代码后必须编译和部署

**服务器端使用 TypeScript，修改源代码后必须编译并部署！**

#### 编译命令

```bash
# 编译服务器端代码
cd server
npm run build
```

#### 部署命令

```bash
# 上传编译后的文件到服务器
scp -i "私钥路径" server/dist/services/XXX.js ubuntu@124.221.247.107:/var/www/geo-system/server/services/

# 重启服务
ssh -i "私钥路径" ubuntu@124.221.247.107 "pm2 restart geo-server"
```

#### 完整服务器修复流程

```
1. 发现问题
   ↓
2. 修改源代码（server/src/**/*.ts）
   ↓
3. 编译代码
   cd server && npm run build
   ↓
4. 部署到服务器
   scp dist/xxx.js ubuntu@server:/var/www/geo-system/server/xxx/
   ↓
5. 重启服务
   ssh ubuntu@server "pm2 restart geo-server"
   ↓
6. 验证修复
   ssh ubuntu@server "pm2 logs geo-server --lines 50"
```

---

## 总结

### 关键原则

1. **服务器数据库问题**：先修复服务器 → 再修改迁移文件
2. **Windows 端代码修改**：必须编译 → 验证 → 测试
3. **服务器端代码修改**：必须编译 → 部署 → 重启 → 验证
4. **不要创建临时修复文件**：直接修改原始文件
5. **保持迁移历史整洁**：删除临时文件

### 记住

- ⚠️ TypeScript 代码修改后不会自动生效
- ⚠️ 必须手动编译才能看到修改效果
- ⚠️ Electron 主进程不支持热更新
- ⚠️ 编译后验证文件内容是否正确
