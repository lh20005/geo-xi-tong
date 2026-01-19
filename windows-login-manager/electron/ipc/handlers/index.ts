/**
 * IPC 处理器统一导出
 * Requirements: Phase 6 - 注册 IPC 处理器
 */

import { registerArticleHandlers } from './articleHandlers';
import { registerTaskHandlers } from './taskHandlers';
import { registerPublishHandlers, cleanupPublishHandlers } from './publishHandlers';
import { registerBrowserHandlers, cleanupBrowserHandlers } from './browserHandlers';
import { registerLocalAccountHandlers } from './localAccountHandlers';
import { registerLocalKnowledgeHandlers } from './localKnowledgeHandlers';
import { registerLocalGalleryHandlers } from './localGalleryHandlers';
import { registerDataSyncHandlers } from './dataSyncHandlers';
import { registerLocalDistillationHandlers } from './localDistillationHandlers';
import { registerLocalTopicHandlers } from './localTopicHandlers';
import { registerLocalConversionTargetHandlers } from './localConversionTargetHandlers';
import { registerLocalArticleSettingHandlers } from './localArticleSettingHandlers';
import { registerTaskCleanupHandlers } from './taskCleanupHandlers';
import { registerUserHandlers, cleanupUserHandlers } from './userHandlers';

// 重新导出
export { registerArticleHandlers } from './articleHandlers';
export { registerTaskHandlers } from './taskHandlers';
export { registerPublishHandlers, cleanupPublishHandlers } from './publishHandlers';
export { registerBrowserHandlers, cleanupBrowserHandlers } from './browserHandlers';
export { registerLocalAccountHandlers } from './localAccountHandlers';
export { registerLocalKnowledgeHandlers } from './localKnowledgeHandlers';
export { registerLocalGalleryHandlers } from './localGalleryHandlers';
export { registerDataSyncHandlers } from './dataSyncHandlers';
export { registerLocalDistillationHandlers } from './localDistillationHandlers';
export { registerLocalTopicHandlers } from './localTopicHandlers';
export { registerLocalConversionTargetHandlers } from './localConversionTargetHandlers';
export { registerLocalArticleSettingHandlers } from './localArticleSettingHandlers';
export { registerTaskCleanupHandlers } from './taskCleanupHandlers';
export { registerUserHandlers, cleanupUserHandlers } from './userHandlers';

/**
 * 注册所有本地数据相关的 IPC 处理器
 */
export function registerAllLocalHandlers(): void {
  // 用户管理（本地 PostgreSQL）⭐ 新增
  registerUserHandlers();
  
  // 文章管理（本地 PostgreSQL）
  registerArticleHandlers();
  
  // 任务管理（本地 PostgreSQL）
  registerTaskHandlers();
  
  // 发布执行（本地 Playwright）
  registerPublishHandlers();
  
  // 浏览器自动化（本地 Playwright）
  registerBrowserHandlers();
  
  // 账号管理（本地 PostgreSQL + 加密）
  registerLocalAccountHandlers();
  
  // 知识库管理（本地 PostgreSQL + 文件系统）
  registerLocalKnowledgeHandlers();
  
  // 图库管理（本地 PostgreSQL + 文件系统）
  registerLocalGalleryHandlers();
  
  // 数据同步（与服务器同步）
  registerDataSyncHandlers();
  
  // 蒸馏管理（本地 PostgreSQL）
  registerLocalDistillationHandlers();
  
  // 话题管理（本地 PostgreSQL）
  registerLocalTopicHandlers();
  
  // 转化目标管理（本地 PostgreSQL）
  registerLocalConversionTargetHandlers();
  
  // 文章设置管理（本地 PostgreSQL）
  registerLocalArticleSettingHandlers();
  
  // 任务清理（定时清理旧任务）
  registerTaskCleanupHandlers();
}

/**
 * 清理所有本地数据相关的资源
 */
export async function cleanupAllLocalHandlers(): Promise<void> {
  await cleanupBrowserHandlers();
  cleanupPublishHandlers();
  cleanupUserHandlers();  // ⭐ 新增
}
