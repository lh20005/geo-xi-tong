import { PlatformAdapter } from './PlatformAdapter';
import { XiaohongshuAdapter } from './XiaohongshuAdapter';

/**
 * 平台适配器注册表 (Playwright)
 * 
 * 使用方法：
 * 1. 创建新的平台适配器（继承 PlatformAdapter）
 * 2. 在此文件中导入适配器
 * 3. 在 registerDefaultAdapters() 中注册
 * 
 * 示例：
 * import { ToutiaoAdapter } from './ToutiaoAdapter';
 * this.register(new ToutiaoAdapter());
 */
export class AdapterRegistry {
  private adapters: Map<string, PlatformAdapter> = new Map();

  constructor() {
    this.registerDefaultAdapters();
  }

  /**
   * 注册默认适配器
   * 
   * TODO: 在这里注册你的平台适配器
   * 
   * 示例：
   * import { ToutiaoAdapter } from './ToutiaoAdapter';
   * this.register(new ToutiaoAdapter());
   */
  private registerDefaultAdapters(): void {
    // 注册小红书适配器
    this.register(new XiaohongshuAdapter());
    
    console.log('✅ 已注册 1 个平台适配器');
    console.log('💡 可以参考 XiaohongshuAdapter.ts 创建更多适配器');
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
