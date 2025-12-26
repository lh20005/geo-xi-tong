import fc from 'fast-check';
import { pool } from '../../db/database';
import { encryptionService } from '../EncryptionService';

describe('EncryptionService Database Integration', () => {
  beforeAll(async () => {
    // 初始化加密服务
    await encryptionService.initialize();
  });
  
  afterAll(async () => {
    // 清理测试数据
    await pool.query('DELETE FROM platform_accounts WHERE account_name LIKE $1', ['test_%']);
  });
  
  describe('Property Tests', () => {
    // Feature: multi-platform-article-publishing, Property 2: Credentials always encrypted in database
    it('should store credentials encrypted in database', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.string({ minLength: 1, maxLength: 50 }),
            password: fc.string({ minLength: 1, maxLength: 100 })
          }),
          async (credentials) => {
            const testAccountName = `test_${Date.now()}_${Math.random()}`;
            const encryptedCreds = encryptionService.encryptObject(credentials);
            
            // 插入测试数据
            await pool.query(
              `INSERT INTO platform_accounts 
               (platform_id, account_name, credentials, status) 
               VALUES ($1, $2, $3, $4)`,
              ['zhihu', testAccountName, encryptedCreds, 'active']
            );
            
            // 直接从数据库查询
            const result = await pool.query(
              'SELECT credentials FROM platform_accounts WHERE account_name = $1',
              [testAccountName]
            );
            
            const storedCreds = result.rows[0].credentials;
            
            // 验证存储的凭证是加密的（不等于明文）
            const isEncrypted = storedCreds !== JSON.stringify(credentials);
            
            // 验证可以解密回原始数据
            const decrypted = encryptionService.decryptObject(storedCreds);
            const canDecrypt = JSON.stringify(decrypted) === JSON.stringify(credentials);
            
            // 清理
            await pool.query(
              'DELETE FROM platform_accounts WHERE account_name = $1',
              [testAccountName]
            );
            
            return isEncrypted && canDecrypt;
          }
        ),
        { numRuns: 20 } // 减少运行次数以加快测试
      );
    });
    
    it('should never store plaintext passwords in database', async () => {
      const testCases = [
        { username: 'user1', password: 'password123' },
        { username: 'user2', password: 'secret456' },
        { username: 'user3', password: 'mypass789' }
      ];
      
      for (const credentials of testCases) {
        const testAccountName = `test_${Date.now()}_${Math.random()}`;
        const encryptedCreds = encryptionService.encryptObject(credentials);
        
        // 插入测试数据
        await pool.query(
          `INSERT INTO platform_accounts 
           (platform_id, account_name, credentials, status) 
           VALUES ($1, $2, $3, $4)`,
          ['zhihu', testAccountName, encryptedCreds, 'active']
        );
        
        // 直接从数据库查询
        const result = await pool.query(
          'SELECT credentials FROM platform_accounts WHERE account_name = $1',
          [testAccountName]
        );
        
        const storedCreds = result.rows[0].credentials;
        
        // 验证密码不以明文形式出现在存储的数据中
        expect(storedCreds).not.toContain(credentials.password);
        expect(storedCreds).not.toContain(credentials.username);
        
        // 清理
        await pool.query(
          'DELETE FROM platform_accounts WHERE account_name = $1',
          [testAccountName]
        );
      }
    });
  });
});
