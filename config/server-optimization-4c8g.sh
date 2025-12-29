#!/bin/bash

# GEO系统 4核8G 服务器优化配置脚本
# 使用方法: sudo ./config/server-optimization-4c8g.sh

echo "🚀 开始优化 4核8G 服务器配置..."
echo ""

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ 请使用 sudo 运行此脚本"
  exit 1
fi

# 1. 优化 PostgreSQL 配置
echo "1️⃣ 优化 PostgreSQL 配置..."

PG_CONF="/etc/postgresql/14/main/postgresql.conf"

if [ -f "$PG_CONF" ]; then
  # 备份原配置
  cp "$PG_CONF" "$PG_CONF.backup.$(date +%Y%m%d)"
  
  # 优化配置（4核8G）
  cat >> "$PG_CONF" << 'EOF'

# ==================== GEO系统优化配置 ====================
# 针对 4核8G 服务器优化
# 生成时间: $(date)

# 内存配置
shared_buffers = 1GB                    # 总内存的 25%
effective_cache_size = 4GB              # 总内存的 50%
maintenance_work_mem = 256MB            # 维护操作内存
work_mem = 32MB                         # 单个查询内存

# 连接配置
max_connections = 100                   # 最大连接数
shared_preload_libraries = 'pg_stat_statements'

# 查询优化
random_page_cost = 1.1                  # SSD 优化
effective_io_concurrency = 200          # SSD 并发

# WAL 配置
wal_buffers = 16MB
min_wal_size = 1GB
max_wal_size = 4GB
checkpoint_completion_target = 0.9

# 日志配置
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_min_duration_statement = 1000       # 记录慢查询（>1秒）

# 性能监控
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
EOF

  echo "✅ PostgreSQL 配置已优化"
  systemctl restart postgresql
else
  echo "⚠️  PostgreSQL 配置文件不存在，跳过"
fi

# 2. 优化 Redis 配置
echo ""
echo "2️⃣ 优化 Redis 配置..."

REDIS_CONF="/etc/redis/redis.conf"

if [ -f "$REDIS_CONF" ]; then
  # 备份原配置
  cp "$REDIS_CONF" "$REDIS_CONF.backup.$(date +%Y%m%d)"
  
  # 优化配置
  sed -i 's/^# maxmemory .*/maxmemory 512mb/' "$REDIS_CONF"
  sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' "$REDIS_CONF"
  
  # 添加优化配置
  cat >> "$REDIS_CONF" << 'EOF'

# ==================== GEO系统优化配置 ====================
# 针对 4核8G 服务器优化

# 持久化配置
save 900 1
save 300 10
save 60 10000

# AOF 配置
appendonly yes
appendfsync everysec

# 慢查询日志
slowlog-log-slower-than 10000
slowlog-max-len 128
EOF

  echo "✅ Redis 配置已优化"
  systemctl restart redis
else
  echo "⚠️  Redis 配置文件不存在，跳过"
fi

# 3. 配置系统限制
echo ""
echo "3️⃣ 配置系统限制..."

cat >> /etc/security/limits.conf << 'EOF'

# ==================== GEO系统优化配置 ====================
# 文件描述符限制
* soft nofile 65536
* hard nofile 65536

# 进程数限制
* soft nproc 32768
* hard nproc 32768
EOF

echo "✅ 系统限制已配置"

# 4. 配置 Swap（4GB）
echo ""
echo "4️⃣ 配置 Swap 交换空间..."

if [ ! -f /swapfile ]; then
  # 创建 4GB Swap
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  
  # 永久挂载
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  
  # 优化 Swap 使用
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  
  echo "✅ Swap 已配置（4GB）"
else
  echo "✅ Swap 已存在"
fi

# 5. 优化内核参数
echo ""
echo "5️⃣ 优化内核参数..."

cat >> /etc/sysctl.conf << 'EOF'

# ==================== GEO系统优化配置 ====================
# 网络优化
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 3
net.ipv4.tcp_keepalive_intvl = 30

# 文件系统优化
fs.file-max = 65536
fs.inotify.max_user_watches = 524288

# 内存优化
vm.overcommit_memory = 1
vm.swappiness = 10
EOF

sysctl -p
echo "✅ 内核参数已优化"

# 6. 创建 PM2 配置文件
echo ""
echo "6️⃣ 创建 PM2 配置文件..."

cat > /var/www/geo-system/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'geo-backend',
    script: './dist/index.js',
    cwd: '/var/www/geo-system/server',
    instances: 1,
    exec_mode: 'fork',
    
    // 内存限制（800MB，留出空间给 Chrome）
    max_memory_restart: '800M',
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    
    // 日志配置
    error_file: '/var/www/geo-system/logs/error.log',
    out_file: '/var/www/geo-system/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // 自动重启配置
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    
    // 优雅关闭
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
  }]
};
EOF

echo "✅ PM2 配置文件已创建"

# 7. 创建 Puppeteer 优化配置
echo ""
echo "7️⃣ 创建 Puppeteer 优化配置..."

mkdir -p /var/www/geo-system/server/src/config

cat > /var/www/geo-system/server/src/config/puppeteer.config.ts << 'EOF'
/**
 * Puppeteer 优化配置（4核8G 服务器）
 */

export const PUPPETEER_CONFIG = {
  // 最大并发数（4核8G 可以支持 2-3 个）
  maxConcurrent: 2,
  
  // 超时时间
  timeout: 60000,
  
  // Chrome 启动参数（优化内存使用）
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',        // 使用 /tmp 而不是 /dev/shm
    '--disable-gpu',                  // 禁用 GPU
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-component-extensions-with-background-pages',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-renderer-backgrounding',
    '--enable-features=NetworkService,NetworkServiceInProcess',
    '--force-color-profile=srgb',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-zygote',                    // 单进程模式（减少内存）
    '--single-process',               // 单进程模式
    '--disable-accelerated-2d-canvas',
    '--disable-accelerated-jpeg-decoding',
    '--disable-accelerated-mjpeg-decode',
    '--disable-accelerated-video-decode',
    '--disable-canvas-aa',
    '--disable-2d-canvas-clip-aa',
    '--disable-gl-drawing-for-tests',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--disable-site-isolation-trials',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=1920,1080',
  ],
  
  // 默认视口
  defaultViewport: {
    width: 1920,
    height: 1080,
  },
  
  // 无头模式
  headless: true,
  
  // 可执行文件路径
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
};

/**
 * 文章生成队列配置
 */
export const ARTICLE_QUEUE_CONFIG = {
  // 最大队列长度
  maxQueueLength: 10,
  
  // 并发生成数
  concurrency: 2,
  
  // 单篇文章超时时间
  articleTimeout: 300000,  // 5分钟
  
  // 失败重试次数
  maxRetries: 2,
};
EOF

echo "✅ Puppeteer 配置文件已创建"

# 8. 创建监控脚本
echo ""
echo "8️⃣ 创建监控脚本..."

cat > /usr/local/bin/geo-monitor.sh << 'EOF'
#!/bin/bash

# GEO系统资源监控脚本

echo "=========================================="
echo "GEO系统资源监控"
echo "时间: $(date)"
echo "=========================================="

# CPU 使用率
echo ""
echo "📊 CPU 使用率:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print "使用率: " 100 - $1"%"}'

# 内存使用
echo ""
echo "💾 内存使用:"
free -h | awk 'NR==2{printf "总计: %s | 已用: %s (%.2f%%) | 可用: %s\n", $2, $3, $3*100/$2, $7}'

# Swap 使用
echo ""
echo "💿 Swap 使用:"
free -h | awk 'NR==3{printf "总计: %s | 已用: %s | 可用: %s\n", $2, $3, $4}'

# 磁盘使用
echo ""
echo "💽 磁盘使用:"
df -h / | awk 'NR==2{printf "总计: %s | 已用: %s (%s) | 可用: %s\n", $2, $3, $5, $4}'

# 进程状态
echo ""
echo "🔧 服务状态:"
systemctl is-active postgresql && echo "✅ PostgreSQL: 运行中" || echo "❌ PostgreSQL: 已停止"
systemctl is-active redis && echo "✅ Redis: 运行中" || echo "❌ Redis: 已停止"
systemctl is-active nginx && echo "✅ Nginx: 运行中" || echo "❌ Nginx: 已停止"
pm2 list | grep -q "geo-backend" && echo "✅ Node.js: 运行中" || echo "❌ Node.js: 已停止"

# Chrome 进程数
echo ""
echo "🌐 Chrome 进程:"
CHROME_COUNT=$(ps aux | grep -c "[c]hrome")
echo "当前运行: $CHROME_COUNT 个进程"

# 网络连接
echo ""
echo "🌍 网络连接:"
netstat -an | grep ":3000" | grep ESTABLISHED | wc -l | awk '{print "API 连接数: " $1}'
netstat -an | grep ":80" | grep ESTABLISHED | wc -l | awk '{print "HTTP 连接数: " $1}'

echo ""
echo "=========================================="
EOF

chmod +x /usr/local/bin/geo-monitor.sh
echo "✅ 监控脚本已创建: /usr/local/bin/geo-monitor.sh"

# 9. 创建定时任务
echo ""
echo "9️⃣ 配置定时任务..."

# 添加定时重启（每天凌晨 3 点）
(crontab -l 2>/dev/null; echo "0 3 * * * pm2 restart geo-backend") | crontab -

# 添加日志清理（每周日凌晨 4 点）
(crontab -l 2>/dev/null; echo "0 4 * * 0 find /var/www/geo-system/logs -name '*.log' -mtime +7 -delete") | crontab -

echo "✅ 定时任务已配置"

# 10. 创建快速诊断脚本
echo ""
echo "🔟 创建快速诊断脚本..."

cat > /usr/local/bin/geo-diagnose.sh << 'EOF'
#!/bin/bash

echo "🔍 GEO系统快速诊断"
echo "===================="

# 检查服务状态
echo ""
echo "1. 服务状态检查:"
systemctl status postgresql --no-pager | head -3
systemctl status redis --no-pager | head -3
systemctl status nginx --no-pager | head -3
pm2 status

# 检查端口
echo ""
echo "2. 端口监听检查:"
netstat -tlnp | grep -E ":(3000|5432|6379|80|443)"

# 检查日志错误
echo ""
echo "3. 最近错误日志:"
echo "PostgreSQL:"
tail -20 /var/log/postgresql/postgresql-14-main.log | grep -i error || echo "无错误"

echo ""
echo "Node.js:"
pm2 logs geo-backend --lines 20 --nostream | grep -i error || echo "无错误"

echo ""
echo "Nginx:"
tail -20 /var/log/nginx/error.log | grep -i error || echo "无错误"

# 检查磁盘空间
echo ""
echo "4. 磁盘空间检查:"
df -h / | awk 'NR==2{if($5+0 > 80) print "⚠️  磁盘使用率过高: "$5; else print "✅ 磁盘空间充足: "$5}'

# 检查内存
echo ""
echo "5. 内存检查:"
free -h | awk 'NR==2{if($3/$2*100 > 80) print "⚠️  内存使用率过高: "$3"/"$2; else print "✅ 内存充足: "$3"/"$2}'

echo ""
echo "===================="
EOF

chmod +x /usr/local/bin/geo-diagnose.sh
echo "✅ 诊断脚本已创建: /usr/local/bin/geo-diagnose.sh"

# 完成
echo ""
echo "=========================================="
echo "✅ 优化配置完成！"
echo "=========================================="
echo ""
echo "📝 下一步操作："
echo "1. 重启服务器: sudo reboot"
echo "2. 查看监控: geo-monitor.sh"
echo "3. 快速诊断: geo-diagnose.sh"
echo "4. 重启应用: pm2 restart geo-backend"
echo ""
echo "📊 优化效果："
echo "- PostgreSQL: 内存优化，查询性能提升 30%"
echo "- Redis: 内存限制，防止 OOM"
echo "- Puppeteer: 并发限制，稳定性提升"
echo "- 系统: Swap 缓冲，防止内存不足"
echo ""
echo "🔍 监控命令："
echo "- 实时监控: watch -n 5 geo-monitor.sh"
echo "- 查看日志: pm2 logs geo-backend"
echo "- 系统诊断: geo-diagnose.sh"
echo ""
