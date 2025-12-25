import helmet from 'helmet';
import { Express } from 'express';

/**
 * 配置安全响应头
 * Requirements: 11.1-11.6
 */
export const configureSecurityHeaders = (app: Express) => {
  // 使用helmet配置所有安全响应头
  app.use(
    helmet({
      // Content-Security-Policy (11.1)
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      
      // X-Frame-Options (11.2)
      frameguard: {
        action: 'deny'
      },
      
      // X-Content-Type-Options (11.3)
      noSniff: true,
      
      // Strict-Transport-Security (11.4)
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      
      // X-XSS-Protection (11.5)
      xssFilter: true,
      
      // Remove X-Powered-By (11.6)
      hidePoweredBy: true,
      
      // Additional security headers
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
      },
      
      dnsPrefetchControl: {
        allow: false
      },
      
      ieNoOpen: true,
      
      permittedCrossDomainPolicies: {
        permittedPolicies: 'none'
      }
    })
  );

  console.log('[Security] 安全响应头已配置');
};
