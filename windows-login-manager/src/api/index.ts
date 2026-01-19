/**
 * 统一 API 入口
 * 
 * 改造后的 API 调用规则：
 * 
 * 1. 本地操作（通过 IPC 调用 Electron 主进程）：
 *    - 文章 CRUD（存储在本地 SQLite）
 *    - 知识库管理（存储在本地文件系统）
 *    - 图库管理（存储在本地文件系统）
 *    - 平台账号管理（Cookie 加密存储在本地）
 *    - 发布任务管理（存储在本地 SQLite）
 *    - 发布执行（本地 Playwright）
 *    - 浏览器自动化（本地 Playwright）
 *    - 数据同步（本地导出/导入）
 * 
 * 2. 服务器操作（通过 HTTP 调用服务器 API）：
 *    - 用户认证（登录、注册、刷新 token）
 *    - 配额验证（预扣减、确认、释放）
 *    - AI 文章生成（调用 DeepSeek/Gemini API）
 *    - 蒸馏（关键词蒸馏）
 *    - 订阅管理（套餐、订单）
 *    - 支付（微信支付）
 *    - 数据同步（云端备份/恢复）
 *    - 分析上报（发布统计）
 *    - 用户管理（管理员）
 *    - 代理商管理
 *    - 平台配置
 *    - 转化目标
 *    - 文章设置
 *    - 蒸馏配置
 */

// 本地 API
export {
  localArticleApi,
  localTaskApi,
  localPublishApi,
  localBrowserApi,
  localAccountApi,
  localKnowledgeApi,
  localGalleryApi,
  localSyncApi,
  localPublishingRecordApi,
  localArticleSettingApi,
  // 类型
  type LocalArticle,
  type CreateArticleParams,
  type ArticleSearchParams,
  type LocalTask,
  type CreateTaskParams,
  type LocalAccount,
  type CreateAccountParams,
  type LocalKnowledgeBase,
  type LocalKnowledgeDocument,
  type CreateKnowledgeBaseParams,
  type LocalArticleSetting,
  type CreateArticleSettingParams,
  type LocalAlbum,
  type LocalImage,
  type CreateAlbumParams,
  type LocalPublishingRecord,
  type LocalPublishingStats,
  type SyncSnapshot as LocalSyncSnapshot,
} from './local';

// 远程 API
export {
  remoteAuthApi,
  remoteQuotaApi,
  remoteArticleGenerationApi,
  remoteDistillationApi,
  remoteSubscriptionApi,
  remotePaymentApi,
  remoteSyncApi,
  remoteAnalyticsApi,
  remoteAdapterApi,
  remoteUserApi,
  remoteAgentApi,
  remotePlatformApi,
  remoteConversionTargetApi,
  remoteArticleSettingApi,
  remoteDistillationConfigApi,
  // 类型
  type LoginParams,
  type LoginResponse,
  type QuotaInfo,
  type ReserveQuotaParams,
  type ReserveQuotaResponse,
  type GenerateArticleParams,
  type GeneratedArticle,
  type DistillParams,
  type DistillResult,
  type SubscriptionProduct,
  type UserSubscription,
  type SyncSnapshot as RemoteSyncSnapshot,
  type PublishReport,
  type AdapterVersion,
  type Platform,
  type ConversionTarget,
  type ArticleSetting,
  type DistillationConfig,
} from './remote';

// 原有的 API 客户端（保持兼容）
export { apiClient } from './client';

/**
 * 判断是否在 Electron 环境中
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electron;
}

/**
 * 获取当前用户 ID
 * 从 Electron storage 或 localStorage 中获取
 */
export async function getCurrentUserId(): Promise<number | null> {
  if (isElectron()) {
    try {
      const result = await window.electron.checkAuth();
      if (result.isAuthenticated && result.user) {
        return result.user.id;
      }
    } catch (error) {
      console.error('获取用户 ID 失败:', error);
    }
  }
  
  // 降级到 localStorage
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return user.id;
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * 统一的 API 调用入口
 * 根据操作类型自动选择本地或远程 API
 */
export const api = {
  // 本地操作
  local: {
    article: () => import('./local').then(m => m.localArticleApi),
    task: () => import('./local').then(m => m.localTaskApi),
    publish: () => import('./local').then(m => m.localPublishApi),
    browser: () => import('./local').then(m => m.localBrowserApi),
    account: () => import('./local').then(m => m.localAccountApi),
    knowledge: () => import('./local').then(m => m.localKnowledgeApi),
    gallery: () => import('./local').then(m => m.localGalleryApi),
    sync: () => import('./local').then(m => m.localSyncApi),
  },
  
  // 远程操作
  remote: {
    auth: () => import('./remote').then(m => m.remoteAuthApi),
    quota: () => import('./remote').then(m => m.remoteQuotaApi),
    articleGeneration: () => import('./remote').then(m => m.remoteArticleGenerationApi),
    distillation: () => import('./remote').then(m => m.remoteDistillationApi),
    subscription: () => import('./remote').then(m => m.remoteSubscriptionApi),
    payment: () => import('./remote').then(m => m.remotePaymentApi),
    sync: () => import('./remote').then(m => m.remoteSyncApi),
    analytics: () => import('./remote').then(m => m.remoteAnalyticsApi),
    adapter: () => import('./remote').then(m => m.remoteAdapterApi),
    user: () => import('./remote').then(m => m.remoteUserApi),
    agent: () => import('./remote').then(m => m.remoteAgentApi),
    platform: () => import('./remote').then(m => m.remotePlatformApi),
    conversionTarget: () => import('./remote').then(m => m.remoteConversionTargetApi),
    articleSetting: () => import('./remote').then(m => m.remoteArticleSettingApi),
    distillationConfig: () => import('./remote').then(m => m.remoteDistillationConfigApi),
  },
};
