"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationManager = exports.appManager = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const handler_1 = require("./ipc/handler");
const logger_1 = require("./logger/logger");
const handler_2 = require("./error/handler");
const recovery_1 = require("./crash/recovery");
const certificate_1 = require("./security/certificate");
const csp_1 = require("./security/csp");
const manager_1 = require("./websocket/manager");
const userManager_1 = require("./websocket/userManager");
const manager_2 = require("./storage/manager");
const auto_updater_1 = require("./updater/auto-updater");
const taskQueue_1 = require("./publishing/taskQueue");
// 初始化核心服务
const logger = logger_1.Logger.getInstance();
const errorHandler = handler_2.ErrorHandler.getInstance();
const crashRecovery = recovery_1.CrashRecovery.getInstance();
const certificateValidator = certificate_1.CertificateValidator.getInstance();
const csp = csp_1.ContentSecurityPolicy.getInstance();
let mainWindow = null;
/**
 * 应用管理器
 * 负责管理应用生命周期、窗口创建和管理
 * Requirements: 9.8, 10.5
 */
class ApplicationManager {
    constructor() {
        this.window = null;
        this.isQuitting = false;
        // 缩放管理相关
        this.targetZoomFactor = 1.0;
        this.zoomEnforceInterval = null;
        this.ZOOM_ENFORCE_INTERVAL_MS = 500; // 每 500ms 检查一次
        // 设计稿基准分辨率（按 1920x1080 设计）
        this.BASE_WIDTH = 1920;
        this.BASE_HEIGHT = 1080;
    }
    /**
     * 初始化应用程序
     */
    async initialize() {
        logger.info('Initializing application...');
        try {
            // 确保单实例运行
            const gotTheLock = electron_1.app.requestSingleInstanceLock();
            if (!gotTheLock) {
                logger.warn('Another instance is already running');
                electron_1.app.quit();
                return;
            }
            // 处理第二个实例启动
            electron_1.app.on('second-instance', () => {
                logger.info('Second instance detected, focusing main window');
                this.focusMainWindow();
            });
            // 等待应用准备就绪
            await electron_1.app.whenReady();
            logger.info('App is ready');
            // 清除 Electron 缓存的缩放设置（解决 Windows 上缩放被重置的问题）
            await this.clearZoomCache();
            // 初始化安全功能（需要在app ready之后）
            certificateValidator.initialize();
            csp.configure();
            // 注册IPC处理器
            await handler_1.ipcHandler.registerHandlers();
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
            electron_1.app.on('activate', () => {
                logger.info('App activated');
                if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                    this.createMainWindow();
                }
                else {
                    this.focusMainWindow();
                }
            });
            // 处理所有窗口关闭
            electron_1.app.on('window-all-closed', () => {
                logger.info('All windows closed');
                if (process.platform !== 'darwin') {
                    this.handleAppQuit();
                    electron_1.app.quit();
                }
            });
            // 处理应用退出前
            electron_1.app.on('before-quit', () => {
                logger.info('App is about to quit');
                this.isQuitting = true;
            });
            // 处理应用退出
            electron_1.app.on('will-quit', () => {
                this.handleAppQuit();
            });
            // 处理未捕获的异常
            process.on('uncaughtException', (error) => {
                logger.error('Uncaught exception:', error);
                const appError = errorHandler.wrapError(error, 'UNKNOWN');
                errorHandler.handleError(appError);
            });
            process.on('unhandledRejection', (reason) => {
                logger.error('Unhandled rejection:', reason);
                const appError = errorHandler.wrapError(reason, 'UNKNOWN');
                errorHandler.handleError(appError);
            });
            logger.info('Application initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize application:', error);
            throw error;
        }
    }
    /**
     * 清除 Electron 缓存的缩放设置
     * Electron 会在 Preferences 文件中缓存 per_host_zoom_levels，导致缩放设置被覆盖
     * 这个方法在应用启动时清除这些缓存
     */
    async clearZoomCache() {
        try {
            const userDataPath = electron_1.app.getPath('userData');
            const preferencesPath = path_1.default.join(userDataPath, 'Preferences');
            if (fs_1.default.existsSync(preferencesPath)) {
                const content = fs_1.default.readFileSync(preferencesPath, 'utf-8');
                const preferences = JSON.parse(content);
                // 清除 per_host_zoom_levels 缓存
                if (preferences.partition && preferences.partition.per_host_zoom_levels) {
                    preferences.partition.per_host_zoom_levels = {};
                    logger.info('Cleared per_host_zoom_levels from partition');
                }
                // 清除根级别的 per_host_zoom_levels
                if (preferences.per_host_zoom_levels) {
                    preferences.per_host_zoom_levels = {};
                    logger.info('Cleared root per_host_zoom_levels');
                }
                // 写回文件
                fs_1.default.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));
                logger.info('Zoom cache cleared successfully');
            }
        }
        catch (error) {
            // 如果清除失败，不影响应用启动
            logger.warn('Failed to clear zoom cache (non-critical):', error);
        }
    }
    /**
     * 计算缩放因子
     * 根据当前屏幕分辨率与设计稿基准分辨率的比例计算
     */
    calculateZoomFactor(width, height) {
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
    createMainWindow() {
        logger.info('Creating main window...');
        // 获取主显示器信息
        const primaryDisplay = electron_1.screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
        const displayScaleFactor = primaryDisplay.scaleFactor;
        logger.info(`Screen info: ${screenWidth}x${screenHeight}, displayScaleFactor: ${displayScaleFactor}`);
        // 计算页面缩放因子
        this.targetZoomFactor = this.calculateZoomFactor(screenWidth, screenHeight);
        logger.info(`Calculated targetZoomFactor: ${this.targetZoomFactor}`);
        // 创建窗口配置 - 不在 webPreferences 中设置 zoomFactor，避免被缓存
        const windowConfig = {
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            title: 'Ai智软精准GEO优化系统',
            backgroundColor: '#ffffff',
            icon: path_1.default.join(__dirname, '../build/icon.png'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                preload: path_1.default.join(__dirname, 'preload.js'),
                webviewTag: true,
                // 不设置 zoomFactor，避免被 Electron 缓存覆盖
            },
            show: false,
            frame: true,
            titleBarStyle: 'default',
        };
        this.window = new electron_1.BrowserWindow(windowConfig);
        // 窗口创建后立即最大化
        this.window.maximize();
        logger.info(`Main window created, targetZoomFactor: ${this.targetZoomFactor}`);
        // 窗口准备好后的回调
        this.window.once('ready-to-show', () => {
            logger.info('Window ready-to-show event fired');
            // 确保窗口是最大化的
            if (!this.window?.isMaximized()) {
                this.window?.maximize();
            }
            // 强制应用缩放因子
            this.enforceZoomFactor();
            // 显示窗口
            this.window?.show();
            // 启动缩放强制执行定时器
            this.startZoomEnforcement();
        });
        // 监听页面加载完成，重新应用缩放
        this.window.webContents.on('did-finish-load', () => {
            this.enforceZoomFactor();
        });
        // 监听 DOM 准备完成
        this.window.webContents.on('dom-ready', () => {
            this.enforceZoomFactor();
        });
        // 拦截缩放快捷键 (Ctrl+0, Ctrl+-, Ctrl+=, Ctrl++)
        this.window.webContents.on('before-input-event', (event, input) => {
            if (this.window?.webContents.isDestroyed())
                return;
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
        // 监听窗口获得焦点，重新应用缩放（解决从外部链接返回后缩放丢失的问题）
        this.window.on('focus', () => {
            this.enforceZoomFactor();
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
                }
                else {
                    const indexPath = path_1.default.join(__dirname, '../dist/index.html');
                    logger.info(`Attempting to load file: ${indexPath}`);
                    await this.window.loadFile(indexPath);
                    logger.info('Loaded production file successfully');
                }
            }
            catch (error) {
                logger.error('Failed to load app:', error);
                logger.error('Error details:', JSON.stringify(error, null, 2));
            }
        };
        loadApp().catch(err => {
            logger.error('Unhandled error in loadApp:', err);
        });
        // 窗口关闭事件
        this.window.on('close', (event) => {
            // 停止缩放强制执行
            this.stopZoomEnforcement();
            // 移除事件监听器，防止内存泄漏或销毁后访问
            if (this.window && !this.window.isDestroyed() && this.window.webContents) {
                this.window.webContents.removeAllListeners('did-finish-load');
                this.window.webContents.removeAllListeners('dom-ready');
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
            this.stopZoomEnforcement();
            this.window = null;
            mainWindow = null;
        });
        mainWindow = this.window;
        return this.window;
    }
    /**
     * 强制应用缩放因子
     * 这个方法会检查当前缩放是否正确，如果不正确则强制设置
     */
    enforceZoomFactor() {
        if (!this.window || this.window.isDestroyed())
            return;
        if (!this.window.webContents || this.window.webContents.isDestroyed())
            return;
        try {
            const currentZoom = this.window.webContents.getZoomFactor();
            const diff = Math.abs(currentZoom - this.targetZoomFactor);
            // 如果差异超过 0.01，则强制设置
            if (diff > 0.01) {
                this.window.webContents.setZoomFactor(this.targetZoomFactor);
                logger.info(`Enforced zoomFactor: ${currentZoom} -> ${this.targetZoomFactor}`);
            }
            // 禁用视觉缩放（捏合缩放）
            this.window.webContents.setVisualZoomLevelLimits(1, 1);
        }
        catch (error) {
            logger.error('Failed to enforce zoom factor:', error);
        }
    }
    /**
     * 启动缩放强制执行定时器
     * 定期检查并强制应用正确的缩放因子
     */
    startZoomEnforcement() {
        // 先停止已有的定时器
        this.stopZoomEnforcement();
        // 启动新的定时器
        this.zoomEnforceInterval = setInterval(() => {
            this.enforceZoomFactor();
        }, this.ZOOM_ENFORCE_INTERVAL_MS);
        logger.info('Zoom enforcement started');
    }
    /**
     * 停止缩放强制执行定时器
     */
    stopZoomEnforcement() {
        if (this.zoomEnforceInterval) {
            clearInterval(this.zoomEnforceInterval);
            this.zoomEnforceInterval = null;
            logger.info('Zoom enforcement stopped');
        }
    }
    /**
     * 设置应用菜单
     */
    setupApplicationMenu() {
        const template = [
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
                            electron_1.app.quit();
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
                    // 移除缩放选项，防止用户手动更改缩放
                    // { role: 'resetZoom', label: '实际大小' },
                    // { role: 'zoomIn', label: '放大' },
                    // { role: 'zoomOut', label: '缩小' },
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
                            electron_1.shell.openPath(logger.getLogPath());
                            logger.info('Opening logs folder');
                        },
                    },
                ],
            },
        ];
        const menu = electron_1.Menu.buildFromTemplate(template);
        electron_1.Menu.setApplicationMenu(menu);
        // Windows 平台隐藏菜单栏
        if (process.platform === 'win32') {
            electron_1.Menu.setApplicationMenu(null);
            logger.info('Application menu hidden on Windows');
        }
        else {
            logger.info('Application menu set');
        }
    }
    /**
     * 获取主窗口实例
     */
    getMainWindow() {
        return this.window;
    }
    /**
     * 聚焦主窗口
     */
    focusMainWindow() {
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
    handleWindowResize() {
        if (!this.window || this.window.isDestroyed())
            return;
        try {
            const [width, height] = this.window.getSize();
            const newZoomFactor = this.calculateZoomFactor(width, height);
            // 更新目标缩放因子
            this.targetZoomFactor = newZoomFactor;
            // 立即应用
            this.enforceZoomFactor();
            logger.info(`Window resized to ${width}x${height}, new targetZoomFactor: ${newZoomFactor}`);
        }
        catch (error) {
            logger.error('Failed to handle window resize:', error);
        }
    }
    /**
     * 处理显示器变化（窗口移动到不同 DPI 的显示器）
     */
    handleDisplayChange() {
        if (!this.window || this.window.isDestroyed())
            return;
        try {
            const bounds = this.window.getBounds();
            const currentDisplay = electron_1.screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
            const { width, height } = currentDisplay.workAreaSize;
            // 重新计算缩放因子
            const newZoomFactor = this.calculateZoomFactor(width, height);
            // 更新目标缩放因子
            this.targetZoomFactor = newZoomFactor;
            logger.info(`Display changed, workArea: ${width}x${height}, new targetZoomFactor: ${newZoomFactor}`);
            // 立即应用
            this.enforceZoomFactor();
        }
        catch (error) {
            logger.error('Failed to handle display change:', error);
        }
    }
    /**
     * 处理应用退出
     */
    handleAppQuit() {
        logger.info('Application quitting...');
        // 停止缩放强制执行
        this.stopZoomEnforcement();
        // 停止任务队列
        try {
            taskQueue_1.taskQueue.stop();
            logger.info('Task queue stopped');
        }
        catch (error) {
            logger.error('Failed to stop task queue:', error);
        }
        // 导入并强制关闭浏览器
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { browserAutomationService } = require('./publishing/browser');
            if (browserAutomationService) {
                browserAutomationService.forceCloseBrowser().catch((err) => {
                    logger.error('Failed to force close browser:', err);
                });
                logger.info('Browser force close initiated');
            }
        }
        catch (err) {
            logger.error('Failed to load browser service for cleanup:', err);
        }
        // 导入并断开 WebSocket 连接
        try {
            if (manager_1.wsManager) {
                manager_1.wsManager.disconnect();
                logger.info('WebSocket disconnected');
            }
        }
        catch (error) {
            logger.error('Failed to disconnect WebSocket:', error);
        }
        // 导入并断开用户管理 WebSocket 连接
        try {
            if (userManager_1.userWsManager) {
                userManager_1.userWsManager.disconnect();
                logger.info('User WebSocket disconnected');
            }
        }
        catch (error) {
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
    async initializeWebSocket() {
        try {
            logger.info('Initializing WebSocket connection...');
            // 获取配置
            const config = await manager_2.storageManager.getConfig();
            if (!config || !config.serverUrl) {
                logger.warn('No server URL configured, skipping WebSocket initialization');
                return;
            }
            // 获取认证令牌
            const tokens = await manager_2.storageManager.getTokens();
            if (!tokens?.authToken) {
                logger.warn('No access token available, skipping WebSocket initialization');
                return;
            }
            // 派生WebSocket URL
            const wsUrl = this.deriveWebSocketUrl(config.serverUrl);
            // 初始化WebSocket管理器
            await manager_1.wsManager.initialize({
                serverUrl: wsUrl,
                token: tokens.authToken
            });
            logger.info('WebSocket connection initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize WebSocket connection:', error);
            // 不抛出错误，允许应用继续运行（降级到手动刷新模式）
        }
    }
    /**
     * 初始化用户管理WebSocket连接
     * Requirements: 7.1, 7.2, 7.3, 7.5
     */
    async initializeUserWebSocket() {
        try {
            logger.info('Initializing User WebSocket connection...');
            // 获取配置
            const config = await manager_2.storageManager.getConfig();
            if (!config || !config.serverUrl) {
                logger.warn('No server URL configured, skipping User WebSocket initialization');
                return;
            }
            // 获取认证令牌
            const tokens = await manager_2.storageManager.getTokens();
            if (!tokens?.authToken) {
                logger.warn('No access token available, skipping User WebSocket initialization');
                return;
            }
            // 派生WebSocket URL
            const wsUrl = userManager_1.UserWebSocketManager.deriveWebSocketUrl(config.serverUrl);
            // Set main window reference
            if (this.window) {
                userManager_1.userWsManager.setMainWindow(this.window);
            }
            // 初始化用户管理WebSocket管理器
            await userManager_1.userWsManager.initialize({
                serverUrl: wsUrl,
                token: tokens.authToken
            });
            logger.info('User WebSocket connection initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize User WebSocket connection:', error);
            // 不抛出错误，允许应用继续运行
        }
    }
    /**
     * 派生WebSocket URL从HTTP URL
     * Requirements: 6.1, 6.2, 6.3
     */
    deriveWebSocketUrl(httpUrl) {
        return manager_1.WebSocketManager.deriveWebSocketUrl(httpUrl);
    }
    /**
     * 初始化自动更新器
     */
    initializeAutoUpdater() {
        try {
            logger.info('Initializing auto updater...');
            const autoUpdater = auto_updater_1.AutoUpdater.getInstance();
            // 设置主窗口引用
            if (this.window) {
                autoUpdater.setMainWindow(this.window);
            }
            // 设置更新服务器 URL（服务器自托管）
            // 硬编码 URL，因为打包后的应用无法读取 .env 文件
            const updateServerUrl = 'https://www.jzgeo.cc/releases';
            autoUpdater.setFeedURL(updateServerUrl);
            logger.info(`Auto updater configured with URL: ${updateServerUrl}`);
            // 启动定期检查（每 24 小时）
            autoUpdater.startPeriodicCheck(24);
            logger.info('Auto updater initialized');
        }
        catch (error) {
            logger.error('Failed to initialize auto updater:', error);
            // 不抛出错误，允许应用继续运行
        }
    }
    /**
     * 初始化任务队列
     * 本地发布模块 - 设置主窗口引用并启动任务队列
     */
    initializeTaskQueue() {
        try {
            logger.info('Initializing task queue...');
            // 设置主窗口引用（用于发送 IPC 消息）
            if (this.window) {
                taskQueue_1.taskQueue.setMainWindow(this.window);
            }
            // 启动任务队列（自动检查和执行待处理任务）
            taskQueue_1.taskQueue.start();
            logger.info('✅ Task queue initialized and started');
        }
        catch (error) {
            logger.error('Failed to initialize task queue:', error);
            // 不抛出错误，允许应用继续运行
        }
    }
    /**
     * 检查窗口是否存在
     */
    hasWindow() {
        return this.window !== null && !this.window.isDestroyed();
    }
}
exports.ApplicationManager = ApplicationManager;
// 创建应用管理器实例
const appManager = new ApplicationManager();
exports.appManager = appManager;
// 初始化应用
appManager.initialize().catch((error) => {
    logger.error('Failed to initialize application:', error);
    electron_1.app.quit();
});
