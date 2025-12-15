# Requirements Document

## Introduction

本文档定义了为 GEO 优化系统创建双击启动程序的需求。该启动程序将允许用户通过双击一个文件来自动启动前端和后端服务，无需手动在终端中执行命令。

## Glossary

- **Launcher**: 启动程序，用户可以双击执行的脚本文件
- **System**: GEO 优化系统，包含前端（client）和后端（server）两个服务
- **Frontend Service**: 前端服务，运行在端口 5173 的 Vite 开发服务器
- **Backend Service**: 后端服务，运行在端口 3000 的 Node.js 服务器
- **macOS**: 用户当前使用的操作系统平台

## Requirements

### Requirement 1

**User Story:** 作为系统用户，我希望能够双击一个文件来启动整个系统，这样我就不需要手动在终端中输入命令。

#### Acceptance Criteria

1. WHEN 用户双击启动文件 THEN THE System SHALL 同时启动前端服务和后端服务
2. WHEN 启动程序执行 THEN THE System SHALL 在新的终端窗口中显示服务运行状态
3. WHEN 服务启动成功 THEN THE System SHALL 自动在默认浏览器中打开前端页面
4. WHEN 启动程序执行 THEN THE System SHALL 检查必要的依赖是否已安装
5. WHEN 依赖未安装 THEN THE System SHALL 显示错误提示并提供安装指引

### Requirement 2

**User Story:** 作为系统用户，我希望启动程序能够检测环境配置，这样我就能知道系统是否已正确配置。

#### Acceptance Criteria

1. WHEN 启动程序执行 THEN THE System SHALL 检查 .env 文件是否存在
2. WHEN .env 文件不存在 THEN THE System SHALL 从 .env.example 复制并提示用户配置
3. WHEN 启动程序执行 THEN THE System SHALL 检查 node_modules 目录是否存在
4. WHEN node_modules 不存在 THEN THE System SHALL 提示用户运行依赖安装命令
5. WHEN 环境配置检查失败 THEN THE System SHALL 显示具体的错误信息和解决方案

### Requirement 3

**User Story:** 作为系统用户，我希望启动程序能够优雅地处理错误，这样我就能了解问题所在并进行修复。

#### Acceptance Criteria

1. WHEN 端口已被占用 THEN THE System SHALL 显示端口占用提示和解决方案
2. WHEN 数据库连接失败 THEN THE System SHALL 显示数据库配置检查提示
3. WHEN 服务启动失败 THEN THE System SHALL 显示详细的错误日志
4. WHEN 用户关闭启动程序 THEN THE System SHALL 停止所有已启动的服务
5. IF 启动过程中发生错误 THEN THE System SHALL 保持终端窗口打开以便用户查看错误信息

### Requirement 4

**User Story:** 作为 macOS 用户，我希望启动程序是一个 .command 文件，这样我就可以直接双击执行。

#### Acceptance Criteria

1. THE System SHALL 提供一个 .command 格式的启动脚本文件
2. WHEN 用户首次使用 THEN THE System SHALL 提供设置可执行权限的说明
3. WHEN 启动脚本执行 THEN THE System SHALL 使用 bash shell 运行
4. WHEN 启动脚本执行 THEN THE System SHALL 在当前项目目录的上下文中运行
5. THE System SHALL 在启动脚本中包含清晰的注释说明各个步骤

### Requirement 5

**User Story:** 作为系统用户，我希望能够看到启动进度，这样我就知道系统正在启动而不是卡住了。

#### Acceptance Criteria

1. WHEN 启动程序执行 THEN THE System SHALL 显示当前执行的步骤
2. WHEN 检查环境配置时 THEN THE System SHALL 显示"正在检查环境配置..."
3. WHEN 启动服务时 THEN THE System SHALL 显示"正在启动前端服务..."和"正在启动后端服务..."
4. WHEN 服务启动成功 THEN THE System SHALL 显示"✓ 前端服务已启动"和"✓ 后端服务已启动"
5. WHEN 所有服务启动完成 THEN THE System SHALL 显示访问地址和使用说明

### Requirement 6

**User Story:** 作为系统用户，我希望启动程序能够提供停止服务的方式，这样我就可以优雅地关闭系统。

#### Acceptance Criteria

1. WHEN 启动程序运行时 THEN THE System SHALL 提供停止服务的说明
2. WHEN 用户按下 Ctrl+C THEN THE System SHALL 捕获信号并停止所有服务
3. WHEN 停止服务时 THEN THE System SHALL 显示"正在停止服务..."
4. WHEN 服务停止完成 THEN THE System SHALL 显示"服务已停止"并退出
5. WHEN 服务停止时 THEN THE System SHALL 清理所有子进程
