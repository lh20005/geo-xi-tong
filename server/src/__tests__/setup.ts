/**
 * Jest 测试设置文件
 * 在所有测试运行前执行
 */

// 模拟环境变量
process.env.NODE_ENV = 'test';
// 使用主数据库进行测试（测试会创建和清理自己的数据）
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://lzc@localhost:5432/geo_system';
process.env.REDIS_HOST = process.env.TEST_REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.TEST_REDIS_PORT || '6379';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
