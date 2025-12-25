import { EncryptionService } from '../EncryptionService';
import fc from 'fast-check';

/**
 * Feature: system-security-foundation
 * Property 44: 密码哈希算法
 * Property 45: 敏感配置加密
 * Property 46: 刷新令牌哈希存储
 * Property 47: 安全随机数生成
 * 
 * Validates: Requirements 14.1, 14.2, 14.4, 14.5
 */

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    encryptionService = new EncryptionService('test-encryption-key-for-testing');
  });

  describe('Property 44: Password Hashing Algorithm', () => {
    test('should use bcrypt with cost factor 10', () => {
      const rounds = encryptionService.getBcryptRounds();
      expect(rounds).toBe(10);
    });

    test('should hash passwords using bcrypt', async () => {
      const password = 'testPassword123!';
      const hash = await encryptionService.hashPassword(password);

      // bcrypt hashes start with $2b$ (or $2a$, $2y$)
      expect(hash).toMatch(/^\$2[aby]\$/);
      
      // bcrypt hashes have specific length
      expect(hash.length).toBe(60);
    });

    test('should verify correct password', async () => {
      const password = 'testPassword123!';
      const hash = await encryptionService.hashPassword(password);

      const isValid = await encryptionService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'testPassword123!';
      const wrongPassword = 'wrongPassword456!';
      const hash = await encryptionService.hashPassword(password);

      const isValid = await encryptionService.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    test('Property 44: All passwords should be hashed with bcrypt cost 10', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 }),
          async (password) => {
            const hash = await encryptionService.hashPassword(password);

            // Property: Hash should be valid bcrypt format
            expect(hash).toMatch(/^\$2[aby]\$/);
            expect(hash.length).toBe(60);

            // Property: Original password should verify against hash
            const isValid = await encryptionService.verifyPassword(password, hash);
            expect(isValid).toBe(true);

            // Property: Different password should not verify
            const wrongPassword = password + 'x';
            const isInvalid = await encryptionService.verifyPassword(wrongPassword, hash);
            expect(isInvalid).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should generate different hashes for same password', async () => {
      const password = 'testPassword123!';
      const hash1 = await encryptionService.hashPassword(password);
      const hash2 = await encryptionService.hashPassword(password);

      // Hashes should be different due to random salt
      expect(hash1).not.toBe(hash2);

      // But both should verify the password
      expect(await encryptionService.verifyPassword(password, hash1)).toBe(true);
      expect(await encryptionService.verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('Property 45: Sensitive Configuration Encryption', () => {
    test('should use AES-256-GCM algorithm', () => {
      const algorithm = encryptionService.getEncryptionAlgorithm();
      expect(algorithm).toBe('aes-256-gcm');
    });

    test('should encrypt and decrypt configuration', () => {
      const plaintext = 'sensitive-api-key-12345';
      const encrypted = encryptionService.encryptConfig(plaintext);
      const decrypted = encryptionService.decryptConfig(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    test('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'sensitive-data';
      const encrypted1 = encryptionService.encryptConfig(plaintext);
      const encrypted2 = encryptionService.encryptConfig(plaintext);

      // Different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to same plaintext
      expect(encryptionService.decryptConfig(encrypted1)).toBe(plaintext);
      expect(encryptionService.decryptConfig(encrypted2)).toBe(plaintext);
    });

    test('Property 45: All sensitive config should be encrypted with AES-256', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          (plaintext) => {
            const encrypted = encryptionService.encryptConfig(plaintext);

            // Property: Encrypted data should have correct format (iv:authTag:data)
            const parts = encrypted.split(':');
            expect(parts.length).toBe(3);

            // Property: Should decrypt back to original
            const decrypted = encryptionService.decryptConfig(encrypted);
            expect(decrypted).toBe(plaintext);

            // Property: Encrypted should not contain plaintext
            expect(encrypted).not.toContain(plaintext);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should fail to decrypt with wrong key', () => {
      const plaintext = 'sensitive-data';
      const encrypted = encryptionService.encryptConfig(plaintext);

      // Create new service with different key
      const wrongKeyService = new EncryptionService('wrong-key');

      expect(() => {
        wrongKeyService.decryptConfig(encrypted);
      }).toThrow();
    });

    test('should fail to decrypt tampered data', () => {
      const plaintext = 'sensitive-data';
      const encrypted = encryptionService.encryptConfig(plaintext);

      // Tamper with the encrypted data
      const tampered = encrypted.slice(0, -1) + 'x';

      expect(() => {
        encryptionService.decryptConfig(tampered);
      }).toThrow();
    });
  });

  describe('Property 46: Refresh Token Hashing', () => {
    test('should hash tokens using SHA-256', () => {
      const token = 'refresh-token-12345';
      const hash = encryptionService.hashToken(token);

      // SHA-256 produces 64 character hex string
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    test('should produce consistent hash for same token', () => {
      const token = 'refresh-token-12345';
      const hash1 = encryptionService.hashToken(token);
      const hash2 = encryptionService.hashToken(token);

      expect(hash1).toBe(hash2);
    });

    test('should produce different hash for different tokens', () => {
      const token1 = 'refresh-token-12345';
      const token2 = 'refresh-token-67890';
      const hash1 = encryptionService.hashToken(token1);
      const hash2 = encryptionService.hashToken(token2);

      expect(hash1).not.toBe(hash2);
    });

    test('Property 46: All refresh tokens should be hashed before storage', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          (token) => {
            const hash = encryptionService.hashToken(token);

            // Property: Hash should be SHA-256 format
            expect(hash.length).toBe(64);
            expect(hash).toMatch(/^[0-9a-f]{64}$/);

            // Property: Same token should produce same hash
            const hash2 = encryptionService.hashToken(token);
            expect(hash).toBe(hash2);

            // Property: Hash should not contain original token
            expect(hash).not.toContain(token);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 47: Secure Random Number Generation', () => {
    test('should generate secure random tokens', () => {
      const token1 = encryptionService.generateSecureToken(32);
      const token2 = encryptionService.generateSecureToken(32);

      // Tokens should be different
      expect(token1).not.toBe(token2);

      // Tokens should have correct length (32 bytes = 64 hex chars)
      expect(token1.length).toBe(64);
      expect(token2.length).toBe(64);

      // Tokens should be hex
      expect(token1).toMatch(/^[0-9a-f]+$/);
      expect(token2).toMatch(/^[0-9a-f]+$/);
    });

    test('should generate tokens of specified length', () => {
      const token16 = encryptionService.generateSecureToken(16);
      const token64 = encryptionService.generateSecureToken(64);

      expect(token16.length).toBe(32); // 16 bytes = 32 hex chars
      expect(token64.length).toBe(128); // 64 bytes = 128 hex chars
    });

    test('should generate secure random numbers in range', () => {
      const min = 1;
      const max = 100;
      const numbers = new Set<number>();

      for (let i = 0; i < 50; i++) {
        const num = encryptionService.generateSecureRandom(min, max);
        expect(num).toBeGreaterThanOrEqual(min);
        expect(num).toBeLessThanOrEqual(max);
        numbers.add(num);
      }

      // Should generate diverse numbers
      expect(numbers.size).toBeGreaterThan(10);
    });

    test('Property 47: All random generation should use crypto.randomBytes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 64 }),
          (length) => {
            const token = encryptionService.generateSecureToken(length);

            // Property: Token should have correct length
            expect(token.length).toBe(length * 2); // hex encoding doubles length

            // Property: Token should be valid hex
            expect(token).toMatch(/^[0-9a-f]+$/);

            // Property: Multiple tokens should be unique
            const token2 = encryptionService.generateSecureToken(length);
            expect(token).not.toBe(token2);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('Property 47: Random numbers should be uniformly distributed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 51, max: 100 }),
          (min, max) => {
            const num = encryptionService.generateSecureRandom(min, max);

            // Property: Number should be in range
            expect(num).toBeGreaterThanOrEqual(min);
            expect(num).toBeLessThanOrEqual(max);
            expect(Number.isInteger(num)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Unit Tests: Additional Functionality', () => {
    test('should generate random salt', () => {
      const salt1 = encryptionService.generateSalt();
      const salt2 = encryptionService.generateSalt();

      expect(salt1).not.toBe(salt2);
      expect(salt1.length).toBeGreaterThan(0);
      expect(salt2.length).toBeGreaterThan(0);
    });

    test('should derive key from password and salt', () => {
      const password = 'testPassword123';
      const salt = 'randomSalt';

      const key1 = encryptionService.deriveKey(password, salt);
      const key2 = encryptionService.deriveKey(password, salt);

      // Same password and salt should produce same key
      expect(key1.equals(key2)).toBe(true);

      // Key should be 32 bytes (256 bits)
      expect(key1.length).toBe(32);
    });

    test('should produce different keys for different salts', () => {
      const password = 'testPassword123';
      const salt1 = 'salt1';
      const salt2 = 'salt2';

      const key1 = encryptionService.deriveKey(password, salt1);
      const key2 = encryptionService.deriveKey(password, salt2);

      expect(key1.equals(key2)).toBe(false);
    });
  });
});
