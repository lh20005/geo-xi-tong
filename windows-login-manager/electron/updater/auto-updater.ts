import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { dialog, BrowserWindow, ipcMain, app, Notification, net } from 'electron';
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
  downloadUrl?: string;  // 手动下载链接
  platformInfo?: {       // 平台信息
    platform: string;
    arch: string;
    displayName: string;
  };
}

// macOS latest-mac.yml 文件结构
interface MacUpdateYml {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
  files: Array<{
    url: string;
    sha512: string;
    size: number;
  }>;
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
  private feedUrl: string = '';  // 保存更新服务器 URL，用于生成手动下载链接

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
    autoUpdater.autoDownload = true;  // 启用后台静默下载
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    
    // macOS: 禁用代码签名验证（因为我们没有 Apple Developer 证书）
    // 这允许未签名的应用进行自动更新
    if (process.platform === 'darwin') {
      autoUpdater.forceDevUpdateConfig = true;
    }
    
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
    this.feedUrl = url;  // 保存 URL 用于生成手动下载链接
    
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
      
      // 发送系统通知
      this.showUpdateNotification(info.version);
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
      const platformInfo = this.getPlatformInfo();
      return {
        currentVersion: this.getCurrentVersion(),
        latestVersion: this.latestUpdateInfo?.version,
        updateAvailable: this.currentStatus.status === 'available' || this.currentStatus.status === 'downloaded',
        releaseNotes: this.currentStatus.releaseNotes,
        releaseDate: this.currentStatus.releaseDate,
        downloadUrl: this.getManualDownloadUrl(),
        platformInfo: platformInfo
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
   * macOS: 由于没有签名，使用自定义 HTTP 请求检查 latest-mac.yml
   * Windows: 使用标准的 electron-updater
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

    // macOS: 使用自定义检查逻辑绕过签名验证
    if (process.platform === 'darwin') {
      return await this.checkForUpdatesMacOS();
    }

    // Windows: 使用标准的 electron-updater
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
   * macOS 专用：通过 HTTP 请求检查更新
   * 绕过 electron-updater 的签名验证
   */
  private async checkForUpdatesMacOS(): Promise<{ success: boolean; message: string; updateAvailable?: boolean }> {
    this.logger.info('macOS: Checking for updates via HTTP...');
    
    this.updateStatus({
      status: 'checking',
      message: '正在检查更新...'
    });

    try {
      const ymlUrl = `${this.feedUrl}/latest-mac.yml`;
      this.logger.info(`Fetching: ${ymlUrl}`);
      
      const ymlContent = await this.fetchUrl(ymlUrl);
      const updateInfo = this.parseSimpleYaml(ymlContent);
      
      if (!updateInfo || !updateInfo.version) {
        throw new Error('无法解析更新信息');
      }

      const currentVersion = this.getCurrentVersion();
      const latestVersion = updateInfo.version;
      const updateAvailable = this.compareVersions(latestVersion, currentVersion) > 0;

      this.logger.info(`Current: ${currentVersion}, Latest: ${latestVersion}, Update available: ${updateAvailable}`);

      // 保存更新信息供后续使用
      this.latestUpdateInfo = {
        version: latestVersion,
        releaseDate: updateInfo.releaseDate || new Date().toISOString(),
        releaseNotes: updateInfo.releaseNotes || '',
        files: [],
        path: '',
        sha512: ''
      } as UpdateInfo;

      if (updateAvailable) {
        this.updateStatus({
          status: 'available',
          message: `发现新版本 ${latestVersion}`,
          version: latestVersion,
          releaseNotes: updateInfo.releaseNotes || '',
          releaseDate: updateInfo.releaseDate
        });
        return {
          success: true,
          message: `发现新版本 ${latestVersion}`,
          updateAvailable: true
        };
      } else {
        this.updateStatus({
          status: 'not-available',
          message: '当前已是最新版本',
          version: currentVersion
        });
        return {
          success: true,
          message: '当前已是最新版本',
          updateAvailable: false
        };
      }
    } catch (err) {
      const error = err as Error;
      this.logger.error('macOS update check failed:', error);
      
      this.updateStatus({
        status: 'error',
        message: '更新检查失败',
        error: error.message
      });
      
      return { 
        success: false, 
        message: error.message || '检查更新失败' 
      };
    }
  }

  /**
   * 简单的 YAML 解析器（仅支持 latest-mac.yml 格式）
   */
  private parseSimpleYaml(content: string): MacUpdateYml {
    const result: MacUpdateYml = {
      version: '',
      releaseDate: '',
      releaseNotes: '',
      files: []
    };

    const lines = content.split('\n');
    let inReleaseNotes = false;
    let releaseNotesLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // 检测 releaseNotes 多行字符串
      if (trimmed.startsWith('releaseNotes:')) {
        const value = trimmed.substring('releaseNotes:'.length).trim();
        if (value.startsWith('|') || value.startsWith('>')) {
          inReleaseNotes = true;
          continue;
        } else if (value) {
          // 单行 releaseNotes，去掉引号
          result.releaseNotes = value.replace(/^["']|["']$/g, '');
        }
        continue;
      }

      // 处理多行 releaseNotes
      if (inReleaseNotes) {
        if (line.startsWith('  ') || line.startsWith('\t')) {
          releaseNotesLines.push(line.substring(2) || line.substring(1));
        } else if (trimmed && !trimmed.startsWith('-')) {
          inReleaseNotes = false;
          result.releaseNotes = releaseNotesLines.join('\n').trim();
        }
      }

      // 解析 version
      if (trimmed.startsWith('version:')) {
        result.version = trimmed.substring('version:'.length).trim().replace(/^["']|["']$/g, '');
      }

      // 解析 releaseDate
      if (trimmed.startsWith('releaseDate:')) {
        result.releaseDate = trimmed.substring('releaseDate:'.length).trim().replace(/^["']|["']$/g, '');
      }
    }

    // 如果还在处理 releaseNotes，保存它
    if (inReleaseNotes && releaseNotesLines.length > 0) {
      result.releaseNotes = releaseNotesLines.join('\n').trim();
    }

    return result;
  }

  /**
   * 使用 Electron net 模块获取 URL 内容
   */
  private fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request(url);
      let data = '';

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: 无法获取更新信息`));
          return;
        }

        response.on('data', (chunk) => {
          data += chunk.toString();
        });

        response.on('end', () => {
          resolve(data);
        });

        response.on('error', (error: Error) => {
          reject(error);
        });
      });

      request.on('error', (error: Error) => {
        reject(error);
      });

      request.end();
    });
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
  private formatReleaseNotes(releaseNotes: string | Array<{ version: string; note: string | null }> | null | undefined): string {
    if (!releaseNotes) return '';
    
    if (typeof releaseNotes === 'string') {
      return releaseNotes;
    }
    
    if (Array.isArray(releaseNotes)) {
      return releaseNotes.map(item => `${item.version}: ${item.note || ''}`).join('\n');
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

  /**
   * 显示更新下载完成的系统通知
   */
  private showUpdateNotification(version: string): void {
    try {
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: 'GEO优化系统 - 更新已就绪',
          body: `新版本 ${version} 已下载完成，点击查看详情`,
          icon: undefined, // 使用默认图标
          silent: false
        });
        
        notification.on('click', () => {
          // 点击通知时聚焦主窗口并导航到更新页面
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            if (this.mainWindow.isMinimized()) {
              this.mainWindow.restore();
            }
            this.mainWindow.show();
            this.mainWindow.focus();
            // 发送事件通知渲染进程导航到更新页面
            this.mainWindow.webContents.send('navigate-to-update');
          }
        });
        
        notification.show();
        this.logger.info('Update notification shown');
      }
    } catch (error) {
      this.logger.error('Failed to show update notification:', error);
    }
  }

  /**
   * 获取手动下载链接
   * 根据当前平台和架构返回对应的安装包下载链接
   */
  public getManualDownloadUrl(): string {
    if (!this.feedUrl) {
      return '';
    }
    
    // 获取平台和架构信息
    const platform = process.platform;
    const arch = process.arch;  // 'x64', 'arm64', 'ia32' 等
    const version = this.latestUpdateInfo?.version || this.getCurrentVersion();
    
    // 构建下载链接（基于 electron-builder 的默认命名规则）
    let fileName = '';
    if (platform === 'win32') {
      // Windows: 区分 x64 和 arm64
      if (arch === 'arm64') {
        fileName = `GEO优化系统-Setup-${version}-arm64.exe`;
      } else {
        fileName = `GEO优化系统-Setup-${version}.exe`;  // x64 是默认的，不带后缀
      }
    } else if (platform === 'darwin') {
      // macOS: 区分 Intel (x64) 和 Apple Silicon (arm64)
      if (arch === 'arm64') {
        fileName = `GEO优化系统-${version}-arm64.dmg`;
      } else {
        fileName = `GEO优化系统-${version}.dmg`;  // Intel 版本
      }
    } else {
      // Linux: 区分 x64 和 arm64
      if (arch === 'arm64') {
        fileName = `GEO优化系统-${version}-arm64.AppImage`;
      } else {
        fileName = `GEO优化系统-${version}.AppImage`;
      }
    }
    
    // URL 编码中文文件名
    const encodedFileName = encodeURIComponent(fileName);
    return `${this.feedUrl}/${encodedFileName}`;
  }

  /**
   * 获取当前平台和架构信息（用于 UI 显示）
   */
  public getPlatformInfo(): { platform: string; arch: string; displayName: string } {
    const platform = process.platform;
    const arch = process.arch;
    
    let displayName = '';
    if (platform === 'win32') {
      displayName = arch === 'arm64' ? 'Windows (ARM64)' : 'Windows (x64)';
    } else if (platform === 'darwin') {
      displayName = arch === 'arm64' ? 'macOS (Apple Silicon)' : 'macOS (Intel)';
    } else {
      displayName = arch === 'arm64' ? 'Linux (ARM64)' : 'Linux (x64)';
    }
    
    return { platform, arch, displayName };
  }

  /**
   * 获取更新服务器 URL
   */
  public getFeedUrl(): string {
    return this.feedUrl;
  }
}

export default AutoUpdater;
