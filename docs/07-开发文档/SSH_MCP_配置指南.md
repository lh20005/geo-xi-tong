# SSH MCP 配置指南

## 概述

SSH MCP (Model Context Protocol) 允许 AI 助手通过 SSH 连接远程服务器，执行命令、读写文件、搜索代码等操作。

本文档详细说明如何在不同 IDE 中配置 SSH MCP。

---

## 配置信息

### 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 IP | 124.221.247.107 |
| SSH 端口 | 22 |
| 用户名 | ubuntu |
| 私钥路径 | `/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem` |

### MCP 服务器

- **包名**: `@idletoaster/ssh-mcp-server`
- **版本**: latest
- **运行方式**: npx（自动下载和运行）

---

## 在 Kiro IDE 中配置（当前配置）

### 配置文件位置

```
.kiro/settings/mcp.json
```

### 完整配置

```json
{
  "mcpServers": {
    "ssh-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "@idletoaster/ssh-mcp-server@latest"
      ],
      "env": {
        "SSH_HOST": "124.221.247.107",
        "SSH_PORT": "22",
        "SSH_USERNAME": "ubuntu",
        "SSH_KEY_PATH": "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem"
      },
      "disabled": false,
      "autoApprove": [
        "remote-ssh",
        "ssh-edit-block",
        "ssh-write-chunk",
        "ssh-read-lines",
        "ssh-search-code"
      ]
    }
  }
}
```

### 配置说明

| 字段 | 说明 |
|------|------|
| `command` | 执行命令（npx 用于运行 npm 包） |
| `args` | 命令参数（`-y` 自动确认，包名@版本） |
| `env.SSH_HOST` | 服务器 IP 地址 |
| `env.SSH_PORT` | SSH 端口（默认 22） |
| `env.SSH_USERNAME` | SSH 用户名 |
| `env.SSH_KEY_PATH` | SSH 私钥文件路径（绝对路径） |
| `disabled` | 是否禁用（false = 启用） |
| `autoApprove` | 自动批准的工具列表 |

---

## 在 VS Code 中配置

### 1. 安装 Claude Dev 或 Cline 扩展

VS Code 支持 MCP 的扩展：
- **Cline** (推荐)
- **Claude Dev**

### 2. 配置文件位置

**macOS/Linux**:
```
~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

**Windows**:
```
%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
```

### 3. 配置内容

```json
{
  "mcpServers": {
    "ssh-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "@idletoaster/ssh-mcp-server@latest"
      ],
      "env": {
        "SSH_HOST": "124.221.247.107",
        "SSH_PORT": "22",
        "SSH_USERNAME": "ubuntu",
        "SSH_KEY_PATH": "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem"
      }
    }
  }
}
```

### 4. 重启 VS Code

配置完成后重启 VS Code，扩展会自动加载 MCP 服务器。

---

## 在 Cursor IDE 中配置

### 1. 配置文件位置

**macOS**:
```
~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

**Windows**:
```
%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
```

**Linux**:
```
~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

### 2. 配置内容

与 VS Code 相同：

```json
{
  "mcpServers": {
    "ssh-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "@idletoaster/ssh-mcp-server@latest"
      ],
      "env": {
        "SSH_HOST": "124.221.247.107",
        "SSH_PORT": "22",
        "SSH_USERNAME": "ubuntu",
        "SSH_KEY_PATH": "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem"
      }
    }
  }
}
```

### 3. 重启 Cursor

配置完成后重启 Cursor IDE。

---

## 在 Claude Desktop 中配置

### 1. 配置文件位置

**macOS**:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows**:
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux**:
```
~/.config/Claude/claude_desktop_config.json
```

### 2. 配置内容

```json
{
  "mcpServers": {
    "ssh-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "@idletoaster/ssh-mcp-server@latest"
      ],
      "env": {
        "SSH_HOST": "124.221.247.107",
        "SSH_PORT": "22",
        "SSH_USERNAME": "ubuntu",
        "SSH_KEY_PATH": "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem"
      }
    }
  }
}
```

### 3. 重启 Claude Desktop

配置完成后重启 Claude Desktop 应用。

---

## 可用的 SSH MCP 工具

配置完成后，AI 助手可以使用以下工具：

### 1. remote-ssh - 执行远程命令

```typescript
{
  host: "124.221.247.107",
  user: "ubuntu",
  privateKeyPath: "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem",
  command: "pm2 status"
}
```

### 2. ssh-read-lines - 读取远程文件

```typescript
{
  host: "124.221.247.107",
  user: "ubuntu",
  privateKeyPath: "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem",
  filePath: "/var/www/geo-system/server/.env",
  startLine: 1,
  maxLines: 100
}
```

### 3. ssh-write-chunk - 写入远程文件

```typescript
{
  host: "124.221.247.107",
  user: "ubuntu",
  privateKeyPath: "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem",
  filePath: "/var/www/geo-system/server/test.txt",
  content: "Hello World",
  mode: "rewrite"  // 或 "append"
}
```

### 4. ssh-edit-block - 编辑远程文件

```typescript
{
  host: "124.221.247.107",
  user: "ubuntu",
  privateKeyPath: "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem",
  filePath: "/var/www/geo-system/server/config.js",
  oldText: "port: 3000",
  newText: "port: 3001"
}
```

### 5. ssh-search-code - 搜索远程代码

```typescript
{
  host: "124.221.247.107",
  user: "ubuntu",
  privateKeyPath: "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem",
  path: "/var/www/geo-system/server",
  pattern: "DATABASE_URL",
  filePattern: "*.js"
}
```

---

## 验证配置

### 1. 检查 MCP 服务器状态

在 AI 助手中询问：
```
请检查服务器状态
```

AI 助手应该能够执行 SSH 命令并返回结果。

### 2. 测试命令

```bash
# 查看服务器时间
date

# 查看 PM2 进程
pm2 status

# 查看数据库连接
sudo -u postgres psql -d geo_system -c "SELECT COUNT(*) FROM users;"
```

### 3. 测试文件操作

```bash
# 读取文件
cat /var/www/geo-system/server/.env

# 搜索代码
grep -r "DATABASE_URL" /var/www/geo-system/server/
```

---

## 常见问题

### 1. 私钥权限问题

**错误**: `Permissions 0644 for 'kiro.pem' are too open`

**解决方案**:
```bash
chmod 600 /Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem
```

### 2. 私钥路径错误

**错误**: `ENOENT: no such file or directory`

**解决方案**:
- 确保私钥路径是绝对路径
- 检查文件是否存在
- 路径中的空格需要正确处理

### 3. 连接超时

**错误**: `Connection timeout`

**解决方案**:
- 检查服务器 IP 是否正确
- 检查防火墙是否允许 SSH 连接
- 检查服务器是否在线

### 4. 认证失败

**错误**: `Authentication failed`

**解决方案**:
- 检查用户名是否正确
- 检查私钥是否匹配服务器公钥
- 尝试手动 SSH 连接测试

### 5. npx 命令未找到

**错误**: `command not found: npx`

**解决方案**:
```bash
# 安装 Node.js（包含 npx）
# macOS
brew install node

# Windows
# 从 https://nodejs.org/ 下载安装

# Linux
sudo apt install nodejs npm
```

---

## 安全建议

### 1. 私钥保护

- ✅ 设置正确的文件权限（600）
- ✅ 不要将私钥提交到版本控制
- ✅ 定期更换私钥
- ❌ 不要在配置文件中明文存储密码

### 2. 访问控制

- ✅ 使用专用的 SSH 用户（如 ubuntu）
- ✅ 限制 SSH 用户的权限
- ✅ 使用防火墙限制 SSH 访问来源
- ❌ 不要使用 root 用户

### 3. 审计日志

- ✅ 定期检查 SSH 登录日志
- ✅ 监控异常的 SSH 连接
- ✅ 记录所有远程操作

---

## 高级配置

### 多服务器配置

如果需要连接多个服务器：

```json
{
  "mcpServers": {
    "ssh-production": {
      "command": "npx",
      "args": ["-y", "@idletoaster/ssh-mcp-server@latest"],
      "env": {
        "SSH_HOST": "124.221.247.107",
        "SSH_USERNAME": "ubuntu",
        "SSH_KEY_PATH": "/path/to/production-key.pem"
      }
    },
    "ssh-staging": {
      "command": "npx",
      "args": ["-y", "@idletoaster/ssh-mcp-server@latest"],
      "env": {
        "SSH_HOST": "192.168.1.100",
        "SSH_USERNAME": "ubuntu",
        "SSH_KEY_PATH": "/path/to/staging-key.pem"
      }
    }
  }
}
```

### 使用密码认证（不推荐）

如果必须使用密码：

```json
{
  "mcpServers": {
    "ssh-mcp-server": {
      "command": "npx",
      "args": ["-y", "@idletoaster/ssh-mcp-server@latest"],
      "env": {
        "SSH_HOST": "124.221.247.107",
        "SSH_USERNAME": "ubuntu",
        "SSH_PASSWORD": "your-password"
      }
    }
  }
}
```

**注意**: 密码认证不安全，强烈建议使用私钥认证。

---

## 参考资源

- [SSH MCP Server GitHub](https://github.com/idletoaster/ssh-mcp-server)
- [Model Context Protocol 文档](https://modelcontextprotocol.io/)
- [Cline 扩展文档](https://github.com/cline/cline)
- [Claude Desktop 配置指南](https://docs.anthropic.com/claude/docs)

---

## 更新日志

- **2026-01-19**: 创建文档，包含 Kiro、VS Code、Cursor、Claude Desktop 配置
