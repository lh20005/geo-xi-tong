import { app, dialog } from 'electron';
import { Logger } from '../logger/logger';

export class CertificateValidator {
  private static instance: CertificateValidator;
  private logger: Logger;
  private trustedCertificates: Set<string> = new Set();

  private constructor() {
    this.logger = Logger.getInstance();
  }

  public static getInstance(): CertificateValidator {
    if (!CertificateValidator.instance) {
      CertificateValidator.instance = new CertificateValidator();
    }
    return CertificateValidator.instance;
  }

  public initialize(): void {
    this.logger.info('Initializing certificate validator');

    // Handle certificate errors
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
      this.handleCertificateError(event, url, error, certificate, callback);
    });
  }

  private handleCertificateError(
    event: Electron.Event,
    url: string,
    error: string,
    certificate: Electron.Certificate,
    callback: (isTrusted: boolean) => void
  ): void {
    this.logger.warn(`Certificate error for ${url}: ${error}`);

    // In production, we should be strict about certificates
    if (process.env.NODE_ENV === 'production') {
      // Check if certificate is in trusted list
      const fingerprint = certificate.fingerprint;
      if (this.trustedCertificates.has(fingerprint)) {
        this.logger.info(`Certificate ${fingerprint} is trusted`);
        event.preventDefault();
        callback(true);
        return;
      }

      // Reject untrusted certificates
      this.logger.error(`Rejecting untrusted certificate for ${url}`);
      callback(false);
      
      // Show error to user
      dialog.showErrorBox(
        '证书错误',
        `无法验证 ${url} 的安全证书。\n错误: ${error}`
      );
    } else {
      // In development, we can be more lenient for localhost
      const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
      if (isLocalhost) {
        this.logger.warn('Allowing certificate error for localhost in development');
        event.preventDefault();
        callback(true);
      } else {
        callback(false);
      }
    }
  }

  public trustCertificate(fingerprint: string): void {
    this.trustedCertificates.add(fingerprint);
    this.logger.info(`Certificate ${fingerprint} added to trusted list`);
  }

  public revokeCertificate(fingerprint: string): void {
    this.trustedCertificates.delete(fingerprint);
    this.logger.info(`Certificate ${fingerprint} removed from trusted list`);
  }

  public getTrustedCertificates(): string[] {
    return Array.from(this.trustedCertificates);
  }

  public clearTrustedCertificates(): void {
    this.trustedCertificates.clear();
    this.logger.info('All trusted certificates cleared');
  }
}

export default CertificateValidator;
