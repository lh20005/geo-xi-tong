import { SecurityService } from '../services/SecurityService';
import { AuditLogService } from '../services/AuditLogService';
import { AnomalyDetectionService } from '../services/AnomalyDetectionService';
import { pool } from '../db/database';
import { redisClient } from '../db/redis';

// Mock dependencies
jest.mock('../db/database');
jest.mock('../config/redis');

describe('Security Tests', () => {
  describe('SecurityService', () => {
    describe('maskSensitiveData', () => {
      it('应该脱敏密码字段', () => {
        const data = {
          username: 'testuser',
          password: 'secret123456',
          email: 'test@example.com',
        };

        const masked = SecurityService.maskSensitiveData(data);

        expect(masked.username).toBe('testuser');
        expect(masked.password).toBe('sec***456');
        expect(masked.email).toBe('test@example.com');
      });

      it('应该脱敏 API 密钥', () => {
        const data = {
          api_key: 'abcdefghijklmnopqrstuvwxyz',
          apiKey: '1234567890abcdef',
        };

        const masked = SecurityService.maskSensitiveData(data);

        expect(masked.api_key).toBe('abc***xyz');
        expect(masked.apiKey).toBe('123***def');
      });

      it('应该递归脱敏嵌套对象', () => {
        const data = {
          user: {
            name: 'test',
            credentials: {
              password: 'secret123',
              token: 'token123456',
            },
          },
        };

        const masked = SecurityService.maskSensitiveData(data);

        expect(masked.user.name).toBe('test');
        expect(masked.user.credentials.password).toBe('sec***123');
        expect(masked.user.credentials.token).toBe('tok***456');
      });

      it('应该处理短字符串', () => {
        const data = {
          password: 'abc',
        };

        const masked = SecurityService.maskSensitiveData(data);

        expect(masked.password).toBe('***');
      });

      it('应该处理数组', () => {
        const data = [
          { password: 'secret123' },
          { password: 'secret456' },
        ];

        const masked = SecurityService.maskSensitiveData(data);

        expect(masked[0].password).toBe('sec***123');
        expect(masked[1].password).toBe('sec***456');
      });
    });

    describe('validatePaymentConfig', () => {
      const originalEnv = process.env;

      beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
      });

      afterEach(() => {
        process.env = originalEnv;
      });

      it('应该验证完整的支付配置', () => {
        process.env.WECHAT_PAY_APP_ID = 'test_app_id';
        process.env.WECHAT_PAY_MCH_ID = 'test_mch_id';
        process.env.WECHAT_PAY_API_V3_KEY = '12345678901234567890123456789012'; // 32字符
        process.env.WECHAT_PAY_SERIAL_NO = 'test_serial';
        process.env.WECHAT_PAY_PRIVATE_KEY_PATH = '/path/to/key.pem';
        process.env.WECHAT_PAY_NOTIFY_URL = 'https://example.com/notify';

        // Mock fs.existsSync and fs.readFileSync
        const fs = require('fs');
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'readFileSync').mockReturnValue('-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----');

        const result = SecurityService.validatePaymentConfig();

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('应该检测缺少的环境变量', () => {
        process.env.WECHAT_PAY_APP_ID = '';
        process.env.WECHAT_PAY_MCH_ID = '';

        const result = SecurityService.validatePaymentConfig();

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(e => e.includes('WECHAT_PAY_APP_ID'))).toBe(true);
      });

      it('应该检测 API V3 密钥长度错误', () => {
        process.env.WECHAT_PAY_APP_ID = 'test';
        process.env.WECHAT_PAY_MCH_ID = 'test';
        process.env.WECHAT_PAY_API_V3_KEY = 'short'; // 不是32字符
        process.env.WECHAT_PAY_SERIAL_NO = 'test';
        process.env.WECHAT_PAY_PRIVATE_KEY_PATH = '/path/to/key.pem';
        process.env.WECHAT_PAY_NOTIFY_URL = 'https://example.com/notify';

        const result = SecurityService.validatePaymentConfig();

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('密钥长度'))).toBe(true);
      });

      it('应该检测非 HTTPS 回调 URL', () => {
        process.env.WECHAT_PAY_APP_ID = 'test';
        process.env.WECHAT_PAY_MCH_ID = 'test';
        process.env.WECHAT_PAY_API_V3_KEY = '12345678901234567890123456789012';
        process.env.WECHAT_PAY_SERIAL_NO = 'test';
        process.env.WECHAT_PAY_PRIVATE_KEY_PATH = '/path/to/key.pem';
        process.env.WECHAT_PAY_NOTIFY_URL = 'http://example.com/notify'; // HTTP 而不是 HTTPS

        const result = SecurityService.validatePaymentConfig();

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('HTTPS'))).toBe(true);
      });
    });

    describe('checkEnvLeakage', () => {
      const originalEnv = process.env;

      beforeEach(() => {
        process.env = { ...originalEnv };
      });

      afterEach(() => {
        process.env = originalEnv;
      });

      it('应该检测环境变量泄露', () => {
        process.env.WECHAT_PAY_API_V3_KEY = 'secret_key_12345';

        const logContent = 'Error: Payment failed with key secret_key_12345';
        const result = SecurityService.checkEnvLeakage(logContent);

        expect(result.hasLeak).toBe(true);
        expect(result.leakedVars).toContain('WECHAT_PAY_API_V3_KEY');
      });

      it('应该通过安全的日志', () => {
        process.env.WECHAT_PAY_API_V3_KEY = 'secret_key_12345';

        const logContent = 'Error: Payment failed';
        const result = SecurityService.checkEnvLeakage(logContent);

        expect(result.hasLeak).toBe(false);
        expect(result.leakedVars).toHaveLength(0);
      });
    });
  });

  describe('AuditLogService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('logAdminAction', () => {
      it('应该记录管理员操作', async () => {
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

        await AuditLogService.logAdminAction({
          adminId: 1,
          actionType: 'update_plan',
          resourceType: 'plan',
          resourceId: '123',
          details: { price: 100 },
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
        });

        expect(pool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO admin_logs'),
          expect.arrayContaining([1, 'update_plan', 'plan', '123'])
        );
      });

      it('应该处理记录失败而不抛出错误', async () => {
        (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

        // 不应该抛出错误
        await expect(
          AuditLogService.logAdminAction({
            adminId: 1,
            actionType: 'test',
            resourceType: 'test',
          })
        ).resolves.not.toThrow();
      });
    });

    describe('getAdminLogs', () => {
      it('应该获取审计日志', async () => {
        const mockLogs = [
          {
            id: 1,
            admin_id: 1,
            action_type: 'update_plan',
            resource_type: 'plan',
            created_at: new Date(),
          },
        ];

        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: mockLogs });

        const logs = await AuditLogService.getAdminLogs({
          adminId: 1,
          limit: 10,
          offset: 0,
        });

        expect(logs).toEqual(mockLogs);
        expect(pool.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          expect.arrayContaining([1, 10, 0])
        );
      });

      it('应该支持多个筛选条件', async () => {
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

        await AuditLogService.getAdminLogs({
          adminId: 1,
          actionType: 'update_plan',
          resourceType: 'plan',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
        });

        expect(pool.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE'),
          expect.arrayContaining([1, 'update_plan', 'plan'])
        );
      });
    });
  });

  describe('AnomalyDetectionService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('recordPaymentFailure', () => {
      it('应该记录支付失败', async () => {
        (redisClient.zadd as jest.Mock).mockResolvedValueOnce(1);
        (redisClient.expire as jest.Mock).mockResolvedValueOnce(1);
        (redisClient.zcount as jest.Mock).mockResolvedValueOnce(3);

        await AnomalyDetectionService.recordPaymentFailure(1, 'ORDER001');

        expect(redisClient.zadd).toHaveBeenCalled();
        expect(redisClient.expire).toHaveBeenCalled();
      });
    });

    describe('checkPaymentFailures', () => {
      it('应该在失败次数过多时触发告警', async () => {
        (redisClient.zcount as jest.Mock).mockResolvedValueOnce(6); // 6次失败
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
        (redisClient.setex as jest.Mock).mockResolvedValueOnce('OK');

        await AnomalyDetectionService.checkPaymentFailures(1);

        expect(pool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO security_alerts'),
          expect.arrayContaining([1, 'payment_failures', 'high'])
        );
        expect(redisClient.setex).toHaveBeenCalled(); // 锁定支付
      });

      it('应该在失败次数正常时不触发告警', async () => {
        (redisClient.zcount as jest.Mock).mockResolvedValueOnce(2); // 2次失败

        await AnomalyDetectionService.checkPaymentFailures(1);

        expect(pool.query).not.toHaveBeenCalled();
      });
    });

    describe('checkOrderCreationSpike', () => {
      it('应该检测订单创建异常', async () => {
        (redisClient.zadd as jest.Mock).mockResolvedValueOnce(1);
        (redisClient.expire as jest.Mock).mockResolvedValueOnce(1);
        (redisClient.zcount as jest.Mock).mockResolvedValueOnce(12); // 12个订单
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
        (redisClient.setex as jest.Mock).mockResolvedValueOnce('OK');

        await AnomalyDetectionService.checkOrderCreationSpike(1);

        expect(pool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO security_alerts'),
          expect.arrayContaining([1, 'order_creation_spike', 'high'])
        );
      });
    });
  });
});
