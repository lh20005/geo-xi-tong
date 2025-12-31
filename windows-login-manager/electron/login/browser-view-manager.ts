import { BrowserView, BrowserWindow, session } from 'electron';
import log from 'electron-log';

/**
 * BrowserView管理器
 * 负责创建、配置和管理BrowserView用于平台登录
 * Requirements: 13.1, 13.2
 */

interface BrowserViewConfig {
  url: string;
  partition?: string;
  userAgent?: string;
}

class BrowserViewManager {
  private static instance: BrowserViewManager;
  private currentView: BrowserView | null = null;
  private parentWindow: BrowserWindow | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): BrowserViewManager {
    if (!BrowserViewManager.instance) {
      BrowserViewManager.instance = new BrowserViewManager();
    }
    return BrowserViewManager.instance;
  }

  /**
   * 创建BrowserView
   * Requirements: 13.1, 13.2
   */
  async createBrowserView(
    parentWindow: BrowserWindow,
    config: BrowserViewConfig
  ): Promise<BrowserView> {
    try {
      // 如果已存在BrowserView，先销毁
      if (this.currentView) {
        await this.destroyBrowserView();
      }

      this.parentWindow = parentWindow;

      // 创建独立的session（可选）
      const viewSession = config.partition
        ? session.fromPartition(config.partition)
        : session.defaultSession;

      // 配置BrowserView
      this.currentView = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          javascript: true,
          images: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
          session: viewSession,
        },
      });

      // 设置User Agent（如果提供）
      if (config.userAgent) {
        this.currentView.webContents.setUserAgent(config.userAgent);
      }

      // 配置安全策略
      this.setupSecurityPolicies(this.currentView);

      // 设置BrowserView到父窗口
      parentWindow.setBrowserView(this.currentView);

      // 设置BrowserView的位置和大小
      this.resizeBrowserView();

      // 监听窗口事件 - 手动调整 BrowserView 尺寸
      // 注意：setAutoResize() 在 maximize/unmaximize 时有 bug，所以我们手动处理
      parentWindow.on('resize', () => {
        log.debug('Window resize event');
        this.resizeBrowserView();
      });

      parentWindow.on('maximize', () => {
        log.debug('Window maximize event');
        // 使用 setImmediate 确保窗口已经完成最大化
        setImmediate(() => {
          this.resizeBrowserView();
        });
      });

      parentWindow.on('unmaximize', () => {
        log.debug('Window unmaximize event');
        // 使用 setImmediate 确保窗口已经完成取消最大化
        setImmediate(() => {
          this.resizeBrowserView();
        });
      });

      parentWindow.on('enter-full-screen', () => {
        log.debug('Window enter-full-screen event');
        setImmediate(() => {
          this.resizeBrowserView();
        });
      });

      parentWindow.on('leave-full-screen', () => {
        log.debug('Window leave-full-screen event');
        setImmediate(() => {
          this.resizeBrowserView();
        });
      });

      // 在主窗口中注入工具栏
      this.injectToolbar(parentWindow);

      // 加载URL
      await this.currentView.webContents.loadURL(config.url);

      // 使用多个时机注入全屏样式，确保生效
      
      // 时机1: 页面开始加载时（最早）
      this.currentView.webContents.on('did-start-loading', () => {
        log.debug('Page started loading, pre-injecting fullscreen styles...');
        setTimeout(() => {
          this.injectFullscreenStyles();
        }, 50);
      });

      // 时机2: DOM加载完成时
      this.currentView.webContents.on('dom-ready', () => {
        log.debug('DOM ready, injecting fullscreen styles...');
        setTimeout(() => {
          this.injectFullscreenStyles();
        }, 50);
      });

      // 时机3: 页面完全加载完成时
      this.currentView.webContents.on('did-finish-load', () => {
        log.debug('Page loaded, injecting fullscreen styles...');
        setTimeout(() => {
          this.injectFullscreenStyles();
        }, 100);
        // 再延迟一次，确保动态内容也被处理
        setTimeout(() => {
          this.injectFullscreenStyles();
        }, 500);
      });

      // 时机4: 页面导航时
      this.currentView.webContents.on('did-navigate', () => {
        log.debug('Page navigated, re-injecting fullscreen styles...');
        setTimeout(() => {
          this.injectFullscreenStyles();
        }, 100);
      });

      // 时机5: 立即注入一次
      setTimeout(() => {
        this.injectFullscreenStyles();
      }, 100);

      log.info(`BrowserView created and loaded: ${config.url}`);
      return this.currentView;
    } catch (error) {
      log.error('Failed to create BrowserView:', error);
      throw error;
    }
  }

  /**
   * 在主窗口中注入工具栏
   */
  private injectToolbar(parentWindow: BrowserWindow): void {
    // 注入到主窗口
    parentWindow.webContents.executeJavaScript(`
      (function() {
        // 移除旧的工具栏（如果存在）
        const oldToolbar = document.getElementById('browser-toolbar');
        if (oldToolbar) {
          oldToolbar.remove();
        }
        
        // 创建工具栏容器
        const toolbar = document.createElement('div');
        toolbar.id = 'browser-toolbar';
        toolbar.style.cssText = \`
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 50px;
          background: linear-gradient(to bottom, #f5f5f5, #e8e8e8);
          border-bottom: 1px solid #ccc;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 15px;
          z-index: 999999;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        \`;
        
        // 创建左侧状态区域
        const statusDiv = document.createElement('div');
        statusDiv.style.cssText = \`
          display: flex;
          align-items: center;
          gap: 10px;
          color: #333;
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        \`;
        
        // 添加图标
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('width', '20');
        icon.setAttribute('height', '20');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', 'currentColor');
        icon.setAttribute('stroke-width', '2');
        icon.innerHTML = '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>';
        
        const statusText = document.createElement('span');
        statusText.textContent = '正在登录平台...';
        
        statusDiv.appendChild(icon);
        statusDiv.appendChild(statusText);
        
        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-browser-btn';
        closeBtn.textContent = '✕ 关闭浏览器';
        closeBtn.style.cssText = \`
          background: #ff4444;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        \`;
        
        // 添加悬停效果
        closeBtn.addEventListener('mouseenter', function() {
          this.style.background = '#ff6666';
          this.style.transform = 'translateY(-1px)';
          this.style.boxShadow = '0 3px 6px rgba(0,0,0,0.3)';
        });
        
        closeBtn.addEventListener('mouseleave', function() {
          this.style.background = '#ff4444';
          this.style.transform = 'translateY(0)';
          this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        });
        
        // 添加点击事件 - 触发前端的取消按钮
        closeBtn.addEventListener('click', function() {
          console.log('Close browser button clicked');
          
          // 方法1: 尝试触发前端的取消按钮
          const cancelBtn = document.querySelector('.cancel-btn');
          if (cancelBtn) {
            console.log('Triggering frontend cancel button');
            cancelBtn.click();
          } else {
            console.log('Frontend cancel button not found, calling API directly');
            // 方法2: 如果找不到前端按钮，直接调用 API
            if (window.electronAPI && window.electronAPI.cancelLogin) {
              window.electronAPI.cancelLogin()
                .then(() => {
                  console.log('Cancel login called successfully');
                  // 手动移除工具栏
                  const toolbar = document.getElementById('browser-toolbar');
                  if (toolbar) {
                    toolbar.remove();
                  }
                })
                .catch(err => console.error('Cancel login failed:', err));
            } else {
              console.error('electronAPI.cancelLogin is not available');
            }
          }
        });
        
        // 组装工具栏
        toolbar.appendChild(statusDiv);
        toolbar.appendChild(closeBtn);
        document.body.appendChild(toolbar);
        
        console.log('Browser toolbar injected successfully');
      })();
    `).catch(err => {
      log.error('Failed to inject toolbar:', err);
    });

    log.info('Toolbar injected into main window');
  }

  /**
   * 移除工具栏
   */
  private removeToolbar(parentWindow: BrowserWindow): void {
    if (!parentWindow || parentWindow.isDestroyed()) {
      return;
    }

    parentWindow.webContents.executeJavaScript(`
      (function() {
        const toolbar = document.getElementById('browser-toolbar');
        if (toolbar) {
          toolbar.remove();
        }
      })();
    `).catch(err => {
      log.debug('Failed to remove toolbar (window may be closed):', err);
    });

    log.info('Toolbar removed from main window');
  }

  /**
   * 设置安全策略
   * Requirements: 11.7, 11.8
   */
  private setupSecurityPolicies(view: BrowserView): void {
    // 设置Content Security Policy
    view.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';",
          ],
        },
      });
    });

    // 监听新窗口请求
    view.webContents.setWindowOpenHandler(({ url }) => {
      log.info(`Blocked new window request: ${url}`);
      // 阻止打开新窗口，在当前view中加载
      view.webContents.loadURL(url);
      return { action: 'deny' };
    });

    // 监听导航
    view.webContents.on('will-navigate', (event, url) => {
      log.debug(`Navigating to: ${url}`);
    });

    // 监听页面加载完成
    view.webContents.on('did-finish-load', () => {
      log.debug('Page loaded');
    });

    // 监听页面加载失败
    view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      log.error(`Page load failed: ${errorCode} - ${errorDescription} - ${validatedURL}`);
    });

    // 监听控制台消息（调试用）
    view.webContents.on('console-message', (event, level, message, line, sourceId) => {
      log.debug(`Console [${level}]: ${message}`);
    });

    log.info('Security policies configured for BrowserView');
  }

  /**
   * 注入全屏样式 - 强制页面内容全屏显示
   * 使用insertCSS API，优先级更高
   */
  private injectFullscreenStyles(): void {
    if (!this.currentView || this.currentView.webContents.isDestroyed()) {
      return;
    }

    // 第一步：设置缩放为1.0
    this.currentView.webContents.setZoomFactor(1.0);
    log.info('Set zoom factor to 1.0 for native display');

    // 第二步：使用insertCSS注入样式（优先级更高）
    const fullscreenCSS = `
      /* 强制html和body全屏 */
      html {
        width: 100vw !important;
        height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: auto !important;
        box-sizing: border-box !important;
      }
      
      body {
        width: 100vw !important;
        min-height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: auto !important;
        box-sizing: border-box !important;
      }
      
      /* 强制所有顶层元素全屏 */
      body > div,
      body > main,
      body > section,
      body > article {
        width: 100% !important;
        min-width: 100% !important;
        max-width: 100vw !important;
        box-sizing: border-box !important;
      }
      
      /* 针对常见容器ID和类 */
      #app, #root, #__next, #__nuxt,
      .app, .root, .container, .wrapper, .main, .content,
      [class*="App"], [class*="Root"], [class*="Container"],
      [class*="Wrapper"], [class*="Main"], [class*="Content"] {
        width: 100% !important;
        min-width: 100% !important;
        max-width: 100vw !important;
        box-sizing: border-box !important;
      }
      
      /* 隐藏滚动条 */
      * {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      
      *::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      
      /* 确保所有元素使用border-box */
      * {
        box-sizing: border-box !important;
      }
    `;

    // 使用insertCSS API注入（优先级更高，不会被页面覆盖）
    this.currentView.webContents.insertCSS(fullscreenCSS).then(() => {
      log.info('✅ Fullscreen CSS inserted successfully via insertCSS API');
    }).catch(err => {
      log.error('❌ Failed to insert CSS:', err);
    });

    // 第三步：同时使用JavaScript强制修改样式（双保险）
    this.currentView.webContents.executeJavaScript(`
      (function() {
        console.log('='.repeat(80));
        console.log('🔥 [BrowserView FULLSCREEN] Starting injection...');
        console.log('🔥 [BrowserView FULLSCREEN] Current viewport:', window.innerWidth, 'x', window.innerHeight);
        console.log('='.repeat(80));
        
        // 强制修改html和body的样式
        if (document.documentElement) {
          document.documentElement.style.width = '100vw';
          document.documentElement.style.height = '100vh';
          document.documentElement.style.margin = '0';
          document.documentElement.style.padding = '0';
          document.documentElement.style.overflow = 'auto';
        }
        
        if (document.body) {
          document.body.style.width = '100vw';
          document.body.style.minHeight = '100vh';
          document.body.style.margin = '0';
          document.body.style.padding = '0';
          document.body.style.overflow = 'auto';
        }
        
        console.log('✅ [BrowserView FULLSCREEN] Inline styles applied');
        
        // 延迟处理固定宽度元素
        setTimeout(() => {
          try {
            let fixedCount = 0;
            const allElements = document.querySelectorAll('*');
            
            allElements.forEach(el => {
              const computed = window.getComputedStyle(el);
              const width = parseInt(computed.width);
              
              if (width > 0 && width < window.innerWidth * 0.9) {
                el.style.width = '100%';
                el.style.maxWidth = '100vw';
                fixedCount++;
              }
            });
            
            console.log('✅ [BrowserView FULLSCREEN] Fixed', fixedCount, 'elements with fixed width');
          } catch (e) {
            console.warn('⚠️ [BrowserView FULLSCREEN] Failed to fix widths:', e);
          }
        }, 100);
        
        // 触发重排
        document.body.offsetHeight;
        window.dispatchEvent(new Event('resize'));
        
        console.log('='.repeat(80));
        console.log('✅ [BrowserView FULLSCREEN] Injection completed!');
        console.log('✅ [BrowserView FULLSCREEN] Final viewport:', window.innerWidth, 'x', window.innerHeight);
        console.log('✅ [BrowserView FULLSCREEN] Body size:', document.body.offsetWidth, 'x', document.body.offsetHeight);
        console.log('='.repeat(80));
        
        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          bodySize: { width: document.body.offsetWidth, height: document.body.offsetHeight },
          htmlSize: { width: document.documentElement.offsetWidth, height: document.documentElement.offsetHeight }
        };
      })();
    `).then(result => {
      log.info('✅ Fullscreen JavaScript executed successfully:', JSON.stringify(result));
    }).catch(err => {
      log.error('❌ Failed to execute fullscreen JavaScript:', err);
    });
  }

  /**
   * 调整BrowserView大小
   */
  private resizeBrowserView(): void {
    if (!this.currentView || !this.parentWindow) {
      log.warn('Cannot resize: currentView or parentWindow is null');
      return;
    }

    // 获取窗口的内容区域尺寸
    const [width, height] = this.parentWindow.getContentSize();
    const windowBounds = this.parentWindow.getBounds();
    
    // 打印调试信息
    log.info('=== BrowserView Resize Debug ===');
    log.info(`Window bounds: ${JSON.stringify(windowBounds)}`);
    log.info(`Content size: ${width} x ${height}`);
    log.info(`Window maximized: ${this.parentWindow.isMaximized()}`);
    log.info(`Window fullscreen: ${this.parentWindow.isFullScreen()}`);
    
    // 留出顶部50px空间用于显示控制栏（包含关闭按钮）
    const toolbarHeight = 50;
    
    const viewBounds = {
      x: 0,
      y: toolbarHeight,
      width: width,
      height: height - toolbarHeight,
    };
    
    log.info(`Setting BrowserView bounds: ${JSON.stringify(viewBounds)}`);
    
    // 手动设置 BrowserView 尺寸
    // 注意：不使用 setAutoResize()，因为它在 maximize/unmaximize 时有 bug
    // 我们通过监听窗口事件来手动调整尺寸
    this.currentView.setBounds(viewBounds);
    
    // 重新注入全屏样式和调整缩放
    this.injectFullscreenStyles();
    
    log.info(`BrowserView resized successfully`);
    log.info('================================');
  }

  /**
   * 调整BrowserView大小（自定义）
   */
  setCustomBounds(x: number, y: number, width: number, height: number): void {
    if (!this.currentView) {
      return;
    }

    this.currentView.setBounds({ x, y, width, height });
    log.debug(`BrowserView custom bounds set: ${x},${y} ${width}x${height}`);
  }

  /**
   * 获取当前BrowserView
   */
  getCurrentView(): BrowserView | null {
    return this.currentView;
  }

  /**
   * 导航到URL
   */
  async navigateTo(url: string): Promise<void> {
    if (!this.currentView) {
      throw new Error('No BrowserView available');
    }

    try {
      await this.currentView.webContents.loadURL(url);
      log.info(`Navigated to: ${url}`);
    } catch (error) {
      log.error('Navigation failed:', error);
      throw error;
    }
  }

  /**
   * 执行JavaScript代码
   */
  async executeJavaScript<T>(code: string): Promise<T> {
    if (!this.currentView) {
      throw new Error('No BrowserView available');
    }

    try {
      const result = await this.currentView.webContents.executeJavaScript(code);
      return result as T;
    } catch (error) {
      log.error('JavaScript execution failed:', error);
      throw error;
    }
  }

  /**
   * 获取当前URL
   */
  getCurrentURL(): string | null {
    if (!this.currentView) {
      return null;
    }

    return this.currentView.webContents.getURL();
  }

  /**
   * 获取页面标题
   */
  getPageTitle(): string | null {
    if (!this.currentView) {
      return null;
    }

    return this.currentView.webContents.getTitle();
  }

  /**
   * 等待页面加载完成
   */
  async waitForLoad(timeout: number = 30000): Promise<void> {
    if (!this.currentView) {
      throw new Error('No BrowserView available');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Page load timeout'));
      }, timeout);

      this.currentView!.webContents.once('did-finish-load', () => {
        clearTimeout(timer);
        resolve();
      });

      this.currentView!.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        clearTimeout(timer);
        reject(new Error(`Page load failed: ${errorDescription}`));
      });
    });
  }

  /**
   * 等待特定元素出现
   */
  async waitForElement(selector: string, timeout: number = 10000): Promise<boolean> {
    if (!this.currentView) {
      throw new Error('No BrowserView available');
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const exists = await this.executeJavaScript<boolean>(
          `!!document.querySelector('${selector}')`
        );

        if (exists) {
          log.debug(`Element found: ${selector}`);
          return true;
        }
      } catch (error) {
        // 继续等待
      }

      // 等待100ms后重试
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    log.warn(`Element not found after ${timeout}ms: ${selector}`);
    return false;
  }

  /**
   * 清除BrowserView数据
   */
  async clearData(): Promise<void> {
    if (!this.currentView) {
      return;
    }

    try {
      const viewSession = this.currentView.webContents.session;
      
      // 清除缓存
      await viewSession.clearCache();
      
      // 清除存储数据
      await viewSession.clearStorageData({
        storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage'],
      });

      log.info('BrowserView data cleared');
    } catch (error) {
      log.error('Failed to clear BrowserView data:', error);
    }
  }

  /**
   * 销毁BrowserView
   * Requirements: 13.1
   */
  async destroyBrowserView(): Promise<void> {
    if (!this.currentView) {
      return;
    }

    try {
      // 移除工具栏
      if (this.parentWindow && !this.parentWindow.isDestroyed()) {
        this.removeToolbar(this.parentWindow);
      }

      // 清除数据
      await this.clearData();

      // 从父窗口移除
      if (this.parentWindow && !this.parentWindow.isDestroyed()) {
        this.parentWindow.removeBrowserView(this.currentView);
      }

      // 销毁webContents（注意：BrowserView的webContents会在BrowserView销毁时自动销毁）
      // 直接销毁BrowserView
      (this.currentView as any).destroy?.();

      this.currentView = null;
      this.parentWindow = null;

      log.info('BrowserView destroyed');
    } catch (error) {
      log.error('Failed to destroy BrowserView:', error);
      throw error;
    }
  }

  /**
   * 检查BrowserView是否存在
   */
  hasView(): boolean {
    return this.currentView !== null && !this.currentView.webContents.isDestroyed();
  }

  /**
   * 显示开发者工具
   */
  openDevTools(): void {
    if (this.currentView) {
      this.currentView.webContents.openDevTools();
    }
  }

  /**
   * 关闭开发者工具
   */
  closeDevTools(): void {
    if (this.currentView) {
      this.currentView.webContents.closeDevTools();
    }
  }
}

// 导出单例实例
export const browserViewManager = BrowserViewManager.getInstance();
export { BrowserViewManager, BrowserViewConfig };
