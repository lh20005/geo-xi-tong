import bcrypt from 'bcrypt';
import { pool } from '../db/database';
import { invitationService } from './InvitationService';
import { passwordService } from './PasswordService';

interface User {
  id: number;
  username: string;
  password_hash: string;
  email?: string;
  role: 'admin' | 'user';
  invitation_code: string;
  invited_by_code?: string;
  is_temp_password: boolean;
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
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const passwordHash = await this.hashPassword(password);
      
      // 生成唯一的邀请码
      const invitationCode = await invitationService.generate();
      
      const result = await client.query(
        'INSERT INTO users (username, password_hash, email, role, invitation_code) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [username, passwordHash, email, role, invitationCode]
      );
      
      const user = result.rows[0];
      
      // 初始化用户存储记录
      await client.query('SELECT initialize_user_storage($1)', [user.id]);
      
      await client.query('COMMIT');
      
      console.log(`[Auth] 用户创建成功: ${username}, 邀请码: ${invitationCode}`);
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 注册新用户
   * 支持可选的邀请码
   */
  async registerUser(
    username: string, 
    password: string, 
    invitedByCode?: string
  ): Promise<User> {
    // 验证用户名格式（3-20字符，字母数字和下划线）
    if (!username || username.length < 3 || username.length > 20) {
      throw new Error('用户名必须是3-20个字符');
    }
    
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      throw new Error('用户名只能包含字母、数字和下划线');
    }
    
    // 验证密码强度
    const validation = passwordService.validatePasswordStrength(password);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }
    
    // 检查用户名是否已存在
    const existingUser = await this.getUserByUsername(username);
    if (existingUser) {
      throw new Error('用户名已存在');
    }
    
    // 如果提供了邀请码，验证其存在性
    if (invitedByCode) {
      if (!invitationService.validateFormat(invitedByCode)) {
        console.log(`[Auth] 邀请码格式无效: ${invitedByCode}`);
        // 格式无效，但允许注册继续（不建立邀请关系）
        invitedByCode = undefined;
      } else {
        const codeExists = await invitationService.exists(invitedByCode);
        if (!codeExists) {
          console.log(`[Auth] 邀请码不存在: ${invitedByCode}`);
          // 邀请码不存在，但允许注册继续（不建立邀请关系）
          invitedByCode = undefined;
        }
      }
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 哈希密码
      const passwordHash = await this.hashPassword(password);
      
      // 生成唯一的邀请码
      const invitationCode = await invitationService.generate();
      
      // 创建用户
      const result = await client.query(
        `INSERT INTO users (username, password_hash, invitation_code, invited_by_code, role, is_temp_password) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [username, passwordHash, invitationCode, invitedByCode || null, 'user', false]
      );
      
      const user = result.rows[0];
      
      // 保存密码历史
      await passwordService.savePasswordHistory(user.id, passwordHash);
      
      // 初始化用户存储记录
      await client.query('SELECT initialize_user_storage($1)', [user.id]);
      
      await client.query('COMMIT');
      
      console.log(`[Auth] 用户注册成功: ${username}, 邀请码: ${invitationCode}${invitedByCode ? `, 被邀请码: ${invitedByCode}` : ''}`);
      
      // 为新用户自动开通免费版订阅（在事务外执行，避免影响注册流程）
      try {
        const { freeSubscriptionService } = await import('./FreeSubscriptionService');
        await freeSubscriptionService.activateFreeSubscriptionForNewUser(user.id);
      } catch (error) {
        console.error(`[Auth] 为新用户 ${username} 开通免费版失败:`, error);
        // 不抛出错误，允许注册继续
      }
      
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
