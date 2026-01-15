/**
 * 平台适配器模块导出
 * 
 * 从服务器端迁移: server/src/services/adapters/
 * 包含12个平台适配器
 */

// 基类和注册表
export { PlatformAdapter, LoginSelectors, PublishSelectors, Article, PublishingConfig } from './PlatformAdapter';
export { AdapterRegistry, adapterRegistry } from './AdapterRegistry';

// 平台适配器
export { XiaohongshuAdapter } from './XiaohongshuAdapter';
export { DouyinAdapter } from './DouyinAdapter';
export { ToutiaoAdapter } from './ToutiaoAdapter';
export { SohuAdapter } from './SohuAdapter';
export { WangyiAdapter } from './WangyiAdapter';
export { BaijiahaoAdapter } from './BaijiahaoAdapter';
export { ZhihuAdapter } from './ZhihuAdapter';
export { CSDNAdapter } from './CSDNAdapter';
export { JianshuAdapter } from './JianshuAdapter';
export { WechatAdapter } from './WechatAdapter';
export { QieAdapter } from './QieAdapter';
export { BilibiliAdapter } from './BilibiliAdapter';
