# 端口和路径修复总结

## 问题描述
Electron 应用出现 `EntryNotFound (FileSystemError)` 错误，可能与端口配置和文件路径引用有关。

## 修复内容

### 1. 端口配置统一
- **Vite 开发服务器端口**: `5173` (vite.config.ts)
- **Electron 加载 URL**: `http://localhost:5173` (electron/main.ts)
- **npm 脚本**: 等待 `http://localhost:5173` (package.json)

✅ 所有端口配置已统一为 `5173`

### 2. Preload 路径验证
**当前配置（正确）:**
```typescript
preload: path.join(__dirname, 'preload.js'),
```

**运行时路径解析:**
- 运行 `electron dist-electron/main.js` 时
- `__dirname` = `dist-electron/`
- `preload.js` 位于 `dist-electron/preload.js`
- 因此 `path.join(__dirname, 'preload.js')` 是正确的

✅ Preload 路径配置正确

### 3. 可能的问题原因
如果仍然出现 `EntryNotFound` 错误，可能是：
1. **旧进程占用端口** - 需要杀死占用 5173 的进程
2. **编译未完成** - 需要运行 `npm run build:electron`
3. **缓存问题** - 需要清理 node_modules 或重启编辑器

## 配置检查清单

- ✅ vite.config.ts: `server.port: 5173`
- ✅ electron/main.ts: `loadURL('http://localhost:5173')`
- ✅ electron/main.ts: `preload: path.join(__dirname, '../dist-electron/preload.js')`
- ✅ package.json: `electron:dev` 脚本等待正确的端口
- ✅ dist-electron/main.js: 编译后的路径已更新

## 启动应用

```bash
# 开发模式
npm run electron:dev

# 或分别运行
npm run build:electron  # 编译 Electron 代码
npm run dev             # 启动 Vite 开发服务器
# 然后在另一个终端运行
NODE_ENV=development electron dist-electron/main.js
```

## 预期结果
- Electron 应用正确加载 Vite 开发服务器
- Preload 脚本正确加载，IPC 通信正常
- 不再出现 `EntryNotFound` 错误
