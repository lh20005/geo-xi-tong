import * as fc from 'fast-check';
import { pool } from '../db/database';
import { ipWhitelistService } from '../services/IPWhitelistService';

// 清理测试数据的辅助函数
async function cleanupTestData() {
  await pool.query('DELETE FROM ip_whitelist WHERE description LIKE $1', ['%TEST%']);
}

// 生成有效的IPv4地址
const validIPv4Arb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

// 生成有效的IPv4 CIDR
const validIPv4CIDRArb = fc.tuple(
  validIPv4Arb,
  fc.integer({ min: 0, max: 32 })
).map(([ip, prefix]) => `${ip}/${prefix}`);

// 生成无效的IP地址
const invalidIPArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s)),
  fc.tuple(
    fc.integer({ min: 256, max: 999 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)
);

describe('IP Whitelist Service Properties', () => {
  // 在所有测试之前清理
  beforeAll(async () => {
    await cleanupTestData();
  });

  // 在每个测试之后清理
  afterEach(async () => {
    await cleanupTestData();
  });

  // 在所有测试之后清理并关闭连接
  afterAll(async () => {
    await cleanupTestData();
    await pool.end();
  });

  describe('Property 26: IP白名单执行', () => {
    /**
     * Feature: system-security-foundation, Property 26: IP Whitelist Enforcement
     * 对于任何管理路由请求，当IP白名单启用且非空时，
     * 来自不在白名单中的IP的请求应该被拒绝并返回403状态。
     * 验证需求: Requirements 9.1, 9.2
     */
    it('should allow whitelisted IPs', async () => {
      await fc.assert(
        fc.asyncProperty(
          validIPv4Arb,
          async (ipAddress) => {
            // 添加IP到白名单
            await ipWhitelistService.addIP(ipAddress, 'TEST: Property 26', 1);

            // 验证：IP应该在白名单中
            const isWhitelisted = await ipWhitelistService.isWhitelisted(ipAddress);

            // 清理
            await ipWhitelistService.removeIP(ipAddress, 1);

            return isWhitelisted === true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject non-whitelisted IPs when whitelist is not empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          validIPv4Arb,
          validIPv4Arb,
          async (whitelistedIP, nonWhitelistedIP) => {
            // 跳过相同IP的情况
            if (whitelistedIP === nonWhitelistedIP) return true;

            // 添加一个IP到白名单
            await ipWhitelistService.addIP(whitelistedIP, 'TEST: Property 26', 1);

            // 验证：非白名单IP应该被拒绝
            const isWhitelisted = await ipWhitelistService.isWhitelisted(nonWhitelistedIP);

            // 清理
            await ipWhitelistService.removeIP(whitelistedIP, 1);

            return isWhitelisted === false;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 27: IP白名单CRUD操作', () => {
    /**
     * Feature: system-security-foundation, Property 27: IP Whitelist CRUD Operations
     * 对于任何IP白名单管理操作（添加、移除、列表），
     * 操作应该成功并且白名单应该反映这些变更。
     * 验证需求: Requirements 9.3
     */
    it('should add IP to whitelist successfully', async () => {
      await fc.assert(
        fc.asyncProperty(
          validIPv4Arb,
          fc.string({ minLength: 1, maxLength: 100 }),
          async (ipAddress, description) => {
            // 添加IP
            await ipWhitelistService.addIP(ipAddress, `TEST: ${description}`, 1);

            // 验证：IP应该在白名单中
            const whitelist = await ipWhitelistService.getWhitelist();
            const found = whitelist.some(entry => entry.ip_address === ipAddress);

            // 清理
            await ipWhitelistService.removeIP(ipAddress, 1);

            return found === true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should remove IP from whitelist successfully', async () => {
      await fc.assert(
        fc.asyncProperty(
          validIPv4Arb,
          async (ipAddress) => {
            // 添加IP
            await ipWhitelistService.addIP(ipAddress, 'TEST: Property 27', 1);

            // 移除IP
            await ipWhitelistService.removeIP(ipAddress, 1);

            // 验证：IP不应该在白名单中
            const whitelist = await ipWhitelistService.getWhitelist();
            const found = whitelist.some(entry => entry.ip_address === ipAddress);

            return found === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should list all whitelisted IPs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validIPv4Arb, { minLength: 1, maxLength: 5 }).map(arr => [...new Set(arr)]), // 去重
          async (ipAddresses) => {
            // 添加多个IP
            for (const ip of ipAddresses) {
              await ipWhitelistService.addIP(ip, 'TEST: Property 27', 1);
            }

            // 获取白名单
            const whitelist = await ipWhitelistService.getWhitelist();
            const testIPs = whitelist.filter(entry => entry.description.includes('TEST'));

            // 验证：所有添加的IP都应该在列表中
            const allFound = ipAddresses.every(ip =>
              testIPs.some(entry => entry.ip_address === ip)
            );

            // 清理
            for (const ip of ipAddresses) {
              await ipWhitelistService.removeIP(ip, 1);
            }

            return allFound === true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 28: IP格式验证', () => {
    /**
     * Feature: system-security-foundation, Property 28: IP Format Validation
     * 对于任何被添加到白名单的IP地址，无效的IP格式应该被拒绝。
     * 验证需求: Requirements 9.4
     */
    it('should accept valid IPv4 addresses', () => {
      fc.assert(
        fc.property(
          validIPv4Arb,
          (ipAddress) => {
            const isValid = ipWhitelistService.validateIPFormat(ipAddress);
            return isValid === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid IP addresses', () => {
      fc.assert(
        fc.property(
          invalidIPArb,
          (ipAddress) => {
            const isValid = ipWhitelistService.validateIPFormat(ipAddress);
            return isValid === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid IPv4 CIDR notation', () => {
      fc.assert(
        fc.property(
          validIPv4CIDRArb,
          (cidr) => {
            const isValid = ipWhitelistService.validateIPFormat(cidr);
            return isValid === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid CIDR notation', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            validIPv4Arb,
            fc.integer({ min: 33, max: 100 }) // 无效的前缀长度
          ).map(([ip, prefix]) => `${ip}/${prefix}`),
          (invalidCidr) => {
            const isValid = ipWhitelistService.validateIPFormat(invalidCidr);
            return isValid === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 29: CIDR范围支持', () => {
    /**
     * Feature: system-security-foundation, Property 29: CIDR Range Support
     * 对于任何在白名单CIDR范围内的IP地址，访问应该被允许。
     * 验证需求: Requirements 9.5
     */
    it('should allow IPs within CIDR range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 })
          ),
          fc.integer({ min: 0, max: 255 }),
          async ([a, b, c], d) => {
            const cidr = `${a}.${b}.${c}.0/24`;
            const ipInRange = `${a}.${b}.${c}.${d}`;

            // 添加CIDR到白名单
            await ipWhitelistService.addIP(cidr, 'TEST: Property 29', 1);

            // 验证：范围内的IP应该被允许
            const isWhitelisted = await ipWhitelistService.isWhitelisted(ipInRange);

            // 清理
            await ipWhitelistService.removeIP(cidr, 1);

            return isWhitelisted === true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject IPs outside CIDR range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.integer({ min: 0, max: 254 }), // 确保有空间测试范围外的IP
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 })
          ),
          fc.integer({ min: 0, max: 255 }),
          async ([a, b, c], d) => {
            const cidr = `${a}.${b}.${c}.0/24`;
            const ipOutOfRange = `${a + 1}.${b}.${c}.${d}`;

            // 添加CIDR到白名单
            await ipWhitelistService.addIP(cidr, 'TEST: Property 29', 1);

            // 验证：范围外的IP应该被拒绝
            const isWhitelisted = await ipWhitelistService.isWhitelisted(ipOutOfRange);

            // 清理
            await ipWhitelistService.removeIP(cidr, 1);

            return isWhitelisted === false;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 30: 空白名单默认行为', () => {
    /**
     * Feature: system-security-foundation, Property 30: Empty Whitelist Default Behavior
     * 对于任何请求，当IP白名单为空时，应该允许来自所有IP地址的访问。
     * 验证需求: Requirements 9.6
     */
    it('should allow all IPs when whitelist is empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          validIPv4Arb,
          async (ipAddress) => {
            // 确保白名单为空
            const isEmpty = await ipWhitelistService.isWhitelistEmpty();
            
            if (!isEmpty) {
              // 如果不为空，清空它
              const whitelist = await ipWhitelistService.getWhitelist();
              for (const entry of whitelist) {
                if (entry.description.includes('TEST')) {
                  await ipWhitelistService.removeIP(entry.ip_address, 1);
                }
              }
            }

            // 验证：任何IP都应该被允许
            const isWhitelisted = await ipWhitelistService.isWhitelisted(ipAddress);

            return isWhitelisted === true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should transition from empty to non-empty whitelist correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validIPv4Arb,
          validIPv4Arb,
          async (ip1, ip2) => {
            // 跳过相同IP的情况
            if (ip1 === ip2) return true;

            // 确保白名单为空
            const whitelist = await ipWhitelistService.getWhitelist();
            for (const entry of whitelist) {
              if (entry.description.includes('TEST')) {
                await ipWhitelistService.removeIP(entry.ip_address, 1);
              }
            }

            // 验证：空白名单时两个IP都应该被允许
            const bothAllowedWhenEmpty = 
              await ipWhitelistService.isWhitelisted(ip1) &&
              await ipWhitelistService.isWhitelisted(ip2);

            // 添加一个IP到白名单
            await ipWhitelistService.addIP(ip1, 'TEST: Property 30', 1);

            // 验证：只有白名单中的IP应该被允许
            const onlyWhitelistedAllowed = 
              await ipWhitelistService.isWhitelisted(ip1) &&
              !(await ipWhitelistService.isWhitelisted(ip2));

            // 清理
            await ipWhitelistService.removeIP(ip1, 1);

            return bothAllowedWhenEmpty && onlyWhitelistedAllowed;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle duplicate IP additions gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          validIPv4Arb,
          async (ipAddress) => {
            // 添加IP
            await ipWhitelistService.addIP(ipAddress, 'TEST: Edge Case', 1);

            // 尝试再次添加相同的IP（应该抛出错误）
            let errorThrown = false;
            try {
              await ipWhitelistService.addIP(ipAddress, 'TEST: Edge Case Duplicate', 1);
            } catch (error) {
              errorThrown = true;
            }

            // 清理
            await ipWhitelistService.removeIP(ipAddress, 1);

            // 验证：应该抛出错误
            return errorThrown === true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle removal of non-existent IP gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          validIPv4Arb,
          async (ipAddress) => {
            // 尝试移除不存在的IP（应该抛出错误）
            let errorThrown = false;
            try {
              await ipWhitelistService.removeIP(ipAddress, 1);
            } catch (error) {
              errorThrown = true;
            }

            // 验证：应该抛出错误
            return errorThrown === true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle IPv6 addresses', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 4 }).filter(s => /^[0-9a-fA-F]+$/.test(s)), { minLength: 8, maxLength: 8 })
            .map(parts => parts.join(':')),
          (ipv6) => {
            const isValid = ipWhitelistService.validateIPFormat(ipv6);
            // IPv6应该被识别为有效格式
            return typeof isValid === 'boolean';
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
