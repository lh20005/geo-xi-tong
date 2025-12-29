import { Request, Response, NextFunction } from 'express';
import { quotaService } from '../services/QuotaService';
import { getCurrentTenantId } from './tenantContext';

/**
 * 配额检查中间件
 * 在创建资源前检查用户配额
 */

type ResourceType = 'albums' | 'articles' | 'knowledge_bases' | 'storage_mb';

/**
 * 创建配额检查中间件
 * @param resourceType 资源类型
 * @param count 要创建的资源数量（默认1）
 */
export function checkQuota(resourceType: ResourceType, count: number = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getCurrentTenantId(req);

      // 检查配额
      const result = await quotaService.checkQuota(userId, resourceType, count);

      if (!result.allowed) {
        return res.status(403).json({
          success: false,
          message: result.message,
          error: 'QUOTA_EXCEEDED',
          details: {
            current: result.current,
            limit: result.limit,
            resourceType
          }
        });
      }

      // 配额检查通过，继续处理请求
      next();
    } catch (error) {
      console.error('配额检查失败:', error);
      // 配额检查失败时，为了安全起见，拒绝请求
      res.status(500).json({
        success: false,
        message: '配额检查失败'
      });
    }
  };
}

/**
 * 使用示例：
 * 
 * // 创建相册时检查配额
 * router.post('/albums', 
 *   requireTenantContext,
 *   checkQuota('albums'),
 *   async (req, res) => {
 *     // 创建相册逻辑
 *   }
 * );
 * 
 * // 批量创建文章时检查配额
 * router.post('/articles/batch',
 *   requireTenantContext,
 *   async (req, res, next) => {
 *     const count = req.body.articles?.length || 1;
 *     checkQuota('articles', count)(req, res, next);
 *   },
 *   async (req, res) => {
 *     // 批量创建文章逻辑
 *   }
 * );
 */
