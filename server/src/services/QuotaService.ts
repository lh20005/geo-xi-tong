import { pool } from '../db/database';

/**
 * 配额服务
 * 管理用户的资源配额和使用量
 */

interface PlanQuotas {
  albums: number;
  articles: number;
  knowledge_bases: number;
  images_per_album: number;
  api_calls_per_day: number;
  storage_mb: number;
}

// 套餐配额定义
const PLAN_QUOTAS: Record<string, PlanQuotas> = {
  free: {
    albums: 5,
    articles: 50,
    knowledge_bases: 2,
    images_per_album: 20,
    api_calls_per_day: 100,
    storage_mb: 100
  },
  basic: {
    albums: 20,
    articles: 200,
    knowledge_bases: 10,
    images_per_album: 100,
    api_calls_per_day: 1000,
    storage_mb: 1000
  },
  pro: {
    albums: 100,
    articles: 1000,
    knowledge_bases: 50,
    images_per_album: 500,
    api_calls_per_day: 10000,
    storage_mb: 10000
  },
  enterprise: {
    albums: -1, // 无限制
    articles: -1,
    knowledge_bases: -1,
    images_per_album: -1,
    api_calls_per_day: -1,
    storage_mb: -1
  }
};

export class QuotaService {
  /**
   * 获取用户当前套餐
   */
  async getUserPlan(userId: number): Promise<string> {
    const result = await pool.query(
      `SELECT sp.plan_code 
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = $1 
       AND us.status = 'active' 
       AND us.end_date > CURRENT_TIMESTAMP
       ORDER BY us.end_date DESC
       LIMIT 1`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0].plan_code : 'free';
  }

  /**
   * 获取用户配额
   */
  async getUserQuotas(userId: number): Promise<PlanQuotas> {
    const planCode = await this.getUserPlan(userId);
    return PLAN_QUOTAS[planCode] || PLAN_QUOTAS.free;
  }

  /**
   * 获取用户当前使用量
   */
  async getUserUsage(userId: number): Promise<{
    albums: number;
    articles: number;
    knowledge_bases: number;
    storage_mb: number;
  }> {
    // 相册数量
    const albumsResult = await pool.query(
      'SELECT COUNT(*) as count FROM albums WHERE user_id = $1',
      [userId]
    );

    // 文章数量
    const articlesResult = await pool.query(
      'SELECT COUNT(*) as count FROM articles WHERE user_id = $1',
      [userId]
    );

    // 知识库数量
    const kbResult = await pool.query(
      'SELECT COUNT(*) as count FROM knowledge_bases WHERE user_id = $1',
      [userId]
    );

    // 存储空间（图片 + 知识库文档）
    const storageResult = await pool.query(
      `SELECT 
        COALESCE(SUM(i.size), 0) + COALESCE(SUM(kd.file_size), 0) as total_bytes
       FROM albums a
       LEFT JOIN images i ON i.album_id = a.id
       LEFT JOIN knowledge_bases kb ON kb.user_id = $1
       LEFT JOIN knowledge_documents kd ON kd.knowledge_base_id = kb.id
       WHERE a.user_id = $1`,
      [userId]
    );

    const totalBytes = parseInt(storageResult.rows[0].total_bytes || '0');
    const storageMb = Math.ceil(totalBytes / (1024 * 1024));

    return {
      albums: parseInt(albumsResult.rows[0].count),
      articles: parseInt(articlesResult.rows[0].count),
      knowledge_bases: parseInt(kbResult.rows[0].count),
      storage_mb: storageMb
    };
  }

  /**
   * 检查是否超出配额
   */
  async checkQuota(
    userId: number,
    resourceType: keyof PlanQuotas,
    additionalCount: number = 1
  ): Promise<{ allowed: boolean; message?: string; current?: number; limit?: number }> {
    const quotas = await this.getUserQuotas(userId);
    const usage = await this.getUserUsage(userId);

    const limit = quotas[resourceType];

    // -1 表示无限制
    if (limit === -1) {
      return { allowed: true };
    }

    let current = 0;
    switch (resourceType) {
      case 'albums':
        current = usage.albums;
        break;
      case 'articles':
        current = usage.articles;
        break;
      case 'knowledge_bases':
        current = usage.knowledge_bases;
        break;
      case 'storage_mb':
        current = usage.storage_mb;
        break;
      default:
        current = 0;
    }

    const allowed = current + additionalCount <= limit;

    return {
      allowed,
      current,
      limit,
      message: allowed
        ? undefined
        : `已达到${this.getResourceName(resourceType)}上限 (${current}/${limit})，请升级套餐`
    };
  }

  /**
   * 获取资源名称（中文）
   */
  private getResourceName(resourceType: keyof PlanQuotas): string {
    const names: Record<keyof PlanQuotas, string> = {
      albums: '相册',
      articles: '文章',
      knowledge_bases: '知识库',
      images_per_album: '相册图片',
      api_calls_per_day: 'API调用',
      storage_mb: '存储空间'
    };
    return names[resourceType] || resourceType;
  }

  /**
   * 获取用户配额使用情况摘要
   */
  async getQuotaSummary(userId: number): Promise<{
    plan: string;
    quotas: PlanQuotas;
    usage: any;
    percentages: Record<string, number>;
  }> {
    const plan = await this.getUserPlan(userId);
    const quotas = await this.getUserQuotas(userId);
    const usage = await this.getUserUsage(userId);

    // 计算使用百分比
    const percentages: Record<string, number> = {};
    for (const key of Object.keys(usage) as Array<keyof typeof usage>) {
      const limit = quotas[key];
      if (limit === -1) {
        percentages[key] = 0; // 无限制
      } else {
        percentages[key] = Math.round((usage[key] / limit) * 100);
      }
    }

    return {
      plan,
      quotas,
      usage,
      percentages
    };
  }
}

export const quotaService = new QuotaService();
