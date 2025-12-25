import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * 数据加密服务
 * Requirements: 14.1, 14.2, 14.4, 14.5
 */
export class EncryptionService {
  // bcrypt cost factor (Requirement 14.1)
  private static readonly BCRYPT_ROUNDS = 10;

  // AES-256加密配置 (Requirement 14.2)
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 64;

  // 加密密钥（应从环境变量获取）
  private encryptionKey: Buffer;

  constructor(encryptionKey?: string) {
    // 从环境变量或参数获取密钥
    const key = encryptionKey || process.env.ENCRYPTION_KEY || 'default-key-for-development-only';
    
    // 生成32字节密钥（AES-256需要）
    this.encryptionKey = crypto.scryptSync(key, 'salt', 32);
  }

  /**
   * 使用bcrypt哈希密码
   * Requirement 14.1
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, EncryptionService.BCRYPT_ROUNDS);
  }

  /**
   * 验证密码
   * Requirement 14.1
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * 获取bcrypt cost factor
   * Requirement 14.1
   */
  getBcryptRounds(): number {
    return EncryptionService.BCRYPT_ROUNDS;
  }

  /**
   * 使用AES-256-GCM加密敏感配置
   * Requirement 14.2
   */
  encryptConfig(plaintext: string): string {
    // 生成随机IV
    const iv = crypto.randomBytes(EncryptionService.IV_LENGTH);

    // 创建加密器
    const cipher = crypto.createCipheriv(
      EncryptionService.ALGORITHM,
      this.encryptionKey,
      iv
    );

    // 加密数据
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 获取认证标签
    const authTag = cipher.getAuthTag();

    // 返回格式: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * 解密敏感配置
   * Requirement 14.2
   */
  decryptConfig(ciphertext: string): string {
    // 解析加密数据
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    // 创建解密器
    const decipher = crypto.createDecipheriv(
      EncryptionService.ALGORITHM,
      this.encryptionKey,
      iv
    );

    // 设置认证标签
    decipher.setAuthTag(authTag);

    // 解密数据
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * 哈希刷新令牌
   * Requirement 14.4
   */
  hashToken(token: string): string {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }

  /**
   * 生成安全随机令牌
   * Requirement 14.5
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 生成安全随机数
   * Requirement 14.5
   */
  generateSecureRandom(min: number, max: number): number {
    const range = max - min + 1;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const maxValue = Math.pow(256, bytesNeeded);
    const randomBytes = crypto.randomBytes(bytesNeeded);
    const randomValue = randomBytes.readUIntBE(0, bytesNeeded);
    
    // 使用rejection sampling确保均匀分布
    if (randomValue >= maxValue - (maxValue % range)) {
      return this.generateSecureRandom(min, max);
    }
    
    return min + (randomValue % range);
  }

  /**
   * 验证加密算法
   */
  getEncryptionAlgorithm(): string {
    return EncryptionService.ALGORITHM;
  }

  /**
   * 生成密钥派生
   */
  deriveKey(password: string, salt: string): Buffer {
    return crypto.scryptSync(password, salt, 32);
  }

  /**
   * 生成随机盐
   */
  generateSalt(): string {
    return crypto.randomBytes(EncryptionService.SALT_LENGTH).toString('hex');
  }
}

// 导出单例
export const encryptionService = new EncryptionService();
