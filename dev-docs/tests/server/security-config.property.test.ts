/**
 * 安全配置管理属性测试
 * Requirements: 18.2, 18.3, 18.4
 * Properties: 58, 59, 60
 */

import * as fc from 'fast-check';
import { securityConfigService } from '../services/SecurityConfigService';
import { pool } from '../db/database';

describe('SecurityConfigService Property Tests', () => {
  beforeAll(async () => {
    // 确保测试数据库已初始化
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    // pool.end() 由全局 setup.ts 处理
  });

  /**
   * Property 58: 安全配置验证
   * Validates: Requirement 18.2
   * 
   * 属性: 配置更新必须通过验证规则
   * - 数字类型的配置必须是有效数字
   * - 布尔类型的配置必须是 'true' 或 'false'
   * - JSON类型的配置必须是有效的JSON
   * - 超出范围的值应该被拒绝
   */
  describe('Property 58: 安全配置验证', () => {
    it('应该拒绝无效的数字配置值', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter(s => isNaN(Number(s)) && s.trim() !== ''),
          async (invalidNumber) => {
            // 尝试更新数字类型配置为无效值
            await expect(
              securityConfigService.updateConfig(
                'rate_limit.login.max_requests',
                invalidNumber,
                1,
                '测试无效数字'
              )
            ).rejects.toThrow('配置值必须是数字');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('应该拒绝无效的布尔配置值', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter(s => s !== 'true' && s !== 'false'),
          async (invalidBoolean) => {
            // 尝试更新布尔类型配置为无效值
            await expect(
              securityConfigService.updateConfig(
                'password.require_uppercase',
                invalidBoolean,
                1,
                '测试无效布尔值'
              )
            ).rejects.toThrow('配置值必须是布尔值');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('应该接受范围内的数字配置值', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (validNumber) => {
            // 更新配置
            const result = await securityConfigService.updateConfig(
              'rate_limit.login.max_requests',
              String(validNumber),
              1,
              '测试有效数字'
            );

            // 验证更新成功
            expect(result.config_value).toBe(String(validNumber));
            expect(result.version).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('应该拒绝超出范围的数字配置值', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.integer({ max: 0 }),
            fc.integer({ min: 101 })
          ),
          async (outOfRangeNumber) => {
            // 尝试更新配置为超出范围的值
            await expect(
              securityConfigService.updateConfig(
                'rate_limit.login.max_requests',
                String(outOfRangeNumber),
                1,
                '测试超出范围'
              )
            ).rejects.toThrow(/配置值不能/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 59: 安全配置历史
   * Validates: Requirement 18.3
   * 
   * 属性: 每次配置更新都必须记录历史
   * - 历史记录包含旧值和新值
   * - 版本号递增
   * - 记录更新者和原因
   */
  describe('Property 59: 安全配置历史', () => {
    it('每次更新都应该创建历史记录', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 1000 }),
          fc.integer({ min: 10, max: 1000 }),
          async (value1, value2) => {
            const configKey = 'rate_limit.api.max_requests';

            // 获取当前配置
            const before = await securityConfigService.getConfig(configKey);
            const beforeVersion = before?.version || 1;

            // 第一次更新
            await securityConfigService.updateConfig(
              configKey,
              String(value1),
              1,
              '测试更新1'
            );

            // 第二次更新
            await securityConfigService.updateConfig(
              configKey,
              String(value2),
              1,
              '测试更新2'
            );

            // 获取历史记录
            const history = await securityConfigService.getConfigHistory(configKey, 10);

            // 验证历史记录
            expect(history.length).toBeGreaterThanOrEqual(2);

            // 验证最新的两条记录
            const latest = history[0];
            const secondLatest = history[1];

            expect(latest.new_value).toBe(String(value2));
            expect(latest.old_value).toBe(String(value1));
            expect(latest.version).toBe(beforeVersion + 2);

            expect(secondLatest.new_value).toBe(String(value1));
            expect(secondLatest.version).toBe(beforeVersion + 1);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('历史记录应该包含完整的变更信息', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (newValue, reason) => {
            const configKey = 'session.max_concurrent';

            // 更新配置
            await securityConfigService.updateConfig(
              configKey,
              String(newValue),
              1,
              reason
            );

            // 获取历史记录
            const history = await securityConfigService.getConfigHistory(configKey, 1);

            // 验证历史记录包含所有必要信息
            expect(history.length).toBeGreaterThan(0);
            const record = history[0];

            expect(record.config_key).toBe(configKey);
            expect(record.new_value).toBe(String(newValue));
            expect(record.old_value).toBeDefined();
            expect(record.version).toBeGreaterThan(0);
            expect(record.changed_by).toBe(1);
            expect(record.change_reason).toBe(reason);
            expect(record.created_at).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 60: 安全配置导入导出
   * Validates: Requirement 18.4
   * 
   * 属性: 配置导出后再导入应该保持一致
   * - 导出的配置包含所有活动配置
   * - 导入时验证配置值
   * - 导入失败不影响现有配置
   */
  describe('Property 60: 安全配置导入导出', () => {
    it('导出的配置应该包含所有活动配置', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            // 获取所有配置
            const allConfigs = await securityConfigService.getAllConfigs();

            // 导出配置
            const exportData = await securityConfigService.exportConfigs();

            // 验证导出数据
            expect(exportData.version).toBeDefined();
            expect(exportData.exported_at).toBeDefined();
            expect(exportData.configs.length).toBe(allConfigs.length);

            // 验证每个配置都被导出
            for (const config of allConfigs) {
              const exported = exportData.configs.find(c => c.key === config.config_key);
              expect(exported).toBeDefined();
              expect(exported?.value).toBe(config.config_value);
              expect(exported?.type).toBe(config.config_type);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('导入有效配置应该成功', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (newValue) => {
            // 创建导入数据
            const importData = {
              version: '1.0',
              exported_at: new Date().toISOString(),
              configs: [
                {
                  key: 'rate_limit.login.max_requests',
                  value: String(newValue),
                  type: 'number',
                  description: '测试导入'
                }
              ]
            };

            // 导入配置
            const result = await securityConfigService.importConfigs(importData, 1);

            // 验证导入成功
            expect(result.success).toBe(1);
            expect(result.failed).toBe(0);
            expect(result.errors.length).toBe(0);

            // 验证配置已更新
            const config = await securityConfigService.getConfig('rate_limit.login.max_requests');
            expect(config?.config_value).toBe(String(newValue));
          }
        ),
        { numRuns: 30 }
      );
    });

    it('导入无效配置应该失败但不影响其他配置', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter(s => isNaN(Number(s)) && s.trim() !== ''),
          fc.integer({ min: 1, max: 20 }),
          async (invalidValue, validValue) => {
            // 获取当前配置值
            const beforeInvalid = await securityConfigService.getConfig('rate_limit.login.max_requests');
            const beforeValid = await securityConfigService.getConfig('session.max_concurrent');

            // 创建混合导入数据（一个无效，一个有效）
            const importData = {
              version: '1.0',
              exported_at: new Date().toISOString(),
              configs: [
                {
                  key: 'rate_limit.login.max_requests',
                  value: invalidValue,
                  type: 'number',
                  description: '无效配置'
                },
                {
                  key: 'session.max_concurrent',
                  value: String(validValue),
                  type: 'number',
                  description: '有效配置'
                }
              ]
            };

            // 导入配置
            const result = await securityConfigService.importConfigs(importData, 1);

            // 验证部分成功
            expect(result.success).toBe(1);
            expect(result.failed).toBe(1);
            expect(result.errors.length).toBe(1);

            // 验证无效配置未被更新
            const afterInvalid = await securityConfigService.getConfig('rate_limit.login.max_requests');
            expect(afterInvalid?.config_value).toBe(beforeInvalid?.config_value);

            // 验证有效配置已更新
            const afterValid = await securityConfigService.getConfig('session.max_concurrent');
            expect(afterValid?.config_value).toBe(String(validValue));
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
