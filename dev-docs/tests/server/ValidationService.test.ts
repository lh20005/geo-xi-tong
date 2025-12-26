import { ValidationService } from '../ValidationService';
import fc from 'fast-check';

/**
 * Feature: system-security-foundation
 * Property 36: 输入类型和格式验证
 * Property 37: HTML清理
 * Property 38: 文件上传验证
 * Property 39: 恶意输入模式拒绝
 * 
 * Validates: Requirements 12.1, 12.3, 12.4, 12.5
 */

describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  describe('Property 36: Input Type and Format Validation', () => {
    test('should validate string inputs with length constraints', () => {
      // Test specific cases
      expect(validationService.validateInput('hello', 'string', { minLength: 3, maxLength: 10 }).valid).toBe(true);
      expect(validationService.validateInput('hi', 'string', { minLength: 3, maxLength: 10 }).valid).toBe(false);
      expect(validationService.validateInput('hello world!', 'string', { minLength: 3, maxLength: 10 }).valid).toBe(false);
      expect(validationService.validateInput('test', 'string', { minLength: 4, maxLength: 4 }).valid).toBe(true);
    });

    test('should validate number inputs with range constraints', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer(), fc.float()),
          fc.integer({ min: -100, max: 0 }),
          fc.integer({ min: 1, max: 100 }),
          (value, min, max) => {
            const result = validationService.validateInput(value, 'number', {
              min,
              max
            });

            if (value >= min && value <= max) {
              expect(result.valid).toBe(true);
            } else {
              expect(result.valid).toBe(false);
              expect(result.error).toBeDefined();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should validate email format', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'admin+tag@test.org'
      ];

      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user name@example.com'
      ];

      validEmails.forEach(email => {
        const result = validationService.validateInput(email, 'email', { required: true });
        expect(result.valid).toBe(true);
      });

      invalidEmails.forEach(email => {
        const result = validationService.validateInput(email, 'email', { required: true });
        expect(result.valid).toBe(false);
      });
      
      // Empty string should fail when required
      expect(validationService.validateInput('', 'email', { required: true }).valid).toBe(false);
    });

    test('should validate URL format', () => {
      const validUrls = [
        'https://example.com',
        'http://test.org/path',
        'https://sub.domain.com:8080/path?query=value'
      ];

      const invalidUrls = [
        'not a url',
        'htp://invalid'
      ];

      validUrls.forEach(url => {
        const result = validationService.validateInput(url, 'url', { required: true });
        expect(result.valid).toBe(true);
      });

      invalidUrls.forEach(url => {
        const result = validationService.validateInput(url, 'url', { required: true });
        expect(result.valid).toBe(false);
      });
      
      // Empty string should fail when required
      expect(validationService.validateInput('', 'url', { required: true }).valid).toBe(false);
      
      // Empty string should pass when not required
      expect(validationService.validateInput('', 'url', { required: false }).valid).toBe(true);
    });

    test('should validate required fields', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant(''), fc.string()),
          (value) => {
            const result = validationService.validateInput(value, 'string', {
              required: true
            });

            if (value === null || value === undefined || value === '') {
              expect(result.valid).toBe(false);
              expect(result.error).toContain('required');
            } else {
              expect(result.valid).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should validate object with schema', () => {
      const schema = {
        username: { type: 'string' as const, required: true, minLength: 3, maxLength: 20 },
        email: { type: 'email' as const, required: true },
        age: { type: 'number' as const, min: 0, max: 150 }
      };

      const validObj = {
        username: 'testuser',
        email: 'test@example.com',
        age: 25
      };

      const invalidObj = {
        username: 'ab', // too short
        email: 'invalid-email',
        age: 200 // too high
      };

      const validResult = validationService.validateObject(validObj, schema);
      expect(validResult.valid).toBe(true);
      expect(Object.keys(validResult.errors)).toHaveLength(0);

      const invalidResult = validationService.validateObject(invalidObj, schema);
      expect(invalidResult.valid).toBe(false);
      expect(Object.keys(invalidResult.errors).length).toBeGreaterThan(0);
    });
  });

  describe('Property 37: HTML Sanitization', () => {
    test('should remove script tags from HTML', () => {
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        '<p>Hello</p><script>alert(1)</script>',
        '<img src=x onerror="alert(1)">',
        '<a href="javascript:alert(1)">Click</a>'
      ];

      maliciousInputs.forEach(input => {
        const cleaned = validationService.sanitizeHTML(input);
        expect(cleaned).not.toContain('<script');
        expect(cleaned).not.toContain('javascript:');
        expect(cleaned).not.toContain('onerror');
      });
    });

    test('should preserve safe HTML tags', () => {
      const safeHTML = '<p>Hello <strong>World</strong></p>';
      const cleaned = validationService.sanitizeHTML(safeHTML);

      expect(cleaned).toContain('<p>');
      expect(cleaned).toContain('<strong>');
      expect(cleaned).toContain('Hello');
      expect(cleaned).toContain('World');
    });

    test('Property 37: All HTML should be sanitized to remove malicious content', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 20 }),
          fc.constantFrom(
            '<script>',
            'javascript:',
            'onerror=',
            'onclick=',
            '<iframe>'
          ),
          (baseString, maliciousPattern) => {
            const input = baseString + maliciousPattern + 'alert(1)';
            const cleaned = validationService.sanitizeHTML(input);

            // Property: Cleaned HTML should not contain malicious patterns
            expect(cleaned.toLowerCase()).not.toContain('<script');
            expect(cleaned.toLowerCase()).not.toContain('javascript:');
            expect(cleaned.toLowerCase()).not.toContain('onerror');
            expect(cleaned.toLowerCase()).not.toContain('onclick');
            expect(cleaned.toLowerCase()).not.toContain('<iframe');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should handle empty or null input', () => {
      expect(validationService.sanitizeHTML('')).toBe('');
      expect(validationService.sanitizeHTML(null as any)).toBe('');
      expect(validationService.sanitizeHTML(undefined as any)).toBe('');
    });

    test('should allow custom allowed tags', () => {
      const html = '<div><p>Test</p><script>alert(1)</script></div>';
      const cleaned = validationService.sanitizeHTML(html, {
        allowedTags: ['div', 'p']
      });

      expect(cleaned).toContain('<div>');
      expect(cleaned).toContain('<p>');
      expect(cleaned).not.toContain('<script>');
    });
  });

  describe('Property 38: File Upload Validation', () => {
    test('should validate image file uploads', () => {
      const validImageFiles = [
        { mimetype: 'image/jpeg', size: 1024 * 1024, originalname: 'photo.jpg' },
        { mimetype: 'image/png', size: 500 * 1024, originalname: 'image.png' },
        { mimetype: 'image/gif', size: 2 * 1024 * 1024, originalname: 'animation.gif' }
      ];

      validImageFiles.forEach(file => {
        const result = validationService.validateFileUpload(file, 'image');
        expect(result.valid).toBe(true);
      });
    });

    test('should reject invalid file types', () => {
      const invalidFile = {
        mimetype: 'application/x-executable',
        size: 1024,
        originalname: 'malware.exe'
      };

      const result = validationService.validateFileUpload(invalidFile, 'image');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    test('should reject files exceeding size limit', () => {
      const largeFile = {
        mimetype: 'image/jpeg',
        size: 10 * 1024 * 1024, // 10MB
        originalname: 'large.jpg'
      };

      const result = validationService.validateFileUpload(largeFile, 'image');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    test('should reject files with path traversal in filename', () => {
      const maliciousFiles = [
        { mimetype: 'image/jpeg', size: 1024, originalname: '../../../etc/passwd' },
        { mimetype: 'image/png', size: 1024, originalname: '..\\..\\windows\\system32' },
        { mimetype: 'image/gif', size: 1024, originalname: 'test/../secret.jpg' }
      ];

      maliciousFiles.forEach(file => {
        const result = validationService.validateFileUpload(file, 'image');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
      });
    });

    test('Property 38: File uploads should be validated for type and size', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('image/jpeg', 'image/png', 'application/pdf', 'text/plain', 'application/x-executable'),
          fc.integer({ min: 100, max: 10 * 1024 * 1024 }),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('..') && !s.includes('/') && !s.includes('\\')),
          (mimetype, size, filename) => {
            const file = {
              mimetype,
              size,
              originalname: filename + '.txt'
            };

            const category = mimetype.startsWith('image/') ? 'image' : 'text';
            const result = validationService.validateFileUpload(file, category);

            // Property: Files with invalid type or size should be rejected
            const isValidType = category === 'image' 
              ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimetype)
              : ['text/plain', 'text/csv'].includes(mimetype);
            const isValidSize = size <= 5 * 1024 * 1024;

            if (isValidType && isValidSize) {
              expect(result.valid).toBe(true);
            } else {
              expect(result.valid).toBe(false);
              expect(result.error).toBeDefined();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 39: Malicious Input Pattern Detection', () => {
    test('should detect SQL injection patterns', () => {
      const sqlInjectionInputs = [
        "SELECT * FROM users",
        "1' OR '1'='1",
        "admin'-- ",
        "UNION SELECT password FROM users",
        "DROP TABLE users WHERE id=1"
      ];

      sqlInjectionInputs.forEach(input => {
        const result = validationService.detectMaliciousPatterns(input);
        expect(result.detected).toBe(true);
        expect(result.pattern).toBeDefined();
      });
    });

    test('should detect XSS patterns', () => {
      const xssInputs = [
        '<script>alert(1)</script>',
        'javascript:alert(1)',
        '<img onerror="alert(1)">',
        '<iframe src="evil.com"></iframe>'
      ];

      xssInputs.forEach(input => {
        const result = validationService.detectMaliciousPatterns(input);
        expect(result.detected).toBe(true);
      });
    });

    test('should detect command injection patterns', () => {
      const commandInjectionInputs = [
        'test; rm -rf /',
        'file | cat /etc/passwd',
        'data && rm file',
        'input`whoami`',
        '$(malicious_command)'
      ];

      commandInjectionInputs.forEach(input => {
        const result = validationService.detectMaliciousPatterns(input);
        expect(result.detected).toBe(true);
      });
    });

    test('should detect path traversal patterns', () => {
      const pathTraversalInputs = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        'file/../../secret'
      ];

      pathTraversalInputs.forEach(input => {
        const result = validationService.detectMaliciousPatterns(input);
        expect(result.detected).toBe(true);
      });
    });

    test('should not flag safe inputs', () => {
      const safeInputs = [
        'Hello World',
        'user@example.com',
        'https://example.com',
        'Normal text with numbers 123'
      ];

      safeInputs.forEach(input => {
        const result = validationService.detectMaliciousPatterns(input);
        expect(result.detected).toBe(false);
      });
    });

    test('Property 39: Malicious input patterns should be rejected', () => {
      const maliciousPatterns = [
        'SELECT * FROM users',
        'DROP TABLE test',
        '<script>alert(1)</script>',
        'javascript:alert(1)',
        '; rm -rf /',
        '../../../etc/passwd',
        'UNION SELECT password'
      ];

      maliciousPatterns.forEach(pattern => {
        const result = validationService.detectMaliciousPatterns(pattern);
        expect(result.detected).toBe(true);
        expect(result.pattern).toBeDefined();
      });
    });
  });

  describe('Unit Tests: Additional Validation', () => {
    test('should validate boolean inputs', () => {
      expect(validationService.validateInput(true, 'boolean').valid).toBe(true);
      expect(validationService.validateInput(false, 'boolean').valid).toBe(true);
      expect(validationService.validateInput('true', 'boolean').valid).toBe(true);
      expect(validationService.validateInput('false', 'boolean').valid).toBe(true);
      expect(validationService.validateInput('invalid', 'boolean').valid).toBe(false);
    });

    test('should validate date inputs', () => {
      expect(validationService.validateInput('2024-01-01', 'date').valid).toBe(true);
      expect(validationService.validateInput(new Date(), 'date').valid).toBe(true);
      expect(validationService.validateInput('invalid-date', 'date').valid).toBe(false);
    });

    test('should validate UUID inputs', () => {
      expect(validationService.validateInput('550e8400-e29b-41d4-a716-446655440000', 'uuid').valid).toBe(true);
      expect(validationService.validateInput('not-a-uuid', 'uuid').valid).toBe(false);
    });

    test('cleanAndValidate should detect malicious patterns first', () => {
      const result = validationService.cleanAndValidate('SELECT * FROM users', 'string');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('malicious');
    });

    test('cleanAndValidate should clean and validate safe input', () => {
      const result = validationService.cleanAndValidate('  Hello World  ', 'string', {
        minLength: 5
      });
      expect(result.valid).toBe(true);
      expect(result.cleaned).toBeDefined();
    });
  });
});
