/**
 * Property-Based Tests for Storage Invariants
 * Feature: storage-space-management
 * 
 * These tests verify that storage invariants hold across all operations.
 */

import * as fc from 'fast-check';
import { pool } from '../../db/database';
import { StorageService } from '../../services/StorageService';

describe('Storage Invariants Properties', () => {
  let testUserId: number;
  let storageService: StorageService;

  beforeAll(async () => {
    storageService = StorageService.getInstance();
    
    // 创建测试用户
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [`test_invariants_${Date.now()}`, `test_invariants_${Date.now()}@test.com`, 'hash', 'user']
    );
    testUserId = userResult.rows[0].id;

    // 初始化存储
    await storageService.initializeUserStorage(testUserId, 500 * 1024 * 1024); // 500MB
  });

  afterAll(async () => {
    // 清理测试数据
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });

  /**
   * Property 1: 存储添加不变性
   * 
   * For any user and any resource (image, document, or article), adding a resource 
   * with size S bytes should increase the corresponding resource type storage counter 
   * by exactly S bytes and increase the total storage by exactly S bytes.
   * 
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  test('Property 1: Storage Addition Invariant - adding resource increases counters correctly', async () => {
    // Feature: storage-space-management, Property 1: Storage Addition Invariant
    
    await fc.assert(
      fc.asyncProperty(
        // 生成随机的资源添加操作
        fc.record({
          resourceType: fc.constantFrom('image', 'document', 'article'),
          sizeBytes: fc.integer({ min: 1000, max: 5000000 }), // 1KB to 5MB
          resourceId: fc.integer({ min: 1, max: 1000000 })
        }),
        async (resource) => {
          try {
            // 获取添加前的存储状态（跳过缓存以获取最新数据）
            const beforeUsage = await storageService.getUserStorageUsage(testUserId, true);
            
            const beforeImageBytes = beforeUsage.imageStorageBytes;
            const beforeDocumentBytes = beforeUsage.documentStorageBytes;
            const beforeArticleBytes = beforeUsage.articleStorageBytes;
            const beforeTotalBytes = beforeUsage.totalStorageBytes;

            // 添加资源
            await storageService.recordStorageUsage(
              testUserId,
              resource.resourceType as 'image' | 'document' | 'article',
              resource.resourceId,
              resource.sizeBytes,
              { test: true, property: 1 }
            );

            // 等待数据库更新完成
            await new Promise(resolve => setTimeout(resolve, 100));

            // 获取添加后的存储状态（跳过缓存）
            const afterUsage = await storageService.getUserStorageUsage(testUserId, true);

            // 验证：对应资源类型的存储应该增加 S 字节
            let expectedResourceIncrease = 0;
            let actualResourceIncrease = 0;

            switch (resource.resourceType) {
              case 'image':
                expectedResourceIncrease = resource.sizeBytes;
                actualResourceIncrease = afterUsage.imageStorageBytes - beforeImageBytes;
                
                // 验证其他类型未改变
                expect(afterUsage.documentStorageBytes).toBe(beforeDocumentBytes);
                expect(afterUsage.articleStorageBytes).toBe(beforeArticleBytes);
                break;
              
              case 'document':
                expectedResourceIncrease = resource.sizeBytes;
                actualResourceIncrease = afterUsage.documentStorageBytes - beforeDocumentBytes;
                
                // 验证其他类型未改变
                expect(afterUsage.imageStorageBytes).toBe(beforeImageBytes);
                expect(afterUsage.articleStorageBytes).toBe(beforeArticleBytes);
                break;
              
              case 'article':
                expectedResourceIncrease = resource.sizeBytes;
                actualResourceIncrease = afterUsage.articleStorageBytes - beforeArticleBytes;
                
                // 验证其他类型未改变
                expect(afterUsage.imageStorageBytes).toBe(beforeImageBytes);
                expect(afterUsage.documentStorageBytes).toBe(beforeDocumentBytes);
                break;
            }

            // 断言：资源类型存储应该增加 S 字节
            if (actualResourceIncrease !== expectedResourceIncrease) {
              console.error('资源类型存储增加不正确:', {
                resourceType: resource.resourceType,
                sizeBytes: resource.sizeBytes,
                expectedIncrease: expectedResourceIncrease,
                actualIncrease: actualResourceIncrease,
                difference: actualResourceIncrease - expectedResourceIncrease,
                beforeUsage: {
                  image: beforeImageBytes,
                  document: beforeDocumentBytes,
                  article: beforeArticleBytes,
                  total: beforeTotalBytes
                },
                afterUsage: {
                  image: afterUsage.imageStorageBytes,
                  document: afterUsage.documentStorageBytes,
                  article: afterUsage.articleStorageBytes,
                  total: afterUsage.totalStorageBytes
                }
              });
            }

            expect(actualResourceIncrease).toBe(expectedResourceIncrease);

            // 验证：总存储应该增加 S 字节
            const totalIncrease = afterUsage.totalStorageBytes - beforeTotalBytes;
            
            if (totalIncrease !== resource.sizeBytes) {
              console.error('总存储增加不正确:', {
                resourceType: resource.resourceType,
                sizeBytes: resource.sizeBytes,
                expectedIncrease: resource.sizeBytes,
                actualIncrease: totalIncrease,
                difference: totalIncrease - resource.sizeBytes,
                beforeTotal: beforeTotalBytes,
                afterTotal: afterUsage.totalStorageBytes
              });
            }

            expect(totalIncrease).toBe(resource.sizeBytes);

            // 清理：删除添加的资源
            await storageService.removeStorageUsage(
              testUserId,
              resource.resourceType as 'image' | 'document' | 'article',
              resource.resourceId,
              resource.sizeBytes
            );

            // 等待清理完成
            await new Promise(resolve => setTimeout(resolve, 100));

            return true;
          } catch (error) {
            console.error('Property 1 测试失败:', error);
            
            // 尝试清理
            try {
              await storageService.removeStorageUsage(
                testUserId,
                resource.resourceType as 'image' | 'document' | 'article',
                resource.resourceId,
                resource.sizeBytes
              );
            } catch (cleanupError) {
              console.error('清理失败:', cleanupError);
            }
            
            throw error;
          }
        }
      ),
      { 
        numRuns: 20, // 运行 20 次迭代（减少以加快测试速度）
        verbose: true,
        endOnFailure: true
      }
    );
  }, 60000); // 60秒超时

  /**
   * Property 4: 总存储计算
   * 
   * For any user at any point in time, total_storage_bytes should always equal 
   * the sum of image_storage_bytes + document_storage_bytes + article_storage_bytes.
   * 
   * Validates: Requirements 3.6
   */
  test('Property 4: Total Storage Calculation - total always equals sum of parts', async () => {
    // Feature: storage-space-management, Property 4: Total Storage Calculation
    
    await fc.assert(
      fc.asyncProperty(
        // 生成一系列存储操作
        fc.array(
          fc.record({
            operation: fc.constantFrom('add', 'remove'),
            resourceType: fc.constantFrom('image', 'document', 'article'),
            sizeBytes: fc.integer({ min: 1000, max: 500000 }), // 1KB to 500KB
            resourceId: fc.integer({ min: 1, max: 100000 })
          }),
          { minLength: 1, maxLength: 20 } // 1-20 operations
        ),
        async (operations) => {
          // 跟踪已添加的资源，以便可以删除
          const addedResources = new Map<string, { resourceType: string; sizeBytes: number }>();

          try {
            // 执行所有操作
            for (let i = 0; i < operations.length; i++) {
              const op = operations[i];
              const uniqueResourceId = op.resourceId + i * 100000; // 确保唯一性
              const resourceKey = `${op.resourceType}:${uniqueResourceId}`;

              if (op.operation === 'add') {
                await storageService.recordStorageUsage(
                  testUserId,
                  op.resourceType as 'image' | 'document' | 'article',
                  uniqueResourceId,
                  op.sizeBytes,
                  { test: true, index: i }
                );
                addedResources.set(resourceKey, {
                  resourceType: op.resourceType,
                  sizeBytes: op.sizeBytes
                });
              } else if (op.operation === 'remove' && addedResources.size > 0) {
                // 只删除已添加的资源
                const entries = Array.from(addedResources.entries());
                if (entries.length > 0) {
                  const [key, resource] = entries[Math.floor(Math.random() * entries.length)];
                  const [type, id] = key.split(':');
                  
                  await storageService.removeStorageUsage(
                    testUserId,
                    type as 'image' | 'document' | 'article',
                    parseInt(id),
                    resource.sizeBytes
                  ).catch(err => {
                    // 删除可能失败，这是可以接受的
                    console.log(`删除失败（预期）: ${err.message}`);
                  });
                  
                  addedResources.delete(key);
                }
              }

              // 在每次操作后验证不变量
              // 跳过缓存以获取最新数据
              const usage = await storageService.getUserStorageUsage(testUserId, true);

              // 验证：total_storage_bytes 应该等于各部分之和
              const calculatedTotal = 
                usage.imageStorageBytes + 
                usage.documentStorageBytes + 
                usage.articleStorageBytes;

              // 断言：总存储应该等于各部分之和
              if (usage.totalStorageBytes !== calculatedTotal) {
                console.error('存储计算不一致:', {
                  operation: i,
                  operationType: op.operation,
                  resourceType: op.resourceType,
                  totalStorageBytes: usage.totalStorageBytes,
                  calculatedTotal,
                  imageStorageBytes: usage.imageStorageBytes,
                  documentStorageBytes: usage.documentStorageBytes,
                  articleStorageBytes: usage.articleStorageBytes,
                  difference: usage.totalStorageBytes - calculatedTotal
                });
              }

              expect(usage.totalStorageBytes).toBe(calculatedTotal);
            }

            // 清理：删除所有添加的资源
            for (const [key, resource] of addedResources.entries()) {
              const [type, id] = key.split(':');
              await storageService.removeStorageUsage(
                testUserId,
                type as 'image' | 'document' | 'article',
                parseInt(id),
                resource.sizeBytes
              ).catch(() => {
                // 忽略清理错误
              });
            }

            // 等待清理完成
            await new Promise(resolve => setTimeout(resolve, 200));

            return true;
          } catch (error) {
            console.error('Property 4 测试失败:', error);
            
            // 尝试清理
            for (const [key, resource] of addedResources.entries()) {
              const [type, id] = key.split(':');
              await storageService.removeStorageUsage(
                testUserId,
                type as 'image' | 'document' | 'article',
                parseInt(id),
                resource.sizeBytes
              ).catch(() => {});
            }
            
            throw error;
          }
        }
      ),
      { 
        numRuns: 20, // 运行 20 次迭代（减少以加快测试速度）
        verbose: true,
        endOnFailure: true
      }
    );
  }, 60000); // 60秒超时

  /**
   * Property 4 (Variant): 总存储计算 - 直接数据库验证
   * 
   * Verify the invariant by directly querying the database to ensure
   * the generated column matches the sum of individual columns.
   */
  test('Property 4 (Variant): Total Storage Calculation - database level consistency', async () => {
    // Feature: storage-space-management, Property 4: Total Storage Calculation (Database Level)
    
    await fc.assert(
      fc.asyncProperty(
        // 生成随机的存储值
        fc.record({
          imageBytes: fc.integer({ min: 0, max: 10000000 }), // 0 to 10MB
          documentBytes: fc.integer({ min: 0, max: 10000000 }),
          articleBytes: fc.integer({ min: 0, max: 10000000 })
        }),
        async (storageValues) => {
          try {
            // 直接更新数据库中的存储值
            await pool.query(
              `UPDATE user_storage_usage 
               SET image_storage_bytes = $1,
                   document_storage_bytes = $2,
                   article_storage_bytes = $3
               WHERE user_id = $4`,
              [
                storageValues.imageBytes,
                storageValues.documentBytes,
                storageValues.articleBytes,
                testUserId
              ]
            );

            // 查询数据库以获取计算的总值
            const result = await pool.query(
              `SELECT 
                image_storage_bytes,
                document_storage_bytes,
                article_storage_bytes,
                total_storage_bytes
               FROM user_storage_usage
               WHERE user_id = $1`,
              [testUserId]
            );

            const row = result.rows[0];
            
            // 将 BIGINT 转换为数字
            const imageBytes = Number(row.image_storage_bytes);
            const documentBytes = Number(row.document_storage_bytes);
            const articleBytes = Number(row.article_storage_bytes);
            const totalBytes = Number(row.total_storage_bytes);

            // 计算预期的总值
            const expectedTotal = imageBytes + documentBytes + articleBytes;

            // 验证：数据库中的 total_storage_bytes 应该等于各部分之和
            if (totalBytes !== expectedTotal) {
              console.error('数据库级别存储计算不一致:', {
                imageBytes,
                documentBytes,
                articleBytes,
                totalBytes,
                expectedTotal,
                difference: totalBytes - expectedTotal
              });
            }

            expect(totalBytes).toBe(expectedTotal);

            return true;
          } catch (error) {
            console.error('Property 4 (Variant) 测试失败:', error);
            throw error;
          }
        }
      ),
      { 
        numRuns: 20, // 运行 20 次迭代（减少以加快测试速度）
        verbose: true
      }
    );
  }, 30000); // 30秒超时
});
