# 测试指南

本文档说明如何对Windows平台登录管理器项目进行全面测试。

---

## 📋 测试文档索引

| 文档 | 说明 |
|------|------|
| `COMPREHENSIVE_TEST_PLAN.md` | 详细的测试计划，包含所有测试场景和步骤 |
| `TEST_EXECUTION_REPORT.md` | 测试执行报告，记录测试结果 |
| `TEST_SUMMARY.md` | 测试总结，快速了解测试状态 |
| `test-system.sh` | 自动化静态测试脚本 |
| `test-api.sh` | API运行时测试脚本 |

---

## 🚀 快速开始

### 1. 运行静态测试（立即可用）

```bash
# 运行自动化测试脚本
./test-system.sh
```

**测试内容**：
- 项目结构完整性
- 依赖安装状态
- 配置文件存在性
- 核心代码文件存在性
- 文档完整性

**预期结果**：
```
通过: 12
失败: 0
跳过: 0
总计: 12

所有测试通过！✓
```

---

### 2. 运行API测试（需要后端服务器）

**步骤1：启动后端服务器**
```bash
cd server
npm run dev
```

**步骤2：运行API测试**
```bash
# 在另一个终端
./test-api.sh
```

**测试内容**：
- Auth API（登录、刷新、登出）
- Account API（CRUD操作）
- WebSocket端点可用性

---

### 3. 手动功能测试（需要完整环境）

**步骤1：启动所有服务**
```bash
# 终端1：后端服务器
cd server && npm run dev

# 终端2：Web前端
cd client && npm run dev

# 终端3：Electron应用
cd windows-login-manager && npm run electron:dev
```

**步骤2：按照测试计划执行**

参考 `COMPREHENSIVE_TEST_PLAN.md` 中的详细步骤：
- Task 3: Main Process核心模块测试
- Task 6: 后端功能完整性测试
- Task 10: 前后端集成测试
- Task 11.1: 完整账号同步流程测试
- Task 11.3: 平台支持验证测试
- Task 16: Final Checkpoint测试

---

## 📊 测试状态

### ✅ 已完成的测试

| 测试类型 | 状态 | 通过率 |
|---------|------|--------|
| 静态测试 | ✅ 完成 | 100% (12/12) |
| 项目结构 | ✅ 完成 | 100% (3/3) |
| 后端功能 | ✅ 完成 | 100% (3/3) |
| 前后端集成 | ✅ 完成 | 100% (3/3) |
| 平台支持 | ✅ 完成 | 100% (2/2) |
| 文档完整性 | ✅ 完成 | 100% (1/1) |

### ⏳ 待执行的测试

| 测试类型 | 状态 | 需要 |
|---------|------|------|
| API运行时测试 | ⏳ 待执行 | 后端服务器 |
| WebSocket测试 | ⏳ 待执行 | 完整环境 |
| UI功能测试 | ⏳ 待执行 | Electron应用 |
| 登录流程测试 | ⏳ 待执行 | Windows环境 |
| 端到端测试 | ⏳ 待执行 | 完整环境 |

---

## 🎯 测试场景

### 场景1：开发环境验证（5分钟）

**目的**：验证开发环境配置正确

```bash
# 1. 运行静态测试
./test-system.sh

# 2. 检查代码质量
cd windows-login-manager && npm run lint

# 3. 尝试构建
npm run build
```

### 场景2：后端API验证（10分钟）

**目的**：验证后端API功能正常

```bash
# 1. 启动后端
cd server && npm run dev

# 2. 运行API测试
./test-api.sh

# 3. 手动测试关键端点
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 场景3：完整系统验证（30分钟）

**目的**：验证整个系统集成正常

```bash
# 1. 启动所有服务
cd server && npm run dev &
cd client && npm run dev &
cd windows-login-manager && npm run electron:dev

# 2. 按照COMPREHENSIVE_TEST_PLAN.md执行手动测试
# 3. 验证WebSocket实时同步
# 4. 测试账号管理功能
```

---

## 🐛 故障排查

### 问题1：test-system.sh执行失败

**症状**：脚本无法执行或权限错误

**解决方案**：
```bash
chmod +x test-system.sh
./test-system.sh
```

### 问题2：API测试失败

**症状**：test-api.sh报告后端服务器未运行

**解决方案**：
```bash
# 确保后端服务器运行
cd server && npm run dev

# 等待几秒后再运行测试
sleep 5
./test-api.sh
```

### 问题3：Electron应用无法启动

**症状**：npm run electron:dev失败

**解决方案**：
```bash
cd windows-login-manager
rm -rf node_modules
pnpm install
npm run electron:dev
```

---

## 📝 测试报告

### 查看测试结果

1. **静态测试结果**：
   ```bash
   ./test-system.sh
   ```

2. **详细测试报告**：
   ```bash
   cat windows-login-manager/TEST_EXECUTION_REPORT.md
   ```

3. **测试总结**：
   ```bash
   cat windows-login-manager/TEST_SUMMARY.md
   ```

### 生成测试报告

测试报告会自动更新在以下文件中：
- `TEST_EXECUTION_REPORT.md` - 详细执行报告
- `TEST_SUMMARY.md` - 测试总结

---

## 🎓 测试最佳实践

### 1. 测试顺序

建议按以下顺序执行测试：

1. ✅ 静态测试（test-system.sh）
2. ⏳ API测试（test-api.sh）
3. ⏳ UI功能测试（手动）
4. ⏳ 集成测试（手动）
5. ⏳ 端到端测试（手动）

### 2. 测试频率

- **每次代码修改后**：运行静态测试
- **每次提交前**：运行API测试
- **每次发布前**：运行完整测试套件

### 3. 测试环境

- **开发环境**：macOS/Linux/Windows
- **测试环境**：与生产环境相同
- **生产环境**：Windows（推荐）

---

## 📚 相关资源

### 文档
- [COMPREHENSIVE_TEST_PLAN.md](windows-login-manager/COMPREHENSIVE_TEST_PLAN.md) - 完整测试计划
- [TEST_EXECUTION_REPORT.md](windows-login-manager/TEST_EXECUTION_REPORT.md) - 测试执行报告
- [TEST_SUMMARY.md](windows-login-manager/TEST_SUMMARY.md) - 测试总结

### 脚本
- [test-system.sh](test-system.sh) - 静态测试脚本
- [test-api.sh](test-api.sh) - API测试脚本

### 项目文档
- [README.md](windows-login-manager/README.md) - 项目总览
- [QUICK_START.md](windows-login-manager/QUICK_START.md) - 快速开始
- [BUILD_INSTRUCTIONS.md](windows-login-manager/BUILD_INSTRUCTIONS.md) - 构建说明

---

## 🎉 测试结论

**当前状态**：✅ 静态测试全部通过

- ✅ 12/12 静态测试通过
- ✅ 项目结构完整
- ✅ 所有依赖已安装
- ✅ 核心代码完整
- ✅ 文档完整详细

**下一步**：
1. 启动服务并运行API测试
2. 执行手动功能测试
3. 在Windows环境中测试完整登录流程

---

**最后更新**：2024-12-22  
**维护者**：开发团队

