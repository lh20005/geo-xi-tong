import { app, BrowserWindow, Menu, screen, shell } from 'electron';
import path from 'path';
import { ipcHandler } from './ipc/handler';
import { Logger } from './logger/logger';
import { ErrorHandler } from './error/handler';
import { CrashRecovery } from './crash/recovery';
import { CertificateValidator } from './security/certificate';
import { ContentSecurityPolicy } from './security/csp';
import { wsManager, WebSocketManager } from './websocket/manager';
import { userWsManager, UserWebSocketManager } from './websocket/userManager';
import { storageManager } from './storage/manager';
import { AutoUpdater } from './updater/auto-updater';
import { taskQueue } from './publishing/taskQueue';

// 初始化核心服务
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();
const crashRecovery = CrashRecovery.getInstance();
const certificateValidator = CertificateValidator.getInstance();
const csp = ContentSecurityPolicy.getInstance();

let mainWindow: BrowserWindow | null = null;

/**
 * 应用管理器
 * 负责管理应用生命周期、窗口创建和管理
 * Requirements: 9.8, 10.5
 */
class ApplicationManager {
  private window: BrowserWindow | null = null;
  private isQuitting = false;

  /**
   * 初始化应用程序
   */
  async initialize(): Promise<void> {
    logger.info('Initializing application...');
    
    try {
      // 确保单实例运行
      const gotTheLock = app.requestSingleInstanceLock();
      if (!gotTheLock) {
        logger.warn('Another instance is already running');
        app.quit();
        return;
      }

      // 处理第二个实例启动
      app.on('second-instance', () => {
        logger.info('Second instance detected, focusing main window');
        this.focusMainWindow();
      });

      // 等待应用准备就绪
      await app.whenReady();
      logger.info('App is ready');
      
      // 初始化安全功能（需要在app ready之后）
      certificateValidator.initialize();
      csp.configure();
      
      // 注册IPC处理器
      await ipcHandler.registerHandlers();
      
      // 设置应用菜单
      this.setupApplicationMenu();
      
      // 创建主窗口
      this.createMainWindow();
      
      // 初始化崩溃恢复
      if (this.window) {
        crashRecovery.initialize(this.window);
      }
      
      // 初始化WebSocket连接
      await this.initializeWebSocket();
      
      // 初始化用户管理WebSocket连接
      await this.initializeUserWebSocket();
      
      // 初始化自动更新器
      this.initializeAutoUpdater();
      
      // 初始化任务队列（设置主窗口引用并启动）
      this.initializeTaskQueue();
      
      // 处理应用激活（macOS）
      app.on('activate', () => {
        logger.info('App activated');
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        } else {
          this.focusMainWindow();
        }
      });
      
      // 处理所有窗口关闭
      app.on('window-all-closed', () => {
        logger.info('All windows closed');
        if (process.platform !== 'darwin') {
          this.handleAppQuit();
          app.quit();
        }
      });

      // 处理应用退出前
      app.on('before-quit', () => {
        logger.info('App is about to quit');
        this.isQuitting = true;
      });

      // 处理应用退出
      app.on('will-quit', () => {
        this.handleAppQuit();
      });

      // 处理未捕获的异常
      process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception:', error);
        const appError = errorHandler.wrapError(error, 'UNKNOWN' as any);
        errorHandler.handleError(appError);
      });

      process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled rejection:', reason);
        const appError = errorHandler.wrapError(reason, 'UNKNOWN' as any);
        errorHandler.handleError(appError);
      });

      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  // 设计稿基准分辨率（按 1920x1080 设计）
  private readonly BASE_WIDTH = 1920;
  private readonly BASE_HEIGHT = 1080;

  /**
   * 计算缩放因子
   * 根据当前屏幕分辨率与设计稿基准分辨率的比例计算
   */
  private calculateZoomFactor(width: number, height: number): number {
    // 分别计算宽度和高度的缩放比例，取较小值确保内容完全显示
    const widthRatio = width / this.BASE_WIDTH;
    const heightRatio = height / this.BASE_HEIGHT;
    
    // 取较小值，确保内容不会超出屏幕
    let zoomFactor = Math.min(widthRatio, heightRatio);
    
    // 限制缩放范围：最小 0.6（太小看不清），最大 1.5（太大浪费空间）
    zoomFactor = Math.max(0.6, Math.min(1.5, zoomFactor));
    
    return zoomFactor;
  }

  /**
   * 创建主窗口
   */
  createMainWindow(): BrowserWindow {
    logger.info('Creating main window...');
    
    // 获取主显示器信息
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const displayScaleFactor = primaryDisplay.scaleFactor;
    
    logger.info(`Screen info: ${screenWidth}x${screenHeight}, displayScaleFactor: ${displayScaleFactor}`);
    
    // 计算页面缩放因子
    const zoomFactor = this.calculateZoomFactor(screenWidth, screenHeight);
    logger.info(`Calculated zoomFactor: ${zoomFactor}`);
    
    // 创建窗口配置
    const windowConfig = {
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'Ai智软精准GEO优化系统',
      backgroundColor: '#ffffff',
      icon: path.join(__dirname, '../build/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, 'preload.js'),
        webviewTag: true,
        zoomFactor: zoomFactor, // 设置初始缩放因子
      },
      show: false,
      frame: true,
      titleBarStyle: 'default' as const,
    };

    this.window = new BrowserWindow(windowConfig);
    
    // 窗口创建后立即最大化
    this.window.maximize();
    
    logger.info(`Main window created, zoomFactor: ${zoomFactor}`);

    // 窗口准备好后的回调
    this.window.once('ready-to-show', () => {
      logger.info('Window ready-to-show event fired');
      
      // 确保窗口是最大化的
      if (!this.window?.isMaximized()) {
        this.window?.maximize();
      }
      
      // 应用缩放因子
      if (this.window?.webContents) {
        if (!this.window.webContents.isDestroyed()) {
          this.window.webContents.setZoomFactor(zoomFactor);
          // 禁用视觉缩放（捏合缩放）
          this.window.webContents.setVisualZoomLevelLimits(1, 1);
          logger.info(`Applied zoomFactor: ${zoomFactor}`);
        }
      }
      
      // 显示窗口
      this.window?.show();
    });

    // 监听页面加载完成，重新应用缩放（防止被重置）
    this.window.webContents.on('did-finish-load', () => {
      // 安全检查：如果窗口已销毁，直接返回
      if (!this.window || this.window.isDestroyed()) return;
      if (this.window.webContents.isDestroyed()) return;
      
      try {
        const [width, height] = this.window.getSize();
        const currentZoom = this.calculateZoomFactor(width, height);
        this.window.webContents.setZoomFactor(currentZoom);
        logger.info(`Page loaded, re-applied zoomFactor: ${currentZoom}`);
      } catch (error) {
        logger.error('Failed to re-apply zoom factor on load:', error);
      }
    });

    // 拦截缩放快捷键 (Ctrl+0, Ctrl+, Ctrl-, Ctrl+=)
    this.window.webContents.on('before-input-event', (event, input) => {
      if (this.window?.webContents.isDestroyed()) return;
      
      if (input.control || input.meta) {
        if (['0', '-', '=', '+'].includes(input.key)) {
          event.preventDefault();
          logger.info(`Prevented zoom shortcut: ${input.key}`);
        }
      }
    });
    
    // 监听窗口大小变化，动态调整缩放
    this.window.on('resize', () => {
      this.handleWindowResize();
    });
    
    // 监听显示器变化（用户移动窗口到不同显示器）
    this.window.on('moved', () => {
      this.handleDisplayChange();
    });

    // 加载应用
    const loadApp = async () => {
      if (!this.window) {
        logger.error('Window is null, cannot load app');
        return;
      }

      try {
        logger.info(`Loading app in ${process.env.NODE_ENV} mode...`);
        if (process.env.NODE_ENV === 'development') {
          logger.info('Attempting to load URL: http://localhost:5174');
          await this.window.loadURL('http://localhost:5174');
          this.window.webContents.openDevTools();
          logger.info('Loaded development URL successfully');
        } else {
          const indexPath = path.join(__dirname, '../dist/index.html');
          logger.info(`Attempting to load file: ${indexPath}`);
          await this.window.loadFile(indexPath);
          logger.info('Loaded production file successfully');
        }
      } catch (error) {
        logger.error('Failed to load app:', error);
        logger.error('Error details:', JSON.stringify(error, null, 2));
      }
    };

    loadApp().catch(err => {
      logger.error('Unhandled error in loadApp:', err);
    });

    // 窗口关闭事件
    this.window.on('close', (event) => {
      // 移除事件监听器，防止内存泄漏或销毁后访问
      if (this.window && !this.window.isDestroyed() && this.window.webContents) {
        this.window.webContents.removeAllListeners('did-finish-load');
        this.window.webContents.removeAllListeners('before-input-event');
      }

      if (!this.isQuitting && process.platform === 'darwin') {
        event.preventDefault();
        this.window?.hide();
        logger.info('Window hidden (macOS)');
      }
    });

    this.window.on('closed', () => {
      logger.info('Window closed');
      this.window = null;
      mainWindow = null;
    });

    mainWindow = this.window;
    return this.window;
  }

  /**
   * 设置应用菜单
   */
  private setupApplicationMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: '文件',
        submenu: [
          {
            label: '设置',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              logger.info('Settings menu clicked');
              // Navigate to settings page
            },
          },
          { type: 'separator' },
          {
            label: '退出',
            accelerator: 'CmdOrCtrl+Q',
            click: () => {
              app.quit();
            },
          },
        ],
      },
      {
        label: '编辑',
        submenu: [
          { role: 'undo', label: '撤销' },
          { role: 'redo', label: '重做' },
          { type: 'separator' },
          { role: 'cut', label: '剪切' },
          { role: 'copy', label: '复制' },
          { role: 'paste', label: '粘贴' },
          { role: 'selectAll', label: '全选' },
        ],
      },
      {
        label: '视图',
        submenu: [
          { role: 'reload', label: '重新加载' },
          { role: 'forceReload', label: '强制重新加载' },
          { role: 'toggleDevTools', label: '开发者工具' },
          { type: 'separator' },
          { role: 'resetZoom', label: '实际大小' },
          { role: 'zoomIn', label: '放大' },
          { role: 'zoomOut', label: '缩小' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: '全屏' },
        ],
      },
      {
        label: '帮助',
        submenu: [
          {
            label: '关于',
            click: () => {
              logger.info('About menu clicked');
            },
          },
          {
            label: '查看日志',
            click: () => {
              shell.openPath(logger.getLogPath());
              logger.info('Opening logs folder');
            },
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    
    // Windows 平台隐藏菜单栏
    if (process.platform === 'win32') {
      Menu.setApplicationMenu(null);
      logger.info('Application menu hidden on Windows');
    } else {
      logger.info('Application menu set');
    }
  }

  /**
   * 获取主窗口实例
   */
  getMainWindow(): BrowserWindow | null {
    return this.window;
  }

  /**
   * 聚焦主窗口
   */
  focusMainWindow(): void {
    if (this.window) {
      if (this.window.isMinimized()) {
        this.window.restore();
      }
      if (!this.window.isVisible()) {
        this.window.show();
      }
      this.window.focus();
      logger.info('Main window focused');
    }
  }

  /**
   * 处理窗口大小变化，动态调整缩放因子
   */
  private handleWindowResize(): void {
    if (!this.window || this.window.isDestroyed()) return;
    
    try {
      const [width, height] = this.window.getSize();
      const newZoomFactor = this.calculateZoomFactor(width, height);
      
      if (this.window.webContents) {
        this.window.webContents.setZoomFactor(newZoomFactor);
        logger.info(`Window resized to ${width}x${height}, new zoomFactor: ${newZoomFactor}`);
      }
    } catch (error) {
      logger.error('Failed to handle window resize:', error);
    }
  }

  /**
   * 处理显示器变化（窗口移动到不同 DPI 的显示器）
   */
  private handleDisplayChange(): void {
    if (!this.window || this.window.isDestroyed()) return;
    
    try {
      const bounds = this.window.getBounds();
      const currentDisplay = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
      const { width, height } = currentDisplay.workAreaSize;
      
      // 重新计算缩放因子
      const newZoomFactor = this.calculateZoomFactor(width, height);
      
      logger.info(`Display changed, workArea: ${width}x${height}, new zoomFactor: ${newZoomFactor}`);
      
      if (this.window.webContents) {
        this.window.webContents.setZoomFactor(newZoomFactor);
      }
    } catch (error) {
      logger.error('Failed to handle display change:', error);
    }
  }

  /**
   * 处理应用退出
   */
  handleAppQuit(): void {
    logger.info('Application quitting...');
    
    // 停止任务队列
    try {
      taskQueue.stop();
      logger.info('Task queue stopped');
    } catch (error) {
      logger.error('Failed to stop task queue:', error);
    }
    
    // 导入并强制关闭浏览器
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { browserAutomationService } = require('./publishing/browser');
        if (browserAutomationService) {
            browserAutomationService.forceCloseBrowser().catch((err: Error) => {
                logger.error('Failed to force close browser:', err);
            });
            logger.info('Browser force close initiated');
        }
      } catch (err) {
        logger.error('Failed to load browser service for cleanup:', err);
      }
    
    // 导入并断开 WebSocket 连接
      try {
        if (wsManager) {
            wsManager.disconnect();
            logger.info('WebSocket disconnected');
        }
      } catch (error) {
        logger.error('Failed to disconnect WebSocket:', error);
      }
    
    // 导入并断开用户管理 WebSocket 连接
      try {
        if (userWsManager) {
            userWsManager.disconnect();
            logger.info('User WebSocket disconnected');
        }
      } catch (error) {
        logger.error('Failed to disconnect User WebSocket:', error);
      }
    
    // 清理资源
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
    mainWindow = null;
    
    // 清理崩溃恢复状态
    crashRecovery.clearState();
    
    logger.info('Application cleanup completed');
  }

  /**
   * 初始化WebSocket连接
   * Requirements: 1.1, 1.2, 4.1, 6.4
   */
  private async initializeWebSocket(): Promise<void> {
    try {
      logger.info('Initializing WebSocket connection...');
      
      // 获取配置
      const config = await storageManager.getConfig();
      
      if (!config || !config.serverUrl) {
        logger.warn('No server URL configured, skipping WebSocket initialization');
        return;
      }
      
      // 获取认证令牌
      const tokens = await storageManager.getTokens();
      
      if (!tokens?.authToken) {
        logger.warn('No access token available, skipping WebSocket initialization');
        return;
      }
      
      // 派生WebSocket URL
      const wsUrl = this.deriveWebSocketUrl(config.serverUrl);
      
      // 初始化WebSocket管理器
      await wsManager.initialize({
        serverUrl: wsUrl,
        token: tokens.authToken
      });
      
      logger.info('WebSocket connection initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WebSocket connection:', error);
      // 不抛出错误，允许应用继续运行（降级到手动刷新模式）
    }
  }

  /**
   * 初始化用户管理WebSocket连接
   * Requirements: 7.1, 7.2, 7.3, 7.5
   */
  private async initializeUserWebSocket(): Promise<void> {
    try {
      logger.info('Initializing User WebSocket connection...');
      
      // 获取配置
      const config = await storageManager.getConfig();
      
      if (!config || !config.serverUrl) {
        logger.warn('No server URL configured, skipping User WebSocket initialization');
        return;
      }
      
      // 获取认证令牌
      const tokens = await storageManager.getTokens();
      
      if (!tokens?.authToken) {
        logger.warn('No access token available, skipping User WebSocket initialization');
        return;
      }
      
      // 派生WebSocket URL
      const wsUrl = UserWebSocketManager.deriveWebSocketUrl(config.serverUrl);
      
      // Set main window reference
      if (this.window) {
        userWsManager.setMainWindow(this.window);
      }
      
      // 初始化用户管理WebSocket管理器
      await userWsManager.initialize({
        serverUrl: wsUrl,
        token: tokens.authToken
      });
      
      logger.info('User WebSocket connection initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize User WebSocket connection:', error);
      // 不抛出错误，允许应用继续运行
    }
  }

  /**
   * 派生WebSocket URL从HTTP URL
   * Requirements: 6.1, 6.2, 6.3
   */
  private deriveWebSocketUrl(httpUrl: string): string {
    return WebSocketManager.deriveWebSocketUrl(httpUrl);
  }

  /**
   * 初始化自动更新器
   */
  private initializeAutoUpdater(): void {
    try {
      logger.info('Initializing auto updater...');
      
      const autoUpdater = AutoUpdater.getInstance();
      
      // 设置主窗口引用
      if (this.window) {
        autoUpdater.setMainWindow(this.window);
      }
      
      // 设置更新服务器 URL（腾讯云 COS）
      // 硬编码 URL，因为打包后的应用无法读取 .env 文件
      const updateServerUrl = 'https://geo-1301979637.cos.ap-shanghai.myqcloud.com/releases';
      autoUpdater.setFeedURL(updateServerUrl);
      logger.info(`Auto updater configured with URL: ${updateServerUrl}`);
      
      // 启动定期检查（每 24 小时）
      autoUpdater.startPeriodicCheck(24);
      
      logger.info('Auto updater initialized');
    } catch (error) {
      logger.error('Failed to initialize auto updater:', error);
      // 不抛出错误，允许应用继续运行
    }
  }

  /**
   * 初始化任务队列
   * 本地发布模块 - 设置主窗口引用并启动任务队列
   */
  private initializeTaskQueue(): void {
    try {
      logger.info('Initializing task queue...');
      
      // 设置主窗口引用（用于发送 IPC 消息）
      if (this.window) {
        taskQueue.setMainWindow(this.window);
      }
      
      // 启动任务队列（自动检查和执行待处理任务）
      taskQueue.start();
      
      logger.info('✅ Task queue initialized and started');
    } catch (error) {
      logger.error('Failed to initialize task queue:', error);
      // 不抛出错误，允许应用继续运行
    }
  }

  /**
   * 检查窗口是否存在
   */
  hasWindow(): boolean {
    return this.window !== null && !this.window.isDestroyed();
  }
}

// 创建应用管理器实例
const appManager = new ApplicationManager();

// 初始化应用
appManager.initialize().catch((error) => {
  logger.error('Failed to initialize application:', error);
  app.quit();
});

// 导出以供其他模块使用
export { appManager, ApplicationManager };
