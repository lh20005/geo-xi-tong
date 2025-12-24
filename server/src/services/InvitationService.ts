import crypto from 'crypto';
import { pool } from '../db/database';

interface InvitedUser {
  username: string;
  createdAt: string;
}

interface InvitationStats {
  invitationCode: string;
  totalInvites: number;
  invitedUsers: InvitedUser[];
}

export class InvitationService {
  private static instance: InvitationService;
  private readonly CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';
  private readonly CODE_LENGTH = 6;
  private readonly MAX_RETRY_ATTEMPTS = 10;

  private constructor() {}

  public static getInstance(): InvitationService {
    if (!InvitationService.instance) {
      InvitationService.instance = new InvitationService();
    }
    return InvitationService.instance;
  }

  /**
   * 生成唯一的邀请码
   * 使用 crypto.randomBytes 确保安全的随机生成
   * 如果生成的代码已存在，会重试最多 MAX_RETRY_ATTEMPTS 次
   */
  async generate(): Promise<string> {
    for (let attempt = 0; attempt < this.MAX_RETRY_ATTEMPTS; attempt++) {
      const code = this.generateRandomCode();
      
      // 检查唯一性
      const isUnique = await this.isUnique(code);
      
      if (isUnique) {
        console.log(`[Invitation] 生成邀请码成功: ${code}`);
        return code;
      }
      
      console.log(`[Invitation] 邀请码冲突，重试 (${attempt + 1}/${this.MAX_RETRY_ATTEMPTS}): ${code}`);
    }
    
    throw new Error('无法生成唯一的邀请码，已达到最大重试次数');
  }

  /**
   * 生成随机邀请码
   * 使用 crypto.randomBytes 生成加密安全的随机数
   */
  private generateRandomCode(): string {
    const bytes = crypto.randomBytes(this.CODE_LENGTH);
    let code = '';
    
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      const index = bytes[i] % this.CHARSET.length;
      code += this.CHARSET[index];
    }
    
    return code;
  }

  /**
   * 验证邀请码格式
   * 必须是6个字符，只包含小写字母和数字
   */
  validateFormat(code: string): boolean {
    if (!code || code.length !== this.CODE_LENGTH) {
      return false;
    }
    
    const regex = /^[a-z0-9]{6}$/;
    return regex.test(code);
  }

  /**
   * 检查邀请码是否唯一（数据库中不存在）
   */
  async isUnique(code: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE invitation_code = $1',
      [code]
    );
    
    return parseInt(result.rows[0].count) === 0;
  }

  /**
   * 检查邀请码是否存在
   */
  async exists(code: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE invitation_code = $1',
      [code]
    );
    
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * 获取邀请码对应的用户名
   */
  async getInviterUsername(code: string): Promise<string | null> {
    const result = await pool.query(
      'SELECT username FROM users WHERE invitation_code = $1',
      [code]
    );
    
    return result.rows.length > 0 ? result.rows[0].username : null;
  }

  /**
   * 获取用户的邀请统计信息
   * 包括邀请码、总邀请数和被邀请用户列表
   */
  async getInvitationStats(userId: number): Promise<InvitationStats> {
    // 获取用户的邀请码
    const userResult = await pool.query(
      'SELECT invitation_code FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('用户不存在');
    }
    
    const invitationCode = userResult.rows[0].invitation_code;
    
    // 获取被邀请的用户列表
    const invitedResult = await pool.query(
      `SELECT username, created_at 
       FROM users 
       WHERE invited_by_code = $1 
       ORDER BY created_at DESC`,
      [invitationCode]
    );
    
    const invitedUsers: InvitedUser[] = invitedResult.rows.map(row => ({
      username: row.username,
      createdAt: row.created_at.toISOString()
    }));
    
    console.log(`[Invitation] 获取邀请统计: ${invitationCode}, 总数: ${invitedUsers.length}`);
    
    return {
      invitationCode,
      totalInvites: invitedUsers.length,
      invitedUsers
    };
  }

  /**
   * 验证邀请码并返回邀请者信息
   */
  async validateCode(code: string): Promise<{ valid: boolean; inviterUsername?: string }> {
    if (!this.validateFormat(code)) {
      return { valid: false };
    }
    
    const inviterUsername = await this.getInviterUsername(code);
    
    if (inviterUsername) {
      return {
        valid: true,
        inviterUsername
      };
    }
    
    return { valid: false };
  }
}

export const invitationService = InvitationService.getInstance();
