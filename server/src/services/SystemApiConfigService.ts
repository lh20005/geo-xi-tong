import { pool } from '../db/database';
import { encryptionService } from './EncryptionService';
import { AIProvider } from './aiService';

export interface SystemApiConfig {
  id: number;
  provider: AIProvider;
  apiKey?: string;  // 解密后的密钥（仅在内部使用，不返回给前端）
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: number;
  notes?: string;
}

export interface ApiUsageLog {
  tenantId: number;
  userId: number;
  provider: AIProvider;
  operationType: string;
  tokensUsed?: number;
  costEstimate?: number;
  success: boolean;
  errorMessage?: string;
  requestDurationMs?: number;
}

export interface ApiQuota {
  tenantId: number;
  monthlyLimit: number;
  dailyLimit: number;
  monthlyUsed: number;
  dailyUsed: number;
}

/**
 * 系统级API配置服务
 */
export class SystemApiConfigService {
  /**
   * 获取激活的系统级API配置
   */
  async getActiveConfig(provider?: AIProvider): Promise<SystemApiConfig | null> {
    try {
      let query = `
        SELECT id, provider, api_key_encrypted, ollama_base_url, ollama_model, 
               is_active, priority, created_at, updated_at, created_by, notes
        FROM system_api_configs
        WHERE is_active = true
      `;
      
      const params: any[] = [];
      
      if (provider) {
        query += ' AND provider = $1';
        params.push(provider);
      }
      
      query += ' ORDER BY priority DESC, created_at DESC LIMIT 1';
      
      const result = await pool.query(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      
      // 解密API密钥
      let apiKey: string | undefined;
      if (row.api_key_encrypted) {
        try {
          apiKey = encryptionService.decrypt(row.api_key_encrypted);
        } catch (error) {
          console.error('Failed to decrypt API key:', error);
          // 如果解密失败，可能是旧数据（未加密），直接使用
          apiKey = row.api_key_encrypted;
        }
      }
      
      return {
        id: row.id,
        provider: row.provider,
        apiKey,
        ollamaBaseUrl: row.ollama_base_url,
        ollamaModel: row.ollama_model,
        isActive: row.is_active,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        notes: row.notes
      };
    } catch (error: any) {
      console.error('Error getting active system API config:', error);
      throw new Error(`Failed to get system API config: ${error.message}`);
    }
  }

  /**
   * 保存系统级API配置
   */
  async saveConfig(
    provider: AIProvider,
    apiKey: string | undefined,
    ollamaBaseUrl: string | undefined,
    ollamaModel: string | undefined,
    userId: number,
    notes?: string
  ): Promise<SystemApiConfig> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 停用该provider的所有现有配置
      await client.query(
        'UPDATE system_api_configs SET is_active = false WHERE provider = $1',
        [provider]
      );
      
      // 加密API密钥
      let apiKeyEncrypted: string | undefined;
      if (apiKey) {
        apiKeyEncrypted = encryptionService.encrypt(apiKey);
      }
      
      // 插入新配置
      const result = await client.query(
        `INSERT INTO system_api_configs 
         (provider, api_key_encrypted, ollama_base_url, ollama_model, is_active, created_by, notes)
         VALUES ($1, $2, $3, $4, true, $5, $6)
         RETURNING id, provider, ollama_base_url, ollama_model, is_active, priority, 
                   created_at, updated_at, created_by, notes`,
        [provider, apiKeyEncrypted, ollamaBaseUrl, ollamaModel, userId, notes]
      );
      
      await client.query('COMMIT');
      
      const row = result.rows[0];
      
      return {
        id: row.id,
        provider: row.provider,
        apiKey,  // 返回解密后的密钥（仅在内部使用）
        ollamaBaseUrl: row.ollama_base_url,
        ollamaModel: row.ollama_model,
        isActive: row.is_active,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        notes: row.notes
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Error saving system API config:', error);
      throw new Error(`Failed to save system API config: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * 获取所有系统级配置（不返回密钥）
   */
  async getAllConfigs(): Promise<Omit<SystemApiConfig, 'apiKey'>[]> {
    try {
      const result = await pool.query(
        `SELECT id, provider, ollama_base_url, ollama_model, is_active, priority,
                created_at, updated_at, created_by, notes
         FROM system_api_configs
         ORDER BY is_active DESC, priority DESC, created_at DESC`
      );
      
      return result.rows.map(row => ({
        id: row.id,
        provider: row.provider,
        ollamaBaseUrl: row.ollama_base_url,
        ollamaModel: row.ollama_model,
        isActive: row.is_active,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        notes: row.notes
      }));
    } catch (error: any) {
      console.error('Error getting all system API configs:', error);
      throw new Error(`Failed to get system API configs: ${error.message}`);
    }
  }

  /**
   * 删除系统级配置
   */
  async deleteConfig(configId: number): Promise<void> {
    try {
      await pool.query('DELETE FROM system_api_configs WHERE id = $1', [configId]);
    } catch (error: any) {
      console.error('Error deleting system API config:', error);
      throw new Error(`Failed to delete system API config: ${error.message}`);
    }
  }

  /**
   * 记录API使用
   */
  async logUsage(log: ApiUsageLog): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO api_usage_logs 
         (tenant_id, user_id, provider, operation_type, tokens_used, cost_estimate, 
          success, error_message, request_duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          log.tenantId,
          log.userId,
          log.provider,
          log.operationType,
          log.tokensUsed,
          log.costEstimate,
          log.success,
          log.errorMessage,
          log.requestDurationMs
        ]
      );
    } catch (error: any) {
      console.error('Error logging API usage:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 检查租户配额
   */
  async checkQuota(tenantId: number): Promise<ApiQuota> {
    try {
      // 获取配额配置
      const configResult = await pool.query(
        'SELECT monthly_limit, daily_limit FROM api_quota_configs WHERE tenant_id = $1',
        [tenantId]
      );
      
      if (configResult.rows.length === 0) {
        // 如果没有配置，使用默认值
        return {
          tenantId,
          monthlyLimit: 1000,
          dailyLimit: 100,
          monthlyUsed: 0,
          dailyUsed: 0
        };
      }
      
      const config = configResult.rows[0];
      
      // 获取本月使用量
      const monthlyResult = await pool.query(
        `SELECT COUNT(*) as count FROM api_usage_logs
         WHERE tenant_id = $1 
         AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
         AND success = true`,
        [tenantId]
      );
      
      // 获取今日使用量
      const dailyResult = await pool.query(
        `SELECT COUNT(*) as count FROM api_usage_logs
         WHERE tenant_id = $1 
         AND created_at >= date_trunc('day', CURRENT_TIMESTAMP)
         AND success = true`,
        [tenantId]
      );
      
      return {
        tenantId,
        monthlyLimit: config.monthly_limit,
        dailyLimit: config.daily_limit,
        monthlyUsed: parseInt(monthlyResult.rows[0].count),
        dailyUsed: parseInt(dailyResult.rows[0].count)
      };
    } catch (error: any) {
      console.error('Error checking quota:', error);
      throw new Error(`Failed to check quota: ${error.message}`);
    }
  }

  /**
   * 验证配额是否充足
   */
  async validateQuota(tenantId: number): Promise<{ valid: boolean; message?: string }> {
    try {
      const quota = await this.checkQuota(tenantId);
      
      // 检查每日限制
      if (quota.dailyLimit > 0 && quota.dailyUsed >= quota.dailyLimit) {
        return {
          valid: false,
          message: `已达到每日API调用限制（${quota.dailyLimit}次），请明天再试`
        };
      }
      
      // 检查每月限制
      if (quota.monthlyLimit > 0 && quota.monthlyUsed >= quota.monthlyLimit) {
        return {
          valid: false,
          message: `已达到每月API调用限制（${quota.monthlyLimit}次），请下月再试或升级套餐`
        };
      }
      
      return { valid: true };
    } catch (error: any) {
      console.error('Error validating quota:', error);
      // 配额检查失败时，允许继续（避免影响服务）
      return { valid: true };
    }
  }

  /**
   * 获取租户使用统计
   */
  async getUsageStats(tenantId: number, days: number = 30): Promise<any> {
    try {
      const result = await pool.query(
        `SELECT 
           DATE(created_at) as date,
           provider,
           operation_type,
           COUNT(*) as count,
           SUM(tokens_used) as total_tokens,
           SUM(cost_estimate) as total_cost,
           AVG(request_duration_ms) as avg_duration
         FROM api_usage_logs
         WHERE tenant_id = $1 
         AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
         GROUP BY DATE(created_at), provider, operation_type
         ORDER BY date DESC, provider, operation_type`,
        [tenantId]
      );
      
      return result.rows;
    } catch (error: any) {
      console.error('Error getting usage stats:', error);
      throw new Error(`Failed to get usage stats: ${error.message}`);
    }
  }
}

// 导出单例
export const systemApiConfigService = new SystemApiConfigService();
