import bcrypt from 'bcrypt';
import { pool } from '../db/database';

interface User {
  id: number;
  username: string;
  password_hash: string;
  email?: string;
  role: 'admin' | 'user';
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 加密密码
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * 验证密码
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * 创建用户
   */
  async createUser(username: string, password: string, email?: string, role: 'admin' | 'user' = 'user'): Promise<User> {
    const passwordHash = await this.hashPassword(password);
    
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [username, passwordHash, email, role]
    );
    
    console.log(`[Auth] 用户创建成功: ${username}`);
    return result.rows[0];
  }

  /**
   * 验证用户并更新最后登录时间
   */
  async validateUser(username: string, password: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      console.log(`[Auth] 用户不存在: ${username}`);
      return null;
    }
    
    const user = result.rows[0];
    const isValid = await this.verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      console.log(`[Auth] 密码错误: ${username}`);
      return null;
    }
    
    // 更新最后登录时间
    await pool.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    console.log(`[Auth] 用户验证成功: ${username}`);
    return user;
  }

  /**
   * 根据ID获取用户
   */
  async getUserById(userId: number): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 根据用户名获取用户
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 初始化默认管理员账号
   */
  async initializeDefaultAdmin(): Promise<void> {
    try {
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      
      // 检查管理员是否已存在
      const existingAdmin = await this.getUserByUsername(adminUsername);
      
      if (!existingAdmin) {
        await this.createUser(adminUsername, adminPassword, undefined, 'admin');
        console.log(`[Auth] 默认管理员账号已创建: ${adminUsername}`);
      } else {
        console.log(`[Auth] 默认管理员账号已存在: ${adminUsername}`);
      }
    } catch (error) {
      console.error('[Auth] 初始化默认管理员失败:', error);
      throw error;
    }
  }
}

export const authService = AuthService.getInstance();
