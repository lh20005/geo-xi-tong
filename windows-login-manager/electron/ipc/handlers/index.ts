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

// 重新导出
export { registerArticleHandlers } from './articleHandlers';
export { registerTaskHandlers } from './taskHandlers';
export { registerPublishHandlers, cleanupPublishHandlers } from './publishHandlers';
export { registerBrowserHandlers, cleanupBrowserHandlers } from './browserHandlers';
export { registerLocalAccountHandlers } from './localAccountHandlers';
export { registerLocalKnowledgeHandlers } from './localKnowledgeHandlers';
export { registerLocalGalleryHandlers } from './localGalleryHandlers';
export { registerDataSyncHandlers } from './dataSyncHandlers';

/**
 * 注册所有本地数据相关的 IPC 处理器
 */
export function registerAllLocalHandlers(): void {
  // 文章管理（本地 SQLite）
  registerArticleHandlers();
  
  // 任务管理（本地 SQLite）
  registerTaskHandlers();
  
  // 发布执行（本地 Playwright）
  registerPublishHandlers();
  
  // 浏览器自动化（本地 Playwright）
  registerBrowserHandlers();
  
  // 账号管理（本地 SQLite + 加密）
  registerLocalAccountHandlers();
  
  // 知识库管理（本地文件系统）
  registerLocalKnowledgeHandlers();
  
  // 图库管理（本地文件系统）
  registerLocalGalleryHandlers();
  
  // 数据同步（与服务器同步）
  registerDataSyncHandlers();
}

/**
 * 清理所有本地数据相关的资源
 */
export async function cleanupAllLocalHandlers(): Promise<void> {
  await cleanupBrowserHandlers();
  cleanupPublishHandlers();
}
