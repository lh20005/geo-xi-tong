/**
 * PM2 生产环境配置
 * 
 * 功能：
 * 1. 自动重启（崩溃后自动恢复）
 * 2. 指数退避重启延迟（避免频繁重启）
 * 3. 内存限制自动重启
 * 4. 日志管理（带时间戳）
 * 5. 优雅关闭
 * 
 * 配合 pm2-watchdog 模块实现 HTTP 健康检查
 * 配合 pm2-logrotate 模块实现日志轮转
 */
module.exports = {
  apps: [{
    name: 'geo-server',
    script: './index.js',
    cwd: '/var/www/geo-system/server',
    
    // 实例配置
    instances: 1,
    exec_mode: 'fork',
    
    // 自动重启配置
    autorestart: true,
    watch: false,
    
    // 指数退避重启延迟
    // 首次重启延迟 100ms，之后每次翻倍，最大 10 秒
    exp_backoff_restart_delay: 100,
    
    // 最大重启次数（15分钟内）
    max_restarts: 10,
    
    // 最小运行时间（毫秒），低于此时间的重启被视为崩溃
    min_uptime: 5000,
    
    // 内存限制（超过后自动重启）
    max_memory_restart: '1G',
    
    // 优雅关闭
    kill_timeout: 5000,           // 等待进程关闭的超时时间
    wait_ready: true,             // 等待进程发送 ready 信号
    listen_timeout: 10000,        // 等待 ready 信号的超时时间
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // 日志配置
    error_file: '/var/www/geo-system/server/logs/pm2-error.log',
    out_file: '/var/www/geo-system/server/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // 进程标题
    name: 'geo-server'
  }]
};

/**
 * 部署后配置说明
 * 
 * 1. 安装 pm2-watchdog（HTTP 健康检查看门狗）:
 *    pm2 install ma-zal/pm2-watchdog
 *    pm2 set pm2-watchdog:url-geo-server http://localhost:3000/api/health
 *    pm2 set pm2-watchdog:checking_interval 30
 *    pm2 set pm2-watchdog:fails_to_restart 3
 * 
 * 2. 安装 pm2-logrotate（日志轮转）:
 *    pm2 install pm2-logrotate
 *    pm2 set pm2-logrotate:max_size 50M
 *    pm2 set pm2-logrotate:retain 14
 *    pm2 set pm2-logrotate:compress true
 *    pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
 *    pm2 set pm2-logrotate:rotateModule true
 * 
 * 3. 保存 PM2 进程列表（开机自启）:
 *    pm2 save
 *    pm2 startup
 * 
 * 4. 查看监控状态:
 *    pm2 monit
 *    pm2 logs geo-server --lines 100
 * 
 * 5. 健康检查端点:
 *    curl http://localhost:3000/api/health
 *    curl http://localhost:3000/api/monitoring/status
 */
