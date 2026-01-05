import { pool } from '../db/database';
import { authService } from './AuthService';
import { invitationService } from './InvitationService';
import { tokenService } from './TokenService';
import { sessionService } from './SessionService';
import { passwordService } from './PasswordService';

interface User {
  id: number;
  username: string;
  invitation_code: string;
  invited_by_code?: string;
  role: 'admin' | 'user';
  is_temp_password: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

interface UserProfile extends User {
  invitedUsers?: Array<{
    username: string;
    createdAt: string;
  }>;
}

export class UserService {
  private static instance: UserService;

  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * 统计管理员数量
   */
  private async countAdmins(): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE role = 'admin'`
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * 根据ID获取用户
   */
  async getUserById(id: number): Promise<User | null> {
    const result = await pool.query(
      `SELECT id, username, invitation_code, invited_by_code, role, is_temp_password, 
              created_at, updated_at, last_login_at 
       FROM users 
       WHERE id = $1`,
      [id]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 获取用户资料（包括邀请统计）
   */
  async getUserProfile(id: number): Promise<UserProfile | null> {
    const user = await this.getUserById(id);
    
    if (!user) {
      return null;
    }
    
    // 获取邀请统计
    const stats = await invitationService.getInvitationStats(id);
    
    return {
      ...user,
      invitedUsers: stats.invitedUsers
    };
  }

  /**
   * 更新用户信息（管理员操作）
   */
  async updateUser(
    id: number, 
    data: { username?: string; role?: 'admin' | 'user' }
  ): Promise<User> {
    // 如果要修改角色,检查是否是最后一个管理员
    if (data.role !== undefined) {
      const user = await this.getUserById(id);
      
      if (!user) {
        throw new Error('用户不存在');
      }
      
      // 如果当前用户是管理员且要降权为普通用户
      if (user.role === 'admin' && data.role === 'user') {
        const adminCount = await this.countAdmins();
        
        if (adminCount <= 1) {
          throw new Error('不能降权最后一个管理员');
        }
      }
    }
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (data.username !== undefined) {
      // 检查新用户名是否已被其他用户使用
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [data.username, id]
      );
      
      if (existingUser.rows.length > 0) {
        throw new Error('用户名已被使用');
      }
      
      updates.push(`username = $${paramIndex++}`);
      values.push(data.username);
    }
    
    if (data.role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(data.role);
    }
    
    if (updates.length === 0) {
      throw new Error('没有要更新的字段');
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const result = await pool.query(
      `UPDATE users 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING id, username, invitation_code, invited_by_code, role, is_temp_password, 
                 created_at, updated_at, last_login_at`,
      values
    );
    
    console.log(`[User] 用户更新成功: ID ${id}`);
    return result.rows[0];
  }

  /**
   * 修改密码
   */
  async changePassword(
    id: number, 
    currentPassword: string, 
    newPassword: string,
    currentRefreshToken?: string
  ): Promise<void> {
    // 获取用户
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [id]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('用户不存在');
    }
    
    const user = userResult.rows[0];
    
    // 验证当前密码
    const isValid = await authService.verifyPassword(currentPassword, user.password_hash);
    
    if (!isValid) {
      throw new Error('当前密码不正确');
    }
    
    // 验证新密码强度
    const validation = passwordService.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }
    
    // 检查密码重用
    const isReused = await passwordService.checkPasswordReuse(id, newPassword);
    if (isReused) {
      throw new Error('新密码不能与最近3次使用的密码相同');
    }
    
    // 哈希新密码
    const newPasswordHash = await authService.hashPassword(newPassword);
    
    // 更新密码并清除临时密码标记
    await pool.query(
      `UPDATE users 
       SET password_hash = $1, is_temp_password = FALSE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newPasswordHash, id]
    );
    
    // 保存密码历史
    await passwordService.savePasswordHistory(id, newPasswordHash);
    
    // 使旧会话失效（保留当前会话）
    if (currentRefreshToken) {
      await sessionService.revokeAllSessionsExcept(id, currentRefreshToken);
    } else {
      await sessionService.revokeAllSessions(id);
    }
    
    console.log(`[User] 密码修改成功: ID ${id}`);
  }

  /**
   * 删除用户
   */
  async deleteUser(id: number): Promise<void> {
    // 检查是否是最后一个管理员
    const user = await this.getUserById(id);
    
    if (!user) {
      throw new Error('用户不存在');
    }
    
    if (user.role === 'admin') {
      const adminCount = await this.countAdmins();
      
      if (adminCount <= 1) {
        throw new Error('不能删除最后一个管理员');
      }
    }
    
    // 先使所有会话失效
    await sessionService.revokeAllSessions(id);
    
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );
    
    console.log(`[User] 用户删除成功: ID ${id}`);
  }

  /**
   * 管理员重置用户密码
   * 生成临时密码并设置 is_temp_password 标记
   */
  async resetPassword(userId: number): Promise<string> {
    // 生成8位随机临时密码
    const tempPassword = this.generateTempPassword();
    
    // 哈希临时密码
    const passwordHash = await authService.hashPassword(tempPassword);
    
    // 更新用户密码并设置临时密码标记
    await pool.query(
      `UPDATE users 
       SET password_hash = $1, is_temp_password = TRUE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [passwordHash, userId]
    );
    
    // 保存密码历史
    await passwordService.savePasswordHistory(userId, passwordHash);
    
    // 使所有旧会话失效
    await sessionService.revokeAllSessions(userId);
    
    console.log(`[User] 管理员重置密码成功: ID ${userId}`);
    
    return tempPassword;
  }

  /**
   * 生成临时密码（8位随机字符）
   */
  private generateTempPassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    
    for (let i = 0; i < 8; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      password += chars[randomIndex];
    }
    
    return password;
  }

  /**
   * 获取用户列表（分页和搜索）
   */
  async getUsers(
    page: number = 1,
    pageSize: number = 10,
    search?: string,
    subscriptionPlan?: string
  ): Promise<{
    users: Array<User & { invitedCount: number; subscriptionPlanName?: string }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const offset = (page - 1) * pageSize;
    
    let whereClause = '';
    const params: any[] = [];
    
    if (search) {
      whereClause = 'WHERE u.username ILIKE $1';
      params.push(`%${search}%`);
    }
    
    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);
    
    // 获取用户列表（包括邀请数量和订阅套餐名称）
    // 使用LATERAL子查询获取每个用户最新的有效订阅
    let havingClause = '';
    if (subscriptionPlan) {
      if (subscriptionPlan === '无订阅') {
        havingClause = 'HAVING latest_sub.plan_name IS NULL';
      } else {
        params.push(subscriptionPlan);
        havingClause = `HAVING latest_sub.plan_name = $${params.length}`;
      }
    }
    
    const usersResult = await pool.query(
      `SELECT 
        u.id, u.username, u.invitation_code, u.invited_by_code, u.role, 
        u.is_temp_password, u.created_at, u.updated_at, u.last_login_at,
        COUNT(DISTINCT invited.id) as invited_count,
        latest_sub.plan_name as subscription_plan_name
       FROM users u
       LEFT JOIN users invited ON invited.invited_by_code = u.invitation_code
       LEFT JOIN LATERAL (
         SELECT p.plan_name
         FROM user_subscriptions us
         JOIN subscription_plans p ON p.id = us.plan_id
         WHERE us.user_id = u.id 
           AND us.status = 'active'
           AND (us.end_date IS NULL OR us.end_date > NOW())
         ORDER BY us.created_at DESC
         LIMIT 1
       ) latest_sub ON true
       ${whereClause}
       GROUP BY u.id, latest_sub.plan_name
       ${havingClause}
       ORDER BY u.created_at DESC
       LIMIT $` + (params.length + 1) + ` OFFSET $` + (params.length + 2),
      [...params, pageSize, offset]
    );
    
    const users = usersResult.rows.map(row => ({
      id: row.id,
      username: row.username,
      invitation_code: row.invitation_code,
      invited_by_code: row.invited_by_code,
      role: row.role,
      is_temp_password: row.is_temp_password,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_login_at: row.last_login_at,
      invitedCount: parseInt(row.invited_count),
      subscriptionPlanName: row.subscription_plan_name || '无订阅'
    }));
    
    return {
      users,
      total,
      page,
      pageSize
    };
  }
}

export const userService = UserService.getInstance();
