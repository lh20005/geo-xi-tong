/**
 * 发布执行器
 * 本地发布模块 - 负责执行实际的文章发布流程
 */

import { BrowserWindow } from 'electron';
import { browserAutomationService } from './browser';
import { adapterRegistry } from './adapters';
import { normalizeCookies } from './utils';
import { TaskTimeoutError, AccountOfflineError, AdapterNotFoundError, TaskCancelledError } from './errors';
import { LocalTask, Account, Article, TaskLogEvent, AccountCredentials } from './types';
import { apiClient } from '../api/client';

/**
 * 发布执行器
 * 负责执行实际的文章发布流程
 */
export class PublishingExecutor {
  private mainWindow: BrowserWindow | null = null;
  private cancelledTasks: Set<number> = new Set();

  /**
   * 设置主窗口（用于发送 IPC 消息）
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * 发送日志到渲染进程
   */
  private sendLog(taskId: number, level: 'info' | 'warning' | 'error', message: string, details?: any): void {
    const logEvent: TaskLogEvent = {
      taskId,
      level,
      message,
      timestamp: new Date().toISOString(),
      details
    };

    // 发送到渲染进程
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('publishing:task-log', logEvent);
    }

    // 同时输出到控制台
    const prefix = `[任务 #${taskId}]`;
    if (level === 'error') {
      console.error(prefix, message, details || '');
    } else if (level === 'warning') {
      console.warn(prefix, message, details || '');
    } else {
      console.log(prefix, message, details || '');
    }
  }

  /**
   * 同步日志到服务器
   */
  private async syncLogToServer(taskId: number, level: 'info' | 'warning' | 'error', message: string, details?: any): Promise<void> {
    try {
      await apiClient.post(`/api/publishing/tasks/${taskId}/logs`, {
        level,
        message,
        details
      });
    } catch (error) {
      console.error(`同步日志到服务器失败:`, error);
    }
  }

  /**
   * 记录日志（本地 + 服务器）
   */
  private async log(taskId: number, level: 'info' | 'warning' | 'error', message: string, details?: any): Promise<void> {
    // 发送到渲染进程
    this.sendLog(taskId, level, message, details);
    
    // 同步到服务器（异步，不阻塞）
    this.syncLogToServer(taskId, level, message, details).catch(() => {});
  }

  /**
   * 更新任务状态到服务器
   * 支持 429 错误的智能重试（指数退避 + Retry-After）
   */
  private async updateTaskStatus(taskId: number, status: string, errorMessage?: string): Promise<void> {
    const maxRetries = 5;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        await apiClient.put(`/api/publishing/tasks/${taskId}/status`, {
          status,
          error_message: errorMessage
        });
        console.log(`✅ 任务 #${taskId} 状态已更新为 ${status}`);
        return;
      } catch (error: any) {
        const statusCode = error.response?.status;
        const retryAfter = error.response?.headers?.['retry-after'];
        const errorCode = error.response?.data?.code;
        
        // 处理 429 错误（间隔控制/并发控制）
        if (statusCode === 429) {
          attempt++;
          
          // 计算等待时间：优先使用 Retry-After，否则使用指数退避
          let waitSeconds: number;
          if (retryAfter) {
            waitSeconds = parseInt(retryAfter, 10);
          } else {
            // 指数退避：30s, 60s, 120s, 240s, 480s
            waitSeconds = 30 * Math.pow(2, attempt - 1);
          }
          
          // 添加随机抖动（±10%）避免多任务同时重试
          const jitter = waitSeconds * 0.1 * (Math.random() * 2 - 1);
          waitSeconds = Math.round(waitSeconds + jitter);
          
          const reason = errorCode === 'INTERVAL_CONTROL' ? '间隔控制' : 
                        errorCode === 'CONCURRENCY_CONTROL' ? '并发控制' : '限流';
          
          console.log(`⏳ 任务 #${taskId} 触发${reason}，等待 ${waitSeconds} 秒后重试 (${attempt}/${maxRetries})`);
          await this.log(taskId, 'warning', `触发${reason}，等待 ${waitSeconds} 秒后重试`, { attempt, maxRetries, waitSeconds });
          
          await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
          continue;
        }
        
        // 其他错误直接抛出
        console.error(`更新任务状态失败:`, error);
        throw error;
      }
    }
    
    // 重试次数耗尽
    throw new Error(`更新任务状态失败：重试 ${maxRetries} 次后仍触发限流`);
  }

  /**
   * 更新账号在线状态
   */
  private async updateAccountOnlineStatus(accountId: number, isOnline: boolean, offlineReason?: string): Promise<void> {
    try {
      await apiClient.put(`/api/accounts/${accountId}/online-status`, {
        is_online: isOnline,
        offline_reason: offlineReason
      });
    } catch (error) {
      console.error(`更新账号状态失败:`, error);
    }
  }

  /**
   * 增加重试次数
   */
  private async incrementRetryCount(taskId: number): Promise<void> {
    try {
      await apiClient.post(`/api/publishing/tasks/${taskId}/increment-retry`);
    } catch (error) {
      console.error(`增加重试次数失败:`, error);
    }
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: number): void {
    this.cancelledTasks.add(taskId);
    console.log(`🛑 任务 #${taskId} 已标记为取消`);
  }

  /**
   * 检查任务是否被取消
   */
  private isTaskCancelled(taskId: number): boolean {
    return this.cancelledTasks.has(taskId);
  }

  /**
   * 执行发布任务（带超时控制）
   * 
   * 关键改进：使用 AbortController 实现真正的超时取消
   * Promise.race 只能让 race 返回，但不会取消底层操作
   * 必须在超时时主动关闭浏览器，否则任务会继续运行阻塞后续任务
   */
  async executeTask(taskId: number): Promise<void> {
    const taskStartTime = Date.now();
    console.log(`\n🚀 [任务 #${taskId}] 开始执行 at ${new Date().toISOString()}`);
    
    // 清除取消标记
    this.cancelledTasks.delete(taskId);
    
    let page = null;
    let timeoutTimer: NodeJS.Timeout | null = null;
    let isTimedOut = false;

    try {
      // 从服务器获取任务详情
      await this.log(taskId, 'info', '获取任务详情...');
      const response = await apiClient.get(`/api/publishing/tasks/${taskId}/full`);
      
      if (!response.data?.success || !response.data?.data) {
        throw new Error('获取任务详情失败');
      }

      const { task, account } = response.data.data as { task: LocalTask; account: Account };

      await this.log(taskId, 'info', '开始执行发布任务');

      // 解析 config（数据库返回的是 JSON 字符串）
      let taskConfig: any = {};
      if (task.config) {
        try {
          taskConfig = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
        } catch (e) {
          console.warn('解析任务配置失败，使用默认配置:', e);
        }
      }

      // 获取超时配置（默认15分钟）
      const timeoutMinutes = taskConfig.timeout_minutes || 15;
      
      // 验证超时时间
      const validatedTimeout = Math.max(1, timeoutMinutes);
      if (timeoutMinutes > 60) {
        await this.log(taskId, 'warning', `超时时间设置为 ${timeoutMinutes} 分钟（超过1小时）`);
      }

      await this.log(taskId, 'info', `⏱️  任务超时限制: ${validatedTimeout} 分钟`);

      // 更新任务状态为运行中
      await this.updateTaskStatus(taskId, 'running');

      // 创建超时 Promise，超时时主动关闭浏览器
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(async () => {
          isTimedOut = true;
          console.log(`⏰ [任务 #${taskId}] 超时！正在强制关闭浏览器...`);
          await this.log(taskId, 'error', `任务执行超时（${validatedTimeout}分钟），正在强制终止...`);
          
          // 关键：超时时立即强制关闭浏览器，终止底层操作
          try {
            await browserAutomationService.forceCloseBrowser();
            console.log(`✅ [任务 #${taskId}] 浏览器已强制关闭`);
          } catch (closeError) {
            console.error(`❌ [任务 #${taskId}] 强制关闭浏览器失败:`, closeError);
          }
          
          reject(new TaskTimeoutError(validatedTimeout, taskId));
        }, validatedTimeout * 60 * 1000);
      });

      // 创建执行Promise
      const executePromise = this.performPublish(taskId, task, account, taskConfig);

      // 使用Promise.race实现超时控制
      // 注意：超时时 timeoutPromise 会先关闭浏览器，然后 reject
      // 这样 executePromise 中的浏览器操作会因为浏览器关闭而抛出错误并结束
      page = await Promise.race([executePromise, timeoutPromise]);

      const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
      console.log(`✅ [任务 #${taskId}] 执行完成，耗时: ${taskDuration}秒`);

    } catch (error: any) {
      const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
      console.error(`❌ [任务 #${taskId}] 执行失败，耗时: ${taskDuration}秒`, error);
      const isTimeout = error instanceof TaskTimeoutError || isTimedOut;
      await this.handleTaskFailure(taskId, error, isTimeout);
    } finally {
      // 清除超时定时器（如果任务正常完成）
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      
      // 确保资源总是被清理
      const cleanupStartTime = Date.now();
      console.log(`🔄 [任务 #${taskId}] 开始清理资源...`);
      await this.cleanupBrowser(page, taskId);
      const cleanupDuration = Math.round((Date.now() - cleanupStartTime) / 1000);
      console.log(`✅ [任务 #${taskId}] 资源清理完成，耗时: ${cleanupDuration}秒`);
      
      // 清除取消标记
      this.cancelledTasks.delete(taskId);
      
      const totalDuration = Math.round((Date.now() - taskStartTime) / 1000);
      console.log(`✅ [任务 #${taskId}] 总耗时: ${totalDuration}秒\n`);
    }
  }

  /**
   * 执行发布流程（不含超时控制）
   */
  private async performPublish(taskId: number, task: LocalTask, account: Account, taskConfig: any = {}): Promise<any> {
    let page = null;

    try {
      // 检查任务是否被取消
      if (this.isTaskCancelled(taskId)) {
        throw new TaskCancelledError(taskId);
      }

      // 获取平台适配器
      const adapter = adapterRegistry.getAdapter(task.platform_id);
      if (!adapter) {
        throw new AdapterNotFoundError(task.platform_id);
      }

      // 设置任务ID和日志回调
      adapter.setTaskId(taskId);
      adapter.setLogCallback((level, message, details) => {
        this.log(taskId, level, message, details);
      });

      await this.log(taskId, 'info', `📦 使用适配器: ${adapter.platformName}`);

      // 验证账号凭证
      if (!account.credentials) {
        throw new Error('账号凭证无效');
      }

      // 构建文章对象
      const article: Article = {
        id: task.article_id,
        title: task.article_title || '',
        content: task.article_content || '',
        keyword: task.article_keyword
      };

      // 检查任务是否被取消
      if (this.isTaskCancelled(taskId)) {
        throw new TaskCancelledError(taskId);
      }

      // 启动浏览器（使用传入的 taskConfig）
      const headlessMode = taskConfig.headless !== false;
      const modeText = headlessMode ? '静默模式' : '可视化模式';
      await this.log(taskId, 'info', `🚀 启动浏览器（${modeText}）...`);
      
      // 设置浏览器日志回调
      browserAutomationService.setLogCallback((level, message, details) => {
        this.log(taskId, level, message, details);
      });
      
      await browserAutomationService.launchBrowser({ headless: headlessMode });
      await this.log(taskId, 'info', '✅ 浏览器启动成功');

      // 创建新页面
      page = await browserAutomationService.createPage();

      // 执行登录
      await this.log(taskId, 'info', `🔐 开始登录 ${adapter.platformName}...`);
      
      let loginSuccess = false;
      
      // 如果有Cookie，先尝试Cookie登录
      if (account.credentials.cookies && account.credentials.cookies.length > 0) {
        await this.log(taskId, 'info', `📝 使用Cookie登录（${account.credentials.cookies.length}个Cookie）`);
        
        // 设置Cookie
        await this.log(taskId, 'info', '🔑 设置Cookie...');
        const context = browserAutomationService.getContext();
        if (context) {
          const normalizedCookies = normalizeCookies(account.credentials.cookies);
          await context.addCookies(normalizedCookies);
        }
        await this.log(taskId, 'info', '✅ Cookie设置成功');
        
        // 导航到发布页面
        await this.log(taskId, 'info', `🌐 打开 ${adapter.platformName} 发布页面（已登录状态）...`);
        await browserAutomationService.navigateTo(page, adapter.getPublishUrl());
        
        // 等待页面加载
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 验证登录状态
        await this.log(taskId, 'info', '🔍 验证登录状态...');
        loginSuccess = await browserAutomationService.executeWithRetry(
          () => adapter.performLogin(page!, account.credentials),
          1
        );
        
        if (loginSuccess) {
          await this.log(taskId, 'info', `✅ ${adapter.platformName} Cookie有效，已登录`);
          await this.updateAccountOnlineStatus(account.id, true);
        } else {
          // 检查任务是否被取消
          if (this.isTaskCancelled(taskId)) {
            throw new TaskCancelledError(taskId);
          }
          
          await this.log(taskId, 'error', `❌ ${adapter.platformName} Cookie已失效或平台已掉线`);
          await this.updateAccountOnlineStatus(account.id, false, 'Cookie已失效或平台已掉线');
          throw new AccountOfflineError(account.id, task.platform_id, `${adapter.platformName} Cookie已失效，请重新登录`);
        }
      } else {
        // 没有Cookie，使用表单登录
        await this.log(taskId, 'info', '📝 使用表单登录');
        await this.log(taskId, 'info', `🌐 打开 ${adapter.platformName} 登录页...`);
        await browserAutomationService.navigateTo(page, adapter.getLoginUrl());

        await this.log(taskId, 'info', '⌨️  输入账号密码...');
        loginSuccess = await browserAutomationService.executeWithRetry(
          () => adapter.performLogin(page!, account.credentials),
          task.max_retries
        );
        
        if (!loginSuccess) {
          throw new Error(`${adapter.platformName} 表单登录失败`);
        }
        
        await this.log(taskId, 'info', `✅ ${adapter.platformName} 表单登录成功`);
        
        // 导航到发布页面
        await this.log(taskId, 'info', `📄 打开 ${adapter.platformName} 发布页面...`);
        await browserAutomationService.navigateTo(page, adapter.getPublishUrl());
      }

      // 检查任务是否被取消
      if (this.isTaskCancelled(taskId)) {
        throw new TaskCancelledError(taskId);
      }

      // 执行发布
      await this.log(taskId, 'info', `📝 开始发布文章《${article.title}》...`);
      
      const publishSuccess = await browserAutomationService.executeWithRetry(
        () => adapter.performPublish(page!, article, taskConfig),
        task.max_retries
      );

      if (!publishSuccess) {
        throw new Error('文章发布失败');
      }

      // 发布成功后等待4秒再关闭浏览器
      await this.log(taskId, 'info', '⏳ 等待4秒后关闭浏览器...');
      await new Promise(resolve => setTimeout(resolve, 4000));

      // 更新任务状态为成功（服务器会自动创建发布记录）
      await this.updateTaskStatus(taskId, 'success');
      await this.log(taskId, 'info', '✅ 任务执行成功');
      await this.log(taskId, 'info', `🎉 文章《${article.title}》发布成功！`);

      return page;
    } catch (error: any) {
      // 如果发生错误，确保清理page
      if (page) {
        try {
          await browserAutomationService.closePage(page);
        } catch (closeError) {
          console.error('关闭页面失败:', closeError);
        }
      }
      
      // 检查是否是浏览器关闭错误
      const isBrowserClosedError = 
        error.isBrowserClosed ||
        error.message?.includes('Target page, context or browser has been closed') ||
        error.message?.includes('browser has been closed') ||
        error.message?.includes('context has been closed') ||
        error.message?.includes('page has been closed') ||
        error.message?.includes('Target closed') ||
        error.message?.includes('Session closed');

      if (isBrowserClosedError) {
        // 浏览器意外关闭，可能是网络问题或页面崩溃
        // 将其视为账号离线错误，需要用户重新登录
        await this.log(taskId, 'error', `❌ ${task.platform_id} 浏览器上下文意外关闭，Cookie可能已失效`);
        await this.updateAccountOnlineStatus(account.id, false, '浏览器上下文意外关闭，请重新登录');
        throw new AccountOfflineError(account.id, task.platform_id, `${task.platform_id} Cookie已失效，请重新登录`);
      }
      
      throw error;
    }
  }

  /**
   * 处理任务失败，包含重试逻辑
   * 特殊处理 429 错误：不消耗重试次数，抛出特殊错误让批次执行器处理等待
   */
  private async handleTaskFailure(taskId: number, error: Error, isTimeout: boolean = false): Promise<void> {
    // 如果是取消错误，直接返回
    if (error instanceof TaskCancelledError) {
      await this.log(taskId, 'info', '⚠️ 任务已被用户取消');
      await this.updateTaskStatus(taskId, 'cancelled', '任务已被用户取消');
      return;
    }

    // 检查是否是 429 错误（间隔控制/并发控制）
    const is429Error = error.message?.includes('429') || 
                       error.message?.includes('间隔控制') || 
                       error.message?.includes('并发控制') ||
                       error.message?.includes('限流');
    
    if (is429Error) {
      // 429 错误不应该消耗重试次数
      // 解析等待时间
      const waitMatch = error.message?.match(/等待\s*(\d+)\s*秒/);
      const waitSeconds = waitMatch ? parseInt(waitMatch[1]) : 60;
      
      await this.log(taskId, 'warning', `触发间隔/并发控制，需等待 ${waitSeconds} 秒`, { error: error.message });
      console.log(`⏳ 任务 #${taskId} 触发间隔控制，需等待 ${waitSeconds} 秒后重试`);
      
      // 抛出特殊错误，让批次执行器知道需要等待后重试
      const retryError = new Error(`RETRY_AFTER:${waitSeconds}:${error.message}`);
      (retryError as any).isRetryable = true;
      (retryError as any).retryAfterSeconds = waitSeconds;
      throw retryError;
    }

    // 增加重试次数
    await this.incrementRetryCount(taskId);

    // 获取任务信息以检查重试次数
    try {
      const response = await apiClient.get(`/api/publishing/tasks/${taskId}/full`);
      if (!response.data?.success || !response.data?.data) {
        console.error(`❌ 获取任务 #${taskId} 信息失败`);
        return;
      }

      const { task } = response.data.data as { task: LocalTask };
      const nextRetryCount = task.retry_count + 1;
      const failureType = isTimeout ? '超时' : '失败';

      if (nextRetryCount < task.max_retries) {
        // 还可以重试，保持pending状态
        const statusMessage = `执行${failureType}，将自动重试 (${nextRetryCount}/${task.max_retries})`;
        await this.updateTaskStatus(taskId, 'pending', statusMessage);
        await this.log(taskId, 'warning', statusMessage, { error: error.message, isTimeout });
        console.log(`🔄 任务 #${taskId} 将在下次调度时重试 (${nextRetryCount}/${task.max_retries})`);
      } else {
        // 重试次数已用完，标记为失败或超时
        const finalStatus = isTimeout ? 'timeout' : 'failed';
        const errorMessage = `重试次数已用完: ${error.message}`;
        
        await this.updateTaskStatus(taskId, finalStatus, errorMessage);
        await this.log(taskId, 'error', `任务执行${failureType}，重试次数已用完`, { 
          error: error.message, 
          stack: error.stack, 
          isTimeout 
        });
      }
    } catch (fetchError) {
      console.error(`获取任务信息失败:`, fetchError);
      // 如果获取任务信息失败，直接标记为失败
      await this.updateTaskStatus(taskId, 'failed', error.message);
    }
  }

  /**
   * 清理浏览器资源
   * 增强版：确保无论任务成功、失败还是超时，都能正确清理资源
   */
  private async cleanupBrowser(page: any, taskId: number): Promise<void> {
    try {
      // 先尝试关闭页面
      if (page) {
        try {
          console.log(`🔄 [任务 #${taskId}] 关闭页面...`);
          await browserAutomationService.closePage(page);
          console.log(`✅ [任务 #${taskId}] 页面已关闭`);
        } catch (pageError) {
          console.warn(`⚠️  [任务 #${taskId}] 关闭页面失败（可能已被关闭）:`, pageError);
        }
      }
      
      // 检查浏览器是否仍在运行，如果是则关闭
      if (browserAutomationService.isBrowserRunning()) {
        console.log(`🔄 [任务 #${taskId}] 关闭浏览器...`);
        await browserAutomationService.closeBrowser();
        console.log(`✅ [任务 #${taskId}] 浏览器已关闭`);
      } else {
        console.log(`ℹ️  [任务 #${taskId}] 浏览器已经关闭，跳过清理`);
      }
    } catch (error) {
      console.error(`⚠️  [任务 #${taskId}] 正常关闭浏览器失败:`, error);
      
      // 尝试强制关闭
      try {
        console.log(`🔄 [任务 #${taskId}] 尝试强制关闭浏览器...`);
        await browserAutomationService.forceCloseBrowser();
        console.log(`✅ [任务 #${taskId}] 浏览器已强制关闭`);
      } catch (forceError) {
        console.error(`❌ [任务 #${taskId}] 强制关闭浏览器失败:`, forceError);
      }
    }
  }

  /**
   * 停止任务（强制关闭浏览器）
   */
  async stopTask(taskId: number): Promise<void> {
    this.cancelTask(taskId);
    
    // 强制关闭浏览器
    try {
      await browserAutomationService.forceCloseBrowser();
    } catch (error) {
      console.error(`强制关闭浏览器失败:`, error);
    }
    
    // 更新任务状态
    await this.updateTaskStatus(taskId, 'cancelled', '任务已被用户终止');
  }
}

// 导出单例
export const publishingExecutor = new PublishingExecutor();
