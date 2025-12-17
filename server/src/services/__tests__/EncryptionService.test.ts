import fc from 'fast-check';
import { EncryptionService } from '../EncryptionService';
import crypto from 'crypto';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  
  beforeAll(async () => {
    // 创建测试用的加密服务实例
    encryptionService = EncryptionService.getInstance();
    
    // 直接设置一个测试密钥，绕过数据库初始化
    const testKey = crypto.randomBytes(32);
    (encryptionService as any).encryptionKey = testKey;
  });
  
  describe('Property Tests', () => {
    // Feature: multi-platform-article-publishing, Property 1: Encryption round-trip consistency
    it('should maintain data integrity through encrypt-decrypt cycle', () => {
      fc.assert(
        fc.property(fc.string(), (plaintext) => {
          if (!plaintext) return true; // Skip empty strings as they're handled separately
          
          const encrypted = encryptionService.encrypt(plaintext);
          const decrypted = encryptionService.decrypt(encrypted);
          
          return decrypted === plaintext;
        }),
        { numRuns: 100 }
      );
    });
    
    it('should handle various string lengths in round-trip', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (plaintext) => {
            const encrypted = encryptionService.encrypt(plaintext);
            const decrypted = encryptionService.decrypt(encrypted);
            
            return decrypted === plaintext;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should handle JSON objects in round-trip', () => {
      fc.assert(
        fc.property(
          fc.record({
            username: fc.string(),
            password: fc.string(),
            token: fc.option(fc.string()),
            metadata: fc.option(fc.record({
              lastLogin: fc.date(),
              attempts: fc.integer()
            }))
          }),
          (obj) => {
            const encrypted = encryptionService.encryptObject(obj);
            const decrypted = encryptionService.decryptObject(encrypted);
            
            return JSON.stringify(decrypted) === JSON.stringify(obj);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Unit Tests', () => {
    it('should encrypt plaintext to non-plaintext ciphertext', () => {
      const plaintext = 'myPassword123';
      const encrypted = encryptionService.encrypt(plaintext);
      
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(0);
    });
    
    it('should throw error when encrypting empty string', () => {
      expect(() => encryptionService.encrypt('')).toThrow('明文不能为空');
    });
    
    it('should throw error when decrypting empty string', () => {
      expect(() => encryptionService.decrypt('')).toThrow('密文不能为空');
    });
    
    it('should throw error when decrypting invalid ciphertext', () => {
      expect(() => encryptionService.decrypt('invalid-base64')).toThrow('解密失败');
    });
    
    it('should validate correct key format', () => {
      const validKey = Buffer.from('a'.repeat(32)).toString('base64');
      expect(encryptionService.validateKey(validKey)).toBe(true);
    });
    
    it('should reject invalid key format', () => {
      expect(encryptionService.validateKey('short')).toBe(false);
      expect(encryptionService.validateKey('not-base64!!!')).toBe(false);
    });
    
    it('should generate 32-byte keys', async () => {
      const key = await encryptionService.generateKey();
      expect(key.length).toBe(32);
    });
  });
});
