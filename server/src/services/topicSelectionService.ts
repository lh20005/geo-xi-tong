import { pool } from '../db/database';

/**
 * 话题选择服务
 * 负责智能选择话题，确保话题轮换使用
 */
export class TopicSelectionService {
  /**
   * 为蒸馏结果选择使用次数最少的话题（改进的轮换算法）
   * 
   * 策略：
   * 1. 找出usage_count的最小值
   * 2. 在所有usage_count等于最小值的话题中，选择ID最小的
   * 3. 这样确保话题按ID顺序轮换使用
   * 
   * 例如：
   * - 第1次：选择话题1（usage_count=0）
   * - 第2次：选择话题2（usage_count=0）
   * - 第3次：选择话题3（usage_count=0）
   * - 当所有话题都用过一轮后：
   * - 第4次：选择话题1（usage_count=1）
   * 
   * @param distillationId 蒸馏结果ID
   * @returns 选中的话题ID和内容
   */
  async selectLeastUsedTopic(distillationId: number): Promise<{
    topicId: number;
    question: string;
    usageCount: number;
  } | null> {
    // 第一步：找出最小的usage_count
    const minCountResult = await pool.query(
      `SELECT MIN(usage_count) as min_count
       FROM topics
       WHERE distillation_id = $1`,
      [distillationId]
    );

    if (minCountResult.rows.length === 0 || minCountResult.rows[0].min_count === null) {
      return null;
    }

    const minCount = minCountResult.rows[0].min_count;

    // 第二步：在所有usage_count等于最小值的话题中，选择ID最小的
    const result = await pool.query(
      `SELECT id, question, usage_count
       FROM topics
       WHERE distillation_id = $1 AND usage_count = $2
       ORDER BY id ASC
       LIMIT 1`,
      [distillationId, minCount]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      topicId: row.id,
      question: row.question,
      usageCount: row.usage_count || 0
    };
  }

  /**
   * 批量选择话题（为多个蒸馏结果各选一个话题）
   * 
   * @param distillationIds 蒸馏结果ID数组
   * @returns Map<distillationId, {topicId, question, usageCount}>
   */
  async selectTopicsForDistillations(
    distillationIds: number[]
  ): Promise<Map<number, { topicId: number; question: string; usageCount: number }>> {
    if (distillationIds.length === 0) {
      return new Map();
    }

    // 使用窗口函数为每个蒸馏结果选择usage_count最小的话题
    const result = await pool.query(
      `SELECT DISTINCT ON (distillation_id)
        distillation_id,
        id as topic_id,
        question,
        usage_count
       FROM topics
       WHERE distillation_id = ANY($1)
       ORDER BY distillation_id, usage_count ASC, created_at ASC`,
      [distillationIds]
    );

    const topicMap = new Map();
    for (const row of result.rows) {
      topicMap.set(row.distillation_id, {
        topicId: row.topic_id,
        question: row.question,
        usageCount: row.usage_count || 0
      });
    }

    return topicMap;
  }

  /**
   * 记录话题使用（在事务中）
   * 
   * @param topicId 话题ID
   * @param distillationId 蒸馏结果ID
   * @param articleId 文章ID
   * @param taskId 任务ID
   * @param client 数据库客户端（事务）
   */
  async recordTopicUsage(
    topicId: number,
    distillationId: number,
    articleId: number,
    taskId: number,
    client: any
  ): Promise<void> {
    // 1. 插入使用记录
    await client.query(
      `INSERT INTO topic_usage 
       (topic_id, distillation_id, article_id, task_id, used_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [topicId, distillationId, articleId, taskId]
    );

    // 2. 更新话题的usage_count
    await client.query(
      `UPDATE topics 
       SET usage_count = usage_count + 1
       WHERE id = $1`,
      [topicId]
    );

    // 3. 更新文章的topic_id字段
    await client.query(
      `UPDATE articles 
       SET topic_id = $1
       WHERE id = $2`,
      [topicId, articleId]
    );
  }

  /**
   * 获取话题使用统计
   * 
   * @param topicId 话题ID
   * @returns 使用统计信息
   */
  async getTopicUsageStats(topicId: number): Promise<{
    topicId: number;
    question: string;
    usageCount: number;
    lastUsedAt: string | null;
    articles: Array<{
      articleId: number;
      articleTitle: string;
      usedAt: string;
    }>;
  } | null> {
    // 获取话题基本信息
    const topicResult = await pool.query(
      `SELECT id, question, usage_count
       FROM topics
       WHERE id = $1`,
      [topicId]
    );

    if (topicResult.rows.length === 0) {
      return null;
    }

    const topic = topicResult.rows[0];

    // 获取使用记录
    const usageResult = await pool.query(
      `SELECT 
        tu.article_id,
        a.title as article_title,
        tu.used_at
       FROM topic_usage tu
       LEFT JOIN articles a ON tu.article_id = a.id
       WHERE tu.topic_id = $1
       ORDER BY tu.used_at DESC`,
      [topicId]
    );

    const lastUsedAt = usageResult.rows.length > 0 
      ? usageResult.rows[0].used_at 
      : null;

    return {
      topicId: topic.id,
      question: topic.question,
      usageCount: topic.usage_count || 0,
      lastUsedAt,
      articles: usageResult.rows.map(row => ({
        articleId: row.article_id,
        articleTitle: row.article_title || '已删除',
        usedAt: row.used_at
      }))
    };
  }

  /**
   * 获取蒸馏结果的所有话题使用统计
   * 
   * @param distillationId 蒸馏结果ID
   * @returns 话题列表及使用统计
   */
  async getDistillationTopicsStats(distillationId: number): Promise<Array<{
    topicId: number;
    question: string;
    usageCount: number;
    lastUsedAt: string | null;
  }>> {
    const result = await pool.query(
      `SELECT 
        t.id as topic_id,
        t.question,
        t.usage_count,
        MAX(tu.used_at) as last_used_at
       FROM topics t
       LEFT JOIN topic_usage tu ON t.id = tu.topic_id
       WHERE t.distillation_id = $1
       GROUP BY t.id, t.question, t.usage_count
       ORDER BY t.usage_count ASC, t.created_at ASC`,
      [distillationId]
    );

    return result.rows.map(row => ({
      topicId: row.topic_id,
      question: row.question,
      usageCount: row.usage_count || 0,
      lastUsedAt: row.last_used_at
    }));
  }

  /**
   * 修复话题使用计数（重新计算）
   * 
   * @param topicId 话题ID（可选，不传则修复所有）
   * @returns 修复结果
   */
  async repairTopicUsageCount(topicId?: number): Promise<{
    fixed: number;
    details: Array<{ topicId: number; oldCount: number; newCount: number }>;
  }> {
    const details: Array<{ topicId: number; oldCount: number; newCount: number }> = [];

    let whereClause = '';
    const params: any[] = [];

    if (topicId !== undefined) {
      whereClause = 'WHERE t.id = $1';
      params.push(topicId);
    }

    // 查找不一致的数据
    const result = await pool.query(`
      SELECT 
        t.id as topic_id,
        t.usage_count as old_count,
        COUNT(tu.id) as new_count
      FROM topics t
      LEFT JOIN topic_usage tu ON t.id = tu.topic_id
      ${whereClause}
      GROUP BY t.id, t.usage_count
      HAVING t.usage_count != COUNT(tu.id)
    `, params);

    if (result.rows.length === 0) {
      return { fixed: 0, details: [] };
    }

    // 修复每条不一致的数据
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const row of result.rows) {
        const topicId = row.topic_id;
        const oldCount = row.old_count;
        const newCount = parseInt(row.new_count);

        await client.query(
          'UPDATE topics SET usage_count = $1 WHERE id = $2',
          [newCount, topicId]
        );

        details.push({
          topicId,
          oldCount,
          newCount
        });
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return {
      fixed: details.length,
      details
    };
  }
}
