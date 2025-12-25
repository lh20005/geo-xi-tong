import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/SubscriptionService';
import { FeatureCode } from '../config/features';

/**
 * 配额检查中间件
 * 在执行需要配额的功能前检查用户是否有足够的配额
 */
export function checkQuota(featureCode: FeatureCode) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: '请先登录'
        });
      }

      // 检查配额
      const canPerform = await subscriptionService.canUserPerformAction(userId, featureCode);

      if (!canPerform) {
        // 获取用户当前订阅信息
        const subscription = await subscriptionService.getUserActiveSubscription(userId);
        const currentPlan = subscription?.plan?.plan_name || '体验版';

        return res.status(403).json({
          success: false,
          code: 'QUOTA_EXCEEDED',
          message: `${currentPlan}配额已用完，请升级套餐`,
          data: {
            feature_code: featureCode,
            current_plan: currentPlan,
            upgrade_url: '/pricing'
          }
        });
      }

      // 配额充足，继续执行
      next();
    } catch (error) {
      console.error('配额检查失败:', error);
      res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: '配额检查失败'
      });
    }
  };
}

/**
 * 记录使用量的辅助函数
 * 在功能执行成功后调用
 */
export async function recordFeatureUsage(userId: number, featureCode: FeatureCode, amount: number = 1): Promise<void> {
  try {
    await subscriptionService.recordUsage(userId, featureCode, amount);
  } catch (error) {
    console.error('记录使用量失败:', error);
    // 不抛出错误，避免影响主流程
  }
}
