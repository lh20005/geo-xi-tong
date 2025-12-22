import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { ipcHandler } from './ipc/handler';
import { Logger } from './logger/logger';
import { ErrorHandler } from './error/handler';
import { CrashRecovery } from './crash/recovery';
import { CertificateValidator } from './security/certificate';
import { ContentSecurityPolicy } from './security/csp';

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
      ipcHandler.registerHandlers();
      
      // 设置应用菜单
      this.setupApplicationMenu();
      
      // 创建主窗口
      this.createMainWindow();
      
      // 初始化崩溃恢复
      if (this.window) {
        crashRecovery.initialize(this.window);
      }
      
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

  /**
   * 创建主窗口
   */
  createMainWindow(): BrowserWindow {
    logger.info('Creating main window...');
    
    // 创建窗口配置
    const windowConfig = {
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: '平台登录管理器',
      backgroundColor: '#ffffff',
      icon: process.platform === 'win32' 
        ? path.join(__dirname, '../build/icon.ico')
        : undefined,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      show: false, // 等待ready-to-show事件
      frame: true, // 使用原生窗口框架
      titleBarStyle: 'default' as const,
    };

    this.window = new BrowserWindow(windowConfig);

    // 窗口准备好后显示
    this.window.once('ready-to-show', () => {
      if (this.window) {
        this.window.show();
        logger.info('Main window shown');
      }
    });

    // 加载应用
    const loadApp = async () => {
      if (!this.window) return;

      try {
        if (process.env.NODE_ENV === 'development') {
          await this.window.loadURL('http://localhost:5174');
          this.window.webContents.openDevTools();
          logger.info('Loaded development URL');
        } else {
          const indexPath = path.join(__dirname, '../dist/index.html');
          await this.window.loadFile(indexPath);
          logger.info('Loaded production file');
        }
      } catch (error) {
        logger.error('Failed to load app:', error);
      }
    };

    loadApp();

    // 窗口关闭事件
    this.window.on('close', (event) => {
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
              const { shell } = require('electron');
              shell.openPath(logger.getLogPath());
              logger.info('Opening logs folder');
            },
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    logger.info('Application menu set');
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
   * 处理应用退出
   */
  handleAppQuit(): void {
    logger.info('Application quitting...');
    
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
