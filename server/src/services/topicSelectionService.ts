/**
 * 话题选择服务（已迁移到 Windows 端）
 * 
 * ⚠️ 此服务已迁移到 Windows 端本地执行
 * 服务器端保留此文件仅用于编译通过
 * 
 * 迁移日期: 2026-01-17
 * Windows 端实现: windows-login-manager/electron/services/TopicServicePostgres.ts
 */

export class TopicSelectionService {
  constructor() {
    throw new Error('话题选择功能已迁移到 Windows 端，服务器端不再提供此功能');
  }

  /**
   * 选择使用次数最少的话题
   * @deprecated 已迁移到 Windows 端
   */
  async selectLeastUsedTopic(distillationId: number): Promise<any> {
    throw new Error('话题选择功能已迁移到 Windows 端，服务器端不再提供此功能');
  }

  /**
   * 增加话题使用次数
   * @deprecated 已迁移到 Windows 端
   */
  async incrementTopicUsage(topicId: number): Promise<void> {
    throw new Error('话题选择功能已迁移到 Windows 端，服务器端不再提供此功能');
  }

  /**
   * 记录话题使用
   * @deprecated 已迁移到 Windows 端
   */
  async recordTopicUsage(topicId: number, distillationId: number, articleId: number, taskId: number, client?: any): Promise<void> {
    throw new Error('话题选择功能已迁移到 Windows 端，服务器端不再提供此功能');
  }
}
