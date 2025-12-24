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
    await encryptionService.initialize();
    console.log('✅ 加密服务初始化成功');
    
    // 启动任务调度器
    taskScheduler.start();
    
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
  const webSocketService = getWebSocketService();
  webSocketService.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭服务器...');
  taskScheduler.stop();
  const webSocketService = getWebSocketService();
  webSocketService.close();
  process.exit(0);
});

startServer();
