import fs from 'fs';

/**
 * 安全服务
 * 处理密钥验证、日志脱敏等安全相关功能
 */
export class SecurityService {
  /**
   * 验证支付配置完整性（启动时调用）
   */
  static validatePaymentConfig(): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 检查必需的环境变量
    const requiredEnvVars = [
      'WECHAT_PAY_APP_ID',
      'WECHAT_PAY_MCH_ID',
      'WECHAT_PAY_API_V3_KEY',
      'WECHAT_PAY_SERIAL_NO',
      'WECHAT_PAY_PRIVATE_KEY_PATH',
      'WECHAT_PAY_NOTIFY_URL',
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        errors.push(`缺少环境变量: ${envVar}`);
      }
    }

    // 检查私钥文件
    const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH;
    if (privateKeyPath) {
      if (!fs.existsSync(privateKeyPath)) {
        errors.push(`私钥文件不存在: ${privateKeyPath}`);
      } else {
        try {
          const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
          if (!privateKey.includes('BEGIN PRIVATE KEY')) {
            errors.push('私钥文件格式不正确');
          }
        } catch (error) {
          errors.push(`无法读取私钥文件: ${error}`);
        }
      }
    }

    // 检查 API V3 密钥长度
    const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
    if (apiV3Key && apiV3Key.length !== 32) {
      errors.push('API V3 密钥长度应为32字符');
    }

    // 检查回调 URL 格式
    const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL;
    if (notifyUrl && !notifyUrl.startsWith('https://')) {
      errors.push('回调 URL 必须使用 HTTPS 协议');
    }

    const isValid = errors.length === 0;

    if (isValid) {
      console.log('✅ 支付配置验证通过');
    } else {
      console.error('❌ 支付配置验证失败:');
      errors.forEach(error => console.error(`   - ${error}`));
    }

    return { isValid, errors };
  }

  /**
   * 脱敏处理敏感信息
   */
  static maskSensitiveData(data: any, sensitiveFields: string[] = []): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const defaultSensitiveFields = [
      'password',
      'api_key',
      'apiKey',
      'api_v3_key',
      'apiV3Key',
      'private_key',
      'privateKey',
      'secret',
      'token',
      'access_token',
      'accessToken',
      'refresh_token',
      'refreshToken',
    ];

    const allSensitiveFields = [...defaultSensitiveFields, ...sensitiveFields];

    const masked: { [key: string]: any } = Array.isArray(data) ? [] : {};

    for (const key in data) {
      const value = data[key];
      const lowerKey = key.toLowerCase();

      // 检查是否是敏感字段
      const isSensitive = allSensitiveFields.some(field => 
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive && typeof value === 'string') {
        // 脱敏处理：只显示前3位和后3位
        if (value.length > 6) {
          masked[key] = `${value.substring(0, 3)}***${value.substring(value.length - 3)}`;
        } else {
          masked[key] = '***';
        }
      } else if (typeof value === 'object' && value !== null) {
        // 递归处理嵌套对象
        masked[key] = this.maskSensitiveData(value, sensitiveFields);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  /**
   * 安全日志记录（自动脱敏）
   */
  static secureLog(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const maskedData = data ? this.maskSensitiveData(data) : undefined;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    switch (level) {
      case 'info':
        console.log(logMessage, maskedData || '');
        break;
      case 'warn':
        console.warn(logMessage, maskedData || '');
        break;
      case 'error':
        console.error(logMessage, maskedData || '');
        break;
    }
  }

  /**
   * 验证 API 响应中不包含敏感信息
   */
  static sanitizeApiResponse(response: any): any {
    return this.maskSensitiveData(response);
  }

  /**
   * 生成安全的错误响应（不暴露内部信息）
   */
  static createSafeErrorResponse(error: any, isDevelopment: boolean = false): {
    success: false;
    message: string;
    error?: string;
  } {
    // 生产环境：返回通用错误消息
    if (!isDevelopment) {
      return {
        success: false,
        message: '操作失败，请稍后重试',
      };
    }

    // 开发环境：返回详细错误（但仍然脱敏）
    const maskedError = this.maskSensitiveData({
      message: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      message: error.message || '操作失败',
      error: maskedError.message,
    };
  }

  /**
   * 检查环境变量是否泄露到日志
   */
  static checkEnvLeakage(logContent: string): {
    hasLeak: boolean;
    leakedVars: string[];
  } {
    const sensitiveEnvVars = [
      'WECHAT_PAY_API_V3_KEY',
      'WECHAT_PAY_PRIVATE_KEY_PATH',
      'DB_PASSWORD',
      'REDIS_PASSWORD',
      'JWT_SECRET',
    ];

    const leakedVars: string[] = [];

    for (const envVar of sensitiveEnvVars) {
      const value = process.env[envVar];
      if (value && logContent.includes(value)) {
        leakedVars.push(envVar);
      }
    }

    return {
      hasLeak: leakedVars.length > 0,
      leakedVars,
    };
  }

  /**
   * 生成安全报告
   */
  static generateSecurityReport(): {
    timestamp: string;
    paymentConfigValid: boolean;
    environmentSecure: boolean;
    recommendations: string[];
  } {
    const paymentConfig = this.validatePaymentConfig();
    const recommendations: string[] = [];

    if (!paymentConfig.isValid) {
      recommendations.push('修复支付配置问题');
      recommendations.push(...paymentConfig.errors);
    }

    // 检查是否在生产环境
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
      recommendations.push('确保在生产环境设置 NODE_ENV=production');
    }

    // 检查 HTTPS
    const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL;
    if (notifyUrl && !notifyUrl.startsWith('https://')) {
      recommendations.push('使用 HTTPS 协议保护回调 URL');
    }

    return {
      timestamp: new Date().toISOString(),
      paymentConfigValid: paymentConfig.isValid,
      environmentSecure: recommendations.length === 0,
      recommendations,
    };
  }
}
