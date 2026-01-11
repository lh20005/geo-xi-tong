/**
 * 邮件服务
 * 使用 Nodemailer 发送邮件（支持 SMTP）
 */

import nodemailer from 'nodemailer';
import { pool } from '../db/database';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;

  private constructor() {
    this.initTransporter();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * 初始化邮件传输器
   */
  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '465');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const fromName = process.env.SMTP_FROM_NAME || 'GEO优化系统';

    if (!host || !user || !pass) {
      console.warn('[EmailService] SMTP 配置不完整，邮件服务未启用');
      return;
    }

    this.config = {
      host,
      port,
      secure: port === 465,
      user,
      pass,
      fromName
    };

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass
      }
    });

    console.log(`[EmailService] 邮件服务已初始化: ${this.config.host}`);
  }

  /**
   * 检查邮件服务是否可用
   */
  public isAvailable(): boolean {
    return this.transporter !== null && this.config !== null;
  }

  /**
   * 发送邮件
   */
  public async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.transporter || !this.config) {
      console.error('[EmailService] 邮件服务未配置');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.user}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      });

      console.log(`[EmailService] 邮件发送成功: ${options.to}, messageId: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error('[EmailService] 邮件发送失败:', error);
      return false;
    }
  }

  /**
   * 生成6位数字验证码
   */
  public generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 创建验证码记录
   */
  public async createVerificationCode(
    target: string,
    type: 'reset_password' | 'verify_email' | 'login',
    userId?: number,
    ipAddress?: string
  ): Promise<string | null> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟有效期

    try {
      // 先删除该目标的旧验证码（同类型）
      await pool.query(
        'DELETE FROM verification_codes WHERE target = $1 AND type = $2',
        [target, type]
      );

      // 创建新验证码
      await pool.query(
        `INSERT INTO verification_codes (target, code, type, user_id, expires_at, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [target, code, type, userId || null, expiresAt, ipAddress || null]
      );

      console.log(`[EmailService] 验证码已创建: ${target}, type: ${type}`);
      return code;
    } catch (error) {
      console.error('[EmailService] 创建验证码失败:', error);
      return null;
    }
  }

  /**
   * 验证验证码
   */
  public async verifyCode(
    target: string,
    code: string,
    type: 'reset_password' | 'verify_email' | 'login'
  ): Promise<{ valid: boolean; userId?: number; message: string }> {
    try {
      // 查找验证码
      const result = await pool.query(
        `SELECT * FROM verification_codes 
         WHERE target = $1 AND type = $2 AND used = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [target, type]
      );

      if (result.rows.length === 0) {
        return { valid: false, message: '验证码不存在或已过期' };
      }

      const record = result.rows[0];

      // 检查是否过期
      if (new Date(record.expires_at) < new Date()) {
        return { valid: false, message: '验证码已过期' };
      }

      // 检查尝试次数（最多5次）
      if (record.attempts >= 5) {
        return { valid: false, message: '验证码尝试次数过多，请重新获取' };
      }

      // 更新尝试次数
      await pool.query(
        'UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1',
        [record.id]
      );

      // 验证码匹配
      if (record.code !== code) {
        return { valid: false, message: '验证码错误' };
      }

      // 标记为已使用
      await pool.query(
        'UPDATE verification_codes SET used = TRUE WHERE id = $1',
        [record.id]
      );

      return { 
        valid: true, 
        userId: record.user_id,
        message: '验证成功' 
      };
    } catch (error) {
      console.error('[EmailService] 验证码验证失败:', error);
      return { valid: false, message: '验证失败，请重试' };
    }
  }

  /**
   * 发送密码重置验证码
   */
  public async sendPasswordResetCode(email: string, code: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px 0; }
          .logo { font-size: 24px; font-weight: bold; color: #4F46E5; }
          .content { background: #f9fafb; border-radius: 8px; padding: 30px; margin: 20px 0; }
          .code { font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 4px; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }
          .warning { color: #DC2626; font-size: 14px; margin-top: 20px; }
          .footer { text-align: center; color: #6B7280; font-size: 12px; padding: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">GEO优化系统</div>
          </div>
          <div class="content">
            <h2 style="margin-top: 0;">密码重置验证码</h2>
            <p>您正在重置密码，请使用以下验证码：</p>
            <div class="code">${code}</div>
            <p>验证码有效期为 <strong>10分钟</strong>，请尽快使用。</p>
            <p class="warning">⚠️ 如果这不是您本人的操作，请忽略此邮件，您的账户是安全的。</p>
          </div>
          <div class="footer">
            <p>此邮件由系统自动发送，请勿回复</p>
            <p>© ${new Date().getFullYear()} GEO优化系统</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: '【GEO优化系统】密码重置验证码',
      html,
      text: `您的密码重置验证码是：${code}，有效期10分钟。如非本人操作，请忽略此邮件。`
    });
  }

  /**
   * 发送邮箱验证码（用于绑定邮箱）
   */
  public async sendEmailVerificationCode(email: string, code: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px 0; }
          .logo { font-size: 24px; font-weight: bold; color: #4F46E5; }
          .content { background: #f9fafb; border-radius: 8px; padding: 30px; margin: 20px 0; }
          .code { font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 4px; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; color: #6B7280; font-size: 12px; padding: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">GEO优化系统</div>
          </div>
          <div class="content">
            <h2 style="margin-top: 0;">邮箱验证码</h2>
            <p>您正在绑定邮箱，请使用以下验证码：</p>
            <div class="code">${code}</div>
            <p>验证码有效期为 <strong>10分钟</strong>，请尽快使用。</p>
          </div>
          <div class="footer">
            <p>此邮件由系统自动发送，请勿回复</p>
            <p>© ${new Date().getFullYear()} GEO优化系统</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: '【GEO优化系统】邮箱验证码',
      html,
      text: `您的邮箱验证码是：${code}，有效期10分钟。`
    });
  }

  /**
   * 清理过期验证码
   */
  public async cleanupExpiredCodes(): Promise<number> {
    try {
      const result = await pool.query('SELECT cleanup_expired_verification_codes()');
      const count = result.rows[0].cleanup_expired_verification_codes;
      if (count > 0) {
        console.log(`[EmailService] 清理了 ${count} 个过期验证码`);
      }
      return count;
    } catch (error) {
      console.error('[EmailService] 清理过期验证码失败:', error);
      return 0;
    }
  }
}

export const emailService = EmailService.getInstance();
