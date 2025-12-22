import { dialog } from 'electron';
import { Logger } from '../logger/logger';

export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  STORAGE = 'STORAGE',
  LOGIN = 'LOGIN',
  SYNC = 'SYNC',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  context?: Record<string, unknown>;
  timestamp: Date;
  recoverable: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  public handleError(error: AppError): void {
    // Log error
    this.logError(error);

    // Attempt recovery if possible
    if (error.recoverable) {
      this.attemptRecovery(error);
    }

    // Show user-friendly message if critical
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.showErrorDialog(error);
    }
  }

  private logError(error: AppError): void {
    const logMessage = `[${error.type}] ${error.message}`;
    const logContext = {
      severity: error.severity,
      recoverable: error.recoverable,
      timestamp: error.timestamp.toISOString(),
      context: error.context,
      stack: error.originalError?.stack,
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error(logMessage, logContext);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(logMessage, logContext);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(logMessage, logContext);
        break;
      case ErrorSeverity.LOW:
        this.logger.info(logMessage, logContext);
        break;
    }
  }

  private attemptRecovery(error: AppError): void {
    this.logger.info(`Attempting recovery for error: ${error.type}`);

    switch (error.type) {
      case ErrorType.NETWORK:
        this.recoverFromNetworkError();
        break;
      case ErrorType.AUTHENTICATION:
        this.recoverFromAuthError();
        break;
      case ErrorType.STORAGE:
        this.recoverFromStorageError();
        break;
      case ErrorType.SYNC:
        this.recoverFromSyncError();
        break;
      default:
        this.logger.warn(`No recovery strategy for error type: ${error.type}`);
    }
  }

  private recoverFromNetworkError(): void {
    // Retry logic is handled by API client
    this.logger.info('Network error recovery: relying on API client retry');
  }

  private recoverFromAuthError(): void {
    // Token refresh is handled by API client
    this.logger.info('Auth error recovery: token refresh will be attempted');
  }

  private recoverFromStorageError(): void {
    // Storage manager has built-in repair
    this.logger.info('Storage error recovery: storage repair will be attempted');
  }

  private recoverFromSyncError(): void {
    // Sync service has retry queue
    this.logger.info('Sync error recovery: item will be queued for retry');
  }

  private showErrorDialog(error: AppError): void {
    const userMessage = this.getUserFriendlyMessage(error);
    
    dialog.showErrorBox(
      '发生错误',
      userMessage
    );
  }

  private getUserFriendlyMessage(error: AppError): string {
    switch (error.type) {
      case ErrorType.NETWORK:
        return '网络连接失败，请检查您的网络设置。';
      case ErrorType.AUTHENTICATION:
        return '身份验证失败，请重新登录。';
      case ErrorType.STORAGE:
        return '数据存储失败，请检查磁盘空间。';
      case ErrorType.LOGIN:
        return '登录失败，请重试。';
      case ErrorType.SYNC:
        return '数据同步失败，将在稍后重试。';
      default:
        return `发生未知错误: ${error.message}`;
    }
  }

  public createError(
    type: ErrorType,
    severity: ErrorSeverity,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>,
    recoverable: boolean = true
  ): AppError {
    return {
      type,
      severity,
      message,
      originalError,
      context,
      timestamp: new Date(),
      recoverable,
    };
  }

  public wrapError(error: unknown, type: ErrorType, context?: Record<string, unknown>): AppError {
    const originalError = error instanceof Error ? error : new Error(String(error));
    const message = originalError.message;

    // Determine severity based on error type and message
    let severity = ErrorSeverity.MEDIUM;
    if (message.includes('ENOENT') || message.includes('EACCES')) {
      severity = ErrorSeverity.HIGH;
    }

    return this.createError(type, severity, message, originalError, context);
  }
}

export default ErrorHandler;
