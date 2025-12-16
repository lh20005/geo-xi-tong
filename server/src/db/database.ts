import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
 * 只返回有话题的关键词，按字母顺序排序
 * 
 * @returns 关键词数组
 */
export async function getAllKeywords(): Promise<string[]> {
  const query = `
    SELECT DISTINCT d.keyword
    FROM distillations d
    INNER JOIN topics t ON d.id = t.distillation_id
    WHERE t.id IS NOT NULL
    ORDER BY d.keyword ASC
  `;

  const result = await pool.query(query);
  return result.rows.map(row => row.keyword);
}

/**
 * 话题引用信息接口
 */
export interface TopicWithReference {
  id: number;
  distillation_id: number;
  keyword: string;
  question: string;
  provider: string;
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
  search?: string;  // 新增：搜索话题内容
  page?: number;
  pageSize?: number;
}

/**
 * 获取带引用次数的话题列表
 * 使用LEFT JOIN连接topics、distillations和articles表
 * 通过内容匹配统计每个话题的引用次数
 * 支持search参数进行全局搜索（优先级高于其他筛选条件）
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
    pageSize = 10
  } = filters;

  // 构建WHERE条件
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // search参数优先级最高，如果提供了search，忽略其他筛选条件
  if (search) {
    conditions.push(`LOWER(t.question) LIKE LOWER($${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  } else {
    // 只有在没有search参数时才应用其他筛选条件
    if (keyword) {
      conditions.push(`d.keyword = $${paramIndex}`);
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

  // 计算偏移量
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

  // 查询数据
  // 注意：由于articles表通过distillation_id关联，我们需要通过内容匹配来判断引用
  const dataQuery = `
    SELECT 
      t.id,
      t.distillation_id,
      t.question,
      t.created_at,
      d.keyword,
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
      reference_count: parseInt(row.reference_count)
    })),
    total,
    page,
    pageSize
  };
}

/**
 * 获取话题统计信息
 * 支持search参数进行全局搜索统计
 * 
 * @param filters 筛选参数
 * @returns 统计信息
 */
export async function getTopicsStatistics(
  filters: TopicsQueryFilters = {}
): Promise<TopicsStatistics> {
  const { keyword, provider, search } = filters;

  // 构建WHERE条件
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // search参数优先级最高
  if (search) {
    conditions.push(`LOWER(t.question) LIKE LOWER($${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  } else {
    if (keyword) {
      conditions.push(`d.keyword = $${paramIndex}`);
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

  const query = `
    SELECT 
      COUNT(DISTINCT t.id) as total_topics,
      COUNT(DISTINCT d.keyword) as total_keywords,
      SUM(t.usage_count) as total_references
    FROM topics t
    LEFT JOIN distillations d ON t.distillation_id = d.id
    ${whereClause}
  `;

  const result = await pool.query(query, params);
  const row = result.rows[0];

  return {
    totalTopics: parseInt(row.total_topics),
    totalKeywords: parseInt(row.total_keywords),
    totalReferences: parseInt(row.total_references)
  };
}

/**
 * 批量删除话题
 * 使用事务确保数据一致性，并清理没有话题的distillation记录
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
    const distillationIds = distillationsResult.rows.map(row => row.distillation_id);

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
