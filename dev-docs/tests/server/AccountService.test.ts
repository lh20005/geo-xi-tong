import fc from 'fast-check';
import { AccountService } from '../AccountService';
import { encryptionService } from '../EncryptionService';
import crypto from 'crypto';

// Mock the database pool
jest.mock('../../db/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn()
  }
}));

import { pool } from '../../db/database';

describe('AccountService', () => {
  let accountService: AccountService;
  
  beforeAll(() => {
    // 初始化加密服务（使用测试密钥）
    const testKey = crypto.randomBytes(32);
    (encryptionService as any).encryptionKey = testKey;
    
    accountService = new AccountService();
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Property Tests', () => {
    // Feature: multi-platform-article-publishing, Property 7: Credential validation rejects invalid formats
    it('should reject invalid credential formats', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant(123),
            fc.constant([]),
            fc.record({ username: fc.constant('') }), // Missing password
            fc.record({ password: fc.constant('test') }), // Missing username
            fc.record({ username: fc.constant(''), password: fc.constant('test') }), // Empty username
            fc.record({ username: fc.constant('test'), password: fc.constant('') }) // Empty password
          ),
          (invalidCredentials) => {
            expect(() => {
              (accountService as any).validateCredentials(invalidCredentials);
            }).toThrow();
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('should accept valid credential formats', () => {
      fc.assert(
        fc.property(
          fc.record({
            username: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            password: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
          }),
          (validCredentials) => {
            expect(() => {
              (accountService as any).validateCredentials(validCredentials);
            }).not.toThrow();
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    // Feature: multi-platform-article-publishing, Property 8: Valid credentials are encrypted before storage
    it('should encrypt credentials before storage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            platform_id: fc.constantFrom('zhihu', 'wangyi', 'baijiahao'),
            account_name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            credentials: fc.record({
              username: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              password: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
            })
          }),
          async (input) => {
            // Clear previous mocks
            jest.clearAllMocks();
            
            // Mock database response
            (pool.query as jest.Mock).mockResolvedValueOnce({
              rows: [{
                id: 1,
                ...input,
                credentials: 'encrypted_data',
                is_default: false,
                status: 'active',
                created_at: new Date(),
                updated_at: new Date()
              }]
            });
            
            await accountService.createAccount(input);
            
            // Verify that pool.query was called
            expect(pool.query).toHaveBeenCalled();
            
            // Get the credentials parameter passed to the query
            const queryCall = (pool.query as jest.Mock).mock.calls[0];
            const storedCredentials = queryCall[1][2]; // Third parameter is credentials
            
            // Verify credentials are encrypted (not equal to original)
            const originalJson = JSON.stringify(input.credentials);
            const isEncrypted = storedCredentials !== originalJson;
            
            // Verify we can decrypt back to original
            try {
              const decrypted = encryptionService.decryptObject(storedCredentials);
              const canDecrypt = JSON.stringify(decrypted) === originalJson;
              return isEncrypted && canDecrypt;
            } catch (error) {
              console.error('Decryption failed:', error);
              return false;
            }
          }
        ),
        { numRuns: 20 }
      );
    });
    
    // Feature: multi-platform-article-publishing, Property 3: Account deletion removes all data
    it('should remove all account data on deletion', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          async (accountId) => {
            // Mock successful deletion
            (pool.query as jest.Mock).mockResolvedValueOnce({
              rowCount: 1
            });
            
            await accountService.deleteAccount(accountId);
            
            // Verify DELETE query was called with correct ID
            expect(pool.query).toHaveBeenCalledWith(
              'DELETE FROM platform_accounts WHERE id = $1',
              [accountId]
            );
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('should throw error when deleting non-existent account', async () => {
      // Mock no rows deleted
      (pool.query as jest.Mock).mockResolvedValue({
        rowCount: 0
      });
      
      await expect(accountService.deleteAccount(999)).rejects.toThrow('账号不存在');
    });
    
    // Feature: multi-platform-article-publishing, Property 25: Multiple accounts per platform supported
    it('should support multiple accounts for the same platform', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            platform_id: fc.constantFrom('zhihu', 'wangyi'),
            accounts: fc.array(
              fc.record({
                account_name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                credentials: fc.record({
                  username: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                  password: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
                })
              }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          async ({ platform_id, accounts }) => {
            // Mock database responses for each account creation
            for (let i = 0; i < accounts.length; i++) {
              (pool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{
                  id: i + 1,
                  platform_id,
                  account_name: accounts[i].account_name,
                  credentials: 'encrypted',
                  is_default: false,
                  status: 'active',
                  created_at: new Date(),
                  updated_at: new Date()
                }]
              });
            }
            
            // Create multiple accounts for the same platform
            const createdAccounts = [];
            for (const account of accounts) {
              const created = await accountService.createAccount({
                platform_id,
                ...account
              });
              createdAccounts.push(created);
            }
            
            // Verify all accounts were created
            expect(createdAccounts.length).toBe(accounts.length);
            
            // Verify all have the same platform_id
            const allSamePlatform = createdAccounts.every(
              acc => acc.platform_id === platform_id
            );
            
            return allSamePlatform;
          }
        ),
        { numRuns: 10 }
      );
    });
  });
  
  describe('Unit Tests', () => {
    it('should validate credentials with username and password', () => {
      const validCreds = { username: 'test', password: 'pass123' };
      expect(() => {
        (accountService as any).validateCredentials(validCreds);
      }).not.toThrow();
    });
    
    it('should reject credentials without username', () => {
      const invalidCreds = { password: 'pass123' };
      expect(() => {
        (accountService as any).validateCredentials(invalidCreds);
      }).toThrow('凭证必须包含用户名和密码');
    });
    
    it('should reject credentials without password', () => {
      const invalidCreds = { username: 'test' };
      expect(() => {
        (accountService as any).validateCredentials(invalidCreds);
      }).toThrow('凭证必须包含用户名和密码');
    });
    
    it('should reject empty username', () => {
      const invalidCreds = { username: '', password: 'pass123' };
      expect(() => {
        (accountService as any).validateCredentials(invalidCreds);
      }).toThrow();
    });
    
    it('should reject empty password', () => {
      const invalidCreds = { username: 'test', password: '' };
      expect(() => {
        (accountService as any).validateCredentials(invalidCreds);
      }).toThrow();
    });
  });
});
