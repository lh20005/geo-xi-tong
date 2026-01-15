/**
 * 平台适配器注册表 (Playwright)
 * 
 * 从服务器端迁移: server/src/services/adapters/AdapterRegistry.ts
 * 改动说明: 注册所有12个平台适配器
 * 
 * 使用方法：
 * 1. 创建新的平台适配器（继承 PlatformAdapter）
 * 2. 在此文件中导入适配器
 * 3. 在 registerDefaultAdapters() 中注册
 */

import { PlatformAdapter } from './PlatformAdapter';
import { XiaohongshuAdapter } from './XiaohongshuAdapter';
import { DouyinAdapter } from './DouyinAdapter';
import { ToutiaoAdapter } from './ToutiaoAdapter';
import { SohuAdapter } from './SohuAdapter';
import { WangyiAdapter } from './WangyiAdapter';
import { BaijiahaoAdapter } from './BaijiahaoAdapter';
import { ZhihuAdapter } from './ZhihuAdapter';
import { CSDNAdapter } from './CSDNAdapter';
import { JianshuAdapter } from './JianshuAdapter';
import { WechatAdapter } from './WechatAdapter';
import { QieAdapter } from './QieAdapter';
import { BilibiliAdapter } from './BilibiliAdapter';

export class AdapterRegistry {
  private adapters: Map<string, PlatformAdapter> = new Map();

  constructor() {
    this.registerDefaultAdapters();
  }

  /**
   * 注册默认适配器
   */
  private registerDefaultAdapters(): void {
    // 注册所有12个平台适配器
    this.register(new XiaohongshuAdapter());
    this.register(new DouyinAdapter());
    this.register(new ToutiaoAdapter());
    this.register(new SohuAdapter());
    this.register(new WangyiAdapter());
    this.register(new BaijiahaoAdapter());
    this.register(new ZhihuAdapter());
    this.register(new CSDNAdapter());
    this.register(new JianshuAdapter());
    this.register(new WechatAdapter());
    this.register(new QieAdapter());
    this.register(new BilibiliAdapter());
    
    console.log('✅ 已注册 12 个平台适配器');
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

export const adapterRegistry = new AdapterRegistry();
