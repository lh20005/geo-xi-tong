import { pool } from '../db/database';
import { cacheService, CACHE_PREFIX, CACHE_TTL } from './CacheService';

/**
 * Dashboard数据服务
 * 提供工作台所需的各类统计数据查询
 * 优化：合并查询 + Redis 缓存
 */
export class DashboardService {
  /**
   * 获取核心业务指标（优化版）
   * 将 4 个独立查询合并为 1 个，并添加缓存
   */
  async getMetrics(userId: number, startDate?: string, endDate?: string) {
    const cacheKey = `${CACHE_PREFIX.DASHBOARD_METRICS}${userId}`;
    
    // 尝试从缓存获取
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const client = await pool.connect();
    
    try {
      // 获取今日和昨日的日期范围
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString();

      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

      // 合并查询：一次性获取所有指标
      const combinedQuery = `
        WITH params AS (
          SELECT 
            $1::timestamp as today,
            $2::timestamp as yesterday,
            $3::timestamp as thirty_days_ago,
            $4::int as uid
        ),
        distillation_stats AS (
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE created_at >= (SELECT today FROM params)) as today_count,
            COUNT(*) FILTER (WHERE created_at >= (SELECT yesterday FROM params) AND created_at < (SELECT today FROM params)) as yesterday_count
          FROM distillations
          WHERE user_id = (SELECT uid FROM params)
        ),
        article_stats AS (
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE created_at >= (SELECT today FROM params)) as today_count,
            COUNT(*) FILTER (WHERE created_at >= (SELECT yesterday FROM params) AND created_at < (SELECT today FROM params)) as yesterday_count,
            COUNT(*) FILTER (WHERE is_published = true AND created_at >= (SELECT thirty_days_ago FROM params)) as published_30d,
            COUNT(*) FILTER (WHERE created_at >= (SELECT thirty_days_ago FROM params)) as total_30d
          FROM articles
          WHERE user_id = (SELECT uid FROM params)
        ),
        task_stats AS (
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE created_at >= (SELECT today FROM params)) as today_count,
            COUNT(*) FILTER (WHERE created_at >= (SELECT yesterday FROM params) AND created_at < (SELECT today FROM params)) as yesterday_count
          FROM publishing_tasks
          WHERE user_id = (SELECT uid FROM params)
        )
        SELECT 
          d.total as d_total, d.today_count as d_today, d.yesterday_count as d_yesterday,
          a.total as a_total, a.today_count as a_today, a.yesterday_count as a_yesterday,
          a.published_30d, a.total_30d,
          t.total as t_total, t.today_count as t_today, t.yesterday_count as t_yesterday
        FROM distillation_stats d, article_stats a, task_stats t
      `;

      const result = await client.query(combinedQuery, [todayStr, yesterdayStr, thirtyDaysAgoStr, userId]);
      const row = result.rows[0];

      const total30d = parseInt(row.total_30d) || 0;
      const published30d = parseInt(row.published_30d) || 0;
      const currentRate = total30d > 0 ? (published30d / total30d) * 100 : 0;

      const metrics = {
        distillations: {
          total: parseInt(row.d_total) || 0,
          today: parseInt(row.d_today) || 0,
          yesterday: parseInt(row.d_yesterday) || 0
        },
        articles: {
          total: parseInt(row.a_total) || 0,
          today: parseInt(row.a_today) || 0,
          yesterday: parseInt(row.a_yesterday) || 0
        },
        publishingTasks: {
          total: parseInt(row.t_total) || 0,
          today: parseInt(row.t_today) || 0,
          yesterday: parseInt(row.t_yesterday) || 0
        },
        publishingSuccessRate: {
          total: total30d,
          success: published30d,
          rate: currentRate,
          previousRate: 0
        }
      };

      // 缓存结果 2 分钟
      await cacheService.set(cacheKey, metrics, CACHE_TTL.DASHBOARD);

      return metrics;
    } finally {
      client.release();
    }
  }

  /**
   * 获取内容生产趋势数据（优化版）
   * 返回指定时间范围内每天的文章和蒸馏数量
   */
  async getTrends(userId: number, startDate?: string, endDate?: string) {
    // 默认查询最近30天
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // 缓存 key 包含日期范围
    const cacheKey = `${CACHE_PREFIX.DASHBOARD_TRENDS}${userId}:${start.toISOString().slice(0,10)}:${end.toISOString().slice(0,10)}`;
    
    // 尝试从缓存获取
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const client = await pool.connect();
    
    try {
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

      const trends = {
        data: result.rows.map(row => ({
          date: row.date,
          articleCount: parseInt(row.article_count),
          distillationCount: parseInt(row.distillation_count)
        }))
      };

      // 缓存 2 分钟
      await cacheService.set(cacheKey, trends, CACHE_TTL.DASHBOARD);

      return trends;
    } finally {
      client.release();
    }
  }

  /**
   * 获取发布平台分布（优化版）
   * 返回各平台的发布数量，按数量降序排列
   */
  async getPlatformDistribution(userId: number, startDate?: string, endDate?: string) {
    const cacheKey = `${CACHE_PREFIX.DASHBOARD_PLATFORM}${userId}`;
    
    // 尝试从缓存获取（无日期参数时）
    if (!startDate && !endDate) {
      const cached = await cacheService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    }

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

      const distribution = {
        data: result.rows.map(row => ({
          platformId: row.platform_id,
          platformName: row.platform_name || row.platform_id,
          publishCount: parseInt(row.publish_count)
        }))
      };

      // 缓存 2 分钟（无日期参数时）
      if (!startDate && !endDate) {
        await cacheService.set(cacheKey, distribution, CACHE_TTL.DASHBOARD);
      }

      return distribution;
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
      // 查询蒸馏使用情况（添加 user_id 过滤）
      const distillationsQuery = `
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE usage_count > 0) AS used
        FROM distillations
        WHERE user_id = $1
      `;
      const distillationsResult = await client.query(distillationsQuery, [userId]);
      const distillations = distillationsResult.rows[0];

      // 查询话题使用情况（添加 user_id 过滤）
      const topicsQuery = `
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE usage_count > 0) AS used
        FROM topics
        WHERE user_id = $1
      `;
      const topicsResult = await client.query(topicsQuery, [userId]);
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
        WHERE user_id = $3
      `;

      const result = await client.query(query, [todayStr, firstDayStr, userId]);
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
        LEFT JOIN articles a ON d.id = a.distillation_id AND a.user_id = $1
        WHERE d.user_id = $1
        GROUP BY d.keyword
        ORDER BY distillation_count DESC, article_count DESC
        LIMIT 10
      `;

      const result = await client.query(query, [userId]);

      // 获取总数
      const totalQuery = `
        SELECT 
          COUNT(DISTINCT keyword) as total_keywords,
          COUNT(*) as total_distillations
        FROM distillations
        WHERE user_id = $1
      `;
      const totalResult = await client.query(totalQuery, [userId]);

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
        WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      `;
      const publishingResult = await client.query(publishingQuery, [userId]);
      const publishingTotal = parseInt(publishingResult.rows[0].total);
      const publishingSuccess = parseInt(publishingResult.rows[0].success);
      const publishingRate = publishingTotal > 0 ? (publishingSuccess / publishingTotal) * 100 : 0;

      // 生成成功率
      const generationQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'completed') as success
        FROM generation_tasks
        WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      `;
      const generationResult = await client.query(generationQuery, [userId]);
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

  /**
   * 获取发布趋势数据
   * 返回每日发布成功/失败数量和成功率
   */
  async getPublishingTrend(userId: number, startDate?: string, endDate?: string) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const client = await pool.connect();
    
    try {
      const query = `
        WITH date_series AS (
          SELECT generate_series(
            DATE($1),
            DATE($2),
            '1 day'::interval
          )::date AS date
        ),
        daily_stats AS (
          SELECT 
            DATE(created_at) AS date,
            COUNT(*) FILTER (WHERE status = 'success' OR status = 'completed') AS success_count,
            COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
            COUNT(*) AS total_count
          FROM publishing_records
          WHERE user_id = $3 AND created_at >= $1 AND created_at <= $2
          GROUP BY DATE(created_at)
        )
        SELECT 
          ds.date,
          COALESCE(s.success_count, 0) AS success_count,
          COALESCE(s.failed_count, 0) AS failed_count,
          CASE 
            WHEN COALESCE(s.total_count, 0) > 0 
            THEN ROUND((COALESCE(s.success_count, 0)::numeric / s.total_count) * 100, 1)
            ELSE 0 
          END AS success_rate
        FROM date_series ds
        LEFT JOIN daily_stats s ON ds.date = s.date
        ORDER BY ds.date ASC
      `;

      const result = await client.query(query, [start.toISOString(), end.toISOString(), userId]);

      return {
        dates: result.rows.map(row => row.date),
        successCounts: result.rows.map(row => parseInt(row.success_count)),
        failedCounts: result.rows.map(row => parseInt(row.failed_count)),
        successRates: result.rows.map(row => parseFloat(row.success_rate))
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取内容转化漏斗数据
   * 展示从蒸馏到发布的完整转化流程
   */
  async getContentFunnel(userId: number, startDate?: string, endDate?: string) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          (SELECT COUNT(*) FROM distillations WHERE user_id = $1) AS distillations,
          (SELECT COUNT(*) FROM topics WHERE user_id = $1) AS topics,
          (SELECT COUNT(*) FROM articles WHERE user_id = $1) AS articles,
          (SELECT COUNT(*) FROM articles WHERE user_id = $1 AND is_published = true) AS published_articles,
          (SELECT COUNT(*) FROM publishing_records WHERE user_id = $1 AND (status = 'success' OR status = 'completed')) AS successful_publishes
      `;

      const result = await client.query(query, [userId]);
      const row = result.rows[0];

      return {
        distillations: parseInt(row.distillations) || 0,
        topics: parseInt(row.topics) || 0,
        articles: parseInt(row.articles) || 0,
        publishedArticles: parseInt(row.published_articles) || 0,
        successfulPublishes: parseInt(row.successful_publishes) || 0
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取周环比对比数据
   * 对比本周和上周的关键指标
   */
  async getWeeklyComparison(userId: number) {
    const client = await pool.connect();
    
    try {
      const query = `
        WITH week_bounds AS (
          SELECT 
            date_trunc('week', CURRENT_DATE) AS this_week_start,
            date_trunc('week', CURRENT_DATE) + interval '6 days' AS this_week_end,
            date_trunc('week', CURRENT_DATE - interval '1 week') AS last_week_start,
            date_trunc('week', CURRENT_DATE - interval '1 week') + interval '6 days' AS last_week_end
        )
        SELECT 
          -- 本周数据
          (SELECT COUNT(*) FROM distillations WHERE user_id = $1 
           AND created_at >= (SELECT this_week_start FROM week_bounds) 
           AND created_at <= (SELECT this_week_end FROM week_bounds)) AS this_week_distillations,
          (SELECT COUNT(*) FROM articles WHERE user_id = $1 
           AND created_at >= (SELECT this_week_start FROM week_bounds) 
           AND created_at <= (SELECT this_week_end FROM week_bounds)) AS this_week_articles,
          (SELECT COUNT(*) FROM publishing_records WHERE user_id = $1 
           AND created_at >= (SELECT this_week_start FROM week_bounds) 
           AND created_at <= (SELECT this_week_end FROM week_bounds)) AS this_week_publishes,
          (SELECT CASE WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(*) FILTER (WHERE status = 'success' OR status = 'completed')::numeric / COUNT(*)) * 100, 1)
            ELSE 0 END
           FROM publishing_records WHERE user_id = $1 
           AND created_at >= (SELECT this_week_start FROM week_bounds) 
           AND created_at <= (SELECT this_week_end FROM week_bounds)) AS this_week_success_rate,
          -- 上周数据
          (SELECT COUNT(*) FROM distillations WHERE user_id = $1 
           AND created_at >= (SELECT last_week_start FROM week_bounds) 
           AND created_at <= (SELECT last_week_end FROM week_bounds)) AS last_week_distillations,
          (SELECT COUNT(*) FROM articles WHERE user_id = $1 
           AND created_at >= (SELECT last_week_start FROM week_bounds) 
           AND created_at <= (SELECT last_week_end FROM week_bounds)) AS last_week_articles,
          (SELECT COUNT(*) FROM publishing_records WHERE user_id = $1 
           AND created_at >= (SELECT last_week_start FROM week_bounds) 
           AND created_at <= (SELECT last_week_end FROM week_bounds)) AS last_week_publishes,
          (SELECT CASE WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(*) FILTER (WHERE status = 'success' OR status = 'completed')::numeric / COUNT(*)) * 100, 1)
            ELSE 0 END
           FROM publishing_records WHERE user_id = $1 
           AND created_at >= (SELECT last_week_start FROM week_bounds) 
           AND created_at <= (SELECT last_week_end FROM week_bounds)) AS last_week_success_rate
      `;

      const result = await client.query(query, [userId]);
      const row = result.rows[0];

      return {
        thisWeek: {
          distillations: parseInt(row.this_week_distillations) || 0,
          articles: parseInt(row.this_week_articles) || 0,
          publishes: parseInt(row.this_week_publishes) || 0,
          successRate: parseFloat(row.this_week_success_rate) || 0
        },
        lastWeek: {
          distillations: parseInt(row.last_week_distillations) || 0,
          articles: parseInt(row.last_week_articles) || 0,
          publishes: parseInt(row.last_week_publishes) || 0,
          successRate: parseFloat(row.last_week_success_rate) || 0
        }
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取最近发布记录
   * 返回最近的发布活动列表
   */
  async getRecentPublishing(userId: number) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          pr.id,
          a.title AS article_title,
          pc.platform_name,
          pr.status,
          pr.created_at,
          pr.error_message
        FROM publishing_records pr
        LEFT JOIN articles a ON pr.article_id = a.id
        LEFT JOIN platforms_config pc ON pr.platform_id = pc.platform_id
        WHERE pr.user_id = $1
        ORDER BY pr.created_at DESC
        LIMIT 10
      `;

      const result = await client.query(query, [userId]);

      return result.rows.map(row => ({
        id: row.id,
        articleTitle: row.article_title || '未知文章',
        platformName: row.platform_name || row.platform_id || '未知平台',
        status: row.status,
        createdAt: row.created_at,
        errorMessage: row.error_message
      }));
    } finally {
      client.release();
    }
  }

  /**
   * 获取各平台发布成功率
   * 返回每个平台的发布成功率统计
   */
  async getPlatformSuccessRate(userId: number) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          pr.platform_id,
          pc.platform_name,
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE pr.status = 'success' OR pr.status = 'completed') AS success_count,
          CASE 
            WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(*) FILTER (WHERE pr.status = 'success' OR pr.status = 'completed')::numeric / COUNT(*)) * 100, 1)
            ELSE 0 
          END AS success_rate
        FROM publishing_records pr
        LEFT JOIN platforms_config pc ON pr.platform_id = pc.platform_id
        WHERE pr.user_id = $1
        GROUP BY pr.platform_id, pc.platform_name
        HAVING COUNT(*) > 0
        ORDER BY success_rate DESC, total_count DESC
      `;

      const result = await client.query(query, [userId]);

      return result.rows.map(row => ({
        platformName: row.platform_name || row.platform_id,
        totalCount: parseInt(row.total_count),
        successCount: parseInt(row.success_count),
        successRate: parseFloat(row.success_rate)
      }));
    } finally {
      client.release();
    }
  }

  /**
   * 获取平台账号状态
   * 返回各平台账号的登录状态、活跃度和发布统计
   */
  async getPlatformAccountStatus(userId: number) {
    const client = await pool.connect();
    
    try {
      // 查询账号统计 - 使用 status 字段判断活跃状态
      const accountsQuery = `
        SELECT 
          COUNT(*) AS total_accounts,
          COUNT(*) FILTER (WHERE status = 'active' OR status = 'logged_in') AS active_accounts,
          COUNT(*) FILTER (WHERE status = 'inactive' OR status = 'expired' OR status = 'error') AS expired_accounts
        FROM platform_accounts
        WHERE user_id = $1
      `;
      const accountsResult = await client.query(accountsQuery, [userId]);
      const accountStats = accountsResult.rows[0];

      // 查询各平台账号详情
      const platformsQuery = `
        SELECT 
          pa.platform_id,
          pc.platform_name,
          COUNT(*) AS account_count,
          COUNT(*) FILTER (WHERE pa.status = 'active' OR pa.status = 'logged_in') AS active_count,
          MAX(pr.created_at) AS last_publish_time,
          COALESCE(pub_stats.publish_count, 0) AS publish_count
        FROM platform_accounts pa
        LEFT JOIN platforms_config pc ON pa.platform_id = pc.platform_id
        LEFT JOIN publishing_records pr ON pa.id = pr.account_id AND pr.user_id = $1
        LEFT JOIN (
          SELECT account_id, COUNT(*) AS publish_count
          FROM publishing_records
          WHERE user_id = $1
          GROUP BY account_id
        ) pub_stats ON pa.id = pub_stats.account_id
        WHERE pa.user_id = $1
        GROUP BY pa.platform_id, pc.platform_name, pub_stats.publish_count
        ORDER BY publish_count DESC, account_count DESC
      `;
      const platformsResult = await client.query(platformsQuery, [userId]);

      return {
        totalAccounts: parseInt(accountStats.total_accounts) || 0,
        activeAccounts: parseInt(accountStats.active_accounts) || 0,
        expiredAccounts: parseInt(accountStats.expired_accounts) || 0,
        platforms: platformsResult.rows.map(row => ({
          platformName: row.platform_name || row.platform_id,
          accountCount: parseInt(row.account_count) || 0,
          activeCount: parseInt(row.active_count) || 0,
          lastPublishTime: row.last_publish_time,
          publishCount: parseInt(row.publish_count) || 0
        }))
      };
    } finally {
      client.release();
    }
  }
}
