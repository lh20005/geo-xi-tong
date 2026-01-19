import { ipcMain, app, BrowserWindow } from 'electron';
import log from 'electron-log';
import { appManager } from '../main';
import { loginManager, Platform, LoginResult } from '../login/login-manager';
import { toutiaoLoginManager } from '../login/toutiao-login-manager';
import { douyinLoginManager } from '../login/douyin-login-manager';
import { xiaohongshuLoginManager } from '../login/xiaohongshu-login-manager';
import { wechatLoginManager } from '../login/wechat-login-manager';
import { baijiahaoLoginManager } from '../login/baijiahao-login-manager';
import { jianshuLoginManager } from '../login/jianshu-login-manager';
import { zhihuLoginManager } from '../login/zhihu-login-manager';
import { qieLoginManager } from '../login/qie-login-manager';
import { souhuLoginManager } from '../login/souhu-login-manager';
import { wangyiLoginManager } from '../login/wangyi-login-manager';
import { csdnLoginManager } from '../login/csdn-login-manager';
import { bilibiliLoginManager } from '../login/bilibili-login-manager';
import { webViewManager } from '../login/webview-manager';
import { storageManager, AppConfig } from '../storage/manager';
import { apiClient } from '../api/client';
import { syncService } from '../sync/service';
import { wsManager, WebSocketManager } from '../websocket/manager';
import { AccountEvent } from '../websocket/client';
import { accountService } from '../services';
import path from 'path';
import fs from 'fs/promises';
import * as fsSync from 'fs';

/**
 * IPC处理器
 * 处理渲染进程的IPC请求
 * Requirements: 所有功能需求
 */

class IPCHandler {
  private static instance: IPCHandler;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): IPCHandler {
    if (!IPCHandler.instance) {
      IPCHandler.instance = new IPCHandler();
    }
    return IPCHandler.instance;
  }

  /**
   * 注册所有IPC处理器
   */
  async registerHandlers(): Promise<void> {
    log.info('Registering IPC handlers...');

    // 初始化API客户端的baseURL
    await this.initializeAPIClient();

    // 平台登录
    this.registerLoginHandlers();

    // 账号管理
    this.registerAccountHandlers();

    // Dashboard
    this.registerDashboardHandlers();

    // 转化目标
    this.registerConversionTargetHandlers();

    // 知识库管理
    this.registerKnowledgeBaseHandlers();

    // 配置管理
    this.registerConfigHandlers();

    // 日志管理
    this.registerLogHandlers();

    // 同步管理
    this.registerSyncHandlers();

    // WebSocket管理
    this.registerWebSocketHandlers();
    
    // 存储管理
    this.registerStorageHandlers();
    
    // 发布任务管理
    this.registerPublishingHandlers();
    
    // 设置WebSocket事件转发回调
    wsManager.setEventForwardCallback((event: AccountEvent) => {
      this.broadcastAccountEvent(event);
    });

    log.info('IPC handlers registered');
  }

  /**
   * 初始化API客户端
   */
  private async initializeAPIClient(): Promise<void> {
    try {
      const config = await storageManager.getConfig();
      if (config && config.serverUrl) {
        await apiClient.setBaseURL(config.serverUrl);
        log.info(`API client initialized with baseURL: ${config.serverUrl}`);
      } else {
        // 统一使用生产服务器地址
        const defaultUrl = 'https://www.jzgeo.cc';
        await apiClient.setBaseURL(defaultUrl);
        log.info(`API client initialized with default baseURL: ${defaultUrl}`);
      }
    } catch (error) {
      log.error('Failed to initialize API client:', error);
      // 使用生产服务器作为后备
      const fallbackUrl = 'https://www.jzgeo.cc';
      await apiClient.setBaseURL(fallbackUrl);
    }
  }

  /**
   * 注册登录相关处理器
   */
  private registerLoginHandlers(): void {
    // 系统登录
    ipcMain.handle('login', async (event, username: string, password: string) => {
      try {
        log.info(`IPC: login - ${username}`);
        
        // 调用API登录
        const loginResult = await apiClient.login(username, password);
        
        // 保存用户信息到 Electron Store
        if (loginResult.user) {
          await storageManager.saveUser(loginResult.user);
          
          // ⭐ 同步用户信息到本地数据库（新增）
          try {
            const { getPool } = await import('../database/postgres');
            const pool = getPool();
            
            const query = `
              INSERT INTO users (id, username, email, role, invitation_code, is_temp_password, synced_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
              ON CONFLICT (id) DO UPDATE SET
                username = EXCLUDED.username,
                email = EXCLUDED.email,
                role = EXCLUDED.role,
                invitation_code = EXCLUDED.invitation_code,
                is_temp_password = EXCLUDED.is_temp_password,
                synced_at = NOW(),
                updated_at = NOW()
            `;
            
            await pool.query(query, [
              loginResult.user.id,
              loginResult.user.username,
              loginResult.user.email || null,
              loginResult.user.role,
              (loginResult.user as any).invitationCode || null,
              (loginResult.user as any).isTempPassword || false,
            ]);
            
            log.info(`✅ 用户信息已同步到本地数据库: ${loginResult.user.username}`);
          } catch (dbError) {
            log.error('同步用户信息到本地数据库失败:', dbError);
            // 不抛出错误，允许登录继续
          }
        }
        
        // 获取保存的 tokens 并发送到渲染进程
        const tokens = await storageManager.getTokens();
        if (tokens) {
          log.info('Sending tokens to renderer process for localStorage sync');
          event.sender.send('tokens-saved', tokens);
        }
        
        // 登录成功后初始化WebSocket
        const config = await storageManager.getConfig();
        if (config) {
          const wsUrl = WebSocketManager.deriveWebSocketUrl(config.serverUrl);
          
          if (tokens?.authToken) {
            await wsManager.initialize({
              serverUrl: wsUrl,
              token: tokens.authToken
            });
            log.info('WebSocket initialized after login');
          }
        }
        
        return { 
          success: true,
          user: loginResult.user,
          tokens: tokens // 同时在响应中返回 tokens
        };
      } catch (error) {
        log.error('IPC: login failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '登录失败',
        };
      }
    });

    // 系统登出
    ipcMain.handle('logout', async () => {
      try {
        log.info('IPC: logout');
        
        // 断开WebSocket
        wsManager.disconnect();
        
        // 清除用户信息
        await storageManager.clearUser();
        
        // 调用API登出
        await apiClient.logout();
        
        return { success: true };
      } catch (error) {
        log.error('IPC: logout failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '登出失败',
        };
      }
    });

    // 检查认证状态
    ipcMain.handle('check-auth', async () => {
      try {
        const tokens = await storageManager.getTokens();
        const user = await storageManager.getUser();
        
        return {
          isAuthenticated: !!tokens?.authToken,
          user: user || undefined
        };
      } catch (error) {
        log.error('IPC: check-auth failed:', error);
        return { 
          isAuthenticated: false,
          user: undefined
        };
      }
    });

    // 平台登录
    ipcMain.handle('login-platform', async (event, platformId: string) => {
      try {
        log.info(`IPC: login-platform - ${platformId}`);

        // 获取主窗口
        const mainWindow = appManager.getMainWindow();
        if (!mainWindow) {
          throw new Error('Main window not available');
        }

        // 使用平台专用登录管理器
        if (platformId === 'toutiao') {
          log.info('IPC: 使用头条号专用登录管理器');
          const result = await toutiaoLoginManager.login(mainWindow);
          return result;
        }

        if (platformId === 'douyin') {
          log.info('IPC: 使用抖音号专用登录管理器');
          const result = await douyinLoginManager.login(mainWindow);
          return result;
        }

        if (platformId === 'xiaohongshu') {
          log.info('IPC: 使用小红书专用登录管理器');
          const result = await xiaohongshuLoginManager.login(mainWindow);
          return result;
        }

        if (platformId === 'wechat') {
          log.info('IPC: 使用微信公众号专用登录管理器');
          const result = await wechatLoginManager.login(mainWindow);
          return result;
        }

        if (platformId === 'baijiahao') {
          log.info('IPC: 使用百家号专用登录管理器');
          const result = await baijiahaoLoginManager.login(mainWindow);
          return result;
        }

        if (platformId === 'jianshu') {
          log.info('IPC: 使用简书专用登录管理器');
          const result = await jianshuLoginManager.login(mainWindow);
          return result;
        }

        if (platformId === 'zhihu') {
          log.info('IPC: 使用知乎专用登录管理器');
          const result = await zhihuLoginManager.login(mainWindow);
          return result;
        }

        if (platformId === 'qie') {
          log.info('IPC: 使用企鹅号专用登录管理器');
          const result = await qieLoginManager.login(mainWindow);
          return result;
        }

        if (platformId === 'souhu') {
          log.info('IPC: 使用搜狐号专用登录管理器');
          const result = await souhuLoginManager.login(mainWindow);
          return result;
        }

        if (platformId === 'wangyi') {
          log.info('IPC: 使用网易号专用登录管理器');
          const result = await wangyiLoginManager.login(mainWindow);
          return result;
        }

        if (platformId === 'csdn') {
          log.info('IPC: 使用CSDN专用登录管理器');
          const result = await csdnLoginManager.login(mainWindow);
          return result;
        }

        if (platformId === 'bilibili') {
          log.info('IPC: 使用哔哩哔哩专用登录管理器');
          const result = await bilibiliLoginManager.login(mainWindow);
          return result;
        }

        // 其他平台使用通用登录管理器
        const platforms = await apiClient.getPlatforms();
        const platform = platforms.find((p) => p.platform_id === platformId);

        if (!platform) {
          throw new Error(`Platform not found: ${platformId}`);
        }

        // 执行登录
        const result = await loginManager.loginWithBrowser(mainWindow, platform as Platform);
        return result;
      } catch (error) {
        log.error('IPC: login-platform failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 取消登录
    ipcMain.handle('cancel-login', async (event, platformId?: string) => {
      try {
        log.info(`IPC: cancel-login - ${platformId || 'all'}`);
        
        // 如果指定了平台，使用对应的管理器
        if (platformId === 'toutiao') {
          await toutiaoLoginManager.cancelLogin();
        } else if (platformId === 'douyin') {
          await douyinLoginManager.cancelLogin();
        } else if (platformId === 'xiaohongshu') {
          await xiaohongshuLoginManager.cancelLogin();
        } else if (platformId === 'wechat') {
          await wechatLoginManager.cancelLogin();
        } else if (platformId === 'baijiahao') {
          await baijiahaoLoginManager.cancelLogin();
        } else if (platformId === 'jianshu') {
          await jianshuLoginManager.cancelLogin();
        } else if (platformId === 'zhihu') {
          await zhihuLoginManager.cancelLogin();
        } else if (platformId === 'qie') {
          await qieLoginManager.cancelLogin();
        } else if (platformId === 'souhu') {
          await souhuLoginManager.cancelLogin();
        } else if (platformId === 'wangyi') {
          await wangyiLoginManager.cancelLogin();
        } else if (platformId === 'csdn') {
          await csdnLoginManager.cancelLogin();
        } else if (platformId === 'bilibili') {
          await bilibiliLoginManager.cancelLogin();
        } else if (platformId) {
          await loginManager.cancelLogin();
        } else {
          // 没有指定平台，取消所有正在进行的登录
          log.info('IPC: 取消所有正在进行的登录');
          
          // 检查并取消所有平台登录
          if (toutiaoLoginManager.isLoggingIn()) {
            log.info('IPC: 取消头条号登录');
            await toutiaoLoginManager.cancelLogin();
          }
          
          if (douyinLoginManager.isLoggingIn()) {
            log.info('IPC: 取消抖音号登录');
            await douyinLoginManager.cancelLogin();
          }
          
          if (xiaohongshuLoginManager.isLoggingIn()) {
            log.info('IPC: 取消小红书登录');
            await xiaohongshuLoginManager.cancelLogin();
          }
          
          if (wechatLoginManager.isLoggingIn()) {
            log.info('IPC: 取消微信公众号登录');
            await wechatLoginManager.cancelLogin();
          }
          
          if (baijiahaoLoginManager.isLoggingIn()) {
            log.info('IPC: 取消百家号登录');
            await baijiahaoLoginManager.cancelLogin();
          }
          
          if (jianshuLoginManager.isLoggingIn()) {
            log.info('IPC: 取消简书登录');
            await jianshuLoginManager.cancelLogin();
          }
          
          if (zhihuLoginManager.isLoggingIn()) {
            log.info('IPC: 取消知乎登录');
            await zhihuLoginManager.cancelLogin();
          }
          
          if (qieLoginManager.isLoggingIn()) {
            log.info('IPC: 取消企鹅号登录');
            await qieLoginManager.cancelLogin();
          }
          
          if (souhuLoginManager.isLoggingIn()) {
            log.info('IPC: 取消搜狐号登录');
            await souhuLoginManager.cancelLogin();
          }
          
          if (wangyiLoginManager.isLoggingIn()) {
            log.info('IPC: 取消网易号登录');
            await wangyiLoginManager.cancelLogin();
          }
          
          if (csdnLoginManager.isLoggingIn()) {
            log.info('IPC: 取消CSDN登录');
            await csdnLoginManager.cancelLogin();
          }
          
          if (bilibiliLoginManager.isLoggingIn()) {
            log.info('IPC: 取消哔哩哔哩登录');
            await bilibiliLoginManager.cancelLogin();
          }
          
          // 检查并取消通用登录
          if (loginManager.isLoggingIn()) {
            log.info('IPC: 取消通用登录');
            await loginManager.cancelLogin();
          }
          
          // 如果没有正在进行的登录，可能是测试登录的 WebView
          // 直接销毁 WebView
          if (!toutiaoLoginManager.isLoggingIn() && 
              !douyinLoginManager.isLoggingIn() && 
              !xiaohongshuLoginManager.isLoggingIn() &&
              !wechatLoginManager.isLoggingIn() &&
              !baijiahaoLoginManager.isLoggingIn() &&
              !jianshuLoginManager.isLoggingIn() &&
              !zhihuLoginManager.isLoggingIn() &&
              !qieLoginManager.isLoggingIn() &&
              !souhuLoginManager.isLoggingIn() &&
              !wangyiLoginManager.isLoggingIn() &&
              !csdnLoginManager.isLoggingIn() &&
              !bilibiliLoginManager.isLoggingIn() &&
              !loginManager.isLoggingIn()) {
            log.info('IPC: 没有正在进行的登录，尝试关闭测试 WebView');
            if (webViewManager.hasView()) {
              await webViewManager.destroyWebView();
              log.info('IPC: 测试 WebView 已关闭');
            }
          }
        }
        
        return { success: true };
      } catch (error) {
        log.error('IPC: cancel-login failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 获取登录状态
    ipcMain.handle('get-login-status', async () => {
      try {
        return {
          isLoggingIn: loginManager.isLoggingIn(),
        };
      } catch (error) {
        log.error('IPC: get-login-status failed:', error);
        return { isLoggingIn: false };
      }
    });

    // 测试账号登录（使用 webview 打开平台页面验证 Cookie 是否有效）
    ipcMain.handle('test-account-login', async (event, accountId: string | number) => {
      try {
        log.info(`IPC: test-account-login - ${accountId}`);

        // 获取主窗口
        const mainWindow = appManager.getMainWindow();
        if (!mainWindow) {
          throw new Error('Main window not available');
        }

        // 从本地 SQLite 获取账号信息（包含解密的凭证）
        // accountId 可能是字符串（UUID）或数字，统一转为字符串
        const accountIdStr = String(accountId);
        log.info(`IPC: 从本地获取账号 ${accountIdStr}（包含凭证）`);
        const account = accountService.getDecrypted(accountIdStr);
        
        if (!account) {
          log.error(`IPC: 账号 ${accountIdStr} 不存在`);
          return {
            success: false,
            message: '账号不存在'
          };
        }
        
        log.info(`IPC: 获取到账号: ${account.account_name}, platform: ${account.platform}`);

        // 获取平台配置
        const platforms = await apiClient.getPlatforms();
        const platform = platforms.find((p: any) => p.platform_id === account.platform);
        
        if (!platform) {
          return {
            success: false,
            message: '平台配置不存在'
          };
        }

        // 使用 webview 打开平台主页
        const testUrl = (platform as any).home_url || platform.login_url;
        log.info(`IPC: 测试登录 URL: ${testUrl}`);
        
        // 使用持久化 partition 用于测试登录
        const partition = `persist:${account.platform}`;
        
        // 先设置 cookies 到 session
        if (account.cookies && account.cookies.length > 0) {
          log.info(`IPC: 设置 ${account.cookies.length} 个 cookies 到 session`);
          const { session } = require('electron');
          const ses = session.fromPartition(partition);
          
          // 清除旧的 cookies
          const oldCookies = await ses.cookies.get({});
          for (const cookie of oldCookies) {
            try {
              const url = `https://${cookie.domain}${cookie.path}`;
              await ses.cookies.remove(url, cookie.name);
            } catch (e) {
              // 忽略删除错误
            }
          }
          
          // 设置新的 cookies
          for (const cookie of account.cookies) {
            try {
              const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
              const cookieDetails: Electron.CookiesSetDetails = {
                url: `https://${domain}${cookie.path || '/'}`,
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path || '/',
                secure: cookie.secure !== false,
                httpOnly: cookie.httpOnly,
                expirationDate: cookie.expires,
              };
              
              // 处理 sameSite
              if (cookie.sameSite) {
                const sameSiteMap: Record<string, 'no_restriction' | 'lax' | 'strict'> = {
                  'None': 'no_restriction',
                  'Lax': 'lax',
                  'Strict': 'strict',
                  'no_restriction': 'no_restriction',
                  'lax': 'lax',
                  'strict': 'strict'
                };
                cookieDetails.sameSite = sameSiteMap[cookie.sameSite] || 'lax';
              }
              
              await ses.cookies.set(cookieDetails);
            } catch (e) {
              log.warn(`IPC: 设置 cookie ${cookie.name} 失败:`, e);
            }
          }
          log.info('IPC: Cookies 设置完成');
        } else {
          log.warn('IPC: 账号没有保存的 cookies');
        }
        
        await webViewManager.createWebView(mainWindow, {
          url: testUrl,
          partition: partition,
        });

        log.info(`Test login webview opened for account: ${account.account_name}`);
        
        return {
          success: true,
          message: '已打开测试页面，请查看登录状态'
        };
      } catch (error) {
        log.error('IPC: test-account-login failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 获取平台列表
    ipcMain.handle('get-platforms', async () => {
      try {
        log.info('IPC: get-platforms');
        return await apiClient.getPlatforms();
      } catch (error) {
        log.error('IPC: get-platforms failed:', error);
        return [];
      }
    });

    // 服务健康检查（用于测试 serverUrl 连通性）
    ipcMain.handle('check-server-health', async () => {
      try {
        log.info('IPC: check-server-health');
        return await apiClient.getHealth();
      } catch (error: any) {
        log.error('IPC: check-server-health failed:', error);
        const message = error?.response?.data?.message || error?.message || '无法连接到服务器';
        return { status: 'error', message };
      }
    });
  }

  /**
   * 注册账号管理处理器
   * 改造说明：账号数据存储在Windows端本地SQLite，不再从服务器获取
   */
  private registerAccountHandlers(): void {
    const { accountService } = require('../services');

    // 获取所有账号（本地SQLite）
    ipcMain.handle('get-accounts', async (_event, userId?: number) => {
      try {
        log.info('IPC: get-accounts (local)');
        
        // 如果没有传userId，从存储中获取当前用户
        if (!userId) {
          const user = await storageManager.getUser();
          if (!user) {
            log.warn('IPC: No user logged in');
            return [];
          }
          userId = user.id;
        }

        const accounts = accountService.findAll(userId);
        log.info(`IPC: 从本地获取到 ${accounts.length} 个账号`);
        
        return accounts;
      } catch (error) {
        log.error('IPC: get-accounts failed:', error);
        return [];
      }
    });

    // 获取账号详情（本地SQLite，包含解密的凭证）
    ipcMain.handle('account:getById', async (_event, accountId: string, includeCredentials: boolean = false) => {
      try {
        log.info(`IPC: account:getById - ${accountId}`);
        
        if (includeCredentials) {
          const account = accountService.getDecrypted(accountId);
          return { success: true, data: account };
        } else {
          const account = accountService.findById(accountId);
          return { success: true, data: account };
        }
      } catch (error: any) {
        log.error('IPC: account:getById failed:', error);
        return { success: false, error: error.message || '获取账号详情失败' };
      }
    });

    // 根据平台获取账号（本地SQLite）
    ipcMain.handle('account:getByPlatform', async (_event, userId: number, platform: string) => {
      try {
        log.info(`IPC: account:getByPlatform - ${platform}`);
        const accounts = accountService.findByPlatform(userId, platform);
        return { success: true, data: accounts };
      } catch (error: any) {
        log.error('IPC: account:getByPlatform failed:', error);
        return { success: false, error: error.message || '获取账号列表失败' };
      }
    });

    // 创建账号（本地SQLite）
    // 注意：账号创建通常在登录成功后自动完成，这个接口主要用于手动添加
    ipcMain.handle('account:create', async (_event, params: {
      user_id: number;
      platform: string;
      platform_id?: string;
      account_name?: string;
      real_username?: string;
      credentials?: any;
      cookies?: any[];
      status?: string;
      is_default?: boolean;
    }) => {
      try {
        log.info(`IPC: account:create - ${params.platform}`);
        const account = accountService.create(params);
        return { success: true, data: account };
      } catch (error: any) {
        log.error('IPC: account:create failed:', error);
        return { success: false, error: error.message || '创建账号失败' };
      }
    });

    // 更新账号（本地SQLite）
    ipcMain.handle('account:update', async (_event, accountId: string, params: {
      account_name?: string;
      real_username?: string;
      credentials?: any;
      cookies?: any[];
      status?: string;
      is_default?: boolean;
      error_message?: string;
    }) => {
      try {
        log.info(`IPC: account:update - ${accountId}`);
        const account = accountService.update(accountId, params);
        return { success: true, data: account };
      } catch (error: any) {
        log.error('IPC: account:update failed:', error);
        return { success: false, error: error.message || '更新账号失败' };
      }
    });

    // 删除账号（本地SQLite）
    ipcMain.handle('delete-account', async (_event, accountId: string, userId?: number) => {
      try {
        log.info(`IPC: delete-account - ${accountId}`);
        
        // 如果没有传userId，从存储中获取当前用户
        if (!userId) {
          const user = await storageManager.getUser();
          if (user) {
            userId = user.id;
          }
        }

        const success = accountService.delete(accountId, userId);
        
        if (success) {
          log.info(`Account ${accountId} deleted from local SQLite`);
          return { success: true };
        } else {
          return { success: false, error: '账号不存在或无权删除' };
        }
      } catch (error) {
        log.error('IPC: delete-account failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '删除失败，请重试',
        };
      }
    });

    // 设置默认账号（本地SQLite）
    ipcMain.handle('set-default-account', async (_event, platformId: string, accountId: string, userId?: number) => {
      try {
        log.info(`IPC: set-default-account - ${platformId}, ${accountId}`);
        
        // 如果没有传userId，从存储中获取当前用户
        if (!userId) {
          const user = await storageManager.getUser();
          if (!user) {
            return { success: false, error: '用户未登录' };
          }
          userId = user.id;
        }

        const success = accountService.setDefaultAccount(userId, platformId, accountId);
        
        if (success) {
          log.info(`Default account set in local SQLite: ${platformId} -> ${accountId}`);
          return { success: true };
        } else {
          return { success: false, error: '设置失败' };
        }
      } catch (error) {
        log.error('IPC: set-default-account failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '设置失败，请重试',
        };
      }
    });

    // 获取默认账号（本地SQLite）
    ipcMain.handle('account:getDefault', async (_event, userId: number, platform: string) => {
      try {
        log.info(`IPC: account:getDefault - ${platform}`);
        const account = accountService.getDefaultAccount(userId, platform);
        return { success: true, data: account };
      } catch (error: any) {
        log.error('IPC: account:getDefault failed:', error);
        return { success: false, error: error.message || '获取默认账号失败' };
      }
    });

    // 获取活跃账号（本地SQLite）
    ipcMain.handle('account:getActive', async (_event, userId: number) => {
      try {
        log.info('IPC: account:getActive');
        const accounts = accountService.findActiveAccounts(userId);
        return { success: true, data: accounts };
      } catch (error: any) {
        log.error('IPC: account:getActive failed:', error);
        return { success: false, error: error.message || '获取活跃账号失败' };
      }
    });

    // 获取账号统计（本地SQLite）
    ipcMain.handle('account:getStats', async (_event, userId: number) => {
      try {
        log.info('IPC: account:getStats');
        const stats = accountService.getStats(userId);
        return { success: true, data: stats };
      } catch (error: any) {
        log.error('IPC: account:getStats failed:', error);
        return { success: false, error: error.message || '获取统计数据失败' };
      }
    });

    // 更新账号Cookies（本地SQLite）
    ipcMain.handle('account:updateCookies', async (_event, accountId: string, cookies: any[]) => {
      try {
        log.info(`IPC: account:updateCookies - ${accountId}`);
        const success = accountService.updateCookies(accountId, cookies);
        return { success, message: success ? 'Cookies更新成功' : 'Cookies更新失败' };
      } catch (error: any) {
        log.error('IPC: account:updateCookies failed:', error);
        return { success: false, error: error.message || 'Cookies更新失败' };
      }
    });

    // 更新账号状态（本地SQLite）
    ipcMain.handle('account:updateStatus', async (_event, accountId: string, status: string, errorMessage?: string) => {
      try {
        log.info(`IPC: account:updateStatus - ${accountId} -> ${status}`);
        const success = accountService.updateStatus(accountId, status, errorMessage);
        return { success, message: success ? '状态更新成功' : '状态更新失败' };
      } catch (error: any) {
        log.error('IPC: account:updateStatus failed:', error);
        return { success: false, error: error.message || '状态更新失败' };
      }
    });

    // 刷新账号列表（保留，但改为从本地获取）
    ipcMain.handle('refresh-accounts', async (_event, userId?: number) => {
      try {
        log.info('IPC: refresh-accounts (local)');
        
        if (!userId) {
          const user = await storageManager.getUser();
          if (!user) {
            return [];
          }
          userId = user.id;
        }
        
        const accounts = accountService.findAll(userId);
        return accounts;
      } catch (error) {
        log.error('IPC: refresh-accounts failed:', error);
        return [];
      }
    });
  }

  /**
   * 注册Dashboard处理器
   */
  private registerDashboardHandlers(): void {
    ipcMain.handle('dashboard:get-all', async (_event, params?: { startDate?: string; endDate?: string }) => {
      try {
        log.info('IPC: dashboard:get-all');
        const data = await apiClient.getDashboardAllData(params);
        return { success: true, data };
      } catch (error: any) {
        log.error('IPC: dashboard:get-all failed:', error);
        const message = error?.response?.data?.error || error?.message || '加载Dashboard失败';
        return { success: false, error: message };
      }
    });
  }

  /**
   * 注册转化目标处理器
   */
  private registerConversionTargetHandlers(): void {
    ipcMain.handle(
      'conversion-targets:list',
      async (
        _event,
        params: {
          page?: number;
          pageSize?: number;
          search?: string;
          sortField?: string;
          sortOrder?: 'asc' | 'desc';
        }
      ) => {
        try {
          log.info('IPC: conversion-targets:list');
          const data = await apiClient.getConversionTargets(params);
          return { success: true, data };
        } catch (error: any) {
          log.error('IPC: conversion-targets:list failed:', error);
          const message = error?.response?.data?.error || error?.message || '加载转化目标失败';
          return { success: false, error: message };
        }
      }
    );

    ipcMain.handle(
      'conversion-targets:create',
      async (
        _event,
        payload: { companyName: string; industry?: string; website?: string; address?: string }
      ) => {
        try {
          log.info('IPC: conversion-targets:create');
          const data = await apiClient.createConversionTarget(payload);
          return { success: true, data };
        } catch (error: any) {
          log.error('IPC: conversion-targets:create failed:', error);
          const message = error?.response?.data?.error || error?.message || '创建失败';
          return { success: false, error: message };
        }
      }
    );

    ipcMain.handle(
      'conversion-targets:update',
      async (
        _event,
        id: number,
        payload: { companyName?: string; industry?: string; website?: string; address?: string }
      ) => {
        try {
          log.info(`IPC: conversion-targets:update - ${id}`);
          const data = await apiClient.updateConversionTarget(id, payload);
          return { success: true, data };
        } catch (error: any) {
          log.error('IPC: conversion-targets:update failed:', error);
          const message = error?.response?.data?.error || error?.message || '更新失败';
          return { success: false, error: message };
        }
      }
    );

    ipcMain.handle('conversion-targets:delete', async (_event, id: number) => {
      try {
        log.info(`IPC: conversion-targets:delete - ${id}`);
        const data = await apiClient.deleteConversionTarget(id);
        return { success: true, data };
      } catch (error: any) {
        log.error('IPC: conversion-targets:delete failed:', error);
        const message = error?.response?.data?.error || error?.message || '删除失败';
        return { success: false, error: message };
      }
    });

    ipcMain.handle('conversion-targets:get', async (_event, id: number) => {
      try {
        log.info(`IPC: conversion-targets:get - ${id}`);
        const data = await apiClient.getConversionTarget(id);
        return { success: true, data };
      } catch (error: any) {
        log.error('IPC: conversion-targets:get failed:', error);
        const message = error?.response?.data?.error || error?.message || '获取详情失败';
        return { success: false, error: message };
      }
    });
  }

  /**
   * 注册知识库管理处理器
   */
  private registerKnowledgeBaseHandlers(): void {
    // 获取所有知识库
    ipcMain.handle('knowledge-base:list', async () => {
      try {
        log.info('IPC: knowledge-base:list');
        const data = await apiClient.getKnowledgeBases();
        return { success: true, data };
      } catch (error: any) {
        log.error('IPC: knowledge-base:list failed:', error);
        const message = error?.response?.data?.error || error?.message || '加载知识库失败';
        return { success: false, error: message };
      }
    });

    // 获取单个知识库详情
    ipcMain.handle('knowledge-base:get', async (_event, id: number) => {
      try {
        log.info(`IPC: knowledge-base:get - ${id}`);
        const data = await apiClient.getKnowledgeBase(id);
        return { success: true, data };
      } catch (error: any) {
        log.error('IPC: knowledge-base:get failed:', error);
        const message = error?.response?.data?.error || error?.message || '获取知识库详情失败';
        return { success: false, error: message };
      }
    });

    // 创建知识库
    ipcMain.handle('knowledge-base:create', async (_event, payload: { name: string; description?: string }) => {
      try {
        log.info('IPC: knowledge-base:create');
        const data = await apiClient.createKnowledgeBase(payload);
        return { success: true, data };
      } catch (error: any) {
        log.error('IPC: knowledge-base:create failed:', error);
        const message = error?.response?.data?.error || error?.message || '创建知识库失败';
        return { success: false, error: message };
      }
    });

    // 更新知识库
    ipcMain.handle('knowledge-base:update', async (_event, id: number, payload: { name?: string; description?: string }) => {
      try {
        log.info(`IPC: knowledge-base:update - ${id}`);
        const data = await apiClient.updateKnowledgeBase(id, payload);
        return { success: true, data };
      } catch (error: any) {
        log.error('IPC: knowledge-base:update failed:', error);
        const message = error?.response?.data?.error || error?.message || '更新知识库失败';
        return { success: false, error: message };
      }
    });

    // 删除知识库
    ipcMain.handle('knowledge-base:delete', async (_event, id: number) => {
      try {
        log.info(`IPC: knowledge-base:delete - ${id}`);
        const data = await apiClient.deleteKnowledgeBase(id);
        return { success: true, data };
      } catch (error: any) {
        log.error('IPC: knowledge-base:delete failed:', error);
        const message = error?.response?.data?.error || error?.message || '删除知识库失败';
        return { success: false, error: message };
      }
    });

    // 上传文档
    ipcMain.handle('knowledge-base:upload-documents', async (_event, id: number, files: any[]) => {
      try {
        log.info(`IPC: knowledge-base:upload-documents - KB ID: ${id}, 文件数: ${files.length}`);
        
        // 直接传递文件路径信息给 API 客户端
        const filesData = files.map((fileData: any) => {
          log.info(`准备文件: ${fileData.name}, 路径: ${fileData.path}`);
          return {
            name: fileData.name,
            path: fileData.path,
            type: fileData.type
          };
        });
        
        log.info(`所有文件准备完成，开始调用 API...`);
        const data = await apiClient.uploadKnowledgeBaseDocuments(id, filesData);
        log.info(`API 调用成功，上传了 ${data.uploadedCount} 个文档`);
        
        return { success: true, data };
      } catch (error: any) {
        log.error('IPC: knowledge-base:upload-documents failed:', error);
        log.error('错误详情:', error.response?.data || error.message);
        const message = error?.response?.data?.error || error?.message || '上传文档失败';
        return { success: false, error: message };
      }
    });

    // 获取文档详情
    ipcMain.handle('knowledge-base:get-document', async (_event, docId: number) => {
      try {
        log.info(`IPC: knowledge-base:get-document - ${docId}`);
        const data = await apiClient.getKnowledgeBaseDocument(docId);
        return { success: true, data };
      } catch (error: any) {
        log.error('IPC: knowledge-base:get-document failed:', error);
        const message = error?.response?.data?.error || error?.message || '获取文档详情失败';
        return { success: false, error: message };
      }
    });

    // 删除文档
    ipcMain.handle('knowledge-base:delete-document', async (_event, docId: number) => {
      try {
        log.info(`IPC: knowledge-base:delete-document - ${docId}`);
        const data = await apiClient.deleteKnowledgeBaseDocument(docId);
        return { success: true, data };
      } catch (error: any) {
        log.error('IPC: knowledge-base:delete-document failed:', error);
        const message = error?.response?.data?.error || error?.message || '删除文档失败';
        return { success: false, error: message };
      }
    });

    // 搜索文档
    ipcMain.handle('knowledge-base:search-documents', async (_event, id: number, query: string) => {
      try {
        log.info(`IPC: knowledge-base:search-documents - ${id}, query: ${query}`);
        const data = await apiClient.searchKnowledgeBaseDocuments(id, query);
        return { success: true, data };
      } catch (error: any) {
        log.error('IPC: knowledge-base:search-documents failed:', error);
        const message = error?.response?.data?.error || error?.message || '搜索文档失败';
        return { success: false, error: message };
      }
    });
  }

  /**
   * 注册配置管理处理器
   */
  private registerConfigHandlers(): void {
    // 获取配置
    ipcMain.handle('get-config', async () => {
      try {
        log.info('IPC: get-config');
        const config = await storageManager.getConfig();
        return config;
      } catch (error) {
        log.error('IPC: get-config failed:', error);
        return null;
      }
    });

    // 保存配置
    ipcMain.handle('set-config', async (event, config: AppConfig) => {
      try {
        log.info('IPC: set-config');
        await storageManager.saveConfig(config);

        // 更新API客户端的baseURL
        if (config.serverUrl) {
          await apiClient.setBaseURL(config.serverUrl);
          
          // 重新连接WebSocket（如果有token）
          const tokens = await storageManager.getTokens();
          if (tokens?.authToken) {
            try {
              const wsUrl = WebSocketManager.deriveWebSocketUrl(config.serverUrl);
              await wsManager.reconnect({
                serverUrl: wsUrl,
                token: tokens.authToken
              });
              log.info('WebSocket reconnected with new server URL');
            } catch (error) {
              log.error('Failed to reconnect WebSocket:', error);
              // 不阻止配置保存
            }
          }
        }

        return { success: true };
      } catch (error) {
        log.error('IPC: set-config failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 清除缓存
    ipcMain.handle('clear-cache', async () => {
      try {
        log.info('IPC: clear-cache');
        await storageManager.clearCache();
        return { success: true };
      } catch (error) {
        log.error('IPC: clear-cache failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 清除所有数据
    ipcMain.handle('clear-all-data', async () => {
      try {
        log.info('IPC: clear-all-data');
        await storageManager.clearAll();
        return { success: true };
      } catch (error) {
        log.error('IPC: clear-all-data failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * 注册日志管理处理器
   */
  private registerLogHandlers(): void {
    // 获取日志
    ipcMain.handle('get-logs', async () => {
      try {
        log.info('IPC: get-logs');
        const logPath = log.transports.file.getFile().path;
        const content = await fs.readFile(logPath, 'utf-8');
        const lines = content.split('\n').slice(-1000); // 最后1000行
        return lines;
      } catch (error) {
        log.error('IPC: get-logs failed:', error);
        return [];
      }
    });

    // 导出日志
    ipcMain.handle('export-logs', async () => {
      try {
        log.info('IPC: export-logs');
        const logPath = log.transports.file.getFile().path;
        return logPath;
      } catch (error) {
        log.error('IPC: export-logs failed:', error);
        return '';
      }
    });

    // 清除日志
    ipcMain.handle('clear-logs', async () => {
      try {
        log.info('IPC: clear-logs');
        const logPath = log.transports.file.getFile().path;
        await fs.writeFile(logPath, '');
        return { success: true };
      } catch (error) {
        log.error('IPC: clear-logs failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * 注册同步管理处理器
   */
  private registerSyncHandlers(): void {
    // 获取同步状态
    ipcMain.handle('get-sync-status', async () => {
      try {
        return syncService.getSyncStatus();
      } catch (error) {
        log.error('IPC: get-sync-status failed:', error);
        return {
          isOnline: false,
          isSyncing: false,
          queueLength: 0,
        };
      }
    });

    // 手动触发同步
    ipcMain.handle('trigger-sync', async () => {
      try {
        log.info('IPC: trigger-sync');
        await syncService.triggerSync();
        return { success: true };
      } catch (error) {
        log.error('IPC: trigger-sync failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 清空同步队列
    ipcMain.handle('clear-sync-queue', async () => {
      try {
        log.info('IPC: clear-sync-queue');
        await syncService.clearQueue();
        return { success: true };
      } catch (error) {
        log.error('IPC: clear-sync-queue failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * 注册WebSocket管理处理器
   * Requirements: 3.1, 3.2, 3.3
   */
  private registerWebSocketHandlers(): void {
    // 获取WebSocket状态
    ipcMain.handle('get-websocket-status', async () => {
      try {
        log.info('IPC: get-websocket-status');
        return wsManager.getStatus();
      } catch (error) {
        log.error('IPC: get-websocket-status failed:', error);
        return {
          connected: false,
          authenticated: false,
          reconnectAttempts: 0,
          lastError: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // 手动重新连接WebSocket
    ipcMain.handle('reconnect-websocket', async () => {
      try {
        log.info('IPC: reconnect-websocket');
        
        const config = await storageManager.getConfig();
        const tokens = await storageManager.getTokens();
        
        if (!config || !config.serverUrl) {
          return {
            success: false,
            error: 'No server URL configured'
          };
        }
        
        if (!tokens?.authToken) {
          return {
            success: false,
            error: 'No access token available'
          };
        }
        
        const wsUrl = WebSocketManager.deriveWebSocketUrl(config.serverUrl);
        await wsManager.reconnect({
          serverUrl: wsUrl,
          token: tokens.authToken
        });
        
        return { success: true };
      } catch (error) {
        log.error('IPC: reconnect-websocket failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * 注册存储管理处理器
   */
  private registerStorageHandlers(): void {
    // 获取 tokens
    ipcMain.handle('storage:get-tokens', async () => {
      try {
        const tokens = await storageManager.getTokens();
        return tokens;
      } catch (error) {
        log.error('IPC: storage:get-tokens failed:', error);
        return null;
      }
    });

    // 保存 tokens
    ipcMain.handle('storage:save-tokens', async (_event, tokens: { authToken: string; refreshToken: string }) => {
      try {
        await storageManager.saveTokens(tokens);
        log.info('IPC: Tokens saved successfully');
      } catch (error) {
        log.error('IPC: storage:save-tokens failed:', error);
        throw error;
      }
    });

    // 清除 tokens
    ipcMain.handle('storage:clear-tokens', async () => {
      try {
        await storageManager.clearTokens();
        log.info('IPC: Tokens cleared successfully');
      } catch (error) {
        log.error('IPC: storage:clear-tokens failed:', error);
        throw error;
      }
    });
  }

  /**
   * 注册发布任务管理处理器
   * Requirements: Phase 3 - 发布功能本地化
   */
  private registerPublishingHandlers(): void {
    const { taskService } = require('../services');
    const { publishingExecutor } = require('../publishing/PublishingExecutor');
    const { articleService } = require('../services');
    const { accountService } = require('../services');

    // ==================== 注意 ====================
    // Task 相关的 IPC 处理器已迁移到 taskHandlers.ts
    // 通过 registerAllLocalHandlers() 统一注册
    // ============================================

    // 获取发布记录列表
    ipcMain.handle('publishing:getRecords', async (_event, params: {
      user_id: number;
      page?: number;
      pageSize?: number;
      platform_id?: string;
      article_id?: string;
      account_id?: string;
    }) => {
      try {
        log.info('IPC: publishing:getRecords');
        // TODO: 实现发布记录查询
        return { success: true, data: { records: [], total: 0, page: 1, pageSize: 20 } };
      } catch (error: any) {
        log.error('IPC: publishing:getRecords failed:', error);
        return { success: false, error: error.message || '获取发布记录失败' };
      }
    });
  }

  /**
   * 广播账号事件到所有渲染进程
   * Requirements: 3.1, 3.2
   */
  broadcastAccountEvent(event: AccountEvent): void {
    try {
      log.info(`Broadcasting account event to renderers: ${event.type}`);
      
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('account-event', event);
        }
      });
    } catch (error) {
      log.error('Failed to broadcast account event:', error);
    }
  }

  /**
   * 移除所有处理器
   */
  removeAllHandlers(): void {
    log.info('Removing all IPC handlers...');
    ipcMain.removeAllListeners();
  }
}

// 导出单例实例
export const ipcHandler = IPCHandler.getInstance();
export { IPCHandler };
