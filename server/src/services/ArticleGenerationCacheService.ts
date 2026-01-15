/**
 * AI 生成结果缓存服务
 * 
 * 用于解决 AI 生成文章后网络中断导致用户丢失已生成文章的问题。
 * 
 * 工作流程：
 * 1. 服务器生成文章后缓存到 Redis（10 分钟）
 * 2. 返回 generationId + 文章内容
 * 3. Windows 端保存到本地后调用确认接口
 * 4. 服务器删除缓存
 * 5. 网络恢复后可通过 generationId 重新获取
 */

import crypto from 'crypto';
import { redisClient } from '../db/redis';

// 缓存过期时间（10 分钟）
const CACHE_TTL_SECONDS = 10 * 60;

// Redis key 前缀
const CACHE_KEY_PREFIX = 'article:generation:';

/**
 * 生成结果接口
 */
export interface GeneratedArticle {
  title: string;
  content: string;
  keyword?: string;
  topicId?: number;
  topicQuestion?: string;
  imageUrl?: string;
  provider?: string;
}

/**
 * 缓存数据接口
 */
interface CachedGenerationData {
  article: GeneratedArticle;
  userId: number;
  reservationId?: string;  // 配额预留 ID
  createdAt: string;
  metadata?: Record<string, any>;
}

/**
 * 生成结果响应接口
 */
export interface GenerationResult {
  generationId: string;
  article: GeneratedArticle;
  expiresAt: string;
}

/**
 * AI 生成结果缓存服务
 */
export class ArticleGenerationCacheService {
  private static instance: ArticleGenerationCacheService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ArticleGenerationCacheService {
    if (!ArticleGenerationCacheService.instance) {
      ArticleGenerationCacheService.instance = new ArticleGenerationCacheService();
    }
    return ArticleGenerationCacheService.instance;
  }

  /**
   * 生成缓存 key
   */
  private getCacheKey(generationId: string): string {
    return `${CACHE_KEY_PREFIX}${generationId}`;
  }

  /**
   * 缓存生成结果
   * 
   * @param article 生成的文章
   * @param userId 用户 ID
   * @param reservationId 配额预留 ID（可选）
   * @param metadata 额外元数据（可选）
   * @returns 生成结果，包含 generationId 和过期时间
   */
  async cacheGenerationResult(
    article: GeneratedArticle,
    userId: number,
    reservationId?: string,
    metadata?: Record<string, any>
  ): Promise<GenerationResult> {
    const generationId = `gen-${crypto.randomUUID()}`;
    const cacheKey = this.getCacheKey(generationId);
    const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);

    const cacheData: CachedGenerationData = {
      article,
      userId,
      reservationId,
      createdAt: new Date().toISOString(),
      metadata
    };

    try {
      await redisClient.setEx(
        cacheKey,
        CACHE_TTL_SECONDS,
        JSON.stringify(cacheData)
      );

      console.log(`[ArticleGenerationCache] 缓存生成结果: generationId=${generationId}, userId=${userId}, expiresAt=${expiresAt.toISOString()}`);

      return {
        generationId,
        article,
        expiresAt: expiresAt.toISOString()
      };
    } catch (error: any) {
      console.error(`[ArticleGenerationCache] 缓存失败:`, error.message);
      // 即使缓存失败，也返回结果（降级处理）
      return {
        generationId,
        article,
        expiresAt: expiresAt.toISOString()
      };
    }
  }

  /**
   * 确认收到生成结果
   * 
   * 客户端确认已成功保存文章后调用，删除缓存
   * 
   * @param generationId 生成 ID
   * @param userId 用户 ID（用于验证）
   * @returns 是否成功
   */
  async confirmReceived(generationId: string, userId: number): Promise<boolean> {
    const cacheKey = this.getCacheKey(generationId);

    try {
      // 先获取缓存数据验证用户
      const cached = await redisClient.get(cacheKey);
      
      if (!cached) {
        console.log(`[ArticleGenerationCache] 确认失败: generationId=${generationId} 不存在或已过期`);
        // 缓存不存在也视为成功（可能已过期或已确认）
        return true;
      }

      const data: CachedGenerationData = JSON.parse(cached);
      
      // 验证用户
      if (data.userId !== userId) {
        console.warn(`[ArticleGenerationCache] 确认失败: 用户不匹配 (expected=${data.userId}, actual=${userId})`);
        return false;
      }

      // 删除缓存
      await redisClient.del(cacheKey);
      
      console.log(`[ArticleGenerationCache] 确认成功: generationId=${generationId}, userId=${userId}`);
      return true;
    } catch (error: any) {
      console.error(`[ArticleGenerationCache] 确认失败:`, error.message);
      return false;
    }
  }

  /**
   * 重新获取生成结果
   * 
   * 用于网络恢复后重新获取之前生成的文章
   * 
   * @param generationId 生成 ID
   * @param userId 用户 ID（用于验证）
   * @returns 生成的文章，如果不存在或已过期返回 null
   */
  async retrieveGeneration(generationId: string, userId: number): Promise<GeneratedArticle | null> {
    const cacheKey = this.getCacheKey(generationId);

    try {
      const cached = await redisClient.get(cacheKey);
      
      if (!cached) {
        console.log(`[ArticleGenerationCache] 获取失败: generationId=${generationId} 不存在或已过期`);
        return null;
      }

      const data: CachedGenerationData = JSON.parse(cached);
      
      // 验证用户
      if (data.userId !== userId) {
        console.warn(`[ArticleGenerationCache] 获取失败: 用户不匹配 (expected=${data.userId}, actual=${userId})`);
        return null;
      }

      console.log(`[ArticleGenerationCache] 获取成功: generationId=${generationId}, userId=${userId}`);
      return data.article;
    } catch (error: any) {
      console.error(`[ArticleGenerationCache] 获取失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取缓存的完整数据（包括元数据）
   * 
   * @param generationId 生成 ID
   * @param userId 用户 ID（用于验证）
   * @returns 完整的缓存数据
   */
  async getCachedData(generationId: string, userId: number): Promise<CachedGenerationData | null> {
    const cacheKey = this.getCacheKey(generationId);

    try {
      const cached = await redisClient.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      const data: CachedGenerationData = JSON.parse(cached);
      
      // 验证用户
      if (data.userId !== userId) {
        return null;
      }

      return data;
    } catch (error: any) {
      console.error(`[ArticleGenerationCache] 获取缓存数据失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取用户的所有未确认生成结果
   * 
   * 用于客户端启动时检查是否有未确认的生成结果
   * 
   * @param userId 用户 ID
   * @returns 未确认的生成结果列表
   */
  async getUserPendingGenerations(userId: number): Promise<Array<{ generationId: string; article: GeneratedArticle; createdAt: string }>> {
    try {
      // 使用 SCAN 命令查找所有匹配的 key
      const pattern = `${CACHE_KEY_PREFIX}*`;
      const results: Array<{ generationId: string; article: GeneratedArticle; createdAt: string }> = [];
      
      let cursor: string = '0';
      do {
        const reply = await redisClient.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        
        cursor = String(reply.cursor);
        const keys = reply.keys;
        
        for (const key of keys) {
          const cached = await redisClient.get(key);
          if (cached) {
            const data: CachedGenerationData = JSON.parse(cached);
            if (data.userId === userId) {
              const generationId = key.replace(CACHE_KEY_PREFIX, '');
              results.push({
                generationId,
                article: data.article,
                createdAt: data.createdAt
              });
            }
          }
        }
      } while (cursor !== '0');
      
      return results;
    } catch (error: any) {
      console.error(`[ArticleGenerationCache] 获取用户未确认生成结果失败:`, error.message);
      return [];
    }
  }

  /**
   * 获取缓存的 TTL（剩余过期时间）
   * 
   * @param generationId 生成 ID
   * @returns 剩余秒数，-2 表示 key 不存在，-1 表示没有设置过期时间
   */
  async getTTL(generationId: string): Promise<number> {
    const cacheKey = this.getCacheKey(generationId);
    try {
      return await redisClient.ttl(cacheKey);
    } catch (error: any) {
      console.error(`[ArticleGenerationCache] 获取 TTL 失败:`, error.message);
      return -2;
    }
  }
}

// 导出单例实例
export const articleGenerationCacheService = ArticleGenerationCacheService.getInstance();
