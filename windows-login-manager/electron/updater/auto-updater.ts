import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { dialog, BrowserWindow, ipcMain, app } from 'electron';
import { Logger } from '../logger/logger';
import log from 'electron-log';

// 更新状态类型
export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  message: string;
  progress?: number;
  version?: string;
  releaseNotes?: string;
  releaseDate?: string;
  error?: string;
}

// 更新信息类型
export interface UpdateInfoResult {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  releaseNotes?: string;
  releaseDate?: string;
}

/**
 * 自动更新管理器
 * 支持腾讯云 COS 作为更新服务器
 */
export class AutoUpdater {
  private static instance: AutoUpdater;
  private logger: Logger;
  private mainWindow: BrowserWindow | null = null;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private currentStatus: UpdateStatus = {
    status: 'idle',
    message: '就绪'
  };
  private latestUpdateInfo: UpdateInfo | null = null;

  private constructor() {
    this.logger = Logger.getInstance();
    this.configureUpdater();
    this.registerIPCHandlers();
  }

  public static getInstance(): AutoUpdater {
    if (!AutoUpdater.instance) {
      AutoUpdater.instance = new AutoUpdater();
    }
    return AutoUpdater.instance;
  }

  /**
   * 配置更新器
   */
  private configureUpdater(): void {
    // 配置 electron-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    
    // 配置日志
    autoUpdater.logger = log;
    (autoUpdater.logger as any).transports.file.level = 'info';

    this.setupEventHandlers();
  }

  /**
   * 设置更新服务器 URL（腾讯云 COS）
   * @param url COS 存储桶的 URL，例如：https://geo-1301979637.cos.ap-chengdu.myqcloud.com/releases
   */
  public setFeedURL(url: string): void {
    this.logger.info(`Setting update feed URL: ${url}`);
    
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: url,
      useMultipleRangeRequest: false
    });
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 检查更新中
    autoUpdater.on('checking-for-update', () => {
      this.logger.info('Checking for updates...');
      this.updateStatus({
        status: 'checking',
        message: '正在检查更新...'
      });
    });

    // 发现新版本
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.logger.info('Update available:', info);
      this.latestUpdateInfo = info;
      
      const releaseNotes = this.formatReleaseNotes(info.releaseNotes);
      
      this.updateStatus({
        status: 'available',
        message: `发现新版本 ${info.version}`,
        version: info.version,
        releaseNotes: releaseNotes,
        releaseDate: info.releaseDate
      });
    });

    // 没有新版本
    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.logger.info('Update not available:', info);
      this.updateStatus({
        status: 'not-available',
        message: '当前已是最新版本',
        version: info.version
      });
    });

    // 更新错误
    autoUpdater.on('error', (err: Error) => {
      this.logger.error('Update error:', err);
      this.updateStatus({
        status: 'error',
        message: '更新检查失败',
        error: err.message
      });
    });

    // 下载进度
    autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
      const percent = Math.round(progressObj.percent);
      const speed = this.formatBytes(progressObj.bytesPerSecond);
      const transferred = this.formatBytes(progressObj.transferred);
      const total = this.formatBytes(progressObj.total);
      
      const message = `下载中: ${percent}% (${transferred}/${total}) - ${speed}/s`;
      this.logger.info(message);
      
      this.updateStatus({
        status: 'downloading',
        message: message,
        progress: percent,
        version: this.latestUpdateInfo?.version
      });
    });

    // 下载完成
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.logger.info('Update downloaded:', info);
      
      const releaseNotes = this.formatReleaseNotes(info.releaseNotes);
      
      this.updateStatus({
        status: 'downloaded',
        message: '更新已下载完成，可以安装',
        version: info.version,
        releaseNotes: releaseNotes,
        releaseDate: info.releaseDate
      });
    });
  }

  /**
   * 注册 IPC 处理器
   */
  private registerIPCHandlers(): void {
    // 获取当前版本
    ipcMain.handle('updater:get-version', () => {
      return this.getCurrentVersion();
    });

    // 获取更新状态
    ipcMain.handle('updater:get-status', () => {
      return this.currentStatus;
    });

    // 检查更新
    ipcMain.handle('updater:check', async () => {
      return await this.checkForUpdates();
    });

    // 下载更新
    ipcMain.handle('updater:download', async () => {
      return await this.downloadUpdate();
    });

    // 安装更新（重启应用）
    ipcMain.handle('updater:install', () => {
      return this.installUpdate();
    });

    // 获取更新信息
    ipcMain.handle('updater:get-info', async (): Promise<UpdateInfoResult> => {
      return {
        currentVersion: this.getCurrentVersion(),
        latestVersion: this.latestUpdateInfo?.version,
        updateAvailable: this.currentStatus.status === 'available' || this.currentStatus.status === 'downloaded',
        releaseNotes: this.currentStatus.releaseNotes,
        releaseDate: this.currentStatus.releaseDate
      };
    });
  }

  /**
   * 设置主窗口
   */
  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * 检查更新
   */
  public async checkForUpdates(): Promise<{ success: boolean; message: string; updateAvailable?: boolean }> {
    if (process.env.NODE_ENV === 'development') {
      this.logger.info('Skipping update check in development mode');
      return { 
        success: true, 
        message: '开发模式下跳过更新检查',
        updateAvailable: false
      };
    }

    try {
      this.logger.info('Manually checking for updates');
      const result = await autoUpdater.checkForUpdates();
      
      if (result && result.updateInfo) {
        const currentVersion = this.getCurrentVersion();
        const latestVersion = result.updateInfo.version;
        const updateAvailable = this.compareVersions(latestVersion, currentVersion) > 0;
        
        return {
          success: true,
          message: updateAvailable ? `发现新版本 ${latestVersion}` : '当前已是最新版本',
          updateAvailable
        };
      }
      
      return { success: true, message: '检查完成', updateAvailable: false };
    } catch (err) {
      const error = err as Error;
      this.logger.error('Failed to check for updates:', error);
      return { success: false, message: error.message || '检查更新失败' };
    }
  }

  /**
   * 下载更新
   */
  public async downloadUpdate(): Promise<{ success: boolean; message: string }> {
    if (this.currentStatus.status !== 'available') {
      return { success: false, message: '没有可用的更新' };
    }

    try {
      this.logger.info('Starting update download');
      await autoUpdater.downloadUpdate();
      return { success: true, message: '开始下载更新' };
    } catch (err) {
      const error = err as Error;
      this.logger.error('Failed to download update:', error);
      return { success: false, message: error.message || '下载更新失败' };
    }
  }

  /**
   * 安装更新（退出并安装）
   */
  public installUpdate(): { success: boolean; message: string } {
    if (this.currentStatus.status !== 'downloaded') {
      return { success: false, message: '更新尚未下载完成' };
    }

    try {
      this.logger.info('Installing update and restarting');
      // 设置为 false 表示不静默安装，true 表示安装后强制重启
      autoUpdater.quitAndInstall(false, true);
      return { success: true, message: '正在安装更新...' };
    } catch (err) {
      const error = err as Error;
      this.logger.error('Failed to install update:', error);
      return { success: false, message: error.message || '安装更新失败' };
    }
  }

  /**
   * 开始定期检查更新
   */
  public startPeriodicCheck(intervalHours: number = 24): void {
    if (process.env.NODE_ENV === 'development') {
      this.logger.info('Skipping periodic update check in development mode');
      return;
    }

    // 启动后延迟 30 秒检查一次
    setTimeout(() => {
      this.checkForUpdates();
    }, 30000);

    // 然后定期检查
    const intervalMs = intervalHours * 60 * 60 * 1000;
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);

    this.logger.info(`Started periodic update check (every ${intervalHours} hours)`);
  }

  /**
   * 停止定期检查
   */
  public stopPeriodicCheck(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      this.logger.info('Stopped periodic update check');
    }
  }

  /**
   * 获取当前版本
   */
  public getCurrentVersion(): string {
    return app.getVersion();
  }

  /**
   * 更新状态并通知渲染进程
   */
  private updateStatus(status: UpdateStatus): void {
    this.currentStatus = status;
    this.sendStatusToWindow(status);
  }

  /**
   * 发送状态到渲染进程
   */
  private sendStatusToWindow(status: UpdateStatus): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater:status-changed', status);
    }
  }

  /**
   * 格式化发布说明
   */
  private formatReleaseNotes(releaseNotes: string | Array<{ version: string; note: string }> | null | undefined): string {
    if (!releaseNotes) return '';
    
    if (typeof releaseNotes === 'string') {
      return releaseNotes;
    }
    
    if (Array.isArray(releaseNotes)) {
      return releaseNotes.map(item => `${item.version}: ${item.note}`).join('\n');
    }
    
    return '';
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 比较版本号
   * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    
    return 0;
  }

  /**
   * 显示更新提示对话框
   */
  public promptUpdate(info: UpdateInfo): void {
    const version = info.version;
    const releaseNotes = this.formatReleaseNotes(info.releaseNotes) || '无更新说明';

    dialog
      .showMessageBox({
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${version}`,
        detail: `当前版本: ${this.getCurrentVersion()}\n新版本: ${version}\n\n更新内容:\n${releaseNotes}`,
        buttons: ['立即下载', '稍后提醒'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          this.logger.info('User chose to download update');
          this.downloadUpdate();
        } else {
          this.logger.info('User chose to skip update');
        }
      });
  }

  /**
   * 显示安装提示对话框
   */
  public promptInstall(): void {
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
          this.installUpdate();
        } else {
          this.logger.info('User chose to install update later');
        }
      });
  }
}

export default AutoUpdater;
