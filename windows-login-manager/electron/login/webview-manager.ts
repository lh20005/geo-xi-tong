import { BrowserWindow } from 'electron';
import log from 'electron-log';
import path from 'path';

/**
 * WebView管理器
 * 使用 <webview> 标签替代 BrowserView
 * Requirements: 13.1, 13.2
 */

interface WebViewConfig {
  url: string;
  partition?: string;
  userAgent?: string;
}

interface WebViewMessage {
  type: string;
  data?: any;
}

class WebViewManager {
  private static instance: WebViewManager;
  private parentWindow: BrowserWindow | null = null;
  private currentWebViewId: string | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): WebViewManager {
    if (!WebViewManager.instance) {
      WebViewManager.instance = new WebViewManager();
    }
    return WebViewManager.instance;
  }

  /**
   * 创建 WebView
   * Requirements: 13.1, 13.2
   */
  async createWebView(
    parentWindow: BrowserWindow,
    config: WebViewConfig
  ): Promise<string> {
    try {
      // 如果已存在 WebView，先销毁
      if (this.currentWebViewId) {
        await this.destroyWebView();
      }

      this.parentWindow = parentWindow;
      this.currentWebViewId = `webview-${Date.now()}`;

      // 构建 preload 脚本路径
      const preloadPath = path.join(__dirname, '../preload/webview-preload.js');

      // 在主窗口中注入 webview
      await parentWindow.webContents.executeJavaScript(`
        (function() {
          // 移除旧的 webview 和工具栏
          const oldWebView = document.getElementById('${this.currentWebViewId}');
          if (oldWebView) {
            oldWebView.remove();
          }
          const oldToolbar = document.getElementById('browser-toolbar');
          if (oldToolbar) {
            oldToolbar.remove();
          }

          // 创建全局关闭函数
          window.__closeWebView = async function() {
            console.log('[WebView] Global close function called');
            try {
              if (window.electronAPI && window.electronAPI.cancelLogin) {
                console.log('[WebView] Calling cancelLogin via IPC');
                const result = await window.electronAPI.cancelLogin();
                console.log('[WebView] cancelLogin result:', result);
                return result;
              } else {
                console.error('[WebView] electronAPI.cancelLogin not available');
                return { success: false, error: 'electronAPI not available' };
              }
            } catch (err) {
              console.error('[WebView] cancelLogin failed:', err);
              return { success: false, error: err.message };
            }
          };

          // 创建工具栏
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

          const statusDiv = document.createElement('div');
          statusDiv.style.cssText = \`
            display: flex;
            align-items: center;
            gap: 10px;
            color: #333;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          \`;

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

          closeBtn.addEventListener('click', function() {
            console.log('[WebView] Close button clicked');
            if (window.__closeWebView) {
              window.__closeWebView();
            } else {
              console.error('[WebView] __closeWebView function not available');
            }
          });

          toolbar.appendChild(statusDiv);
          toolbar.appendChild(closeBtn);
          document.body.appendChild(toolbar);

          // 创建 webview 容器
          const webview = document.createElement('webview');
          webview.id = '${this.currentWebViewId}';
          webview.src = '${config.url}';
          webview.partition = '${config.partition || 'persist:default'}';
          webview.preload = 'file://${preloadPath.replace(/\\/g, '/')}';
          webview.allowpopups = 'false';
          webview.nodeintegration = 'false';
          webview.webpreferences = 'contextIsolation=yes,sandbox=yes';
          
          ${config.userAgent ? `webview.useragent = '${config.userAgent}';` : ''}

          // 获取窗口实际尺寸
          const windowWidth = window.innerWidth;
          const windowHeight = window.innerHeight;
          const toolbarHeight = 50;
          const webviewHeight = windowHeight - toolbarHeight;
          
          console.log('[WebView] Window size:', windowWidth, 'x', windowHeight);
          console.log('[WebView] WebView size:', windowWidth, 'x', webviewHeight);

          // 关键：设置 webview 的样式，使用绝对像素值确保全屏显示
          webview.style.cssText = \`
            position: absolute !important;
            top: \${toolbarHeight}px !important;
            left: 0px !important;
            width: \${windowWidth}px !important;
            height: \${webviewHeight}px !important;
            border: none !important;
            display: flex !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: auto !important;
            z-index: 999998 !important;
            background: white !important;
          \`;
          
          // 隐藏原有的应用内容
          const appRoot = document.getElementById('root');
          if (appRoot) {
            appRoot.style.display = 'none';
          }
          
          // 确保 html 和 body 允许滚动
          document.documentElement.style.cssText = \`
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          \`;
          document.body.style.cssText = \`
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            position: relative !important;
          \`;

          document.body.appendChild(webview);

          // 添加窗口 resize 监听器，确保 webview 始终全屏
          const resizeHandler = () => {
            if (webview) {
              const newWidth = window.innerWidth;
              const newHeight = window.innerHeight - 50;
              webview.style.width = newWidth + 'px';
              webview.style.height = newHeight + 'px';
              console.log('[WebView] Resized to:', newWidth, 'x', newHeight);
            }
          };
          window.addEventListener('resize', resizeHandler);
          
          // 保存 resize handler 引用以便后续清理
          webview._resizeHandler = resizeHandler;

          // 等待 webview 加载完成后的处理
          webview.addEventListener('dom-ready', () => {
            console.log('[WebView] DOM ready');
            
            // 不需要注入样式来修改网页内容的宽度
            // 网页会按照自己的布局显示，webview 提供滚动功能
            
            // 只记录一下当前的尺寸信息用于调试
            try {
              webview.executeJavaScript(\`
              (function() {
                console.log('[WebView Content] Viewport:', window.innerWidth, 'x', window.innerHeight);
                console.log('[WebView Content] Body:', document.body.offsetWidth, 'x', document.body.offsetHeight);
                return {
                  viewport: { width: window.innerWidth, height: window.innerHeight },
                  body: { width: document.body.offsetWidth, height: document.body.offsetHeight }
                };
              })();
              \`);
            } catch (err) {
              console.error('[WebView] Failed to get size info:', err);
            }
          });

          // 监听页面导航
          webview.addEventListener('did-navigate', () => {
            console.log('[WebView] Page navigated');
          });

          // 监听 webview 消息
          webview.addEventListener('ipc-message', (event) => {
            console.log('[WebView] IPC message:', event.channel, event.args);
            
            // 转发消息到主进程
            if (window.electronAPI && window.electronAPI.onWebViewMessage) {
              window.electronAPI.onWebViewMessage(event.channel, event.args);
            }
          });

          // 监听 webview 加载事件
          webview.addEventListener('did-start-loading', () => {
            console.log('[WebView] Started loading');
          });

          webview.addEventListener('did-stop-loading', () => {
            console.log('[WebView] Stopped loading');
          });

          webview.addEventListener('did-finish-load', () => {
            console.log('[WebView] Finished loading');
          });

          webview.addEventListener('did-fail-load', (event) => {
            console.error('[WebView] Failed to load:', event);
          });

          console.log('[WebView] Created successfully');
          return '${this.currentWebViewId}';
        })();
      `);

      log.info(`WebView created: ${config.url}`);
      return this.currentWebViewId;
    } catch (error) {
      log.error('Failed to create WebView:', error);
      throw error;
    }
  }

  /**
   * 获取当前 WebView ID
   */
  getCurrentWebViewId(): string | null {
    return this.currentWebViewId;
  }

  /**
   * 导航到 URL
   */
  async navigateTo(url: string): Promise<void> {
    if (!this.currentWebViewId || !this.parentWindow) {
      throw new Error('No WebView available');
    }

    try {
      await this.parentWindow.webContents.executeJavaScript(`
        (function() {
          const webview = document.getElementById('${this.currentWebViewId}');
          if (webview) {
            webview.src = '${url}';
            return true;
          }
          return false;
        })();
      `);

      log.info(`Navigated to: ${url}`);
    } catch (error) {
      log.error('Navigation failed:', error);
      throw error;
    }
  }

  /**
   * 执行 JavaScript 代码
   */
  async executeJavaScript<T>(code: string): Promise<T> {
    if (!this.currentWebViewId || !this.parentWindow) {
      throw new Error('No WebView available');
    }

    try {
      const result = await this.parentWindow.webContents.executeJavaScript(`
        (function() {
          const webview = document.getElementById('${this.currentWebViewId}');
          if (webview) {
            return webview.executeJavaScript(\`${code.replace(/`/g, '\\`')}\`);
          }
          throw new Error('WebView not found');
        })();
      `);

      return result as T;
    } catch (error) {
      log.error('JavaScript execution failed:', error);
      throw error;
    }
  }

  /**
   * 获取当前 URL
   */
  async getCurrentURL(): Promise<string | null> {
    if (!this.currentWebViewId || !this.parentWindow) {
      return null;
    }

    try {
      const url = await this.parentWindow.webContents.executeJavaScript(`
        (function() {
          const webview = document.getElementById('${this.currentWebViewId}');
          return webview ? webview.getURL() : null;
        })();
      `);

      return url;
    } catch (error) {
      log.error('Failed to get current URL:', error);
      return null;
    }
  }

  /**
   * 获取页面标题
   */
  async getPageTitle(): Promise<string | null> {
    if (!this.currentWebViewId || !this.parentWindow) {
      return null;
    }

    try {
      const title = await this.parentWindow.webContents.executeJavaScript(`
        (function() {
          const webview = document.getElementById('${this.currentWebViewId}');
          return webview ? webview.getTitle() : null;
        })();
      `);

      return title;
    } catch (error) {
      log.error('Failed to get page title:', error);
      return null;
    }
  }

  /**
   * 等待页面加载完成
   */
  async waitForLoad(timeout: number = 30000): Promise<void> {
    if (!this.currentWebViewId || !this.parentWindow) {
      throw new Error('No WebView available');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Page load timeout'));
      }, timeout);

      // 使用轮询检查加载状态
      const checkInterval = setInterval(async () => {
        try {
          const isLoading = await this.parentWindow!.webContents.executeJavaScript(`
            (function() {
              const webview = document.getElementById('${this.currentWebViewId}');
              return webview ? webview.isLoading() : false;
            })();
          `);

          if (!isLoading) {
            clearTimeout(timer);
            clearInterval(checkInterval);
            resolve();
          }
        } catch (error) {
          clearTimeout(timer);
          clearInterval(checkInterval);
          reject(error);
        }
      }, 100);
    });
  }

  /**
   * 注册消息处理器
   */
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * 处理来自 webview 的消息
   */
  handleMessage(channel: string, args: any[]): void {
    const handler = this.messageHandlers.get(channel);
    if (handler) {
      handler(args[0]);
    }
  }

  /**
   * 发送消息到 webview
   */
  async sendMessage(channel: string, data: any): Promise<void> {
    if (!this.currentWebViewId || !this.parentWindow) {
      throw new Error('No WebView available');
    }

    try {
      await this.parentWindow.webContents.executeJavaScript(`
        (function() {
          const webview = document.getElementById('${this.currentWebViewId}');
          if (webview) {
            webview.send('${channel}', ${JSON.stringify(data)});
          }
        })();
      `);
    } catch (error) {
      log.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * 销毁 WebView
   */
  async destroyWebView(): Promise<void> {
    if (!this.currentWebViewId || !this.parentWindow) {
      return;
    }

    try {
      // 移除 webview 和工具栏，并恢复原来的样式
      await this.parentWindow.webContents.executeJavaScript(`
        (function() {
          const webview = document.getElementById('${this.currentWebViewId}');
          if (webview) {
            // 移除 resize 监听器
            if (webview._resizeHandler) {
              window.removeEventListener('resize', webview._resizeHandler);
            }
            webview.remove();
          }
          const toolbar = document.getElementById('browser-toolbar');
          if (toolbar) {
            toolbar.remove();
          }
          
          // 清理全局关闭函数
          if (window.__closeWebView) {
            delete window.__closeWebView;
          }
          
          // 恢复原有的应用内容
          const appRoot = document.getElementById('root');
          if (appRoot) {
            appRoot.style.display = '';
          }
          
          // 恢复 html 和 body 的原始样式
          document.documentElement.style.cssText = '';
          document.body.style.cssText = '';
          
          // 重新应用基本样式
          document.body.style.margin = '0';
          document.body.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";
          document.body.style.background = '#f5f7fa';
        })();
      `);

      this.currentWebViewId = null;
      this.parentWindow = null;
      this.messageHandlers.clear();

      log.info('WebView destroyed');
    } catch (error) {
      log.error('Failed to destroy WebView:', error);
      throw error;
    }
  }

  /**
   * 检查 WebView 是否存在
   */
  hasView(): boolean {
    return this.currentWebViewId !== null && this.parentWindow !== null;
  }
}

// 导出单例实例
export const webViewManager = WebViewManager.getInstance();
export { WebViewManager, WebViewConfig };
