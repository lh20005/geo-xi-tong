import { autoUpdater } from 'electron-updater';
import { dialog, BrowserWindow } from 'electron';
import { Logger } from '../logger/logger';

export class AutoUpdater {
  private static instance: AutoUpdater;
  private logger: Logger;
  private mainWindow: BrowserWindow | null = null;
  private updateCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.logger = Logger.getInstance();
    this.configureUpdater();
  }

  public static getInstance(): AutoUpdater {
    if (!AutoUpdater.instance) {
      AutoUpdater.instance = new AutoUpdater();
    }
    return AutoUpdater.instance;
  }

  private configureUpdater(): void {
    // Configure auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Set update server URL (configure this based on your deployment)
    // autoUpdater.setFeedURL({
    //   provider: 'generic',
    //   url: 'https://your-update-server.com/updates'
    // });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Checking for update
    autoUpdater.on('checking-for-update', () => {
      this.logger.info('Checking for updates...');
      this.sendStatusToWindow('正在检查更新...');
    });

    // Update available
    autoUpdater.on('update-available', (info) => {
      this.logger.info('Update available:', info);
      this.sendStatusToWindow('发现新版本');
      this.promptUpdate(info);
    });

    // Update not available
    autoUpdater.on('update-not-available', (info) => {
      this.logger.info('Update not available:', info);
      this.sendStatusToWindow('当前已是最新版本');
    });

    // Update error
    autoUpdater.on('error', (err) => {
      this.logger.error('Update error:', err);
      this.sendStatusToWindow('更新检查失败');
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      const message = `下载速度: ${progressObj.bytesPerSecond} - 已下载 ${progressObj.percent}%`;
      this.logger.info(message);
      this.sendStatusToWindow(message);
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      this.logger.info('Update downloaded:', info);
      this.sendStatusToWindow('更新已下载');
      this.promptInstall();
    });
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  public checkForUpdates(): void {
    if (process.env.NODE_ENV === 'development') {
      this.logger.info('Skipping update check in development mode');
      return;
    }

    this.logger.info('Manually checking for updates');
    autoUpdater.checkForUpdates().catch((err) => {
      this.logger.error('Failed to check for updates:', err);
    });
  }

  public startPeriodicCheck(intervalHours: number = 24): void {
    if (process.env.NODE_ENV === 'development') {
      this.logger.info('Skipping periodic update check in development mode');
      return;
    }

    // Check immediately
    this.checkForUpdates();

    // Then check periodically
    const intervalMs = intervalHours * 60 * 60 * 1000;
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);

    this.logger.info(`Started periodic update check (every ${intervalHours} hours)`);
  }

  public stopPeriodicCheck(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      this.logger.info('Stopped periodic update check');
    }
  }

  private promptUpdate(info: any): void {
    const version = info.version;
    const releaseNotes = info.releaseNotes || '无更新说明';

    dialog
      .showMessageBox({
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${version}`,
        detail: `当前版本: ${autoUpdater.currentVersion}\n新版本: ${version}\n\n更新内容:\n${releaseNotes}`,
        buttons: ['立即下载', '稍后提醒'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          this.logger.info('User chose to download update');
          autoUpdater.downloadUpdate();
        } else {
          this.logger.info('User chose to skip update');
        }
      });
  }

  private promptInstall(): void {
    dialog
      .showMessageBox({
        type: 'info',
        title: '更新已就绪',
        message: '新版本已下载完成',
        detail: '应用将在退出后自动安装更新。是否立即重启应用？',
        buttons: ['立即重启', '稍后重启'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          this.logger.info('User chose to install update now');
          autoUpdater.quitAndInstall(false, true);
        } else {
          this.logger.info('User chose to install update later');
        }
      });
  }

  private sendStatusToWindow(message: string): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update-status', message);
    }
  }

  public getCurrentVersion(): string {
    return autoUpdater.currentVersion.version;
  }
}

export default AutoUpdater;
