/**
 * 发布执行器 (重构版)
 * 
 * 核心职责：执行单个发布任务
 * 设计原则：
 * 1. 单一职责 - 只负责执行任务，不负责调度
 * 2. 使用 Mutex 确保同一时间只有一个任务执行
 * 3. 清晰的错误处理和资源清理
 */

import { BrowserWindow } from 'electron';
import { browserAutomationService } from './browser';
import { adapterRegistry } from './adapters';
import { normalizeCookies } from './utils';
import { globalTaskMutex } from './mutex';
import { 
  TaskTimeoutError, 
  AccountOfflineError, 
  AdapterNotFoundError, 
  TaskCancelledError 
} from './errors';
import { LocalTask, Account, Article, TaskLogEvent } from './types';
import { apiClient } from '../api/client';

export class PublishingExecutor {
  private mainWindow: BrowserWindow | null = null;
  private cancelledTasks = new Set<number>();
  private currentTaskId: number | null = null;

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * 发送日志到渲染进程和服务器
   */
  private async log(
    taskId: number, 
    level: 'info' | 'warning' | 'error', 
    message: string, 
    details?: any
  ): Promise<void> {
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

    // 控制台输出
    const prefix = `[任务#${taskId}]`;
    console[level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log'](
      prefix, message, details || ''
    );

    // 异步同步到服务器
    apiClient.post(`/api/publishing/tasks/${taskId}/logs`, { level, message, details })
      .catch(() => {});
  }

  /**
   * 更新任务状态
   */
  private async updateStatus(
    taskId: number, 
    status: string, 
    errorMessage?: string
  ): Promise<void> {
    try {
      await apiClient.put(`/api/publishing/tasks/${taskId}/status`, {
        status,
        error_message: errorMessage
      });
      console.log(`✅ 任务#${taskId} 状态更新: ${status}`);
    } catch (error: any) {
      console.error(`❌ 更新任务状态失败:`, error.message);
      throw error;
    }
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: number): void {
    this.cancelledTasks.add(taskId);
    console.log(`🛑 任务#${taskId} 已标记取消`);
  }

  /**
   * 检查任务是否被取消
   */
  private isCancelled(taskId: number): boolean {
    return this.cancelledTasks.has(taskId);
  }

  /**
   * 获取当前执行的任务ID
   */
  getCurrentTaskId(): number | null {
    return this.currentTaskId;
  }

  /**
   * 检查是否有任务正在执行
   */
  isExecuting(): boolean {
    return globalTaskMutex.isLocked();
  }

  /**
   * 执行发布任务（核心方法）
   * 使用 Mutex 确保串行执行
   */
  async executeTask(taskId: number): Promise<{ success: boolean; error?: string }> {
    // 使用互斥锁确保串行执行
    return globalTaskMutex.runExclusive(async () => {
      return this.doExecuteTask(taskId);
    });
  }

  /**
   * 实际执行任务的内部方法
   */
  private async doExecuteTask(taskId: number): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();
    this.currentTaskId = taskId;
    this.cancelledTasks.delete(taskId);
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 开始执行任务 #${taskId}`);
    console.log(`   时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`${'='.repeat(50)}\n`);

    let page: any = null;
    let timeoutTimer: NodeJS.Timeout | null = null;

    try {
      // 获取任务详情
      await this.log(taskId, 'info', '获取任务详情...');
      const response = await apiClient.get(`/api/publishing/tasks/${taskId}/full`);
      
      if (!response.data?.success || !response.data?.data) {
        throw new Error('获取任务详情失败');
      }

      const { task, account } = response.data.data as { task: LocalTask; account: Account };

      // 解析配置
      let config: any = {};
      if (task.config) {
        try {
          config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
        } catch (e) {
          console.warn('解析任务配置失败，使用默认配置');
        }
      }

      const timeoutMinutes = Math.max(1, config.timeout_minutes || 15);
      await this.log(taskId, 'info', `⏱️ 超时限制: ${timeoutMinutes} 分钟`);

      // 更新状态为运行中
      await this.updateStatus(taskId, 'running');

      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(async () => {
          await this.log(taskId, 'error', `任务超时（${timeoutMinutes}分钟）`);
          await browserAutomationService.forceCloseBrowser();
          reject(new TaskTimeoutError(timeoutMinutes, taskId));
        }, timeoutMinutes * 60 * 1000);
      });

      // 执行发布
      const executePromise = this.performPublish(taskId, task, account, config);
      page = await Promise.race([executePromise, timeoutPromise]);

      // 成功
      const duration = Math.round((Date.now() - startTime) / 1000);
      await this.updateStatus(taskId, 'success');
      await this.log(taskId, 'info', `✅ 任务成功，耗时 ${duration}秒`);
      
      return { success: true };

    } catch (error: any) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.error(`❌ 任务#${taskId} 失败，耗时 ${duration}秒:`, error.message);
      
      await this.handleFailure(taskId, error);
      return { success: false, error: error.message };

    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      await this.cleanup(page, taskId);
      this.currentTaskId = null;
      this.cancelledTasks.delete(taskId);
      
      console.log(`\n✅ 任务#${taskId} 处理完成\n`);
    }
  }

  /**
   * 执行发布流程
   */
  private async performPublish(
    taskId: number, 
    task: LocalTask, 
    account: Account, 
    config: any
  ): Promise<any> {
    let page = null;

    try {
      if (this.isCancelled(taskId)) {
        throw new TaskCancelledError(taskId);
      }

      // 获取适配器
      const adapter = adapterRegistry.getAdapter(task.platform_id);
      if (!adapter) {
        throw new AdapterNotFoundError(task.platform_id);
      }

      adapter.setTaskId(taskId);
      adapter.setLogCallback((level, message, details) => {
        this.log(taskId, level, message, details);
      });

      await this.log(taskId, 'info', `📦 平台: ${adapter.platformName}`);

      if (!account.credentials) {
        throw new Error('账号凭证无效');
      }

      // 构建文章
      const article: Article = {
        id: task.article_id,
        title: task.article_title || '',
        content: task.article_content || '',
        keyword: task.article_keyword
      };

      if (this.isCancelled(taskId)) {
        throw new TaskCancelledError(taskId);
      }

      // 启动浏览器
      const headless = config.headless !== false;
      await this.log(taskId, 'info', `🚀 启动浏览器（${headless ? '静默' : '可视化'}模式）`);
      
      browserAutomationService.setLogCallback((level, message, details) => {
        this.log(taskId, level, message, details);
      });
      
      await browserAutomationService.launchBrowser({ headless });
      await this.log(taskId, 'info', '✅ 浏览器启动成功');

      page = await browserAutomationService.createPage();

      // 登录
      await this.log(taskId, 'info', `🔐 登录 ${adapter.platformName}...`);
      
      let loginSuccess = false;
      
      if (account.credentials.cookies && account.credentials.cookies.length > 0) {
        await this.log(taskId, 'info', `📝 使用Cookie登录`);
        
        const context = browserAutomationService.getContext();
        if (context) {
          const cookies = normalizeCookies(account.credentials.cookies);
          await context.addCookies(cookies);
        }
        
        await browserAutomationService.navigateTo(page, adapter.getPublishUrl());
        await new Promise(r => setTimeout(r, 2000));
        
        loginSuccess = await browserAutomationService.executeWithRetry(
          () => adapter.performLogin(page!, account.credentials),
          1
        );
        
        if (!loginSuccess) {
          await this.log(taskId, 'error', `❌ Cookie已失效`);
          await this.updateAccountStatus(account.id, false, 'Cookie已失效');
          throw new AccountOfflineError(
            account.id, 
            task.platform_id, 
            `${adapter.platformName} Cookie已失效，请重新登录`
          );
        }
        
        await this.log(taskId, 'info', `✅ 登录成功`);
        await this.updateAccountStatus(account.id, true);
      } else {
        throw new Error('缺少登录凭证');
      }

      if (this.isCancelled(taskId)) {
        throw new TaskCancelledError(taskId);
      }

      // 发布
      await this.log(taskId, 'info', `📝 发布文章《${article.title}》...`);
      
      const publishSuccess = await browserAutomationService.executeWithRetry(
        () => adapter.performPublish(page!, article, config),
        task.max_retries
      );

      if (!publishSuccess) {
        throw new Error('发布失败');
      }

      await this.log(taskId, 'info', '⏳ 等待4秒...');
      await new Promise(r => setTimeout(r, 4000));

      await this.log(taskId, 'info', `🎉 发布成功！`);
      return page;

    } catch (error: any) {
      if (page) {
        try { await browserAutomationService.closePage(page); } catch {}
      }
      
      // 检查浏览器关闭错误
      if (this.isBrowserClosedError(error)) {
        await this.log(taskId, 'error', `❌ 浏览器意外关闭`);
        await this.updateAccountStatus(account.id, false, '浏览器意外关闭');
        throw new AccountOfflineError(
          account.id, 
          task.platform_id, 
          `${task.platform_id} Cookie已失效，请重新登录`
        );
      }
      
      throw error;
    }
  }

  /**
   * 检查是否是浏览器关闭错误
   */
  private isBrowserClosedError(error: any): boolean {
    const msg = error.message || '';
    return error.isBrowserClosed ||
      msg.includes('browser has been closed') ||
      msg.includes('context has been closed') ||
      msg.includes('page has been closed') ||
      msg.includes('Target closed') ||
      msg.includes('Session closed');
  }

  /**
   * 更新账号在线状态
   */
  private async updateAccountStatus(
    accountId: number, 
    isOnline: boolean, 
    reason?: string
  ): Promise<void> {
    try {
      await apiClient.put(`/api/accounts/${accountId}/online-status`, {
        is_online: isOnline,
        offline_reason: reason
      });
    } catch {}
  }

  /**
   * 处理任务失败
   */
  private async handleFailure(taskId: number, error: Error): Promise<void> {
    if (error instanceof TaskCancelledError) {
      await this.log(taskId, 'info', '⚠️ 任务已取消');
      await this.updateStatus(taskId, 'cancelled', '用户取消');
      return;
    }

    const isTimeout = error instanceof TaskTimeoutError;

    try {
      // 增加重试次数
      await apiClient.post(`/api/publishing/tasks/${taskId}/increment-retry`);

      // 获取任务信息
      const response = await apiClient.get(`/api/publishing/tasks/${taskId}/full`);
      if (!response.data?.success) return;

      const { task } = response.data.data as { task: LocalTask };
      const nextRetry = task.retry_count + 1;

      if (nextRetry < task.max_retries) {
        const msg = `执行失败，将重试 (${nextRetry}/${task.max_retries})`;
        await this.updateStatus(taskId, 'pending', msg);
        await this.log(taskId, 'warning', msg);
      } else {
        const status = isTimeout ? 'timeout' : 'failed';
        const msg = `重试次数已用完: ${error.message}`;
        await this.updateStatus(taskId, status, msg);
        await this.log(taskId, 'error', '任务失败，重试次数已用完');
      }
    } catch (e) {
      await this.updateStatus(taskId, 'failed', error.message);
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(page: any, _taskId: number): Promise<void> {
    try {
      if (page) {
        try { await browserAutomationService.closePage(page); } catch {}
      }
      
      if (browserAutomationService.isBrowserRunning()) {
        await browserAutomationService.closeBrowser();
      }
    } catch (error) {
      console.warn(`⚠️ 清理资源失败:`, error);
      try { await browserAutomationService.forceCloseBrowser(); } catch {}
    }
  }

  /**
   * 停止任务
   */
  async stopTask(taskId: number): Promise<void> {
    this.cancelTask(taskId);
    try { await browserAutomationService.forceCloseBrowser(); } catch {}
    await this.updateStatus(taskId, 'cancelled', '用户终止');
  }
}

export const publishingExecutor = new PublishingExecutor();
