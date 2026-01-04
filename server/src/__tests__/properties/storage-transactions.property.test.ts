/**
 * Property-Based Tests for Storage Transaction Atomicity
 * Feature: storage-space-management
 * 
 * These tests verify that storage operations are atomic - either all changes
 * are committed together, or none are committed if any part fails.
 */

import * as fc from 'fast-check';
import { pool } from '../../db/database';
import { StorageService } from '../../services/StorageService';

describe('Storage Transaction Atomicity Properties', () => {
  let testUserId: number;
  let storageService: StorageService;

  beforeAll(async () => {
    storageService = StorageService.getInstance();
    
    // 创建测试用户
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [`test_transaction_${Date.now()}`, `test_transaction_${Date.now()}@test.com`, 'hash', 'user']
    );
    testUserId = userResult.rows[0].id;

    // 初始化存储
    await storageService.initializeUserStorage(testUserId, 100 * 1024 * 1024); // 100MB
  });

  afterAll(async () => {
    // 清理测试数据
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });

  /**
   * Property 22: 事务原子性
   * 
   * For any storage usage update operation, either all database changes
   * (usage counters, transaction log, alerts) should be committed together,
   * or none should be committed if any part fails.
   * 
   * Validates: Requirements 15.5
   */
  test('Property 22: Transaction Atomicity - successful operations commit all changes', async () => {
    // Feature: storage-space-management, Property 22: Transaction Atomicity
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          resourceType: fc.constantFrom('image', 'document', 'article'),
          sizeBytes: fc.integer({ min: 1000, max: 1000000 }), // 1KB to 1MB
          resourceId: fc.integer({ min: 1, max: 100000 })
        }),
        async (operation) => {
          // 获取初始状态
          const initialUsage = await storageService.getUserStorageUsage(testUserId);
          const initialTotal = initialUsage.totalStorageBytes;

          // 检查初始事务日志数量
          const initialTransactionsResult = await pool.query(
            'SELECT COUNT(*) as count FROM storage_transactions WHERE user_id = $1',
            [testUserId]
          );
          const initialTransactionCount = parseInt(initialTransactionsResult.rows[0].count);

          try {
            // 执行存储操作
            await storageService.recordStorageUsage(
              testUserId,
              operation.resourceType as 'image' | 'document' | 'article',
              operation.resourceId,
              operation.sizeBytes,
              { test: true, atomicity: true }
            );

            // 等待操作完成
            await new Promise(resolve => setTimeout(resolve, 300));

            // 验证所有相关数据都已更新
            
            // 1. 检查存储使用量是否更新
            const finalUsage = await storageService.getUserStorageUsage(testUserId);
            const usageUpdated = finalUsage.totalStorageBytes === initialTotal + operation.sizeBytes;

            // 2. 检查事务日志是否创建
            const finalTransactionsResult = await pool.query(
              'SELECT COUNT(*) as count FROM storage_transactions WHERE user_id = $1',
              [testUserId]
            );
            const finalTransactionCount = parseInt(finalTransactionsResult.rows[0].count);
            const transactionLogged = finalTransactionCount === initialTransactionCount + 1;

            // 3. 检查事务日志内容是否正确
            const transactionResult = await pool.query(
              `SELECT * FROM storage_transactions 
               WHERE user_id = $1 AND resource_id = $2 AND resource_type = $3
               ORDER BY created_at DESC LIMIT 1`,
              [testUserId, operation.resourceId, operation.resourceType]
            );
            
            const transactionCorrect = transactionResult.rows.length > 0 &&
              transactionResult.rows[0].operation === 'add' &&
              transactionResult.rows[0].size_bytes === operation.sizeBytes;

            // 清理
            await storageService.removeStorageUsage(
              testUserId,
              operation.resourceType as 'image' | 'document' | 'article',
              operation.resourceId,
              operation.sizeBytes
            );

            await new Promise(resolve => setTimeout(resolve, 300));

            // 所有检查都应该通过
            expect(usageUpdated).toBe(true);
            expect(transactionLogged).toBe(true);
            expect(transactionCorrect).toBe(true);

            return usageUpdated && transactionLogged && transactionCorrect;
          } catch (error) {
            console.error('事务原子性测试失败:', error);
            throw error;
          }
        }
      ),
      { 
        numRuns: 100, // 运行 100 次迭代
        verbose: true
      }
    );
  }, 60000); // 60秒超时

  /**
   * Property 22 (Variant): 删除操作的事务原子性
   * 
   * For any storage removal operation, all related changes should be atomic.
   */
  test('Property 22 (Variant): Transaction Atomicity for removal operations', async () => {
    // Feature: storage-space-management, Property 22: Transaction Atomicity (Removal)
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          resourceType: fc.constantFrom('image', 'document', 'article'),
          sizeBytes: fc.integer({ min: 1000, max: 500000 }),
          resourceId: fc.integer({ min: 1, max: 50000 })
        }),
        async (operation) => {
          // 首先添加资源
          await storageService.recordStorageUsage(
            testUserId,
            operation.resourceType as 'image' | 'document' | 'article',
            operation.resourceId + 100000, // 使用不同的 ID 避免冲突
            operation.sizeBytes,
            { test: true }
          );

          await new Promise(resolve => setTimeout(resolve, 300));

          const initialUsage = await storageService.getUserStorageUsage(testUserId);
          const initialTotal = initialUsage.totalStorageBytes;

          const initialTransactionsResult = await pool.query(
            'SELECT COUNT(*) as count FROM storage_transactions WHERE user_id = $1',
            [testUserId]
          );
          const initialTransactionCount = parseInt(initialTransactionsResult.rows[0].count);

          try {
            // 执行删除操作
            await storageService.removeStorageUsage(
              testUserId,
              operation.resourceType as 'image' | 'document' | 'article',
              operation.resourceId + 100000,
              operation.sizeBytes
            );

            await new Promise(resolve => setTimeout(resolve, 300));

            // 验证所有相关数据都已更新
            
            // 1. 检查存储使用量是否减少
            const finalUsage = await storageService.getUserStorageUsage(testUserId);
            const usageDecreased = finalUsage.totalStorageBytes === initialTotal - operation.sizeBytes;

            // 2. 检查事务日志是否创建
            const finalTransactionsResult = await pool.query(
              'SELECT COUNT(*) as count FROM storage_transactions WHERE user_id = $1',
              [testUserId]
            );
            const finalTransactionCount = parseInt(finalTransactionsResult.rows[0].count);
            const transactionLogged = finalTransactionCount === initialTransactionCount + 1;

            // 3. 检查事务日志内容
            const transactionResult = await pool.query(
              `SELECT * FROM storage_transactions 
               WHERE user_id = $1 AND resource_id = $2 AND resource_type = $3 AND operation = 'remove'
               ORDER BY created_at DESC LIMIT 1`,
              [testUserId, operation.resourceId + 100000, operation.resourceType]
            );
            
            const transactionCorrect = transactionResult.rows.length > 0 &&
              transactionResult.rows[0].size_bytes === operation.sizeBytes;

            // 断言
            expect(usageDecreased).toBe(true);
            expect(transactionLogged).toBe(true);
            expect(transactionCorrect).toBe(true);

            return usageDecreased && transactionLogged && transactionCorrect;
          } catch (error) {
            console.error('删除操作事务原子性测试失败:', error);
            throw error;
          }
        }
      ),
      { 
        numRuns: 100,
        verbose: true
      }
    );
  }, 60000);

  /**
   * Property 22 (Variant): 失败操作不应提交任何更改
   * 
   * When an operation fails, no partial changes should be committed.
   */
  test('Property 22 (Variant): Failed operations commit no changes', async () => {
    // Feature: storage-space-management, Property 22: Transaction Atomicity (Failure)
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          resourceType: fc.constantFrom('image', 'document', 'article'),
          sizeBytes: fc.integer({ min: -10000, max: -1 }), // 负数大小应该失败
          resourceId: fc.integer({ min: 1, max: 10000 })
        }),
        async (operation) => {
          const initialUsage = await storageService.getUserStorageUsage(testUserId);
          const initialTotal = initialUsage.totalStorageBytes;

          const initialTransactionsResult = await pool.query(
            'SELECT COUNT(*) as count FROM storage_transactions WHERE user_id = $1',
            [testUserId]
          );
          const initialTransactionCount = parseInt(initialTransactionsResult.rows[0].count);

          try {
            // 尝试执行无效操作（负数大小）
            await storageService.recordStorageUsage(
              testUserId,
              operation.resourceType as 'image' | 'document' | 'article',
              operation.resourceId,
              operation.sizeBytes, // 负数
              { test: true }
            );

            // 如果没有抛出错误，说明验证有问题
            // 但我们仍然检查数据是否未更改
          } catch (error) {
            // 预期会失败
          }

          await new Promise(resolve => setTimeout(resolve, 300));

          // 验证没有任何更改被提交
          const finalUsage = await storageService.getUserStorageUsage(testUserId);
          const usageUnchanged = finalUsage.totalStorageBytes === initialTotal;

          const finalTransactionsResult = await pool.query(
            'SELECT COUNT(*) as count FROM storage_transactions WHERE user_id = $1',
            [testUserId]
          );
          const finalTransactionCount = parseInt(finalTransactionsResult.rows[0].count);
          const noTransactionLogged = finalTransactionCount === initialTransactionCount;

          // 断言：失败的操作不应该有任何副作用
          expect(usageUnchanged).toBe(true);
          expect(noTransactionLogged).toBe(true);

          return usageUnchanged && noTransactionLogged;
        }
      ),
      { 
        numRuns: 100,
        verbose: true
      }
    );
  }, 60000);
});
