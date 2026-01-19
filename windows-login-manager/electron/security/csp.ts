import { session, app } from 'electron';
import { Logger } from '../logger/logger';

export class ContentSecurityPolicy {
  private static instance: ContentSecurityPolicy;
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  public static getInstance(): ContentSecurityPolicy {
    if (!ContentSecurityPolicy.instance) {
      ContentSecurityPolicy.instance = new ContentSecurityPolicy();
    }
    return ContentSecurityPolicy.instance;
  }

  public configure(): void {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    
    if (isDev) {
      // 开发环境：完全禁用 CSP 以避免任何连接问题
      this.logger.info('Development mode: CSP disabled for localhost connections');
      
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...details.responseHeaders };
        // 移除任何现有的 CSP 头
        delete responseHeaders['Content-Security-Policy'];
        delete responseHeaders['content-security-policy'];
        
        callback({ responseHeaders });
      });
    } else {
      // 生产环境：启用严格的 CSP
      this.logger.info('Production mode: Configuring strict Content Security Policy');
      
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [this.getCSPPolicy()],
          },
        });
      });
    }

    this.logger.info('CSP configured successfully');
  }

  private getCSPPolicy(): string {
    // 在 Electron 开发环境中，始终使用宽松的 CSP
    // 因为 Vite 开发服务器运行在 localhost:5174，后端 API 在 localhost:3000
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    
    if (isDev) {
      // 开发环境：完全宽松的 CSP，允许所有 localhost 连接
      const policy = [
        "default-src 'self' http://localhost:* ws://localhost:*",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*",
        "style-src 'self' 'unsafe-inline' http://localhost:*",
        "img-src 'self' data: https: http: http://localhost:* local-file:",
        "font-src 'self' data: http://localhost:*",
        "connect-src 'self' http://localhost:* ws://localhost:* https:",
        "frame-src 'self' http://localhost:* https: http:",
        "child-src 'self' http://localhost:* https: http:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ];
      return policy.join('; ');
    } else {
      // 生产环境：严格的 CSP，但允许 local-file 协议加载本地图片
      const policy = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: local-file:",
        "font-src 'self' data:",
        "connect-src 'self' https:",
        "frame-src 'self' https: http:",
        "child-src 'self' https: http:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ];
      return policy.join('; ');
    }
  }

  public getRelaxedCSPForLogin(): string {
    // More relaxed CSP for login BrowserView
    const policy = [
      "default-src *",
      "script-src * 'unsafe-inline' 'unsafe-eval'",
      "style-src * 'unsafe-inline'",
      "img-src * data: blob:",
      "font-src * data:",
      "connect-src *",
      "frame-src *",
      "media-src *",
    ];

    return policy.join('; ');
  }
}

export default ContentSecurityPolicy;
