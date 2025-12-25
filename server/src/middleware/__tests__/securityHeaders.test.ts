import request from 'supertest';
import express, { Express } from 'express';
import { configureSecurityHeaders } from '../securityHeaders';
import fc from 'fast-check';

/**
 * Feature: system-security-foundation
 * Property 35: 安全响应头完整性
 * For any HTTP response, the following security headers should be present:
 * Content-Security-Policy, X-Frame-Options, X-Content-Type-Options,
 * Strict-Transport-Security, X-XSS-Protection, and X-Powered-By should be absent.
 * 
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

describe('Security Headers Middleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    configureSecurityHeaders(app);
    
    // Add test routes
    app.get('/test', (req, res) => {
      res.json({ message: 'test' });
    });
    
    app.post('/test', (req, res) => {
      res.json({ message: 'test' });
    });
  });

  describe('Property 35: Security Headers Integrity', () => {
    test('should include all required security headers on GET requests', async () => {
      const response = await request(app).get('/test');

      // Content-Security-Policy (11.1)
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");

      // X-Frame-Options (11.2)
      expect(response.headers['x-frame-options']).toBe('DENY');

      // X-Content-Type-Options (11.3)
      expect(response.headers['x-content-type-options']).toBe('nosniff');

      // Strict-Transport-Security (11.4)
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['strict-transport-security']).toContain('includeSubDomains');

      // X-XSS-Protection (11.5)
      expect(response.headers['x-xss-protection']).toBeDefined();

      // X-Powered-By should be absent (11.6)
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    test('should include all required security headers on POST requests', async () => {
      const response = await request(app).post('/test');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    test('Property 35: All responses should have complete security headers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
            path: fc.constantFrom('/test', '/test/123', '/test/abc')
          }),
          async ({ method, path }) => {
            // Create route for this path if it doesn't exist
            if (!app._router.stack.some((layer: any) => 
              layer.route?.path === path && layer.route?.methods[method.toLowerCase()]
            )) {
              (app as any)[method.toLowerCase()](path, (req: any, res: any) => {
                res.json({ message: 'test' });
              });
            }

            let response;
            switch (method) {
              case 'GET':
                response = await request(app).get(path);
                break;
              case 'POST':
                response = await request(app).post(path);
                break;
              case 'PUT':
                response = await request(app).put(path);
                break;
              case 'DELETE':
                response = await request(app).delete(path);
                break;
            }

            // Property: All required headers must be present
            expect(response!.headers['content-security-policy']).toBeDefined();
            expect(response!.headers['x-frame-options']).toBe('DENY');
            expect(response!.headers['x-content-type-options']).toBe('nosniff');
            expect(response!.headers['strict-transport-security']).toBeDefined();
            expect(response!.headers['x-xss-protection']).toBeDefined();
            
            // Property: X-Powered-By must be absent
            expect(response!.headers['x-powered-by']).toBeUndefined();
          }
        ),
        { numRuns: 20 }
      );
    });

    test('CSP should prevent inline scripts by default', async () => {
      const response = await request(app).get('/test');
      const csp = response.headers['content-security-policy'];

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-src 'none'");
    });

    test('HSTS should include preload directive', async () => {
      const response = await request(app).get('/test');
      const hsts = response.headers['strict-transport-security'];

      expect(hsts).toContain('preload');
    });

    test('should include additional security headers', async () => {
      const response = await request(app).get('/test');

      // Referrer-Policy
      expect(response.headers['referrer-policy']).toBeDefined();

      // X-DNS-Prefetch-Control
      expect(response.headers['x-dns-prefetch-control']).toBe('off');

      // X-Download-Options
      expect(response.headers['x-download-options']).toBe('noopen');

      // X-Permitted-Cross-Domain-Policies
      expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
    });
  });

  describe('Unit Tests: Specific Header Values', () => {
    test('Content-Security-Policy should have correct directives', async () => {
      const response = await request(app).get('/test');
      const csp = response.headers['content-security-policy'];

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("img-src 'self' data: https:");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("font-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("media-src 'self'");
      expect(csp).toContain("frame-src 'none'");
    });

    test('Strict-Transport-Security should have 1 year max-age', async () => {
      const response = await request(app).get('/test');
      const hsts = response.headers['strict-transport-security'];

      expect(hsts).toContain('max-age=31536000');
    });

    test('X-Frame-Options should deny framing', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('Referrer-Policy should be strict-origin-when-cross-origin', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });
});
