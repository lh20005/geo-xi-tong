# Design Document - Double Click Launcher

## Overview

本设计文档描述了为 GEO 优化系统创建双击启动程序的技术方案。该启动程序将是一个 macOS 兼容的 .command 脚本文件，用户双击后可以自动完成环境检查、服务启动、浏览器打开等一系列操作。

启动程序的核心目标是简化用户体验，将原本需要多个终端命令的启动流程整合为一个简单的双击操作。

## Architecture

### 系统架构

```
用户双击 start.command
    ↓
环境检查模块
    ├── 检查 Node.js
    ├── 检查 .env 文件
    └── 检查 node_modules
    ↓
服务启动模块
    ├── 启动后端服务 (port 3000)
    └── 启动前端服务 (port 5173)
    ↓
浏览器打开模块
    └── 打开 http://localhost:5173
    ↓
进程监控模块
    └── 监听 Ctrl+C 信号并清理进程
```

### 技术选型

- **脚本语言**: Bash Shell
- **文件格式**: .command (macOS 可双击执行)
- **进程管理**: 使用 npm 的 concurrently 包
- **浏览器打开**: 使用 macOS 的 open 命令

## Components and Interfaces

### 1. 环境检查模块 (Environment Checker)

**职责**: 检查运行环境是否满足启动条件

**功能**:
- 检查 Node.js 是否安装
- 检查 .env 文件是否存在
- 检查依赖是否已安装
- 提供友好的错误提示

**接口**:
```bash
check_node()      # 返回: 0=成功, 1=失败
check_env()       # 返回: 0=成功, 1=失败
check_deps()      # 返回: 0=成功, 1=失败
```

### 2. 服务启动模块 (Service Launcher)

**职责**: 启动前端和后端服务

**功能**:
- 使用 npm run dev 启动服务
- 捕获服务输出
- 检测服务启动状态
- 等待服务就绪

**接口**:
```bash
start_services()  # 启动所有服务
wait_for_ready()  # 等待服务就绪
```

### 3. 浏览器打开模块 (Browser Opener)

**职责**: 在服务就绪后打开浏览器

**功能**:
- 等待前端服务启动
- 使用 open 命令打开浏览器
- 处理打开失败的情况

**接口**:
```bash
open_browser()    # 打开浏览器
```

### 4. 进程管理模块 (Process Manager)

**职责**: 管理子进程的生命周期

**功能**:
- 捕获 SIGINT 信号 (Ctrl+C)
- 停止所有子进程
- 清理资源
- 显示停止状态

**接口**:
```bash
cleanup()         # 清理所有进程
trap_signals()    # 设置信号捕获
```

### 5. 日志输出模块 (Logger)

**职责**: 提供友好的日志输出

**功能**:
- 彩色输出
- 进度提示
- 错误高亮
- 成功标记

**接口**:
```bash
log_info()        # 信息日志
log_success()     # 成功日志
log_error()       # 错误日志
log_warning()     # 警告日志
```

## Data Models

### 环境配置数据

```typescript
interface EnvironmentConfig {
  nodeVersion: string;      // Node.js 版本
  hasEnvFile: boolean;      // .env 文件是否存在
  hasDependencies: boolean; // 依赖是否已安装
  projectRoot: string;      // 项目根目录
}
```

### 服务状态数据

```typescript
interface ServiceStatus {
  frontend: {
    running: boolean;       // 是否运行中
    port: number;          // 端口号
    pid: number;           // 进程ID
    url: string;           // 访问地址
  };
  backend: {
    running: boolean;
    port: number;
    pid: number;
    url: string;
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

经过属性反思，我们识别并消除了冗余属性，将相关的验收标准合并为更全面的属性：

### Property 1: 环境检查完整性
*For any* 启动执行，所有必要的环境检查（Node.js、.env 文件、node_modules 依赖）都必须在服务启动前按顺序完成，任何检查失败都必须阻止后续启动流程
**Validates: Requirements 1.4, 2.1, 2.3**

**测试方法**: 在不同的环境状态下运行脚本（缺少 Node.js、缺少 .env、缺少依赖），验证检查逻辑是否正确执行且阻止启动

### Property 2: 服务启动和浏览器打开顺序
*For any* 成功的启动执行，前端服务和后端服务必须同时启动，且浏览器打开必须在前端服务就绪后执行
**Validates: Requirements 1.1, 1.3**

**测试方法**: 执行脚本，验证两个服务的进程都在运行，端口都被监听，且浏览器在服务就绪后才打开

### Property 3: 错误信息完整性
*For any* 错误情况（端口占用、配置缺失、依赖缺失、数据库连接失败、服务启动失败），系统必须显示包含问题描述和解决方案的错误信息
**Validates: Requirements 1.5, 2.2, 2.4, 2.5, 3.1, 3.2, 3.3, 3.5**

**测试方法**: 触发各种错误场景，捕获输出并验证是否包含错误描述和解决方案，且终端保持打开状态

### Property 4: 进程清理完整性
*For any* 停止操作（用户按 Ctrl+C 或错误退出），所有已启动的子进程（前端、后端）必须被正确终止，不留遗留进程
**Validates: Requirements 3.4, 6.2, 6.5**

**测试方法**: 启动脚本，发送 SIGINT 信号，验证所有子进程是否被终止，检查端口是否被释放

### Property 5: 状态显示完整性
*For any* 启动执行，系统必须在每个关键步骤（环境检查、服务启动、浏览器打开、停止服务）显示清晰的状态信息，包括进度提示和成功/失败标记
**Validates: Requirements 1.2, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.3, 6.4**

**测试方法**: 捕获脚本输出，验证是否包含所有关键步骤的状态信息，且信息与实际执行状态一致

### Property 6: 工作目录正确性
*For any* 启动执行，脚本必须在项目根目录的上下文中运行，确保所有相对路径引用正确
**Validates: Requirements 4.4**

**测试方法**: 在脚本中验证当前工作目录是否包含 package.json、client 和 server 目录

## Error Handling

### 1. 环境检查错误

**Node.js 未安装**:
```
错误: 未检测到 Node.js
解决方案: 请访问 https://nodejs.org 下载并安装 Node.js 18+
```

**.env 文件缺失**:
```
警告: .env 文件不存在
操作: 已从 .env.example 复制模板
提示: 请编辑 .env 文件并配置必要的环境变量
```

**依赖未安装**:
```
错误: 依赖未安装
解决方案: 请运行 npm run install:all 安装依赖
```

### 2. 服务启动错误

**端口被占用**:
```
错误: 端口 3000 或 5173 已被占用
解决方案:
  1. 查找占用进程: lsof -i :3000
  2. 终止进程: kill -9 <PID>
  3. 或修改 .env 中的端口配置
```

**数据库连接失败**:
```
错误: 无法连接到数据库
检查项:
  1. PostgreSQL 是否已启动
  2. .env 中的 DATABASE_URL 是否正确
  3. 数据库是否已创建
```

### 3. 运行时错误

**服务崩溃**:
- 保持终端窗口打开
- 显示完整的错误堆栈
- 提供重启建议

**用户中断**:
- 捕获 SIGINT 信号
- 优雅停止所有服务
- 显示停止确认信息

## Testing Strategy

### Unit Testing

本项目将使用 **Bash 脚本测试** 和 **手动测试** 相结合的方式。

**测试工具**: 
- 手动测试（主要方式）
- Bash 脚本模拟测试

**测试范围**:
1. 环境检查函数的各种场景
2. 错误处理逻辑
3. 日志输出格式
4. 信号捕获和清理

**测试示例**:
```bash
# 测试 Node.js 检查
test_check_node() {
  # 模拟 Node.js 不存在
  PATH="" check_node
  assert_equals $? 1
  
  # 正常情况
  check_node
  assert_equals $? 0
}
```

### Property-Based Testing

由于这是一个 Bash 脚本项目，我们将使用 **手动场景测试** 来验证属性。

**测试框架**: 手动测试 + 测试脚本

**测试配置**: 每个场景至少测试 3 次以确保稳定性

**测试方法**:
- 创建测试脚本模拟各种环境状态
- 验证启动程序在不同条件下的行为
- 确保所有属性在各种输入下都成立

**属性测试标记格式**: 
```bash
# Feature: double-click-launcher, Property 1: 环境检查完整性
```

### Integration Testing

**测试场景**:
1. 全新环境启动（无 .env，无依赖）
2. 正常环境启动（已配置）
3. 端口冲突场景
4. 用户中断场景
5. 服务崩溃场景

**测试步骤**:
1. 准备测试环境
2. 执行启动脚本
3. 验证服务状态
4. 验证浏览器打开
5. 测试停止功能
6. 验证进程清理

## Implementation Details

### 脚本结构

```bash
#!/bin/bash

# ============================================
# GEO 优化系统 - 启动脚本
# ============================================

# 1. 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 2. 日志函数
log_info() { ... }
log_success() { ... }
log_error() { ... }

# 3. 环境检查
check_node() { ... }
check_env() { ... }
check_deps() { ... }

# 4. 服务启动
start_services() { ... }
wait_for_ready() { ... }
open_browser() { ... }

# 5. 进程管理
cleanup() { ... }
trap cleanup SIGINT SIGTERM

# 6. 主流程
main() {
  log_info "正在启动 GEO 优化系统..."
  
  check_node || exit 1
  check_env || exit 1
  check_deps || exit 1
  
  start_services
  wait_for_ready
  open_browser
  
  log_success "系统启动成功！"
  log_info "按 Ctrl+C 停止服务"
  
  wait
}

main
```

### 关键实现细节

**1. 进程管理**:
```bash
# 使用 npm run dev 启动（已配置 concurrently）
npm run dev &
SERVICE_PID=$!

# 清理函数
cleanup() {
  log_info "正在停止服务..."
  kill -TERM $SERVICE_PID 2>/dev/null
  wait $SERVICE_PID 2>/dev/null
  log_success "服务已停止"
  exit 0
}
```

**2. 服务就绪检测**:
```bash
wait_for_ready() {
  log_info "等待服务启动..."
  
  # 等待后端就绪
  for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null; then
      log_success "✓ 后端服务已启动"
      break
    fi
    sleep 1
  done
  
  # 等待前端就绪
  for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null; then
      log_success "✓ 前端服务已启动"
      break
    fi
    sleep 1
  done
}
```

**3. 浏览器打开**:
```bash
open_browser() {
  sleep 2  # 额外等待确保页面可访问
  open http://localhost:5173
  log_success "✓ 浏览器已打开"
}
```

### 文件权限设置

用户首次使用需要设置可执行权限：
```bash
chmod +x start.command
```

可以在 README 中提供说明，或在脚本中检测权限并提示。

## Deployment Considerations

### 文件位置

启动脚本应放置在项目根目录：
```
geo-optimization-system/
├── start.command          # 启动脚本
├── README.md
├── package.json
├── client/
└── server/
```

### 用户指引

在 README.md 中添加使用说明：

```markdown
## 快速启动

### macOS 用户

1. 首次使用，设置可执行权限：
   ```bash
   chmod +x start.command
   ```

2. 双击 `start.command` 文件启动系统

3. 系统会自动：
   - 检查环境配置
   - 启动前后端服务
   - 打开浏览器

4. 按 `Ctrl+C` 停止服务
```

### 兼容性说明

- **macOS**: 完全支持，.command 文件可直接双击
- **Linux**: 可以使用，但需要手动执行 `./start.command`
- **Windows**: 不支持，建议使用 `npm run dev` 或创建 .bat 文件

## Future Enhancements

1. **Windows 支持**: 创建 start.bat 脚本
2. **Linux 桌面快捷方式**: 创建 .desktop 文件
3. **健康检查**: 定期检查服务状态
4. **日志文件**: 将输出保存到日志文件
5. **配置向导**: 首次启动时引导用户配置
6. **自动更新检查**: 检查依赖更新
7. **开发/生产模式切换**: 支持不同的启动模式
