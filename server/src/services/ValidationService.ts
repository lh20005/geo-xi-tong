import validator from 'validator';

/**
 * 输入验证服务
 * Requirements: 12.1, 12.3, 12.4, 12.5
 */
export class ValidationService {
  // 恶意输入模式
  private static readonly MALICIOUS_PATTERNS = [
    // SQL注入模式
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b.*\b(FROM|INTO|TABLE|WHERE)\b)/i,
    /(UNION\s+SELECT)/i,
    /(--\s|\/\*|\*\/)/,
    /(\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/i,
    
    // XSS模式
    /<script[\s>]/gi,
    /javascript:\s*\w+/gi,
    /on(load|error|click|mouse\w+)\s*=/gi,
    /<iframe[\s>]/gi,
    
    // 命令注入模式 (更严格的模式)
    /[;&|]\s*(rm|del|format|cat|type|wget|curl|nc|bash|sh|cmd|powershell)/i,
    /`[^`]*`/,
    /\$\([^)]*\)/,
    
    // 路径遍历
    /\.\.[\/\\]/,
  ];

  // 允许的HTML标签
  private static readonly ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  
  // 允许的HTML属性
  private static readonly ALLOWED_ATTRIBUTES: Record<string, string[]> = {
    'a': ['href', 'title'],
    '*': ['class']
  };

  // 允许的文件类型
  private static readonly ALLOWED_FILE_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    text: ['text/plain', 'text/csv']
  };

  // 最大文件大小 (5MB)
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024;

  /**
   * 验证输入数据的类型和格式
   * Requirement 12.1
   */
  validateInput(
    value: any,
    type: 'string' | 'number' | 'email' | 'url' | 'boolean' | 'date' | 'uuid',
    options?: {
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
      pattern?: RegExp;
      required?: boolean;
    }
  ): { valid: boolean; error?: string } {
    // 检查必填
    if (options?.required && (value === null || value === undefined || value === '')) {
      return { valid: false, error: 'Field is required' };
    }

    // 如果不是必填且为空，允许通过
    if (!options?.required && (value === null || value === undefined || value === '')) {
      return { valid: true };
    }

    // 类型验证
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, error: 'Value must be a string' };
        }
        if (options?.minLength && value.length < options.minLength) {
          return { valid: false, error: `String must be at least ${options.minLength} characters` };
        }
        if (options?.maxLength && value.length > options.maxLength) {
          return { valid: false, error: `String must not exceed ${options.maxLength} characters` };
        }
        if (options?.pattern && !options.pattern.test(value)) {
          return { valid: false, error: 'String does not match required pattern' };
        }
        break;

      case 'number':
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (typeof num !== 'number' || isNaN(num)) {
          return { valid: false, error: 'Value must be a number' };
        }
        if (options?.min !== undefined && num < options.min) {
          return { valid: false, error: `Number must be at least ${options.min}` };
        }
        if (options?.max !== undefined && num > options.max) {
          return { valid: false, error: `Number must not exceed ${options.max}` };
        }
        break;

      case 'email':
        if (typeof value !== 'string' || !validator.isEmail(value)) {
          return { valid: false, error: 'Invalid email format' };
        }
        break;

      case 'url':
        if (typeof value !== 'string' || !validator.isURL(value)) {
          return { valid: false, error: 'Invalid URL format' };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          return { valid: false, error: 'Value must be a boolean' };
        }
        break;

      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { valid: false, error: 'Invalid date format' };
        }
        break;

      case 'uuid':
        if (typeof value !== 'string' || !validator.isUUID(value)) {
          return { valid: false, error: 'Invalid UUID format' };
        }
        break;

      default:
        return { valid: false, error: 'Unknown validation type' };
    }

    return { valid: true };
  }

  /**
   * 清理HTML内容，移除潜在的恶意脚本
   * Requirement 12.3
   */
  sanitizeHTML(html: string, options?: {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
  }): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    const allowedTags = options?.allowedTags || ValidationService.ALLOWED_TAGS;
    const allowedAttrs = options?.allowedAttributes || ValidationService.ALLOWED_ATTRIBUTES;

    // 移除所有script标签和不完整的script标签
    let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/<script[^>]*>/gi, '');
    
    // 移除所有iframe标签和不完整的iframe标签
    cleaned = cleaned.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    cleaned = cleaned.replace(/<iframe[^>]*>/gi, '');
    
    // 移除javascript: 协议
    cleaned = cleaned.replace(/javascript:/gi, '');
    
    // 移除事件处理器属性 (onclick, onerror, etc.)
    cleaned = cleaned.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    cleaned = cleaned.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
    
    // 移除style标签
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // 移除不允许的标签，但保留内容
    const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    cleaned = cleaned.replace(tagPattern, (match, tagName) => {
      const tag = tagName.toLowerCase();
      if (allowedTags.includes(tag)) {
        // 清理标签属性
        return this.sanitizeTagAttributes(match, tag, allowedAttrs);
      }
      return ''; // 移除不允许的标签
    });
    
    return cleaned;
  }

  /**
   * 清理标签属性
   */
  private sanitizeTagAttributes(
    tagHtml: string,
    tagName: string,
    allowedAttrs: Record<string, string[]>
  ): string {
    const tagAllowedAttrs = allowedAttrs[tagName] || allowedAttrs['*'] || [];
    
    if (tagAllowedAttrs.length === 0) {
      // 如果没有允许的属性，返回纯标签
      return tagHtml.replace(/<([a-z][a-z0-9]*)\b[^>]*>/i, '<$1>');
    }
    
    // 保留允许的属性
    const attrPattern = /\s+([a-z][a-z0-9-]*)\s*=\s*["']([^"']*)["']/gi;
    const matches = [...tagHtml.matchAll(attrPattern)];
    
    const allowedAttrStrings = matches
      .filter(match => tagAllowedAttrs.includes(match[1].toLowerCase()))
      .map(match => `${match[1]}="${match[2]}"`)
      .join(' ');
    
    const isClosing = tagHtml.startsWith('</');
    if (isClosing) {
      return `</${tagName}>`;
    }
    
    const isSelfClosing = tagHtml.endsWith('/>');
    if (allowedAttrStrings) {
      return isSelfClosing 
        ? `<${tagName} ${allowedAttrStrings} />`
        : `<${tagName} ${allowedAttrStrings}>`;
    }
    
    return isSelfClosing ? `<${tagName} />` : `<${tagName}>`;
  }

  /**
   * 验证文件上传
   * Requirement 12.4
   */
  validateFileUpload(
    file: {
      mimetype: string;
      size: number;
      originalname: string;
    },
    category: 'image' | 'document' | 'text'
  ): { valid: boolean; error?: string } {
    // 检查文件类型
    const allowedTypes = ValidationService.ALLOWED_FILE_TYPES[category];
    if (!allowedTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
      };
    }

    // 检查文件大小
    if (file.size > ValidationService.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size ${file.size} exceeds maximum allowed size of ${ValidationService.MAX_FILE_SIZE} bytes`
      };
    }

    // 检查文件名
    if (!file.originalname || file.originalname.length > 255) {
      return {
        valid: false,
        error: 'Invalid filename'
      };
    }

    // 检查文件名中的路径遍历
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      return {
        valid: false,
        error: 'Filename contains invalid characters'
      };
    }

    return { valid: true };
  }

  /**
   * 检测恶意输入模式
   * Requirement 12.5
   */
  detectMaliciousPatterns(input: string): { detected: boolean; pattern?: string } {
    if (!input || typeof input !== 'string') {
      return { detected: false };
    }

    for (const pattern of ValidationService.MALICIOUS_PATTERNS) {
      if (pattern.test(input)) {
        return {
          detected: true,
          pattern: pattern.toString()
        };
      }
    }

    return { detected: false };
  }

  /**
   * 验证对象的所有字段
   */
  validateObject(
    obj: Record<string, any>,
    schema: Record<string, {
      type: 'string' | 'number' | 'email' | 'url' | 'boolean' | 'date' | 'uuid';
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
      pattern?: RegExp;
    }>
  ): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = obj[field];
      const result = this.validateInput(value, rules.type, rules);

      if (!result.valid) {
        errors[field] = result.error || 'Validation failed';
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * 清理和验证输入
   */
  cleanAndValidate(
    input: string,
    type: 'string' | 'number' | 'email' | 'url',
    options?: any
  ): { valid: boolean; cleaned?: string; error?: string } {
    // 首先检测恶意模式
    const maliciousCheck = this.detectMaliciousPatterns(input);
    if (maliciousCheck.detected) {
      return {
        valid: false,
        error: 'Input contains potentially malicious patterns'
      };
    }

    // 清理输入
    let cleaned = input;
    if (typeof input === 'string') {
      cleaned = validator.trim(input);
      cleaned = validator.escape(cleaned);
    }

    // 验证清理后的输入
    const validation = this.validateInput(cleaned, type, options);
    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error
      };
    }

    return {
      valid: true,
      cleaned
    };
  }
}

// 导出单例
export const validationService = new ValidationService();
