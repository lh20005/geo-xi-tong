/**
 * 基础服务类
 * 提供通用的数据库操作方法
 * Requirements: Phase 2 - 数据服务层
 */

import Database from 'better-sqlite3';
import { getDb } from '../database/sqlite';
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
 * 基础服务类
 */
export abstract class BaseService<T> {
  protected tableName: string;
  protected serviceName: string;

  constructor(tableName: string, serviceName?: string) {
    this.tableName = tableName;
    this.serviceName = serviceName || tableName;
  }

  /**
   * 获取数据库实例
   */
  protected get db(): Database.Database {
    return getDb();
  }

  /**
   * 生成 UUID
   */
  protected generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * 获取当前时间字符串
   */
  protected now(): string {
    return new Date().toISOString();
  }

  /**
   * 根据 ID 查找记录
   */
  findById(id: string): T | null {
    try {
      const result = this.db.prepare(
        `SELECT * FROM ${this.tableName} WHERE id = ?`
      ).get(id) as T | undefined;
      
      return result || null;
    } catch (error) {
      log.error(`${this.serviceName}: findById failed:`, error);
      throw error;
    }
  }

  /**
   * 查找所有记录
   */
  findAll(userId?: number): T[] {
    try {
      let sql = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];

      if (userId !== undefined) {
        sql += ' WHERE user_id = ?';
        params.push(userId);
      }

      sql += ' ORDER BY created_at DESC';

      return this.db.prepare(sql).all(...params) as T[];
    } catch (error) {
      log.error(`${this.serviceName}: findAll failed:`, error);
      throw error;
    }
  }

  /**
   * 分页查询
   */
  findPaginated(
    userId: number,
    params: PaginationParams & SortParams & { search?: string },
    searchFields: string[] = []
  ): PaginatedResult<T> {
    try {
      const page = params.page || 1;
      const pageSize = params.pageSize || 20;
      const offset = (page - 1) * pageSize;

      let whereClauses: string[] = ['user_id = ?'];
      let queryParams: any[] = [userId];

      // 搜索条件
      if (params.search && searchFields.length > 0) {
        const searchConditions = searchFields.map(field => `${field} LIKE ?`);
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
      const countResult = this.db.prepare(countSql).get(...queryParams) as { total: number };
      const total = countResult.total;

      // 查询数据
      const dataSql = `
        SELECT * FROM ${this.tableName} 
        WHERE ${whereClause} 
        ${orderClause}
        LIMIT ? OFFSET ?
      `;
      const data = this.db.prepare(dataSql).all(...queryParams, pageSize, offset) as T[];

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      log.error(`${this.serviceName}: findPaginated failed:`, error);
      throw error;
    }
  }

  /**
   * 删除记录
   */
  delete(id: string): boolean {
    try {
      const result = this.db.prepare(
        `DELETE FROM ${this.tableName} WHERE id = ?`
      ).run(id);
      
      return result.changes > 0;
    } catch (error) {
      log.error(`${this.serviceName}: delete failed:`, error);
      throw error;
    }
  }

  /**
   * 批量删除
   */
  deleteMany(ids: string[]): number {
    try {
      if (ids.length === 0) return 0;

      const placeholders = ids.map(() => '?').join(',');
      const result = this.db.prepare(
        `DELETE FROM ${this.tableName} WHERE id IN (${placeholders})`
      ).run(...ids);
      
      return result.changes;
    } catch (error) {
      log.error(`${this.serviceName}: deleteMany failed:`, error);
      throw error;
    }
  }

  /**
   * 统计记录数
   */
  count(userId?: number): number {
    try {
      let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: any[] = [];

      if (userId !== undefined) {
        sql += ' WHERE user_id = ?';
        params.push(userId);
      }

      const result = this.db.prepare(sql).get(...params) as { count: number };
      return result.count;
    } catch (error) {
      log.error(`${this.serviceName}: count failed:`, error);
      throw error;
    }
  }

  /**
   * 检查记录是否存在
   */
  exists(id: string): boolean {
    try {
      const result = this.db.prepare(
        `SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`
      ).get(id);
      
      return !!result;
    } catch (error) {
      log.error(`${this.serviceName}: exists failed:`, error);
      throw error;
    }
  }

  /**
   * 事务执行
   */
  protected transaction<R>(fn: () => R): R {
    const transaction = this.db.transaction(fn);
    return transaction();
  }
}
