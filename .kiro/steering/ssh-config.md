---
inclusion: always
---

# 服务器 SSH 配置

## 生产服务器 (124.221.247.107)

| 项目 | 值 |
|------|-----|
| Host | 124.221.247.107 |
| User | ubuntu |
| Private Key | /Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem |
| 项目路径 | /var/www/geo-system |
| 数据库 | PostgreSQL (geo_system) |
| 数据库用户 | geo_user |

## MCP SSH 工具调用参数

**重要：每次调用 SSH MCP 工具时必须显式传递这些参数！**

```
host: 124.221.247.107
user: ubuntu
privateKeyPath: /Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem
```

## SSH MCP 使用经验

### 关键点

1. **必须显式传参**：虽然 `.kiro/settings/mcp.json` 中配置了环境变量，但调用工具时仍需显式传递 `host`、`user`、`privateKeyPath` 参数

2. **可用的 SSH MCP 工具**：
   - `mcp_ssh_mcp_server_remote_ssh` - 执行远程命令
   - `mcp_ssh_mcp_server_ssh_read_lines` - 读取远程文件
   - `mcp_ssh_mcp_server_ssh_write_chunk` - 写入远程文件
   - `mcp_ssh_mcp_server_ssh_edit_block` - 编辑远程文件
   - `mcp_ssh_mcp_server_ssh_search_code` - 搜索远程代码

3. **数据库访问**：服务器上通过 `sudo -u postgres psql -d geo_system` 访问数据库

### 调用示例

```javascript
// 执行远程命令
mcp_ssh_mcp_server_remote_ssh({
  host: "124.221.247.107",
  user: "ubuntu", 
  privateKeyPath: "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem",
  command: "pm2 status"
})

// 执行数据库查询
mcp_ssh_mcp_server_remote_ssh({
  host: "124.221.247.107",
  user: "ubuntu",
  privateKeyPath: "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem", 
  command: "sudo -u postgres psql -d geo_system -c \"SELECT COUNT(*) FROM users;\""
})
```

### MCP 配置文件位置

- 工作区配置：`.kiro/settings/mcp.json`
- 使用的 MCP 服务器：`@idletoaster/ssh-mcp-server@latest`

### 常见问题

1. **连接失败**：检查私钥路径是否正确，确保文件存在且权限正确
2. **命令超时**：长时间运行的命令可能超时，考虑使用 nohup 或后台执行
3. **权限问题**：某些操作需要 sudo，如数据库访问需要 `sudo -u postgres`

## 服务信息

| 服务 | 路径/命令 |
|------|----------|
| PM2 进程 | geo-server |
| 后端 API | http://localhost:3000 |
| 落地页静态文件 | /var/www/geo-system/landing/ |
| 后端代码 | /var/www/geo-system/server/ |
| 上传目录 | /var/www/geo-system/uploads/ |
| Nginx 配置 | /etc/nginx/sites-available/geo-system |
| 环境配置 | /var/www/geo-system/server/.env |

**注意**: 服务器不再部署 Web 前端（client/），所有系统功能通过 Windows 桌面客户端访问。

## 常用命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs geo-api --lines 50

# 重启服务
pm2 restart geo-api

# 数据库迁移
cd /var/www/geo-system/server && npm run db:migrate

# 健康检查
curl http://localhost:3000/api/health
```

## 部署

详细部署文档见: `config/server-deploy/README.md`

快速部署命令:
```bash
# 增量更新
./scripts/deploy-to-server.sh update

# 全新部署
./scripts/deploy-to-server.sh full
```
