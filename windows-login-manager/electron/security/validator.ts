import { Logger } from '../logger/logger';

export class InputValidator {
  private static instance: InputValidator;
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  public static getInstance(): InputValidator {
    if (!InputValidator.instance) {
      InputValidator.instance = new InputValidator();
    }
    return InputValidator.instance;
  }

  public validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Only allow https (except localhost for development)
      if (parsed.protocol !== 'https:' && !this.isLocalhost(parsed.hostname)) {
        this.logger.warn(`Invalid URL protocol: ${parsed.protocol}`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.warn(`Invalid URL: ${url}`, err);
      return false;
    }
  }

  public validatePlatformId(platformId: string): boolean {
    // Platform ID should be alphanumeric with hyphens/underscores
    const pattern = /^[a-zA-Z0-9_-]+$/;
    const isValid = pattern.test(platformId) && platformId.length > 0 && platformId.length <= 50;
    
    if (!isValid) {
      this.logger.warn(`Invalid platform ID: ${platformId}`);
    }
    
    return isValid;
  }

  public validateAccountId(accountId: string): boolean {
    // Account ID should be a valid UUID or similar format
    const pattern = /^[a-zA-Z0-9_-]+$/;
    const isValid = pattern.test(accountId) && accountId.length > 0 && accountId.length <= 100;
    
    if (!isValid) {
      this.logger.warn(`Invalid account ID: ${accountId}`);
    }
    
    return isValid;
  }

  public sanitizeString(input: string, maxLength: number = 1000): string {
    // Remove null bytes and limit length
    let sanitized = input.replace(/\0/g, '');
    
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
      this.logger.warn(`String truncated to ${maxLength} characters`);
    }
    
    return sanitized;
  }

  public validateEmail(email: string): boolean {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = pattern.test(email);
    
    if (!isValid) {
      this.logger.warn(`Invalid email: ${email}`);
    }
    
    return isValid;
  }

  public validatePath(filePath: string): boolean {
    // Prevent path traversal attacks
    const dangerous = ['..', '~', '$'];
    const hasDangerous = dangerous.some(d => filePath.includes(d));
    
    if (hasDangerous) {
      this.logger.warn(`Potentially dangerous path: ${filePath}`);
      return false;
    }
    
    return true;
  }

  private isLocalhost(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  }

  public validateObject<T>(obj: unknown, requiredFields: string[]): obj is T {
    if (typeof obj !== 'object' || obj === null) {
      this.logger.warn('Invalid object: not an object');
      return false;
    }

    const hasAllFields = requiredFields.every(field => field in obj);
    
    if (!hasAllFields) {
      this.logger.warn(`Missing required fields: ${requiredFields.join(', ')}`);
    }
    
    return hasAllFields;
  }
}

export default InputValidator;
