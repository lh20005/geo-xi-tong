import { pool } from '../db/database';

export class RateLimitService {
  private static instance: RateLimitService;
  private readonly LOGIN_ATTEMPT_LIMIT = 5;
  private readonly LOGIN_ATTEMPT_WINDOW_MINUTES = 15;
  private readonly REGISTRATION_LIMIT = 3;
  private readonly REGISTRATION_WINDOW_HOURS = 1;

  private constructor() {}

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  /**
   * 记录登录尝试
   */
  async recordLoginAttempt(
    username: string,
    ipAddress: string,
    success: boolean
  ): Promise<void> {
    await pool.query(
      'INSERT INTO login_attempts (username, ip_address, success) VALUES ($1, $2, $3)',
      [username, ipAddress, success]
    );
    
    console.log(`[RateLimit] 记录登录尝试: ${username} from ${ipAddress}, 成功: ${success}`);
  }

  /**
   * 检查是否超过速率限制
   * 返回 true 表示允许继续，false 表示已超过限制
   */
  async checkRateLimit(username: string, ipAddress: string): Promise<boolean> {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - this.LOGIN_ATTEMPT_WINDOW_MINUTES);
    
    // 查询在时间窗口内的失败尝试次数
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM login_attempts 
       WHERE (username = $1 OR ip_address = $2) 
       AND success = FALSE 
       AND attempted_at > $3`,
      [username, ipAddress, windowStart]
    );
    
    const failedAttempts = parseInt(result.rows[0].count);
    
    if (failedAttempts >= this.LOGIN_ATTEMPT_LIMIT) {
      console.log(`[RateLimit] 速率限制触发: ${username} from ${ipAddress}, 失败次数: ${failedAttempts}`);
      return false;
    }
    
    return true;
  }

  /**
   * 清理旧的登录尝试记录（超过1小时）
   */
  async cleanup(): Promise<number> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const result = await pool.query(
      'DELETE FROM login_attempts WHERE attempted_at < $1',
      [oneHourAgo]
    );
    
    const deletedCount = result.rowCount || 0;
    
    if (deletedCount > 0) {
      console.log(`[RateLimit] 清理旧记录: ${deletedCount} 条`);
    }
    
    return deletedCount;
  }

  /**
   * 检查注册速率限制
   * 限制：每个 IP 地址每小时最多 3 次注册
   */
  async checkRegistrationRateLimit(ipAddress: string): Promise<boolean> {
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - this.REGISTRATION_WINDOW_HOURS);
    
    // 查询在时间窗口内的注册尝试次数
    // 使用特殊的用户名前缀来标识注册尝试
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM login_attempts 
       WHERE ip_address = $1 
       AND username LIKE 'registration_%'
       AND attempted_at > $2`,
      [ipAddress, windowStart]
    );
    
    const registrationAttempts = parseInt(result.rows[0].count);
    
    if (registrationAttempts >= this.REGISTRATION_LIMIT) {
      console.log(`[RateLimit] 注册速率限制触发: ${ipAddress}, 尝试次数: ${registrationAttempts}`);
      return false;
    }
    
    return true;
  }

  /**
   * 记录注册尝试
   */
  async recordRegistrationAttempt(ipAddress: string, success: boolean): Promise<void> {
    await pool.query(
      'INSERT INTO login_attempts (username, ip_address, success) VALUES ($1, $2, $3)',
      [`registration_${ipAddress}`, ipAddress, success]
    );
    
    console.log(`[RateLimit] 记录注册尝试: ${ipAddress}, 成功: ${success}`);
  }
}

export const rateLimitService = RateLimitService.getInstance();
