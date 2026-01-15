/**
 * 状态管理统一导出
 * 
 * 改造后的状态管理：
 * - 文章、任务、账号、知识库、图库等数据存储在本地 SQLite
 * - 通过 IPC 调用 Electron 主进程的本地服务
 * - 服务器只负责认证、配额验证、AI 生成等
 */

// 本地数据 Store
export { useArticleStore } from './articleStore';
export { useTaskStore } from './taskStore';
export { useAccountStore } from './accountStore';
export { useKnowledgeStore } from './knowledgeStore';
export { useGalleryStore } from './galleryStore';
export { useSyncStore } from './syncStore';

// 原有的 Store（保持兼容）
export { useCacheStore } from './cacheStore';
