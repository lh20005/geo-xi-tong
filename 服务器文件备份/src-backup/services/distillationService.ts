import { 
  pool, 
  getAllKeywords,
  getTopicsWithReferences, 
  getTopicsStatistics, 
  deleteTopicsByIds,
  TopicWithReference,
  TopicsQueryFilters,
  TopicsStatistics
} from '../db/database';

export interface DistillationUsageStats {
  distillationId: number;
  keyword: string;
  provider: string;
  usageCount: number;
  lastUsedAt: string | null;
  topicCount: number;
  createdAt: string;
}

export interface DistillationUsageHistory {
  id: number;
  taskId: number;
  articleId: number;
  articleTitle: string | null;
  usedAt: string;
}

export interface RecommendedDistillation {
  distillationId: number;
  keyword: string;
  usageCount: number;
  topicCount: number;
  isRecommended: boolean;
  recommendReason: string;
}

export class DistillationService {
  /**
   * 获取蒸馏结果列表（包含使用统计）
   * 支持排序和筛选
   * Task 3.1: 扩展getDistillations方法
   */
  async getDistillationsWithStats(
    page: number = 1,
    pageSize: number = 10,
    sortBy: 'created_at' | 'usage_count' = 'usage_count',
    sortOrder: 'asc' | 'desc' = 'asc',
    filterUsage: 'all' | 'used' | 'unused' = 'all',
    userId?: number
  ): Promise<{ distillations: DistillationUsageStats[]; total: number }> {
    const offset = (page - 1) * pageSize;

    // 构建WHERE子句用于筛选
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (userId !== undefined) {
      conditions.push(`d.user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }
    
    if (filterUsage === 'used') {
      conditions.push('d.usage_count > 0');
    } else if (filterUsage === 'unused') {
      conditions.push('d.usage_count = 0');
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数（应用筛选）
    const countResult = await pool.query(`SELECT COUNT(*) FROM distillations d ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    // 构建ORDER BY子句
    const orderByClause = `ORDER BY d.${sortBy} ${sortOrder.toUpperCase()}, d.created_at ASC`;

    // 查询蒸馏结果及其统计信息
    const result = await pool.query(
      `SELECT 
        d.id as distillation_id,
        d.keyword,
        d.provider,
        d.usage_count,
        d.created_at,
        COUNT(t.id) as topic_count,
        MAX(du.used_at) as last_used_at
       FROM distillations d
       LEFT JOIN topics t ON d.id = t.distillation_id
       LEFT JOIN distillation_usage du ON d.id = du.distillation_id
       ${whereClause}
       GROUP BY d.id, d.keyword, d.provider, d.usage_count, d.created_at
       ${orderByClause}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    return {
      distillations: result.rows.map(row => ({
        distillationId: row.distillation_id,
        keyword: row.keyword,
        provider: row.provider,
        usageCount: row.usage_count,
        lastUsedAt: row.last_used_at,
        topicCount: parseInt(row.topic_count),
        createdAt: row.created_at
      })),
      total
    };
  }

  /**
   * 获取单条蒸馏结果的详情（包含使用统计）
   * Task 3.2: 扩展getDistillationDetail方法
   */
  async getDistillationDetail(
    distillationId: number
  ): Promise<DistillationUsageStats | null> {
    const result = await pool.query(
      `SELECT 
        d.id as distillation_id,
        d.keyword,
        d.provider,
        d.usage_count,
        d.created_at,
        COUNT(t.id) as topic_count,
        MAX(du.used_at) as last_used_at
       FROM distillations d
       LEFT JOIN topics t ON d.id = t.distillation_id
       LEFT JOIN distillation_usage du ON d.id = du.distillation_id
       WHERE d.id = $1
       GROUP BY d.id, d.keyword, d.provider, d.usage_count, d.created_at`,
      [distillationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      distillationId: row.distillation_id,
      keyword: row.keyword,
      provider: row.provider,
      usageCount: row.usage_count,
      lastUsedAt: row.last_used_at,
      topicCount: parseInt(row.topic_count),
      createdAt: row.created_at
    };
  }

  /**
   * 获取单条蒸馏结果的使用历史
   * 按used_at降序排序，最新的在前
   */
  async getUsageHistory(
    distillationId: number,
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ history: DistillationUsageHistory[]; total: number }> {
    const offset = (page - 1) * pageSize;

    // 获取总数
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM distillation_usage WHERE distillation_id = $1',
      [distillationId]
    );
    const total = parseInt(countResult.rows[0].count);

    // 查询使用历史
    const result = await pool.query(
      `SELECT 
        du.id,
        du.task_id,
        du.article_id,
        du.used_at,
        a.title as article_title
       FROM distillation_usage du
       LEFT JOIN articles a ON du.article_id = a.id
       WHERE du.distillation_id = $1
       ORDER BY du.used_at DESC
       LIMIT $2 OFFSET $3`,
      [distillationId, pageSize, offset]
    );

    return {
      history: result.rows.map(row => ({
        id: row.id,
        taskId: row.task_id,
        articleId: row.article_id,
        articleTitle: row.article_title || '文章已删除',
        usedAt: row.used_at
      })),
      total
    };
  }

  /**
   * 获取推荐的蒸馏结果（使用次数最少的前N条）
   * 过滤掉没有话题的蒸馏结果
   */
  async getRecommendedDistillations(
    limit: number = 3,
    userId?: number
  ): Promise<RecommendedDistillation[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (userId !== undefined) {
      conditions.push(`d.user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    params.push(limit);
    
    const result = await pool.query(
      `SELECT 
        d.id as distillation_id,
        d.keyword,
        d.usage_count,
        COUNT(t.id) as topic_count
       FROM distillations d
       LEFT JOIN topics t ON d.id = t.distillation_id
       ${whereClause}
       GROUP BY d.id, d.keyword, d.usage_count
       HAVING COUNT(t.id) > 0
       ORDER BY d.usage_count ASC, d.created_at ASC
       LIMIT $${paramIndex}`,
      params
    );

    return result.rows.map((row, index) => ({
      distillationId: row.distillation_id,
      keyword: row.keyword,
      usageCount: row.usage_count,
      topicCount: parseInt(row.topic_count),
      isRecommended: true,
      recommendReason: `使用次数较少（${row.usage_count}次），推荐优先使用`
    }));
  }

  /**
   * 重置单条蒸馏结果的使用统计
   * 将usage_count设为0并删除所有使用记录
   */
  async resetUsageStats(distillationId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 删除使用记录
      await client.query(
        'DELETE FROM distillation_usage WHERE distillation_id = $1',
        [distillationId]
      );

      // 重置usage_count
      await client.query(
        'UPDATE distillations SET usage_count = 0 WHERE id = $1',
        [distillationId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 重置所有蒸馏结果的使用统计
   * 将所有usage_count设为0并清空使用记录表
   */
  async resetAllUsageStats(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 清空使用记录表
      await client.query('DELETE FROM distillation_usage');

      // 重置所有usage_count
      await client.query('UPDATE distillations SET usage_count = 0');

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 修复使用统计（重新计算usage_count）
   * 比对usage_count与实际使用记录数量，修复不一致的数据
   * Task 3.4: 实现fixUsageCount方法
   */
  async repairUsageStats(distillationId?: number): Promise<{
    fixed: number;
    errors: string[];
    details: Array<{ distillationId: number; oldCount: number; newCount: number }>;
  }> {
    const errors: string[] = [];
    const details: Array<{ distillationId: number; oldCount: number; newCount: number }> = [];

    try {
      // 构建查询条件
      let whereClause = '';
      const params: any[] = [];
      
      if (distillationId !== undefined) {
        whereClause = 'AND d.id = $1';
        params.push(distillationId);
      }

      // 查找不一致的数据
      const inconsistentResult = await pool.query(`
        SELECT 
          d.id as distillation_id,
          d.usage_count as old_count,
          COUNT(du.id) as new_count
        FROM distillations d
        LEFT JOIN distillation_usage du ON d.id = du.distillation_id
        WHERE 1=1 ${whereClause}
        GROUP BY d.id, d.usage_count
        HAVING d.usage_count != COUNT(du.id)
      `, params);

      if (inconsistentResult.rows.length === 0) {
        return { fixed: 0, errors: [], details: [] };
      }

      // 修复每条不一致的数据
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const row of inconsistentResult.rows) {
          const distId = row.distillation_id;
          const oldCount = row.old_count;
          const newCount = parseInt(row.new_count);

          await client.query(
            'UPDATE distillations SET usage_count = $1 WHERE id = $2',
            [newCount, distId]
          );

          details.push({
            distillationId: distId,
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
        errors,
        details
      };
    } catch (error: any) {
      errors.push(error.message);
      return { fixed: 0, errors, details };
    }
  }

  /**
   * 减少使用计数（删除文章时调用）
   * Task 3.5: 实现decrementUsageCount方法
   */
  async decrementUsageCount(distillationId: number): Promise<void> {
    await pool.query(
      `UPDATE distillations 
       SET usage_count = GREATEST(usage_count - 1, 0) 
       WHERE id = $1`,
      [distillationId]
    );
  }

  // ==================== 蒸馏结果表格视图相关方法 ====================

  /**
   * 获取所有唯一的关键词列表
   * 调用数据库查询方法，返回所有有话题的关键词
   * 
   * @returns 关键词数组
   */
  async getAllKeywords(): Promise<string[]> {
    try {
      return await getAllKeywords();
    } catch (error: any) {
      console.error('获取关键词列表错误:', error);
      throw new Error(`获取关键词列表失败: ${error.message}`);
    }
  }

  /**
   * 获取带引用次数的蒸馏结果列表
   * 调用数据库查询方法，处理筛选参数，格式化返回数据
   * 
   * @param filters 筛选参数
   * @returns 包含数据、分页信息和统计信息的响应
   */
  async getResultsWithReferences(filters: TopicsQueryFilters & { userId?: number } = {}): Promise<{
    data: Array<{
      id: number;
      distillationId: number | null;
      keyword: string;
      question: string;
      provider: string | null;
      createdAt: string;
      referenceCount: number;
    }>;
    total: number;
    page: number;
    pageSize: number;
    statistics: TopicsStatistics;
  }> {
    try {
      // 查询话题数据
      const queryResult = await getTopicsWithReferences(filters);
      
      // 查询统计信息
      const statistics = await getTopicsStatistics(filters);

      // 格式化返回数据
      return {
        data: queryResult.data.map(topic => ({
          id: topic.id,
          distillationId: topic.distillation_id,
          keyword: topic.keyword,
          question: topic.question,
          provider: topic.provider,
          createdAt: topic.created_at,
          referenceCount: topic.reference_count
        })),
        total: queryResult.total,
        page: queryResult.page,
        pageSize: queryResult.pageSize,
        statistics
      };
    } catch (error: any) {
      console.error('获取蒸馏结果列表错误:', error);
      throw new Error(`获取蒸馏结果列表失败: ${error.message}`);
    }
  }

  /**
   * 批量删除话题
   * 调用数据库删除方法，实现事务处理
   * 
   * @param topicIds 要删除的话题ID数组
   * @returns 删除结果
   */
  async deleteTopics(topicIds: number[]): Promise<{ 
    success: boolean; 
    deletedCount: number 
  }> {
    try {
      if (!topicIds || topicIds.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      const deletedCount = await deleteTopicsByIds(topicIds);

      return {
        success: true,
        deletedCount
      };
    } catch (error: any) {
      console.error('批量删除话题错误:', error);
      throw new Error(`批量删除话题失败: ${error.message}`);
    }
  }

  /**
   * 按关键词删除所有蒸馏结果
   * 删除指定关键词下的所有话题，并删除没有话题的distillation记录
   * 
   * @param keyword 关键词
   * @returns 删除结果
   */
  async deleteTopicsByKeyword(keyword: string): Promise<{
    success: boolean;
    deletedCount: number;
    keyword: string;
  }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 查询该关键词下的所有distillation ID和话题ID
      const distillationsResult = await client.query(
        `SELECT DISTINCT d.id as distillation_id
         FROM distillations d
         WHERE d.keyword = $1`,
        [keyword]
      );

      const distillationIds = distillationsResult.rows.map(row => row.distillation_id);

      if (distillationIds.length === 0) {
        await client.query('COMMIT');
        return {
          success: true,
          deletedCount: 0,
          keyword
        };
      }

      // 查询该关键词下的所有话题ID
      const topicsResult = await client.query(
        `SELECT t.id 
         FROM topics t
         WHERE t.distillation_id = ANY($1::int[])`,
        [distillationIds]
      );

      const topicIds = topicsResult.rows.map(row => row.id);
      let deletedTopicCount = 0;

      // 删除话题
      if (topicIds.length > 0) {
        const deleteTopicsResult = await client.query(
          'DELETE FROM topics WHERE id = ANY($1::int[])',
          [topicIds]
        );
        deletedTopicCount = deleteTopicsResult.rowCount || 0;
      }

      // 删除没有话题的distillation记录
      await client.query(
        `DELETE FROM distillations 
         WHERE id = ANY($1::int[]) 
         AND NOT EXISTS (
           SELECT 1 FROM topics WHERE distillation_id = distillations.id
         )`,
        [distillationIds]
      );

      await client.query('COMMIT');

      return {
        success: true,
        deletedCount: deletedTopicCount,
        keyword
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('按关键词删除话题错误:', error);
      throw new Error(`按关键词删除话题失败: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * 按筛选条件删除话题
   * 删除符合筛选条件的所有话题
   * 
   * @param filters 筛选条件
   * @returns 删除结果
   */
  async deleteTopicsByFilter(filters: {
    keyword?: string;
    provider?: string;
    search?: string;
  }): Promise<{
    success: boolean;
    deletedCount: number;
    filters: typeof filters;
  }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 构建查询条件
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.keyword) {
        conditions.push(`d.keyword = $${paramIndex}`);
        params.push(filters.keyword);
        paramIndex++;
      }

      if (filters.provider) {
        conditions.push(`d.provider = $${paramIndex}`);
        params.push(filters.provider);
        paramIndex++;
      }

      if (filters.search) {
        conditions.push(`t.question ILIKE $${paramIndex}`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      if (conditions.length === 0) {
        await client.query('COMMIT');
        return {
          success: true,
          deletedCount: 0,
          filters
        };
      }

      const whereClause = conditions.join(' AND ');

      // 查询符合条件的话题ID
      const topicsResult = await client.query(
        `SELECT t.id 
         FROM topics t
         INNER JOIN distillations d ON t.distillation_id = d.id
         WHERE ${whereClause}`,
        params
      );

      const topicIds = topicsResult.rows.map(row => row.id);

      if (topicIds.length === 0) {
        await client.query('COMMIT');
        return {
          success: true,
          deletedCount: 0,
          filters
        };
      }

      // 删除话题
      const deleteResult = await client.query(
        'DELETE FROM topics WHERE id = ANY($1::int[])',
        [topicIds]
      );

      await client.query('COMMIT');

      return {
        success: true,
        deletedCount: deleteResult.rowCount || 0,
        filters
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('按筛选条件删除话题错误:', error);
      throw new Error(`按筛选条件删除话题失败: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * 获取统计信息
   * 调用数据库统计方法，支持筛选条件
   * 
   * @param filters 筛选参数
   * @returns 统计数据
   */
  async getStatistics(filters: TopicsQueryFilters = {}): Promise<TopicsStatistics> {
    try {
      return await getTopicsStatistics(filters);
    } catch (error: any) {
      console.error('获取统计信息错误:', error);
      throw new Error(`获取统计信息失败: ${error.message}`);
    }
  }
}
