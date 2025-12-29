import { systemApiConfigService } from './SystemApiConfigService';
import { AIService, AIProvider } from './aiService';

/**
 * 配置辅助服务
 * 用于从系统级配置获取AI服务
 */
export class ConfigHelper {
  /**
   * 获取当前激活的系统级API配置并创建AIService实例
   * @returns AIService实例
   */
  static async getAIService(): Promise<AIService> {
    try {
      // 从系统级配置获取激活的配置
      const config = await systemApiConfigService.getActiveConfig();
      
      if (!config) {
        throw new Error('系统未配置AI服务，请联系管理员在系统配置中设置');
      }
      
      // 创建AIService实例
      return new AIService({
        provider: config.provider as AIProvider,
        apiKey: config.apiKey,
        ollamaBaseUrl: config.ollamaBaseUrl,
        ollamaModel: config.ollamaModel
      });
    } catch (error: any) {
      console.error('获取AI服务配置失败:', error);
      throw new Error(`获取AI服务配置失败: ${error.message}`);
    }
  }
  
  /**
   * 检查是否已配置AI服务
   * @returns 是否已配置
   */
  static async isConfigured(): Promise<boolean> {
    try {
      const config = await systemApiConfigService.getActiveConfig();
      return config !== null;
    } catch (error) {
      console.error('检查AI配置失败:', error);
      return false;
    }
  }
  
  /**
   * 获取当前配置信息（不包含密钥）
   * @returns 配置信息
   */
  static async getCurrentConfig(): Promise<{
    provider: string;
    ollamaBaseUrl?: string;
    ollamaModel?: string;
  } | null> {
    try {
      const config = await systemApiConfigService.getActiveConfig();
      
      if (!config) {
        return null;
      }
      
      return {
        provider: config.provider,
        ollamaBaseUrl: config.ollamaBaseUrl,
        ollamaModel: config.ollamaModel
      };
    } catch (error) {
      console.error('获取当前配置失败:', error);
      return null;
    }
  }
}
