import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
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

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 响应清理中间件（在所有路由之前）
app.use(sanitizeResponse);

// 静态文件服务 - 提供图片访问
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 路由
app.use('/api', apiRouter);

// 错误处理
app.use(errorHandler);

// 初始化加密服务并启动服务器
async function startServer() {
  try {
    // 启动时验证支付配置
    console.log('🔒 验证支付配置...');
    SecurityService.validatePaymentConfig();
    
    // EncryptionService已在导入时初始化，无需调用initialize
    console.log('✅ 加密服务初始化成功');
    
    // 启动任务调度器
    taskScheduler.start();
    
    // 启动订阅系统定时任务
    schedulerService.start();
    
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
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  taskScheduler.stop();
  schedulerService.stop();
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
