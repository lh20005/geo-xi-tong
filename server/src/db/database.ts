import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量 - 从 server 目录读取
dotenv.config({ path: path.join(__dirname, '../../.env') });

// 优化的连接池配置
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 连接池大小配置
  max: parseInt(process.env.DB_POOL_MAX || '30'),           // 最大连接数
  min: parseInt(process.env.DB_POOL_MIN || '5'),            // 最小连接数
  // 超时配置
  idleTimeoutMillis: 30000,                                  // 空闲连接超时 30秒
  connectionTimeoutMillis: 5000,                             // 连接超时 5秒
});

// 测试数据库连接
pool.on('connect', () => {
  console.log('✅ 数据库连接成功');
});

pool.on('error', (err) => {
  console.error('❌ 数据库连接错误:', err);
});

// ==================== 蒸馏结果查询方法 ====================

/**
 * 获取所有唯一的关键词列表
 * topics 表独立存储 keyword，不依赖 distillations
 * 
 * @returns 关键词数组
 */
export async function getAllKeywords(): Promise<string[]> {
  const query = `
    SELECT DISTINCT keyword
    FROM topics
    WHERE keyword IS NOT NULL
    ORDER BY keyword ASC
  `;

  const result = await pool.query(query);
  return result.rows.map(row => row.keyword);
}

/**
 * 话题引用信息接口
 */
export interface TopicWithReference {
  id: number;
  distillation_id: number | null;
  keyword: string;
  question: string;
  provider: string | null;
  created_at: string;
  reference_count: number;
}

/**
 * 查询结果响应接口
 */
export interface TopicsQueryResult {
  data: TopicWithReference[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 统计信息接口
 */
export interface TopicsStatistics {
  totalTopics: number;
  totalKeywords: number;
  totalReferences: number;
}

/**
 * 查询筛选参数接口
 */
export interface TopicsQueryFilters {
  keyword?: string;
  provider?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  userId?: number;
}

/**
 * 获取带引用次数的话题列表
 * 完全解耦设计：topics 独立存储 keyword 和 user_id，不依赖 distillations
 * 
 * @param filters 筛选参数
 * @returns 包含话题数据、分页信息的结果
 */
export async function getTopicsWithReferences(
  filters: TopicsQueryFilters = {}
): Promise<TopicsQueryResult> {
  const {
    keyword,
    provider,
    search,
    page = 1,
    pageSize = 10,
    userId
  } = filters;

  // 构建WHERE条件
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // 用户ID过滤（多租户隔离）- 直接使用 topics.user_id
  if (userId !== undefined) {
    conditions.push(`t.user_id = $${paramIndex}`);
    params.push(userId);
    paramIndex++;
  }

  // search参数优先级最高
  if (search) {
    conditions.push(`LOWER(t.question) LIKE LOWER($${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  } else {
    // 关键词筛选 - 直接使用 topics.keyword
    if (keyword) {
      conditions.push(`t.keyword = $${paramIndex}`);
      params.push(keyword);
      paramIndex++;
    }

    // AI模型筛选 - 仍需要 JOIN distillations
    if (provider) {
      conditions.push(`d.provider = $${paramIndex}`);
      params.push(provider);
      paramIndex++;
    }
  }

  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}` 
    : '';

  const offset = (page - 1) * pageSize;

  // 查询总数
  const countQuery = `
    SELECT COUNT(DISTINCT t.id) as total
    FROM topics t
    LEFT JOIN distillations d ON t.distillation_id = d.id
    ${whereClause}
  `;
  
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].total);

  // 查询数据 - 直接使用 t.keyword，不需要 COALESCE
  const dataQuery = `
    SELECT 
      t.id,
      t.distillation_id,
      t.keyword,
      t.question,
      t.created_at,
      d.provider,
      t.usage_count as reference_count
    FROM topics t
    LEFT JOIN distillations d ON t.distillation_id = d.id
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(pageSize, offset);
  const dataResult = await pool.query(dataQuery, params);

  return {
    data: dataResult.rows.map(row => ({
      id: row.id,
      distillation_id: row.distillation_id,
      keyword: row.keyword,
      question: row.question,
      provider: row.provider,
      created_at: row.created_at,
      reference_count: parseInt(row.reference_count) || 0
    })),
    total,
    page,
    pageSize
  };
}

/**
 * 获取话题统计信息
 * 完全解耦设计：直接使用 topics 表的 keyword 和 user_id
 * 
 * @param filters 筛选参数
 * @returns 统计信息
 */
export async function getTopicsStatistics(
  filters: TopicsQueryFilters = {}
): Promise<TopicsStatistics> {
  const { keyword, provider, search, userId } = filters;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // 用户ID过滤 - 直接使用 topics.user_id
  if (userId !== undefined) {
    conditions.push(`t.user_id = $${paramIndex}`);
    params.push(userId);
    paramIndex++;
  }

  if (search) {
    conditions.push(`LOWER(t.question) LIKE LOWER($${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  } else {
    if (keyword) {
      conditions.push(`t.keyword = $${paramIndex}`);
      params.push(keyword);
      paramIndex++;
    }

    if (provider) {
      conditions.push(`d.provider = $${paramIndex}`);
      params.push(provider);
      paramIndex++;
    }
  }

  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}` 
    : '';

  // 直接使用 t.keyword 统计
  const query = `
    SELECT 
      COUNT(DISTINCT t.id) as total_topics,
      COUNT(DISTINCT t.keyword) as total_keywords,
      COALESCE(SUM(t.usage_count), 0) as total_references
    FROM topics t
    LEFT JOIN distillations d ON t.distillation_id = d.id
    ${whereClause}
  `;

  const result = await pool.query(query, params);
  const row = result.rows[0];

  return {
    totalTopics: parseInt(row.total_topics) || 0,
    totalKeywords: parseInt(row.total_keywords) || 0,
    totalReferences: parseInt(row.total_references) || 0
  };
}

/**
 * 批量删除话题
 * 使用事务确保数据一致性
 * 
 * @param topicIds 要删除的话题ID数组
 * @returns 删除的记录数
 */
export async function deleteTopicsByIds(topicIds: number[]): Promise<number> {
  if (!topicIds || topicIds.length === 0) {
    return 0;
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 查询这些话题关联的distillation IDs
    const distillationsResult = await client.query(
      'SELECT DISTINCT distillation_id FROM topics WHERE id = ANY($1::int[])',
      [topicIds]
    );
    const distillationIds = distillationsResult.rows
      .map(row => row.distillation_id)
      .filter(id => id !== null);

    // 删除话题
    const result = await client.query(
      'DELETE FROM topics WHERE id = ANY($1::int[])',
      [topicIds]
    );

    // 删除没有话题的distillation记录
    if (distillationIds.length > 0) {
      await client.query(
        `DELETE FROM distillations 
         WHERE id = ANY($1::int[]) 
         AND NOT EXISTS (
           SELECT 1 FROM topics WHERE distillation_id = distillations.id
         )`,
        [distillationIds]
      );
    }

    await client.query('COMMIT');
    
    return result.rowCount || 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
