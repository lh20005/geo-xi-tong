/**
 * 图片选择服务（已迁移到 Windows 端）
 * 
 * ⚠️ 此服务已迁移到 Windows 端本地执行
 * 服务器端保留此文件仅用于编译通过
 * 
 * 迁移日期: 2026-01-17
 * Windows 端实现: windows-login-manager/electron/services/ImageServicePostgres.ts
 */

export class ImageSelectionService {
  constructor() {
    throw new Error('图片选择功能已迁移到 Windows 端，服务器端不再提供此功能');
  }

  /**
   * 选择使用次数最少的图片
   * @deprecated 已迁移到 Windows 端
   */
  async selectLeastUsedImage(albumId: number): Promise<any> {
    throw new Error('图片选择功能已迁移到 Windows 端，服务器端不再提供此功能');
  }

  /**
   * 增加图片使用次数
   * @deprecated 已迁移到 Windows 端
   */
  async incrementImageUsage(imageId: number): Promise<void> {
    throw new Error('图片选择功能已迁移到 Windows 端，服务器端不再提供此功能');
  }
}
