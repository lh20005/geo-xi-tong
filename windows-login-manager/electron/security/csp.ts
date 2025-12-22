import { session } from 'electron';
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
    this.logger.info('Configuring Content Security Policy');

    // Set CSP headers for the main window
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [this.getCSPPolicy()],
        },
      });
    });

    this.logger.info('CSP configured successfully');
  }

  private getCSPPolicy(): string {
    const policy = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // unsafe-inline needed for Vite in dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ];

    return policy.join('; ');
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
