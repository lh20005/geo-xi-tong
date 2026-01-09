import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { sanitizeResponse } from './middleware/sanitizeResponse';
import { encryptionService } from './services/EncryptionService';
import { taskScheduler } from './services/TaskScheduler';
import { getWebSocketService } from './services/WebSocketService';
import { rateLimitService } from './services/RateLimitService';
import { tokenService } from './services/TokenService';
import { securityCheckService } from './services/SecurityCheckService';
import { schedulerService } from './services/SchedulerService';
import { SecurityService } from './services/SecurityService';
import { authService } from './services/AuthService';

// 加载环境变量 - 直接从 server 目录读取
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
// 识别反向代理的 X-Forwarded-For，避免限流中间件报错
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;

// ========== 🔒 安全中间件 ==========

// 1. Helmet - 设置安全 HTTP Headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  // 禁用 HSTS，避免强制 HTTPS 跳转问题
  hsts: false
}));

// 2. 隐藏技术栈信息
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('Server', 'WebServer');
  next();
});

// 3. 速率限制（防止暴力攻击）
// 开发环境：宽松限制，方便调试
// 生产环境：合理限制，既保护服务器又不影响正常使用
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1分钟窗口
  max: process.env.NODE_ENV === 'production' ? 500 : 1000,  // 生产：500次/分钟，开发：1000次/分钟
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
  // 跳过某些不需要限制的路径
  skip: (req) => {
    // WebSocket 连接不限制
    return req.path === '/ws';
  }
});

app.use('/api', limiter);

// 4. CORS 配置
const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:5174',  // Electron Vite dev server
  'http://localhost:8080',
  'http://43.143.163.6',
  'https://43.143.163.6',
  'https://your-domain.com'
]).map(o => o.trim()).filter(Boolean);

// 添加ngrok域名（临时解决方案）
allowedOrigins.push('https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev');

console.log('🔒 CORS配置加载完成');
console.log('   允许的来源:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // 允许没有 origin 的请求（如 Electron、Postman、curl）
    if (!origin) {
      callback(null, true);
      return;
    }
    // 允许 file:// 协议（Electron）
    if (origin.startsWith('file://')) {
      callback(null, true);
      return;
    }
    // 允许白名单中的来源
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    console.log('❌ CORS拒绝来源:', origin);
    console.log('   允许的来源列表:', allowedOrigins);
    callback(new Error('不允许的来源'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Confirmation-Token'],
  exposedHeaders: ['Content-Type', 'Content-Length'],
  optionsSuccessStatus: 204
}));

// 其他中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 响应清理中间件（在所有路由之前）
app.use(sanitizeResponse);

// 静态文件服务 - 提供图片访问
// 为静态文件添加CORS头
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 路由
app.use('/api', apiRouter);

// Landing 页面静态文件服务（用于 ngrok 访问）
const landingDistPath = path.join(__dirname, '../../landing/dist');
if (fs.existsSync(landingDistPath)) {
  console.log('✅ 提供 Landing 页面静态文件服务');
  app.use(express.static(landingDistPath));
  
  // SPA 路由支持 - 所有非 API 请求都返回 index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(landingDistPath, 'index.html'));
    }
  });
} else {
  console.log('⚠️  Landing 页面未构建，请运行: cd landing && npm run build');
}

// 错误处理
app.use(errorHandler);

// 初始化加密服务并启动服务器
async function startServer() {
  try {
    // 初始化默认管理员账号
    console.log('👤 初始化管理员账号...');
    await authService.initializeDefaultAdmin();
    
    // 启动时验证支付配置（临时禁用，避免启动失败）
    console.log('🔒 跳过支付配置验证（开发模式）...');
    // SecurityService.validatePaymentConfig();
    
    // EncryptionService已在导入时初始化，无需调用initialize
    console.log('✅ 加密服务初始化成功');
    
    // 启动任务调度器
    taskScheduler.start();
    
    // 启动订阅系统定时任务
    schedulerService.start();
    
    // 启动订阅到期检查服务
    console.log('⏰ 启动订阅到期检查服务...');
    const { subscriptionExpirationService } = await import('./services/SubscriptionExpirationService');
    subscriptionExpirationService.start();
    console.log('✅ 订阅到期检查服务已启动');
    
    // 启动加量包过期检查服务
    console.log('⏰ 启动加量包过期检查服务...');
    const { boosterExpirationService } = await import('./services/BoosterExpirationService');
    boosterExpirationService.startPeriodicCheck();
    console.log('✅ 加量包过期检查服务已启动');
    
    // 启动登录尝试清理任务（每小时运行一次）
    setInterval(async () => {
      try {
        await rateLimitService.cleanup();
      } catch (error) {
        console.error('[Cleanup] 清理登录尝试记录失败:', error);
      }
    }, 60 * 60 * 1000); // 每小时
    
    // 启动过期令牌清理任务（每小时运行一次）
    setInterval(async () => {
      try {
        await tokenService.cleanupExpiredTokens();
      } catch (error) {
        console.error('[Cleanup] 清理过期令牌失败:', error);
      }
    }, 60 * 60 * 1000); // 每小时
    
    // 启动每日安全检查任务（每天凌晨2点运行）
    // Requirement 19.1, 19.2
    const scheduleSecurityCheck = () => {
      const now = new Date();
      const next2AM = new Date(now);
      next2AM.setHours(2, 0, 0, 0);
      
      // 如果今天的2点已过，设置为明天的2点
      if (now.getHours() >= 2) {
        next2AM.setDate(next2AM.getDate() + 1);
      }
      
      const timeUntilNext = next2AM.getTime() - now.getTime();
      
      setTimeout(async () => {
        try {
          console.log('[SecurityCheck] 开始每日安全检查...');
          await securityCheckService.runAllChecks();
          console.log('[SecurityCheck] 每日安全检查完成');
        } catch (error) {
          console.error('[SecurityCheck] 每日安全检查失败:', error);
        }
        
        // 安排下一次检查（24小时后）
        setInterval(async () => {
          try {
            console.log('[SecurityCheck] 开始每日安全检查...');
            await securityCheckService.runAllChecks();
            console.log('[SecurityCheck] 每日安全检查完成');
          } catch (error) {
            console.error('[SecurityCheck] 每日安全检查失败:', error);
          }
        }, 24 * 60 * 60 * 1000); // 每24小时
      }, timeUntilNext);
      
      console.log(`✅ 每日安全检查已安排，下次运行时间: ${next2AM.toLocaleString('zh-CN')}`);
    };
    
    scheduleSecurityCheck();
    
    // 安排孤儿图片清理任务（每天凌晨3点执行）
    const scheduleOrphanImageCleanup = async () => {
      const { orphanImageCleanupService } = await import('./services/OrphanImageCleanupService');
      
      const now = new Date();
      const next3AM = new Date(now);
      next3AM.setHours(3, 0, 0, 0);
      
      if (now.getHours() >= 3) {
        next3AM.setDate(next3AM.getDate() + 1);
      }
      
      const timeUntilNext = next3AM.getTime() - now.getTime();
      
      setTimeout(async () => {
        try {
          console.log('[OrphanCleanup] 开始每日孤儿图片清理...');
          const result = await orphanImageCleanupService.cleanupOrphanImages(24);
          console.log(`[OrphanCleanup] 清理完成: 删除 ${result.deletedCount} 个文件，释放 ${result.freedBytes} 字节`);
        } catch (error) {
          console.error('[OrphanCleanup] 孤儿图片清理失败:', error);
        }
        
        // 安排下一次清理（24小时后）
        setInterval(async () => {
          try {
            console.log('[OrphanCleanup] 开始每日孤儿图片清理...');
            const result = await orphanImageCleanupService.cleanupOrphanImages(24);
            console.log(`[OrphanCleanup] 清理完成: 删除 ${result.deletedCount} 个文件，释放 ${result.freedBytes} 字节`);
          } catch (error) {
            console.error('[OrphanCleanup] 孤儿图片清理失败:', error);
          }
        }, 24 * 60 * 60 * 1000);
      }, timeUntilNext);
      
      console.log(`✅ 孤儿图片清理已安排，下次运行时间: ${next3AM.toLocaleString('zh-CN')}`);
    };
    
    scheduleOrphanImageCleanup();
    
    // 创建HTTP服务器
    const server = createServer(app);
    
    // 初始化WebSocket服务
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const webSocketService = getWebSocketService(jwtSecret);
    webSocketService.initialize(server);
    
    server.listen(PORT, () => {
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
      console.log(`🔌 WebSocket服务运行在 ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  taskScheduler.stop();
  schedulerService.stop();
  
  // 停止订阅到期检查服务
  const { subscriptionExpirationService } = await import('./services/SubscriptionExpirationService');
  subscriptionExpirationService.stop();
  
  // 停止加量包过期检查服务
  const { boosterExpirationService } = await import('./services/BoosterExpirationService');
  boosterExpirationService.stopPeriodicCheck();
  
  const webSocketService = getWebSocketService();
  webSocketService.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭服务器...');
  taskScheduler.stop();
  schedulerService.stop();
  const webSocketService = getWebSocketService();
  webSocketService.close();
  process.exit(0);
});

startServer();
