import crypto from 'crypto';
import { pool } from '../db/database';

/**
 * 加密服务
 * 使用 AES-256-GCM 算法加密敏感数据
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private encryptionKey: Buffer | null = null;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_NAME = 'publishing_master_key';
  private readonly IV_LENGTH = 16;
  private readonly AUTH_TAG_LENGTH = 16;
  
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }
  
  /**
   * 初始化加密服务
   * 从数据库加载或生成新的加密密钥
   */
  public async initialize(): Promise<void> {
    try {
      // 尝试从数据库加载密钥
      const result = await pool.query(
        'SELECT key_value FROM encryption_keys WHERE key_name = $1',
        [this.KEY_NAME]
      );
      
      if (result.rows.length > 0) {
        // 密钥已存在，加载它
        this.encryptionKey = Buffer.from(result.rows[0].key_value, 'base64');
        console.log('✅ 加密密钥已加载');
      } else {
        // 密钥不存在，生成新密钥
        this.encryptionKey = await this.generateKey();
        
        // 保存到数据库
        await pool.query(
          'INSERT INTO encryption_keys (key_name, key_value) VALUES ($1, $2)',
          [this.KEY_NAME, this.encryptionKey.toString('base64')]
        );
        
        console.log('✅ 新加密密钥已生成并保存');
      }
    } catch (error) {
      console.error('❌ 初始化加密服务失败:', error);
      throw error;
    }
  }
  
  /**
   * 生成新的加密密钥
   * @returns 32字节的随机密钥
   */
  public async generateKey(): Promise<Buffer> {
    return crypto.randomBytes(32);
  }
  
  /**
   * 验证密钥有效性
   * @param key 要验证的密钥
   * @returns 密钥是否有效
   */
  public validateKey(key: string): boolean {
    try {
      const buffer = Buffer.from(key, 'base64');
      return buffer.length === 32;
    } catch {
      return false;
    }
  }
  
  /**
   * 加密明文数据
   * @param plaintext 要加密的明文字符串
   * @returns 加密后的密文（base64编码）
   */
  public encrypt(plaintext: string): string {
    if (!this.encryptionKey) {
      throw new Error('加密服务未初始化');
    }
    
    if (!plaintext) {
      throw new Error('明文不能为空');
    }
    
    try {
      // 生成随机IV
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // 创建加密器
      const cipher = crypto.createCipheriv(
        this.ALGORITHM,
        this.encryptionKey,
        iv
      );
      
      // 加密数据
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // 获取认证标签
      const authTag = cipher.getAuthTag();
      
      // 组合 IV + 认证标签 + 密文
      const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'base64')
      ]);
      
      return combined.toString('base64');
    } catch (error) {
      console.error('❌ 加密失败:', error);
      throw new Error('加密失败');
    }
  }
  
  /**
   * 解密密文数据
   * @param ciphertext 要解密的密文（base64编码）
   * @returns 解密后的明文字符串
   */
  public decrypt(ciphertext: string): string {
    if (!this.encryptionKey) {
      throw new Error('加密服务未初始化');
    }
    
    if (!ciphertext) {
      throw new Error('密文不能为空');
    }
    
    try {
      // 解码密文
      const combined = Buffer.from(ciphertext, 'base64');
      
      // 提取 IV、认证标签和加密数据
      const iv = combined.subarray(0, this.IV_LENGTH);
      const authTag = combined.subarray(
        this.IV_LENGTH,
        this.IV_LENGTH + this.AUTH_TAG_LENGTH
      );
      const encrypted = combined.subarray(
        this.IV_LENGTH + this.AUTH_TAG_LENGTH
      );
      
      // 创建解密器
      const decipher = crypto.createDecipheriv(
        this.ALGORITHM,
        this.encryptionKey,
        iv
      );
      
      // 设置认证标签
      decipher.setAuthTag(authTag);
      
      // 解密数据
      let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('❌ 解密失败:', error);
      throw new Error('解密失败');
    }
  }
  
  /**
   * 加密对象（将对象转为JSON后加密）
   * @param obj 要加密的对象
   * @returns 加密后的密文
   */
  public encryptObject(obj: any): string {
    const json = JSON.stringify(obj);
    return this.encrypt(json);
  }
  
  /**
   * 解密对象（解密后解析JSON）
   * @param ciphertext 加密的密文
   * @returns 解密后的对象
   */
  public decryptObject<T = any>(ciphertext: string): T {
    const json = this.decrypt(ciphertext);
    return JSON.parse(json);
  }
}

// 导出单例实例
export const encryptionService = EncryptionService.getInstance();
