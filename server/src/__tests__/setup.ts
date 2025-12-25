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

// Track if cleanup has been done
let cleanupDone = false;

// Global cleanup to prevent resource leaks
// This runs after ALL tests in ALL files
global.afterAll(async () => {
  if (cleanupDone) return;
  cleanupDone = true;

  // Stop any running timers from singleton services
  try {
    const { RateLimitService } = await import('../services/RateLimitService');
    RateLimitService.getInstance().stopCleanupTimer();
  } catch (e) {
    // Service might not be initialized
  }

  try {
    const { SessionService } = await import('../services/SessionService');
    SessionService.getInstance().stopCleanupTimer();
  } catch (e) {
    // Service might not be initialized
  }

  // Close Redis connection
  try {
    const { redisClient } = await import('../db/redis');
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch (e) {
    // Redis might not be initialized or already closed
  }

  // Close database pool
  try {
    const { pool } = await import('../db/database');
    await pool.end();
  } catch (e) {
    // Pool might already be closed
  }
});


