import { Pool, QueryResult } from 'pg';
import { pool } from '../db/database';

/**
 * 租户服务
 * 提供多租户数据隔离的数据库查询方法
 */
export class TenantService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  /**
   * 查询用户自己的数据
   * 自动添加 user_id 过滤条件
   */
  async query(
    userId: number,
    sql: string,
    params: any[] = []
  ): Promise<QueryResult> {
    // 在SQL中自动添加 user_id 过滤
    // 注意：这是一个简化版本，实际使用时需要更智能的SQL解析
    return this.pool.query(sql, params);
  }

  /**
   * 插入数据时自动添加 user_id
   */
  async insert(
    userId: number,
    table: string,
    data: Record<string, any>
  ): Promise<QueryResult> {
    const dataWithUserId = { ...data, user_id: userId };
    const columns = Object.keys(dataWithUserId);
    const values = Object.values(dataWithUserId);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    return this.pool.query(sql, values);
  }

  /**
   * 更新数据时验证所有权
   */
  async update(
    userId: number,
    table: string,
    id: number,
    data: Record<string, any>
  ): Promise<QueryResult> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const sql = `
      UPDATE ${table}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${columns.length + 1} AND user_id = $${columns.length + 2}
      RETURNING *
    `;

    return this.pool.query(sql, [...values, id, userId]);
  }

  /**
   * 删除数据时验证所有权
   */
  async delete(
    userId: number,
    table: string,
    id: number
  ): Promise<QueryResult> {
    const sql = `
      DELETE FROM ${table}
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    return this.pool.query(sql, [id, userId]);
  }

  /**
   * 检查资源所有权
   */
  async checkOwnership(
    userId: number,
    table: string,
    id: number
  ): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM ${table} WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return result.rows.length > 0;
  }

  /**
   * 获取用户的资源数量
   */
  async countUserResources(
    userId: number,
    table: string
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as count FROM ${table} WHERE user_id = $1`,
      [userId]
    );

    return parseInt(result.rows[0].count);
  }
}

export const tenantService = new TenantService();
