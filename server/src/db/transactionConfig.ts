/**
 * 数据库事务配置
 * Task 13.3: 添加数据库事务隔离级别配置
 * 
 * PostgreSQL支持的隔离级别：
 * - READ UNCOMMITTED (实际上等同于READ COMMITTED)
 * - READ COMMITTED (默认，推荐)
 * - REPEATABLE READ
 * - SERIALIZABLE
 */

import { PoolClient } from 'pg';

/**
 * 事务隔离级别枚举
 */
export enum IsolationLevel {
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE'
}

/**
 * 开始事务并设置隔离级别
 * 
 * @param client - 数据库客户端
 * @param isolationLevel - 隔离级别（默认：READ COMMITTED）
 * 
 * READ COMMITTED 特点：
 * - 只能读取已提交的数据
 * - 避免脏读
 * - 允许不可重复读和幻读
 * - 性能最好，适合大多数场景
 * - 对于usage_count的原子更新操作足够安全
 */
export async function beginTransaction(
  client: PoolClient,
  isolationLevel: IsolationLevel = IsolationLevel.READ_COMMITTED
): Promise<void> {
  await client.query(`BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
}

/**
 * 提交事务
 */
export async function commitTransaction(client: PoolClient): Promise<void> {
  await client.query('COMMIT');
}

/**
 * 回滚事务
 */
export async function rollbackTransaction(client: PoolClient): Promise<void> {
  await client.query('ROLLBACK');
}

/**
 * 执行事务（带自动提交/回滚）
 * 
 * @param client - 数据库客户端
 * @param callback - 事务回调函数
 * @param isolationLevel - 隔离级别
 * @returns 回调函数的返回值
 * 
 * 使用示例：
 * ```typescript
 * const client = await pool.connect();
 * try {
 *   const result = await executeTransaction(client, async () => {
 *     // 执行数据库操作
 *     await client.query('INSERT INTO ...');
 *     await client.query('UPDATE ...');
 *     return someValue;
 *   });
 *   return result;
 * } finally {
 *   client.release();
 * }
 * ```
 */
export async function executeTransaction<T>(
  client: PoolClient,
  callback: () => Promise<T>,
  isolationLevel: IsolationLevel = IsolationLevel.READ_COMMITTED
): Promise<T> {
  try {
    await beginTransaction(client, isolationLevel);
    const result = await callback();
    await commitTransaction(client);
    return result;
  } catch (error) {
    await rollbackTransaction(client);
    throw error;
  }
}

/**
 * 处理死锁重试
 * 
 * 当发生死锁时，PostgreSQL会自动选择一个事务回滚
 * 这个函数会自动重试被回滚的事务
 * 
 * @param client - 数据库客户端
 * @param callback - 事务回调函数
 * @param maxRetries - 最大重试次数（默认：3）
 * @param isolationLevel - 隔离级别
 * @returns 回调函数的返回值
 */
export async function executeTransactionWithRetry<T>(
  client: PoolClient,
  callback: () => Promise<T>,
  maxRetries: number = 3,
  isolationLevel: IsolationLevel = IsolationLevel.READ_COMMITTED
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await executeTransaction(client, callback, isolationLevel);
    } catch (error: any) {
      lastError = error;
      
      // 检查是否是死锁错误（PostgreSQL错误代码：40P01）
      if (error.code === '40P01' && attempt < maxRetries - 1) {
        console.warn(`[事务] 检测到死锁，重试 ${attempt + 1}/${maxRetries}`);
        // 等待一小段时间后重试
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        continue;
      }
      
      // 其他错误或达到最大重试次数，抛出错误
      throw error;
    }
  }
  
  throw lastError || new Error('事务执行失败');
}

/**
 * 隔离级别说明
 * 
 * READ COMMITTED（推荐用于usage_count更新）：
 * - 优点：性能好，避免脏读，适合高并发场景
 * - 缺点：可能出现不可重复读和幻读
 * - 适用场景：usage_count的原子更新操作
 * 
 * REPEATABLE READ：
 * - 优点：避免脏读和不可重复读
 * - 缺点：可能出现幻读，性能略低
 * - 适用场景：需要在事务中多次读取同一数据且要求一致性
 * 
 * SERIALIZABLE：
 * - 优点：最高隔离级别，避免所有并发问题
 * - 缺点：性能最低，可能导致大量事务回滚
 * - 适用场景：对数据一致性要求极高的场景
 * 
 * 对于usage_count更新，我们使用READ COMMITTED + 原子操作的组合：
 * - 原子操作（UPDATE ... SET x = x + 1）确保并发安全
 * - READ COMMITTED提供足够的隔离性
 * - 性能最优
 */
