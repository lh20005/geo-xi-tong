import { app, BrowserWindow } from 'electron';
import { StorageManager } from '../storage/manager';
import { Logger } from '../logger/logger';
import path from 'path';
import fs from 'fs';

interface AppState {
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  lastRoute?: string;
  timestamp: number;
}

export class CrashRecovery {
  private static instance: CrashRecovery;
  private logger: Logger;
  private storage: StorageManager;
  private statePath: string;
  private saveInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.logger = Logger.getInstance();
    this.storage = StorageManager.getInstance();
    this.statePath = path.join(app.getPath('userData'), 'app-state.json');
  }

  public static getInstance(): CrashRecovery {
    if (!CrashRecovery.instance) {
      CrashRecovery.instance = new CrashRecovery();
    }
    return CrashRecovery.instance;
  }

  public initialize(window: BrowserWindow): void {
    this.logger.info('Initializing crash recovery');

    // Check for previous crash
    if (this.hasPreviousCrash()) {
      this.logger.warn('Previous crash detected, attempting recovery');
      this.recoverFromCrash(window);
    }

    // Start periodic state saving
    this.startStateSaving(window);

    // Save state on window close
    window.on('close', () => {
      this.saveState(window);
      this.stopStateSaving();
    });

    // Handle renderer process crashes
    window.webContents.on('render-process-gone', (event, details) => {
      this.logger.error('Renderer process crashed:', details);
      this.handleRendererCrash(window, details);
    });

    // Handle unresponsive renderer
    window.on('unresponsive', () => {
      this.logger.warn('Window became unresponsive');
      this.handleUnresponsive(window);
    });

    window.on('responsive', () => {
      this.logger.info('Window became responsive again');
    });
  }

  private hasPreviousCrash(): boolean {
    try {
      if (!fs.existsSync(this.statePath)) {
        return false;
      }

      const state = this.loadState();
      if (!state) {
        return false;
      }

      // Check if state is recent (within last 5 minutes)
      const timeSinceLastSave = Date.now() - state.timestamp;
      const fiveMinutes = 5 * 60 * 1000;

      return timeSinceLastSave < fiveMinutes;
    } catch (err) {
      this.logger.error('Failed to check for previous crash:', err);
      return false;
    }
  }

  private recoverFromCrash(window: BrowserWindow): void {
    try {
      const state = this.loadState();
      if (!state) {
        return;
      }

      // Restore window bounds
      if (state.windowBounds) {
        window.setBounds(state.windowBounds);
        this.logger.info('Restored window bounds');
      }

      // Restore route (will be handled by renderer)
      if (state.lastRoute) {
        this.logger.info(`Last route was: ${state.lastRoute}`);
        // Route restoration will be handled by the renderer process
      }

      this.logger.info('Crash recovery completed');
    } catch (err) {
      this.logger.error('Failed to recover from crash:', err);
    }
  }

  private startStateSaving(window: BrowserWindow): void {
    // Save state every 30 seconds
    this.saveInterval = setInterval(() => {
      this.saveState(window);
    }, 30000);
  }

  private stopStateSaving(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  private saveState(window: BrowserWindow): void {
    try {
      const state: AppState = {
        windowBounds: window.getBounds(),
        timestamp: Date.now(),
      };

      fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
    } catch (err) {
      this.logger.error('Failed to save app state:', err);
    }
  }

  private loadState(): AppState | null {
    try {
      if (!fs.existsSync(this.statePath)) {
        return null;
      }

      const data = fs.readFileSync(this.statePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      this.logger.error('Failed to load app state:', err);
      return null;
    }
  }

  private handleRendererCrash(
    window: BrowserWindow,
    details: Electron.RenderProcessGoneDetails
  ): void {
    this.logger.error('Renderer process crash details:', {
      reason: details.reason,
      exitCode: details.exitCode,
    });

    // Attempt to reload the window
    if (details.reason === 'crashed') {
      setTimeout(() => {
        if (!window.isDestroyed()) {
          this.logger.info('Attempting to reload after crash');
          window.reload();
        }
      }, 1000);
    }
  }

  private handleUnresponsive(window: BrowserWindow): void {
    // Log the unresponsive state
    this.logger.warn('Window is unresponsive, waiting for recovery');

    // Could show a dialog to the user asking if they want to wait or restart
    // For now, we just log and wait for the 'responsive' event
  }

  public clearState(): void {
    try {
      if (fs.existsSync(this.statePath)) {
        fs.unlinkSync(this.statePath);
        this.logger.info('App state cleared');
      }
    } catch (err) {
      this.logger.error('Failed to clear app state:', err);
    }
  }

  public getLastState(): AppState | null {
    return this.loadState();
  }
}

export default CrashRecovery;
