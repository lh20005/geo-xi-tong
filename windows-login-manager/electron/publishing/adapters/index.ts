/**
 * 平台适配器注册表 (Playwright)
 * 本地发布模块 - 管理所有平台适配器
 */

import { PlatformAdapter } from './base';
import { XiaohongshuAdapter } from './xiaohongshu';
import { DouyinAdapter } from './douyin';
import { ToutiaoAdapter } from './toutiao';
import { SohuAdapter } from './sohu';
import { WangyiAdapter } from './wangyi';
import { ZhihuAdapter } from './zhihu';
import { CSDNAdapter } from './csdn';
import { JianshuAdapter } from './jianshu';
import { QieAdapter } from './qie';
import { BilibiliAdapter } from './bilibili';

/**
 * 平台适配器注册表 (Playwright)
 */
export class AdapterRegistry {
  private adapters: Map<string, PlatformAdapter> = new Map();

  constructor() {
    this.registerDefaultAdapters();
  }

  /**
   * 注册默认适配器
   */
  private registerDefaultAdapters(): void {
    // 注册所有平台适配器
    this.register(new XiaohongshuAdapter());
    this.register(new DouyinAdapter());
    this.register(new ToutiaoAdapter());
    this.register(new SohuAdapter());
    this.register(new WangyiAdapter());
    this.register(new ZhihuAdapter());
    this.register(new CSDNAdapter());
    this.register(new JianshuAdapter());
    this.register(new QieAdapter());
    this.register(new BilibiliAdapter());
    
    console.log('✅ 已注册 10 个平台适配器（本地发布模块）');
  }

  /**
   * 注册适配器
   */
  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platformId, adapter);
    console.log(`✅ 注册平台适配器: ${adapter.platformName} (${adapter.platformId})`);
  }

  /**
   * 获取适配器
   */
  getAdapter(platformId: string): PlatformAdapter | null {
    const adapter = this.adapters.get(platformId);
    if (!adapter) {
      console.warn(`⚠️  未找到平台适配器: ${platformId}`);
      console.warn(`💡 已注册的平台: ${this.getRegisteredPlatforms().join(', ') || '无'}`);
    }
    return adapter || null;
  }

  /**
   * 检查适配器是否存在
   */
  hasAdapter(platformId: string): boolean {
    return this.adapters.has(platformId);
  }

  /**
   * 获取所有已注册的平台ID
   */
  getRegisteredPlatforms(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 获取所有已注册的适配器
   */
  getAllAdapters(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }
}

// 导出单例
export const adapterRegistry = new AdapterRegistry();

// 导出所有适配器类
export { PlatformAdapter } from './base';
export { XiaohongshuAdapter } from './xiaohongshu';
export { DouyinAdapter } from './douyin';
export { ToutiaoAdapter } from './toutiao';
export { SohuAdapter } from './sohu';
export { WangyiAdapter } from './wangyi';
export { ZhihuAdapter } from './zhihu';
export { CSDNAdapter } from './csdn';
export { JianshuAdapter } from './jianshu';
export { QieAdapter } from './qie';
export { BilibiliAdapter } from './bilibili';
