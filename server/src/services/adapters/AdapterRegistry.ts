import { PlatformAdapter } from './PlatformAdapter';
import { ZhihuAdapter } from './ZhihuAdapter';
import { WangyiAdapter } from './WangyiAdapter';
import { SouhuAdapter } from './SouhuAdapter';
import { BaijiahaoAdapter } from './BaijiahaoAdapter';
import { ToutiaoAdapter } from './ToutiaoAdapter';
import { QieAdapter } from './QieAdapter';
import { WechatAdapter } from './WechatAdapter';
import { XiaohongshuAdapter } from './XiaohongshuAdapter';
import { DouyinAdapter } from './DouyinAdapter';
import { BilibiliAdapter } from './BilibiliAdapter';
import { CSDNAdapter } from './CSDNAdapter';
import { JianshuAdapter } from './JianshuAdapter';

/**
 * 平台适配器注册表
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
    this.register(new WangyiAdapter());
    this.register(new SouhuAdapter());
    this.register(new BaijiahaoAdapter());
    this.register(new ToutiaoAdapter());
    this.register(new QieAdapter());
    this.register(new ZhihuAdapter());
    this.register(new WechatAdapter());
    this.register(new XiaohongshuAdapter());
    this.register(new DouyinAdapter());
    this.register(new BilibiliAdapter());
    this.register(new CSDNAdapter());
    this.register(new JianshuAdapter());
  }

  /**
   * 注册适配器
   */
  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platformId, adapter);
    console.log(`✅ 注册平台适配器: ${adapter.platformName}`);
  }

  /**
   * 获取适配器
   */
  getAdapter(platformId: string): PlatformAdapter | null {
    return this.adapters.get(platformId) || null;
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
}

export const adapterRegistry = new AdapterRegistry();
