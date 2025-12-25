/**
 * 简单测试 - 安全检查服务
 */

import { securityCheckService } from '../services/SecurityCheckService';
import { pool } from '../db/database';

describe('SecurityCheckService Simple Tests', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    // pool.end() 由全局 setup.ts 处理
  });

  it('应该检测过期会话', async () => {
    const result = await securityCheckService.checkExpiredSessions();
    
    expect(result.checkType).toBe('expired_sessions');
    expect(result.status).toMatch(/^(passed|warning|critical)$/);
    expect(typeof result.issuesFound).toBe('number');
  }, 10000);

  it('应该检测旧临时密码', async () => {
    const result = await securityCheckService.checkOldTempPasswords();
    
    expect(result.checkType).toBe('old_temp_passwords');
    expect(result.status).toMatch(/^(passed|warning|critical)$/);
    expect(typeof result.issuesFound).toBe('number');
  }, 10000);

  it('应该检测休眠管理员', async () => {
    const result = await securityCheckService.checkDormantAdmins();
    
    expect(result.checkType).toBe('dormant_admins');
    expect(result.status).toMatch(/^(passed|warning|critical)$/);
    expect(typeof result.issuesFound).toBe('number');
  }, 10000);

  it('应该检查数据库完整性', async () => {
    const result = await securityCheckService.checkDatabaseIntegrity();
    
    expect(result.checkType).toBe('database_integrity');
    expect(result.status).toMatch(/^(passed|warning|critical)$/);
    expect(typeof result.issuesFound).toBe('number');
  }, 10000);

  it('应该生成完整报告', async () => {
    const report = await securityCheckService.runAllChecks();
    
    expect(report.reportId).toMatch(/^SEC-\d+$/);
    expect(report.checks.length).toBe(4);
    expect(report.summary.totalChecks).toBe(4);
  }, 30000);
});
