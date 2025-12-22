import log from 'electron-log';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export class Logger {
  private static instance: Logger;
  private logPath: string;
  private maxLogSize = 10 * 1024 * 1024; // 10MB
  private maxLogFiles = 5;

  private constructor() {
    this.logPath = path.join(app.getPath('userData'), 'logs');
    this.initializeLogger();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private initializeLogger(): void {
    // Ensure log directory exists
    if (!fs.existsSync(this.logPath)) {
      fs.mkdirSync(this.logPath, { recursive: true });
    }

    // Configure electron-log
    log.transports.file.level = 'info';
    log.transports.file.maxSize = this.maxLogSize;
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    log.transports.file.resolvePathFn = () => path.join(this.logPath, 'main.log');

    // Console transport for development
    log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    log.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}';

    // Rotate logs on startup
    this.rotateLogs();
  }

  private rotateLogs(): void {
    try {
      const files = fs.readdirSync(this.logPath)
        .filter(f => f.startsWith('main') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.logPath, f),
          time: fs.statSync(path.join(this.logPath, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      // Keep only the most recent logs
      if (files.length >= this.maxLogFiles) {
        const mainLog = path.join(this.logPath, 'main.log');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveName = `main.${timestamp}.log`;
        const archivePath = path.join(this.logPath, archiveName);

        // Archive current log
        if (fs.existsSync(mainLog)) {
          fs.renameSync(mainLog, archivePath);
        }

        // Delete old logs
        files.slice(this.maxLogFiles - 1).forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (err) {
            console.error(`Failed to delete old log: ${file.name}`, err);
          }
        });
      }
    } catch (err) {
      console.error('Failed to rotate logs:', err);
    }
  }

  public error(message: string, ...args: unknown[]): void {
    log.error(message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    log.warn(message, ...args);
  }

  public info(message: string, ...args: unknown[]): void {
    log.info(message, ...args);
  }

  public debug(message: string, ...args: unknown[]): void {
    log.debug(message, ...args);
  }

  public setLevel(level: LogLevel): void {
    log.transports.file.level = level;
    log.transports.console.level = level;
  }

  public getLogPath(): string {
    return this.logPath;
  }

  public getLogFiles(): string[] {
    try {
      return fs.readdirSync(this.logPath)
        .filter(f => f.endsWith('.log'))
        .map(f => path.join(this.logPath, f));
    } catch (err) {
      this.error('Failed to get log files:', err);
      return [];
    }
  }

  public readLogFile(filename: string): string {
    try {
      const filePath = path.join(this.logPath, filename);
      return fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      this.error(`Failed to read log file ${filename}:`, err);
      return '';
    }
  }

  public clearLogs(): void {
    try {
      const files = fs.readdirSync(this.logPath);
      files.forEach(file => {
        const filePath = path.join(this.logPath, file);
        fs.unlinkSync(filePath);
      });
      this.info('All logs cleared');
    } catch (err) {
      this.error('Failed to clear logs:', err);
    }
  }

  public exportLogs(destination: string): boolean {
    try {
      const files = this.getLogFiles();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const exportPath = path.join(destination, `logs-export-${timestamp}`);

      if (!fs.existsSync(exportPath)) {
        fs.mkdirSync(exportPath, { recursive: true });
      }

      files.forEach(file => {
        const filename = path.basename(file);
        const destPath = path.join(exportPath, filename);
        fs.copyFileSync(file, destPath);
      });

      this.info(`Logs exported to: ${exportPath}`);
      return true;
    } catch (err) {
      this.error('Failed to export logs:', err);
      return false;
    }
  }
}

export default Logger;
