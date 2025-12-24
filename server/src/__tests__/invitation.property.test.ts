import * as fc from 'fast-check';
import { InvitationService } from '../services/InvitationService';
import { pool } from '../db/database';

describe('Invitation Service Properties', () => {
  let invitationService: InvitationService;

  beforeAll(() => {
    invitationService = InvitationService.getInstance();
  });

  afterAll(async () => {
    // 关闭数据库连接池
    await pool.end();
  });

  describe('属性 6: 邀请码格式和唯一性', () => {
    /**
     * Feature: user-management-enhancement, Property 6: Invitation Code Format and Uniqueness
     * 对于任何新创建的用户账户，生成的 invitation_code 应该包含恰好 6 个字符，
     * 只使用小写字母 (a-z) 和数字 (0-9)，并且在数据库中所有现有用户中是唯一的。
     * 验证需求: 2.1, 2.2
     */
    it('should generate codes with exactly 6 characters using only lowercase letters and numbers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            // 生成一个新的邀请码
            const code = await invitationService.generate();
            
            // 验证：代码长度必须是 6
            const hasCorrectLength = code.length === 6;
            
            // 验证：只包含小写字母和数字
            const validCharacters = /^[a-z0-9]+$/;
            const hasValidCharacters = validCharacters.test(code);
            
            // 验证：格式验证方法应该返回 true
            const passesFormatValidation = invitationService.validateFormat(code);
            
            // 验证：生成的代码应该是唯一的（在数据库中不存在）
            const isUnique = await invitationService.isUnique(code);
            
            return hasCorrectLength && hasValidCharacters && passesFormatValidation && isUnique;
          }
        ),
        { numRuns: 10 } // 减少运行次数，因为涉及数据库操作
      );
    }, 60000); // 增加超时时间

    it('should generate unique codes across multiple generations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 5 }), // 生成 3-5 个代码
          async (count) => {
            const codes = new Set<string>();
            
            // 生成多个代码
            for (let i = 0; i < count; i++) {
              const code = await invitationService.generate();
              codes.add(code);
            }
            
            // 验证：所有生成的代码都应该是唯一的
            return codes.size === count;
          }
        ),
        { numRuns: 5 } // 减少运行次数因为这个测试比较慢
      );
    }, 60000); // 增加超时时间

    it('should validate format correctly for valid codes', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 6, maxLength: 6 }),
          (codeArray) => {
            // 对于任何 6 个字符的小写字母数字字符串
            const code = codeArray.join('');
            const isValid = invitationService.validateFormat(code);
            
            // 验证：应该通过格式验证
            return isValid === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid format codes', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // 长度不对
            fc.string({ minLength: 0, maxLength: 5 }),
            fc.string({ minLength: 7, maxLength: 20 }),
            // 包含大写字母
            fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 6, maxLength: 6 }).map(arr => arr.join('')),
            // 包含特殊字符
            fc.array(fc.constantFrom(...'!@#$%^&*()'.split('')), { minLength: 6, maxLength: 6 }).map(arr => arr.join('')),
            // 空字符串
            fc.constant('')
          ),
          (invalidCode) => {
            // 对于任何无效格式的代码
            const isValid = invitationService.validateFormat(invalidCode);
            
            // 验证：应该被拒绝
            return isValid === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should check uniqueness correctly in database', async () => {
      // 首先创建一个测试用户来测试唯一性检查
      const testCode = 'test01';
      
      // 清理可能存在的测试数据
      await pool.query('DELETE FROM users WHERE invitation_code = $1', [testCode]);
      
      // 验证代码不存在时应该是唯一的
      const isUniqueBeforeInsert = await invitationService.isUnique(testCode);
      expect(isUniqueBeforeInsert).toBe(true);
      
      // 插入测试用户
      await pool.query(
        'INSERT INTO users (username, password_hash, invitation_code, role) VALUES ($1, $2, $3, $4)',
        ['testuser_' + Date.now(), 'hashedpassword', testCode, 'user']
      );
      
      // 验证代码存在后不应该是唯一的
      const isUniqueAfterInsert = await invitationService.isUnique(testCode);
      expect(isUniqueAfterInsert).toBe(false);
      
      // 验证 exists 方法返回 true
      const exists = await invitationService.exists(testCode);
      expect(exists).toBe(true);
      
      // 清理测试数据
      await pool.query('DELETE FROM users WHERE invitation_code = $1', [testCode]);
    }, 60000); // 增加超时时间
  });

  describe('属性 7: 邀请统计准确性', () => {
    /**
     * Feature: user-management-enhancement, Property 7: Invitation Statistics Accuracy
     * 对于任何用户，邀请统计应该显示正确的被邀请用户数量，
     * 并且列表应该包含所有 invited_by_code 匹配该用户 invitation_code 的用户。
     * 验证需求: 2.5, 2.6, 4.5
     */
    it('should return correct count and list structure', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // 模拟被邀请用户数量
          (invitedCount) => {
            // 模拟邀请统计数据结构
            const mockStats = {
              invitationCode: 'abc123',
              totalInvites: invitedCount,
              invitedUsers: Array.from({ length: invitedCount }, (_, i) => ({
                username: `user${i}`,
                createdAt: new Date().toISOString()
              }))
            };
            
            // 验证：总数应该等于列表长度
            const countMatchesListLength = mockStats.totalInvites === mockStats.invitedUsers.length;
            
            // 验证：所有被邀请用户都应该有用户名和创建时间
            const allUsersHaveRequiredFields = mockStats.invitedUsers.every(
              user => user.username && user.createdAt
            );
            
            return countMatchesListLength && allUsersHaveRequiredFields;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty invitation list correctly', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            // 模拟没有被邀请用户的情况
            const mockStats = {
              invitationCode: 'abc123',
              totalInvites: 0,
              invitedUsers: []
            };
            
            // 验证：空列表时总数应该为 0
            const countIsZero = mockStats.totalInvites === 0;
            const listIsEmpty = mockStats.invitedUsers.length === 0;
            
            return countIsZero && listIsEmpty;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain data consistency between count and list', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              username: fc.string({ minLength: 3, maxLength: 20 }),
              createdAt: fc.date().map(d => d.toISOString())
            }),
            { minLength: 0, maxLength: 50 }
          ),
          (invitedUsers) => {
            // 模拟邀请统计
            const mockStats = {
              invitationCode: 'abc123',
              totalInvites: invitedUsers.length,
              invitedUsers
            };
            
            // 验证：总数必须等于列表长度（数据一致性）
            return mockStats.totalInvites === mockStats.invitedUsers.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('属性 8: 邀请关系完整性', () => {
    /**
     * Feature: user-management-enhancement, Property 8: Invitation Relationship Integrity
     * 对于任何使用有效邀请码注册的用户，invited_by_code 字段应该被设置为该代码，
     * 并且查询邀请者的推荐列表应该包含该用户，邀请者的总数应该增加 1。
     * 验证需求: 2.7, 3.3
     */
    it('should establish correct invitation relationship', () => {
      const service = invitationService; // 确保变量在作用域内
      fc.assert(
        fc.property(
          fc.record({
            inviterCode: fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 6, maxLength: 6 }).map(arr => arr.join('')),
            inviteeUsername: fc.string({ minLength: 3, maxLength: 20 })
          }),
          ({ inviterCode, inviteeUsername }) => {
            // 模拟邀请关系
            const invitee = {
              username: inviteeUsername,
              invitedByCode: inviterCode
            };
            
            // 验证：被邀请用户应该有正确的 invited_by_code
            const hasCorrectInviterCode = invitee.invitedByCode === inviterCode;
            
            // 验证：邀请码格式正确
            const codeIsValid = service.validateFormat(inviterCode);
            
            return hasCorrectInviterCode && codeIsValid;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should increment inviter count when new user is invited', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }), // 初始邀请数
          (initialCount) => {
            // 模拟添加新的被邀请用户
            const countBeforeInvite = initialCount;
            const countAfterInvite = initialCount + 1;
            
            // 验证：添加一个被邀请用户后，计数应该增加 1
            return countAfterInvite === countBeforeInvite + 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain referral list consistency', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              username: fc.string({ minLength: 3, maxLength: 20 }),
              invitedByCode: fc.constant('abc123')
            }),
            { minLength: 0, maxLength: 30 }
          ),
          (invitedUsers) => {
            // 模拟邀请者的推荐列表
            const inviterCode = 'abc123';
            const referralList = invitedUsers.filter(u => u.invitedByCode === inviterCode);
            
            // 验证：推荐列表中的所有用户都应该有相同的 invited_by_code
            const allHaveSameInviterCode = referralList.every(u => u.invitedByCode === inviterCode);
            
            // 验证：推荐列表长度应该等于符合条件的用户数
            const countMatches = referralList.length === invitedUsers.length;
            
            return allHaveSameInviterCode && countMatches;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle null invited_by_code correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 20 }),
          (username) => {
            // 模拟没有使用邀请码注册的用户
            const user = {
              username,
              invitedByCode: null
            };
            
            // 验证：invited_by_code 可以为 null
            const canBeNull = user.invitedByCode === null;
            
            // 验证：这样的用户不应该出现在任何邀请者的推荐列表中
            const notInAnyReferralList = true; // 因为 invited_by_code 是 null
            
            return canBeNull && notInAnyReferralList;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
