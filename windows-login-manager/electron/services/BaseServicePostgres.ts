/**
 * PostgreSQL 基础服务类
 * 实现外键约束替代方案
 * 
 * 功能：
 * 1. 引用完整性：从 JWT token 获取 user_id，应用层强制使用
 * 2. 数据隔离：所有操作自动添加 user_id 过滤
 * 3. 级联删除：应用层手动实现（见 UserService）
 * 
 * Requirements: PostgreSQL 迁移 - 外键约束替代
 */

import { Pool, PoolClient } from 'pg';
import { getPool } from '../database/postgres';
import log from 'electron-log';
import * as crypto from 'crypto';

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 排序参数
 */
export interface SortParams {
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * PostgreSQL 基础服务类
 * 
 * 核心功能：
 * - 自动管理 user_id（从 JWT token 获取）
 * - 所有操作自动添加 user_id 过滤
 * - 提供异步 CRUD 操作
 * - 事务支持
 */
export abstract class BaseServicePostgres<T> {
  protected tableName: string;
  protected serviceName: string;
  protected userId: number | null = null;

  constructor(tableName: string, serviceName?: string) {
    this.tableName = tableName;
    this.serviceName = serviceName || tableName;
  }

  /**
   * 获取数据库连接池
   */
  protected get pool(): Pool {
    return getPool();
  }

  /**
   * 生成 UUID
   */
  protected generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * 获取当前时间
   */
  protected now(): Date {
    return new Date();
  }

  /**
   * 获取当前用户 ID
   * 
   * 这是唯一的 user_id 来源，保证数据完整性
   * 替代原有的数据库外键约束：user_id → users(id)
   * 
   * @throws {Error} 如果用户未登录
   */
  protected getCurrentUserId(): number {
    if (this.userId !== null) {
      return this.userId;
    }
    throw new Error('用户未登录：未设置用户 ID');
  }

  /**
   * 设置当前用户 ID
   * 
   * 由 ServiceFactory 调用，从 storageManager 获取用户信息后设置
   * 
   * @param userId 用户 ID
   */
  public setUserId(userId: number): void {
    this.userId = userId;
  }

  /**
   * 验证用户 ID 是否已设置
   * 
   * 在所有需要 user_id 的操作前调用
   * 
   * @throws {Error} 如果用户未登录
   */
  protected validateUserId(): void {
    const userId = this.getCurrentUserId();
    
    if (!userId || userId <= 0) {
      throw new Error('无效的用户 ID');
    }
  }

  /**
   * 创建记录（自动添加 user_id）
   * 
   * 功能：
   * - 自动添加 user_id（从 JWT 获取）
   * - 自动添加 created_at 和 updated_at
   * - 返回创建的记录
   * 
   * 替代原有的外键约束：INSERT 时自动检查 user_id 是否存在
   * 
   * @param data 记录数据（不需要包含 user_id）
   * @returns 创建的记录
   */
  public async create(data: Partial<T>): Promise<T> {
    this.validateUserId();

    try {
      // 强制使用当前用户 ID
      const recordData = {
        ...data,
        user_id: this.userId,
        created_at: this.now(),
        updated_at: this.now()
      };

      const fields = Object.keys(recordData);
      const values = Object.values(recordData);
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

      const query = `
        INSERT INTO ${this.tableName} (${fields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      
      log.info(`${this.serviceName}: 创建记录成功, ID: ${result.rows[0].id}`);
      
      return result.rows[0] as T;
    } catch (error) {
      log.error(`${this.serviceName}: 创建记录失败:`, error);
      throw error;
    }
  }

  /**
   * 根据 ID 查找记录（自动添加 user_id 过滤）
   * 
   * 功能：
   * - 自动添加 WHERE user_id = $1 条件
   * - 防止访问其他用户的数据
   * 
   * 替代原有的外键约束：确保只能访问自己的数据
   * 
   * @param id 记录 ID
   * @returns 记录或 null
   */
  async findById(id: string | number): Promise<T | null> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1 AND user_id = $2`,
        [id, this.userId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      log.error(`${this.serviceName}: findById 失败:`, error);
      throw error;
    }
  }

  /**
   * 查找所有记录（自动添加 user_id 过滤）
   * 
   * 功能：
   * - 自动添加 WHERE user_id = $1 条件
   * - 只返回当前用户的数据
   * 
   * 替代原有的外键约束：数据隔离
   * 
   * @param conditions 额外的查询条件
   * @returns 记录数组
   */
  async findAll(conditions: Partial<T> = {}): Promise<T[]> {
    this.validateUserId();

    try {
      // 强制添加 user_id 条件
      const whereConditions = {
        ...conditions,
        user_id: this.userId
      };

      const whereClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(whereConditions)) {
        whereClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      const query = `
        SELECT * FROM ${this.tableName}
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, values);
      return result.rows as T[];
    } catch (error) {
      log.error(`${this.serviceName}: findAll 失败:`, error);
      throw error;
    }
  }

  /**
   * 分页查询（自动添加 user_id 过滤）
   * 
   * @param params 分页和排序参数
   * @param searchFields 搜索字段
   * @returns 分页结果
   */
  async findPaginated(
    params: PaginationParams & SortParams & { search?: string },
    searchFields: string[] = []
  ): Promise<PaginatedResult<T>> {
    this.validateUserId();

    try {
      const page = params.page || 1;
      const pageSize = params.pageSize || 20;
      const offset = (page - 1) * pageSize;

      const whereClauses: string[] = ['user_id = $1'];
      const queryParams: any[] = [this.userId];
      let paramIndex = 2;

      // 搜索条件
      if (params.search && searchFields.length > 0) {
        const searchConditions = searchFields.map(field => {
          const condition = `${field}::text ILIKE $${paramIndex}`;
          paramIndex++;
          return condition;
        });
        whereClauses.push(`(${searchConditions.join(' OR ')})`);
        searchFields.forEach(() => {
          queryParams.push(`%${params.search}%`);
        });
      }

      const whereClause = whereClauses.join(' AND ');

      // 排序
      const sortField = params.sortField || 'created_at';
      const sortOrder = params.sortOrder || 'desc';
      const orderClause = `ORDER BY ${sortField} ${sortOrder.toUpperCase()}`;

      // 查询总数
      const countSql = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE ${whereClause}`;
      const countResult = await this.pool.query(countSql, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // 查询数据
      const dataSql = `
        SELECT * FROM ${this.tableName} 
        WHERE ${whereClause} 
        ${orderClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      const dataResult = await this.pool.query(dataSql, [...queryParams, pageSize, offset]);

      return {
        data: dataResult.rows as T[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      log.error(`${this.serviceName}: findPaginated 失败:`, error);
      throw error;
    }
  }

  /**
   * 更新记录（自动添加 user_id 过滤）
   * 
   * 功能：
   * - 自动添加 WHERE user_id = $1 条件
   * - 只能修改自己的记录
   * - 自动更新 updated_at
   * 
   * 替代原有的外键约束：防止修改其他用户的数据
   * 
   * @param id 记录 ID
   * @param data 更新数据
   * @returns 更新后的记录
   */
  async update(id: string | number, data: Partial<T>): Promise<T> {
    this.validateUserId();

    try {
      const updateData = {
        ...data,
        updated_at: this.now()
      };

      const fields = Object.keys(updateData);
      const values = Object.values(updateData);
      const setClauses = fields.map((field, i) => `${field} = $${i + 1}`);

      const query = `
        UPDATE ${this.tableName}
        SET ${setClauses.join(', ')}
        WHERE id = $${fields.length + 1} AND user_id = $${fields.length + 2}
        RETURNING *
      `;

      const result = await this.pool.query(query, [...values, id, this.userId]);

      if (result.rowCount === 0) {
        throw new Error('记录不存在或无权限修改');
      }

      log.info(`${this.serviceName}: 更新记录成功, ID: ${id}`);

      return result.rows[0] as T;
    } catch (error) {
      log.error(`${this.serviceName}: update 失败:`, error);
      throw error;
    }
  }

  /**
   * 删除记录（自动添加 user_id 过滤）
   * 
   * 功能：
   * - 自动添加 WHERE user_id = $1 条件
   * - 只能删除自己的记录
   * 
   * 替代原有的外键约束：防止删除其他用户的数据
   * 
   * @param id 记录 ID
   */
  async delete(id: string | number): Promise<void> {
    this.validateUserId();

    try {
      const query = `
        DELETE FROM ${this.tableName}
        WHERE id = $1 AND user_id = $2
      `;

      const result = await this.pool.query(query, [id, this.userId]);

      if (result.rowCount === 0) {
        throw new Error('记录不存在或无权限删除');
      }

      log.info(`${this.serviceName}: 删除记录成功, ID: ${id}`);
    } catch (error) {
      log.error(`${this.serviceName}: delete 失败:`, error);
      throw error;
    }
  }

  /**
   * 批量删除（自动添加 user_id 过滤）
   * 
   * @param ids 记录 ID 数组
   * @returns 删除的记录数
   */
  async deleteMany(ids: (string | number)[]): Promise<number> {
    this.validateUserId();

    try {
      if (ids.length === 0) return 0;

      const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
      const query = `
        DELETE FROM ${this.tableName}
        WHERE id IN (${placeholders}) AND user_id = $1
      `;

      const result = await this.pool.query(query, [this.userId, ...ids]);

      log.info(`${this.serviceName}: 批量删除成功, 删除 ${result.rowCount} 条记录`);

      return result.rowCount || 0;
    } catch (error) {
      log.error(`${this.serviceName}: deleteMany 失败:`, error);
      throw error;
    }
  }

  /**
   * 统计记录数（自动添加 user_id 过滤）
   * 
   * @param conditions 查询条件
   * @returns 记录数
   */
  async count(conditions: Partial<T> = {}): Promise<number> {
    this.validateUserId();

    try {
      const whereConditions = {
        ...conditions,
        user_id: this.userId
      };

      const whereClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(whereConditions)) {
        whereClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      const query = `
        SELECT COUNT(*) as count FROM ${this.tableName}
        WHERE ${whereClauses.join(' AND ')}
      `;

      const result = await this.pool.query(query, values);
      return parseInt(result.rows[0].count);
    } catch (error) {
      log.error(`${this.serviceName}: count 失败:`, error);
      throw error;
    }
  }

  /**
   * 检查记录是否存在（自动添加 user_id 过滤）
   * 
   * @param id 记录 ID
   * @returns 是否存在
   */
  async exists(id: string | number): Promise<boolean> {
    this.validateUserId();

    try {
      const result = await this.pool.query(
        `SELECT 1 FROM ${this.tableName} WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [id, this.userId]
      );
      
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      log.error(`${this.serviceName}: exists 失败:`, error);
      throw error;
    }
  }

  /**
   * 事务执行
   * 
   * 用于实现级联删除等需要原子性的操作
   * 
   * @param fn 事务函数
   * @returns 事务结果
   */
  protected async transaction<R>(fn: (client: PoolClient) => Promise<R>): Promise<R> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      log.error(`${this.serviceName}: 事务执行失败:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
}
