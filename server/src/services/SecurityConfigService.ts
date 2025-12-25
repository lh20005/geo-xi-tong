import { pool } from '../db/database';
import { auditLogService } from './AuditLogService';

/**
 * 安全配置管理服务
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */

export interface SecurityConfig {
  id: number;
  config_key: string;
  config_value: string;
  config_type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  validation_rule?: string;
  is_active: boolean;
  version: number;
  created_by?: number;
  updated_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface SecurityConfigHistory {
  id: number;
  config_id: number;
  config_key: string;
  old_value?: string;
  new_value: string;
  version: number;
  changed_by?: number;
  change_reason?: string;
  created_at: Date;
}

export interface ValidationRule {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: string[];
}

export interface ConfigExport {
  version: string;
  exported_at: string;
  configs: Array<{
    key: string;
    value: string;
    type: string;
    description?: string;
  }>;
}

export class SecurityConfigService {
  private static instance: SecurityConfigService;

  private constructor() {}

  public static getInstance(): SecurityConfigService {
    if (!SecurityConfigService.instance) {
      SecurityConfigService.instance = new SecurityConfigService();
    }
    return SecurityConfigService.instance;
  }

  /**
   * 获取所有安全配置
   * Requirement 18.1
   */
  async getAllConfigs(): Promise<SecurityConfig[]> {
    const result = await pool.query(
      `SELECT * FROM security_config WHERE is_active = true ORDER BY config_key`
    );
    return result.rows;
  }

  /**
   * 获取单个配置
   * Requirement 18.1
   */
  async getConfig(configKey: string): Promise<SecurityConfig | null> {
    const result = await pool.query(
      `SELECT * FROM security_config WHERE config_key = $1 AND is_active = true`,
      [configKey]
    );
    return result.rows[0] || null;
  }

  /**
   * 获取配置值（已解析）
   * Requirement 18.1
   */
  async getConfigValue<T = any>(configKey: string): Promise<T | null> {
    const config = await this.getConfig(configKey);
    if (!config) return null;

    return this.parseConfigValue(config.config_value, config.config_type) as T;
  }

  /**
   * 更新配置
   * Requirement 18.2, 18.3
   */
  async updateConfig(
    configKey: string,
    newValue: string,
    updatedBy: number,
    changeReason?: string
  ): Promise<SecurityConfig> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 获取当前配置
      const currentResult = await client.query(
        `SELECT * FROM security_config WHERE config_key = $1 AND is_active = true`,
        [configKey]
      );

      if (currentResult.rows.length === 0) {
        throw new Error(`配置项不存在: ${configKey}`);
      }

      const currentConfig = currentResult.rows[0];

      // 验证新值
      await this.validateConfigValue(
        newValue,
        currentConfig.config_type,
        currentConfig.validation_rule
      );

      // 记录历史
      await client.query(
        `INSERT INTO security_config_history 
         (config_id, config_key, old_value, new_value, version, changed_by, change_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          currentConfig.id,
          configKey,
          currentConfig.config_value,
          newValue,
          currentConfig.version + 1,
          updatedBy,
          changeReason
        ]
      );

      // 更新配置
      const updateResult = await client.query(
        `UPDATE security_config 
         SET config_value = $1, version = version + 1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE config_key = $3 AND is_active = true
         RETURNING *`,
        [newValue, updatedBy, configKey]
      );

      // 记录审计日志
      await auditLogService.logAction(
        updatedBy,
        'UPDATE_SECURITY_CONFIG',
        'config',
        currentConfig.id,
        {
          config_key: configKey,
          old_value: currentConfig.config_value,
          new_value: newValue,
          version: currentConfig.version + 1,
          reason: changeReason
        },
        '127.0.0.1' // 实际应该从请求中获取
      );

      await client.query('COMMIT');

      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取配置历史
   * Requirement 18.3
   */
  async getConfigHistory(
    configKey: string,
    limit: number = 50
  ): Promise<SecurityConfigHistory[]> {
    const result = await pool.query(
      `SELECT h.*, u.username as changed_by_username
       FROM security_config_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.config_key = $1
       ORDER BY h.created_at DESC
       LIMIT $2`,
      [configKey, limit]
    );
    return result.rows;
  }

  /**
   * 导出配置
   * Requirement 18.4
   */
  async exportConfigs(): Promise<ConfigExport> {
    const configs = await this.getAllConfigs();

    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      configs: configs.map(c => ({
        key: c.config_key,
        value: c.config_value,
        type: c.config_type,
        description: c.description
      }))
    };
  }

  /**
   * 导入配置
   * Requirement 18.4
   */
  async importConfigs(
    configExport: ConfigExport,
    importedBy: number
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const config of configExport.configs) {
      try {
        await this.updateConfig(
          config.key,
          config.value,
          importedBy,
          `从备份导入 (版本: ${configExport.version})`
        );
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`${config.key}: ${(error as Error).message}`);
      }
    }

    return results;
  }

  /**
   * 验证配置值
   * Requirement 18.2
   */
  private async validateConfigValue(
    value: string,
    type: string,
    validationRuleJson?: string
  ): Promise<void> {
    // 类型验证
    switch (type) {
      case 'number':
        if (isNaN(Number(value))) {
          throw new Error('配置值必须是数字');
        }
        break;
      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          throw new Error('配置值必须是布尔值 (true/false)');
        }
        break;
      case 'json':
        try {
          JSON.parse(value);
        } catch {
          throw new Error('配置值必须是有效的JSON');
        }
        break;
    }

    // 规则验证
    if (validationRuleJson) {
      try {
        const rule: ValidationRule = JSON.parse(validationRuleJson);

        if (type === 'number') {
          const numValue = Number(value);
          if (rule.min !== undefined && numValue < rule.min) {
            throw new Error(`配置值不能小于 ${rule.min}`);
          }
          if (rule.max !== undefined && numValue > rule.max) {
            throw new Error(`配置值不能大于 ${rule.max}`);
          }
        }

        if (type === 'string') {
          if (rule.pattern) {
            const regex = new RegExp(rule.pattern);
            if (!regex.test(value)) {
              throw new Error(`配置值不符合格式要求`);
            }
          }
          if (rule.enum && !rule.enum.includes(value)) {
            throw new Error(`配置值必须是以下之一: ${rule.enum.join(', ')}`);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('配置值')) {
          throw error;
        }
        // 忽略规则解析错误
      }
    }
  }

  /**
   * 解析配置值
   */
  private parseConfigValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true';
      case 'json':
        return JSON.parse(value);
      default:
        return value;
    }
  }

  /**
   * 重置配置到默认值
   */
  async resetToDefaults(resetBy: number): Promise<number> {
    // 这里应该从迁移脚本中的默认值重置
    // 简化实现：记录审计日志
    await auditLogService.logAction(
      resetBy,
      'RESET_SECURITY_CONFIG',
      'config',
      null,
      { action: 'reset_to_defaults' },
      '127.0.0.1'
    );

    return 0; // 返回重置的配置数量
  }
}

// 导出单例
export const securityConfigService = SecurityConfigService.getInstance();
