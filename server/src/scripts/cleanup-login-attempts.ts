import { rateLimitService } from '../services/RateLimitService';
import { pool } from '../db/database';

/**
 * 清理旧的登录尝试记录
 * 这个脚本应该通过 cron 任务每小时运行一次
 */
async function cleanupLoginAttempts() {
  try {
    console.log('[Cleanup] 开始清理旧的登录尝试记录...');
    
    const deletedCount = await rateLimitService.cleanup();
    
    console.log(`[Cleanup] 清理完成，删除了 ${deletedCount} 条记录`);
    
    // 关闭数据库连接
    await pool.end();
    
    process.exit(0);
  } catch (error) {
    console.error('[Cleanup] 清理失败:', error);
    await pool.end();
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  cleanupLoginAttempts();
}

export { cleanupLoginAttempts };
