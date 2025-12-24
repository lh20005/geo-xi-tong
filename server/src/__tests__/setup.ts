// Jest setup file
// This file runs before all tests

import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Set test environment variables
process.env.NODE_ENV = 'test';

// 如果没有设置 DATABASE_URL，使用默认值
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://lzc@localhost:5432/geo_system';
}

// Increase timeout for database operations
jest.setTimeout(30000);

// Global test utilities can be added here
