import crypto from 'crypto';

/**
 * 加密服务
 * 用于加密/解密敏感信息（如API密钥）
 */
export class EncryptionService {
  private algorithm = 'aes-256-cbc';
  private key: Buffer;
  private ivLength = 16;

  constructor() {
    // 从环境变量获取加密密钥
    const encryptionKey = process.env.API_KEY_ENCRYPTION_KEY;
    
    if (!encryptionKey) {
      throw new Error('API_KEY_ENCRYPTION_KEY environment variable is not set');
    }

    // 确保密钥长度为32字节（256位）
    this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
  }

  /**
   * 加密文本
   * @param text 要加密的明文
   * @returns 加密后的文本（格式：iv:encryptedData）
   */
  encrypt(text: string): string {
    if (!text) {
      throw new Error('Text to encrypt cannot be empty');
    }

    // 生成随机初始化向量
    const iv = crypto.randomBytes(this.ivLength);
    
    // 创建加密器
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    // 加密数据
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 返回格式：iv:encryptedData
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * 解密文本
   * @param encryptedText 加密的文本（格式：iv:encryptedData）
   * @returns 解密后的明文
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) {
      throw new Error('Encrypted text cannot be empty');
    }

    try {
      // 分离IV和加密数据
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted text format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedData = parts[1];

      // 创建解密器
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      
      // 解密数据
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: any) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * 验证加密密钥是否正确配置
   */
  static validateEncryptionKey(): boolean {
    try {
      const service = new EncryptionService();
      const testText = 'test';
      const encrypted = service.encrypt(testText);
      const decrypted = service.decrypt(encrypted);
      return decrypted === testText;
    } catch (error) {
      return false;
    }
  }

  /**
   * 生成随机加密密钥（用于初始化配置）
   */
  static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

// 导出单例
export const encryptionService = new EncryptionService();
