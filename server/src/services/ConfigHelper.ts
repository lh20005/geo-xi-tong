import { pool } from '../db/database';
import { encryptionService } from './EncryptionService';
import { AIService, AIProvider } from './aiService';

/**
 * 配置辅助服务
 * 用于从数据库获取并解密API配置
 */
export class ConfigHelper {
  /**
   * 获取当前激活的API配置并创建AIService实例
   * @returns AIService实例
   */
  static async getAIService(): Promise<AIService> {
    try {
      // 从数据库获取激活的配置
      const result = await pool.query(
        'SELECT provider, api_key, ollama_base_url, ollama_model FROM api_configs WHERE is_active = true LIMIT 1'
      );
      
      if (result.rows.length === 0) {
        throw new Error('系统未配置AI服务，请联系管理员在系统配置中设置');
      }
      
      const config = result.rows[0];
      
      // 解密API密钥
      let apiKey: string | undefined;
      if (config.api_key) {
        try {
          apiKey = encryptionService.decrypt(config.api_key);
        } catch (error) {
          console.error('解密API密钥失败，尝试使用原始值:', error);
          // 如果解密失败，可能是旧数据（未加密），直接使用
          apiKey = config.api_key;
        }
      }
      
      // 创建AIService实例
      return new AIService({
        provider: config.provider as AIProvider,
        apiKey,
        ollamaBaseUrl: config.ollama_base_url,
        ollamaModel: config.ollama_model
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
      const result = await pool.query(
        'SELECT id FROM api_configs WHERE is_active = true LIMIT 1'
      );
      return result.rows.length > 0;
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
      const result = await pool.query(
        'SELECT provider, ollama_base_url, ollama_model FROM api_configs WHERE is_active = true LIMIT 1'
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const config = result.rows[0];
      return {
        provider: config.provider,
        ollamaBaseUrl: config.ollama_base_url,
        ollamaModel: config.ollama_model
      };
    } catch (error) {
      console.error('获取当前配置失败:', error);
      return null;
    }
  }
}
