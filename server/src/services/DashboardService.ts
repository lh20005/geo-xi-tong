import { pool } from '../db/database';

/**
 * Dashboard数据服务
 * 提供工作台所需的各类统计数据查询
 */
export class DashboardService {
  /**
   * 获取核心业务指标
   * 包括蒸馏总数、文章总数、发布任务总数、发布成功率
   * 以及今日和昨日的对比数据
   */
  async getMetrics(userId: number, startDate?: string, endDate?: string) {
    const client = await pool.connect();
    
    try {
      // 获取今日和昨日的日期范围
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString();

      // 查询蒸馏数据（添加 user_id 过滤）
      const distillationsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE created_at >= $1) as today,
          COUNT(*) FILTER (WHERE created_at >= $2 AND created_at < $1) as yesterday
        FROM distillations
        WHERE user_id = $3
      `;
      const distillationsResult = await client.query(distillationsQuery, [todayStr, yesterdayStr, userId]);
      const distillations = distillationsResult.rows[0];

      // 查询文章数据（添加 user_id 过滤）
      const articlesQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE created_at >= $1) as today,
          COUNT(*) FILTER (WHERE created_at >= $2 AND created_at < $1) as yesterday
        FROM articles
        WHERE user_id = $3
      `;
      const articlesResult = await client.query(articlesQuery, [todayStr, yesterdayStr, userId]);
      const articles = articlesResult.rows[0];

      // 查询发布任务数据（添加 user_id 过滤）
      const publishingTasksQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE created_at >= $1) as today,
          COUNT(*) FILTER (WHERE created_at >= $2 AND created_at < $1) as yesterday
        FROM publishing_tasks
        WHERE user_id = $3
      `;
      const publishingTasksResult = await client.query(publishingTasksQuery, [todayStr, yesterdayStr, userId]);
      const publishingTasks = publishingTasksResult.rows[0];

      // 查询文章发布率（基于articles表的is_published字段）
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

      const publishRateQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_published = true) as published,
          COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2) as previous_total,
          COUNT(*) FILTER (WHERE is_published = true AND created_at >= $1 AND created_at < $2) as previous_published
        FROM articles
        WHERE created_at >= $1 AND user_id = $3
      `;
      const publishRateResult = await client.query(publishRateQuery, [thirtyDaysAgoStr, todayStr, userId]);
      const publishRate = publishRateResult.rows[0];

      const currentRate = parseInt(publishRate.total) > 0 
        ? (parseInt(publishRate.published) / parseInt(publishRate.total)) * 100 
        : 0;
      
      const previousRate = parseInt(publishRate.previous_total) > 0
        ? (parseInt(publishRate.previous_published) / parseInt(publishRate.previous_total)) * 100
        : 0;

      return {
        distillations: {
          total: parseInt(distillations.total),
          today: parseInt(distillations.today),
          yesterday: parseInt(distillations.yesterday)
        },
        articles: {
          total: parseInt(articles.total),
          today: parseInt(articles.today),
          yesterday: parseInt(articles.yesterday)
        },
        publishingTasks: {
          total: parseInt(publishingTasks.total),
          today: parseInt(publishingTasks.today),
          yesterday: parseInt(publishingTasks.yesterday)
        },
        publishingSuccessRate: {
          total: parseInt(publishRate.total),
          success: parseInt(publishRate.published),
          rate: currentRate,
          previousRate: previousRate
        }
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取内容生产趋势数据
   * 返回指定时间范围内每天的文章和蒸馏数量
   */
  async getTrends(userId: number, startDate?: string, endDate?: string) {
    const client = await pool.connect();
    
    try {
      // 默认查询最近30天
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      const query = `
        WITH date_series AS (
          SELECT generate_series(
            DATE($1),
            DATE($2),
            '1 day'::interval
          )::date AS date
        ),
        article_counts AS (
          SELECT 
            DATE(created_at) AS date,
            COUNT(*) AS count
          FROM articles
          WHERE created_at >= $1 AND created_at <= $2 AND user_id = $3
          GROUP BY DATE(created_at)
        ),
        distillation_counts AS (
          SELECT 
            DATE(created_at) AS date,
            COUNT(*) AS count
          FROM distillations
          WHERE created_at >= $1 AND created_at <= $2 AND user_id = $3
          GROUP BY DATE(created_at)
        )
        SELECT 
          ds.date,
          COALESCE(ac.count, 0) AS article_count,
          COALESCE(dc.count, 0) AS distillation_count
        FROM date_series ds
        LEFT JOIN article_counts ac ON ds.date = ac.date
        LEFT JOIN distillation_counts dc ON ds.date = dc.date
        ORDER BY ds.date ASC
      `;

      const result = await client.query(query, [start.toISOString(), end.toISOString(), userId]);

      return {
        data: result.rows.map(row => ({
          date: row.date,
          articleCount: parseInt(row.article_count),
          distillationCount: parseInt(row.distillation_count)
        }))
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取发布平台分布
   * 返回各平台的发布数量，按数量降序排列
   */
  async getPlatformDistribution(userId: number, startDate?: string, endDate?: string) {
    const client = await pool.connect();
    
    try {
      let query = `
        SELECT 
          pr.platform_id,
          pc.platform_name,
          COUNT(*) AS publish_count
        FROM publishing_records pr
        INNER JOIN publishing_tasks pt ON pr.task_id = pt.id
        LEFT JOIN platforms_config pc ON pr.platform_id = pc.platform_id
        WHERE pt.user_id = $1 AND pr.user_id = $1
      `;

      const params: any[] = [userId];
      const conditions: string[] = [];

      if (startDate) {
        params.push(startDate);
        conditions.push(`pr.published_at >= $${params.length}`);
      }

      if (endDate) {
        params.push(endDate);
        conditions.push(`pr.published_at <= $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ` AND ${conditions.join(' AND ')}`;
      }

      query += `
        GROUP BY pr.platform_id, pc.platform_name
        ORDER BY publish_count DESC
      `;

      const result = await client.query(query, params);

      return {
        data: result.rows.map(row => ({
          platformId: row.platform_id,
          platformName: row.platform_name || row.platform_id,
          publishCount: parseInt(row.publish_count)
        }))
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取发布任务状态分布
   * 返回各状态的任务数量和占比
   */
  async getPublishingStatus(userId: number, startDate?: string, endDate?: string) {
    const client = await pool.connect();
    
    try {
      let query = `
        SELECT 
          status,
          COUNT(*) AS count
        FROM publishing_tasks
        WHERE user_id = $1
      `;

      const params: any[] = [userId];
      const conditions: string[] = [];

      if (startDate) {
        params.push(startDate);

        conditions.push(`created_at >= $${params.length}`);
      }

      if (endDate) {
        params.push(endDate);

        conditions.push(`created_at <= $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ` AND ${conditions.join(' AND ')}`;
      }

      query += `
        GROUP BY status
        ORDER BY count DESC
      `;

      const result = await client.query(query, params);

      return {
        data: result.rows.map(row => ({
          status: row.status,
          count: parseInt(row.count)
        }))
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取资源使用效率
   * 返回蒸馏、话题、图片的总数和已使用数量
   */
  async getResourceUsage(userId: number, startDate?: string, endDate?: string) {
    const client = await pool.connect();
    
    try {
      // 查询蒸馏使用情况
      const distillationsQuery = `
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE usage_count > 0) AS used
        FROM distillations
      `;
      const distillationsResult = await client.query(distillationsQuery);
      const distillations = distillationsResult.rows[0];

      // 查询话题使用情况
      const topicsQuery = `
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE usage_count > 0) AS used
        FROM topics
      `;
      const topicsResult = await client.query(topicsQuery);
      const topics = topicsResult.rows[0];

      // 查询图片使用情况
      const imagesQuery = `
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE i.usage_count > 0) AS used
        FROM images i
        INNER JOIN albums a ON i.album_id = a.id
        WHERE a.user_id = $1
      `;
      const imagesResult = await client.query(imagesQuery, [userId]);
      const images = imagesResult.rows[0];

      return {
        distillations: {
          total: parseInt(distillations.total),
          used: parseInt(distillations.used)
        },
        topics: {
          total: parseInt(topics.total),
          used: parseInt(topics.used)
        },
        images: {
          total: parseInt(images.total),
          used: parseInt(images.used)
        }
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取文章生成任务概览
   * 返回任务状态分布、平均完成时间和成功率
   */
  async getGenerationTasks(userId: number, startDate?: string, endDate?: string) {
    const client = await pool.connect();
    
    try {
      let statusQuery = `
        SELECT 
          status,
          COUNT(*) AS count
        FROM generation_tasks WHERE user_id = $1
      `;

      const params: any[] = [userId];
      const conditions: string[] = [];

      if (startDate) {
        params.push(startDate);

        conditions.push(`created_at >= $${params.length}`);
      }

      if (endDate) {
        params.push(endDate);

        conditions.push(`created_at <= $${params.length}`);
      }

      if (conditions.length > 0) {
        statusQuery += ` AND ${conditions.join(' AND ')}`;
      }

      statusQuery += `
        GROUP BY status
        ORDER BY count DESC
      `;

      const statusResult = await client.query(statusQuery, params);

      // 计算平均完成时间（已完成的任务）
      let avgTimeQuery = `
        SELECT 
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) AS avg_seconds
        FROM generation_tasks
        WHERE user_id = $1 AND status = 'completed'
      `;

      if (conditions.length > 0) {
        avgTimeQuery += ` AND ${conditions.join(' AND ')}`;
      }

      const avgTimeResult = await client.query(avgTimeQuery, params);
      const avgSeconds = parseFloat(avgTimeResult.rows[0].avg_seconds) || 0;

      // 计算成功率
      const totalTasks = statusResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
      const completedTasks = statusResult.rows.find(row => row.status === 'completed');
      const successRate = totalTasks > 0 
        ? (parseInt(completedTasks?.count || '0') / totalTasks) * 100 
        : 0;

      return {
        statusDistribution: statusResult.rows.map(row => ({
          status: row.status,
          count: parseInt(row.count)
        })),
        avgCompletionTime: Math.round(avgSeconds),
        successRate: successRate
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取文章详细统计
   * 包括总数、已发布、未发布、今日生成、本月生成
   */
  async getArticleStats(userId: number) {
    const client = await pool.connect();
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstDayStr = firstDayOfMonth.toISOString();

      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_published = true) as published,
          COUNT(*) FILTER (WHERE is_published = false OR is_published IS NULL) as unpublished,
          COUNT(*) FILTER (WHERE created_at >= $1) as today_generated,
          COUNT(*) FILTER (WHERE created_at >= $2) as month_generated
        FROM articles
      `;

      const result = await client.query(query, [todayStr, firstDayStr]);
      const stats = result.rows[0];

      return {
        total: parseInt(stats.total),
        published: parseInt(stats.published),
        unpublished: parseInt(stats.unpublished),
        todayGenerated: parseInt(stats.today_generated),
        monthGenerated: parseInt(stats.month_generated)
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取关键词分布统计
   * 返回TOP10关键词及其蒸馏次数和文章数量
   */
  async getKeywordDistribution(userId: number) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          d.keyword,
          COUNT(DISTINCT d.id) as distillation_count,
          COUNT(DISTINCT a.id) as article_count
        FROM distillations d
        LEFT JOIN articles a ON d.id = a.distillation_id
        GROUP BY d.keyword
        ORDER BY distillation_count DESC, article_count DESC
        LIMIT 10
      `;

      const result = await client.query(query);

      // 获取总数
      const totalQuery = `
        SELECT 
          COUNT(DISTINCT keyword) as total_keywords,
          COUNT(*) as total_distillations
        FROM distillations
      `;
      const totalResult = await client.query(totalQuery);

      return {
        totalKeywords: parseInt(totalResult.rows[0].total_keywords),
        totalDistillations: parseInt(totalResult.rows[0].total_distillations),
        topKeywords: result.rows.map(row => ({
          keyword: row.keyword,
          count: parseInt(row.distillation_count),
          articleCount: parseInt(row.article_count)
        }))
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取月度对比数据
   * 返回最近6个月的蒸馏、文章、发布数据
   */
  async getMonthlyComparison(userId: number) {
    const client = await pool.connect();
    
    try {
      const query = `
        WITH months AS (
          SELECT 
            TO_CHAR(date_trunc('month', CURRENT_DATE - interval '5 months' + (n || ' months')::interval), 'YYYY-MM') as month
          FROM generate_series(0, 5) n
        )
        SELECT 
          m.month,
          COALESCE(d.count, 0) as distillations,
          COALESCE(a.count, 0) as articles,
          COALESCE(p.count, 0) as publishings
        FROM months m
        LEFT JOIN (
          SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count
          FROM distillations
          WHERE user_id = $1
          GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ) d ON m.month = d.month
        LEFT JOIN (
          SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count
          FROM articles
          WHERE user_id = $1
          GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ) a ON m.month = a.month
        LEFT JOIN (
          SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count
          FROM publishing_tasks
          WHERE user_id = $1
          GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ) p ON m.month = p.month
        ORDER BY m.month ASC
      `;

      const result = await client.query(query, [userId]);

      return {
        months: result.rows.map(row => row.month),
        distillations: result.rows.map(row => parseInt(row.distillations)),
        articles: result.rows.map(row => parseInt(row.articles)),
        publishings: result.rows.map(row => parseInt(row.publishings))
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取24小时活动分布
   * 返回每小时的活动次数
   */
  async getHourlyActivity(userId: number) {
    const client = await pool.connect();
    
    try {
      const query = `
        WITH hours AS (
          SELECT generate_series(0, 23) as hour
        )
        SELECT 
          h.hour,
          COALESCE(COUNT(a.id), 0) as activity_count
        FROM hours h
        LEFT JOIN articles a ON EXTRACT(HOUR FROM a.created_at) = h.hour
          AND a.created_at >= CURRENT_DATE - INTERVAL '7 days'
          AND a.user_id = $1
        GROUP BY h.hour
        ORDER BY h.hour ASC
      `;

      const result = await client.query(query, [userId]);

      return {
        hours: result.rows.map(row => parseInt(row.hour)),
        activities: result.rows.map(row => parseInt(row.activity_count))
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取成功率数据
   * 返回发布成功率和生成成功率
   */
  async getSuccessRates(userId: number) {
    const client = await pool.connect();
    
    try {
      // 发布成功率
      const publishingQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'completed') as success
        FROM publishing_tasks
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      `;
      const publishingResult = await client.query(publishingQuery);
      const publishingTotal = parseInt(publishingResult.rows[0].total);
      const publishingSuccess = parseInt(publishingResult.rows[0].success);
      const publishingRate = publishingTotal > 0 ? (publishingSuccess / publishingTotal) * 100 : 0;

      // 生成成功率
      const generationQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'completed') as success
        FROM generation_tasks
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      `;
      const generationResult = await client.query(generationQuery);
      const generationTotal = parseInt(generationResult.rows[0].total);
      const generationSuccess = parseInt(generationResult.rows[0].success);
      const generationRate = generationTotal > 0 ? (generationSuccess / generationTotal) * 100 : 0;

      return {
        publishingSuccessRate: parseFloat(publishingRate.toFixed(1)),
        generationSuccessRate: parseFloat(generationRate.toFixed(1))
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取知识库和转化目标使用排行
   * 返回TOP10最常用的资源
   */
  async getTopResources(userId: number, startDate?: string, endDate?: string) {
    const client = await pool.connect();
    
    try {
      // 查询知识库使用排行
      const knowledgeBasesQuery = `
        SELECT 
          kb.id,
          kb.name,
          COUNT(gt.id) AS usage_count
        FROM knowledge_bases kb
        LEFT JOIN generation_tasks gt ON kb.id = gt.knowledge_base_id AND gt.user_id = $1
        WHERE kb.user_id = $1
        GROUP BY kb.id, kb.name
        ORDER BY usage_count DESC
        LIMIT 10
      `;
      const knowledgeBasesResult = await client.query(knowledgeBasesQuery, [userId]);

      // 查询转化目标使用排行
      const conversionTargetsQuery = `
        SELECT 
          ct.id,
          ct.company_name,
          COUNT(gt.id) AS usage_count
        FROM conversion_targets ct
        LEFT JOIN generation_tasks gt ON ct.id = gt.conversion_target_id AND gt.user_id = $1
        WHERE ct.user_id = $1
        GROUP BY ct.id, ct.company_name
        ORDER BY usage_count DESC
        LIMIT 10
      `;
      const conversionTargetsResult = await client.query(conversionTargetsQuery, [userId]);

      return {
        knowledgeBases: knowledgeBasesResult.rows.map(row => ({
          id: row.id,
          name: row.name,
          usageCount: parseInt(row.usage_count)
        })),
        conversionTargets: conversionTargetsResult.rows.map(row => ({
          id: row.id,
          companyName: row.company_name,
          usageCount: parseInt(row.usage_count)
        }))
      };
    } finally {
      client.release();
    }
  }
}
