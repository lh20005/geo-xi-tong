import * as fs from 'fs';
import { browserAutomationService } from '../browser/BrowserAutomationService';
import { adapterRegistry } from '../adapters/AdapterRegistry';
import { taskService } from '../services/TaskService';
import { accountService } from '../services/AccountService';
import { articleService } from '../services/ArticleService';
import { apiClient } from '../api/client';
import { imageUploadService } from './ImageUploadService';
import { normalizeCookies } from '../utils/cookieNormalizer';

/**
 * 任务超时错误
 */
export class TaskTimeoutError extends Error {
  constructor(public timeoutMinutes: number, public taskId: string) {
    super(`任务执行超时（${timeoutMinutes}分钟）`);
    this.name = 'TaskTimeoutError';
  }
}

/**
 * 日志回调类型
 */
type LogCallback = (taskId: string, level: 'info' | 'warn' | 'error', message: string, details?: object) => void;

/**
 * 发布执行器
 * 负责执行实际的文章发布流程
 * 
 * 改造说明：从服务器迁移到 Windows 端
 * - 使用本地 SQLite 替代 PostgreSQL
 * - 使用本地服务替代服务器服务
 * - 添加配额预扣减机制
 * - 添加分析上报功能
 */
export class PublishingExecutor {
  private logCallback: LogCallback | null = null;

  /**
   * 设置日志回调
   */
  setLogCallback(callback: LogCallback): void {
    this.logCallback = callback;
  }

  /**
   * 记录日志
   */
  private async log(taskId: string, level: 'info' | 'warn' | 'error', message: string, details?: object): Promise<void> {
    // 记录到本地数据库
    taskService.addLog(taskId, level, message, details ? JSON.stringify(details) : undefined);
    
    // 调用回调（用于实时显示）
    if (this.logCallback) {
      this.logCallback(taskId, level, message, details);
    }
    
    // 控制台输出
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
    console.log(`${prefix} [任务 ${taskId}] ${message}`);
  }

  /**
   * 执行发布任务（带配额保护）
   */
  async executeTask(taskId: string): Promise<void> {
    const taskStartTime = Date.now();
    console.log(`\n🚀 [任务 ${taskId}] 开始执行 at ${new Date().toISOString()}`);
    
    let page = null;
    let reservationId: number | null = null;  // ✅ 修复：SERIAL -> number

    try {
      // 获取任务详情
      const task = taskService.findById(taskId);
      if (!task) {
        throw new Error('任务不存在');
      }

      await this.log(taskId, 'info', '开始执行发布任务');

      // 1. 预扣减配额
      await this.log(taskId, 'info', '🔒 预扣减发布配额...');
      const reserveResult = await apiClient.reserveQuota({
        quotaType: 'publish',
        amount: 1,
        taskInfo: {
          taskId,
          platform: task.platform_id,
          articleId: task.article_id
        }
      });

      if (!reserveResult.success) {
        const errorMsg = reserveResult.error || '配额不足';
        await this.log(taskId, 'error', `❌ 配额预扣减失败: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      reservationId = reserveResult.reservationId!;
      await this.log(taskId, 'info', `✅ 配额预扣减成功，预留ID: ${reservationId}`);

      // 获取超时配置（默认15分钟）
      const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
      const timeoutMinutes = config?.timeout_minutes || 15;
      
      await this.log(taskId, 'info', `⏱️ 任务超时限制: ${timeoutMinutes} 分钟`);

      // 更新任务状态为运行中
      taskService.updateStatus(taskId, 'running');

      // 创建超时Promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new TaskTimeoutError(timeoutMinutes, taskId));
        }, timeoutMinutes * 60 * 1000);
      });

      // 创建执行Promise
      const executePromise = this.performPublish(taskId, task);

      // 使用Promise.race实现超时控制
      page = await Promise.race([executePromise, timeoutPromise]);

      const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
      console.log(`✅ [任务 ${taskId}] 执行完成，耗时: ${taskDuration}秒`);

      // 2. 确认配额消费
      await this.log(taskId, 'info', '✅ 确认配额消费...');
      await apiClient.confirmQuota({
        reservationId,
        result: { status: 'success', duration: taskDuration }
      });

      // 3. 上报分析数据（异步，不阻塞）
      this.reportAnalytics(taskId, task.platform_id, 'success', taskDuration * 1000);

    } catch (error: any) {
      const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
      console.error(`❌ [任务 ${taskId}] 执行失败，耗时: ${taskDuration}秒`, error);
      
      const isTimeout = error instanceof TaskTimeoutError;
      await this.handleTaskFailure(taskId, error, isTimeout);

      // 释放配额
      if (reservationId) {
        await this.log(taskId, 'info', '🔓 释放预留配额...');
        await apiClient.releaseQuota({
          reservationId,
          reason: error.message,
          errorCode: isTimeout ? 'TIMEOUT' : 'EXECUTION_FAILED'
        });
      }

      // 上报分析数据（失败）
      const task = taskService.findById(taskId);
      if (task) {
        this.reportAnalytics(
          taskId,
          task.platform_id,
          'failed',
          taskDuration * 1000,
          isTimeout ? 'TIMEOUT' : 'EXECUTION_FAILED',
          error.message
        );
      }
    } finally {
      // 确保资源总是被清理
      const cleanupStartTime = Date.now();
      console.log(`🔄 [任务 ${taskId}] 开始清理资源...`);
      await this.cleanupBrowser(page, taskId);
      const cleanupDuration = Math.round((Date.now() - cleanupStartTime) / 1000);
      console.log(`✅ [任务 ${taskId}] 资源清理完成，耗时: ${cleanupDuration}秒`);
      
      const totalDuration = Math.round((Date.now() - taskStartTime) / 1000);
      console.log(`✅ [任务 ${taskId}] 总耗时: ${totalDuration}秒\n`);
    }
  }

  /**
   * 执行发布流程（不含超时控制和配额管理）
   */
  private async performPublish(taskId: string, task: any): Promise<any> {
    let page = null;

    try {
      // 获取平台适配器
      const adapter = adapterRegistry.getAdapter(task.platform_id);
      if (!adapter) {
        throw new Error(`平台 ${task.platform_id} 的适配器未实现`);
      }

      // 设置任务ID，让适配器可以记录日志
      adapter.setTaskId(taskId);

      await this.log(taskId, 'info', `📦 使用适配器: ${adapter.platformName}`);

      // 获取账号信息（包含凭证）
      const account = accountService.findById(task.account_id);
      if (!account) {
        throw new Error('账号不存在');
      }

      // 解密凭证
      const decryptedAccount = accountService.getDecrypted(task.account_id);
      if (!decryptedAccount) {
        throw new Error('账号凭证无效');
      }
      
      // 构建凭证对象
      const credentials = {
        username: decryptedAccount.real_username || decryptedAccount.account_name || '',
        password: '', // Cookie 登录不需要密码
        cookies: decryptedAccount.cookies || [],
        ...decryptedAccount.credentials
      };

      // 获取文章内容
      let article: { id: string; title: string; content: string; keyword: string; image_url: string | null };
      
      // 优先使用任务中保存的文章快照
      if (task.article_title && task.article_content) {
        article = {
          id: task.article_id,
          title: task.article_title,
          content: task.article_content,
          keyword: task.article_keyword || '',
          image_url: task.article_image_url || null
        };
        console.log(`📄 使用任务快照中的文章内容: "${article.title}"`);
      } else {
        // 从本地数据库获取文章
        const dbArticle = articleService.findById(task.article_id);
        if (!dbArticle) {
          throw new Error('文章不存在（原文章已删除且任务无快照）');
        }
        article = {
          id: dbArticle.id,
          title: dbArticle.title || '无标题',
          content: dbArticle.content,
          keyword: dbArticle.keyword,
          image_url: dbArticle.image_url
        };
        console.log(`📄 从本地数据库获取文章内容: "${article.title}"`);
      }

      // 预检查：验证文章中的图片是否存在
      await this.validateArticleImages(taskId, article.content);

      // 启动浏览器
      const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
      const headlessMode = config?.headless !== false;
      const modeText = headlessMode ? '静默模式' : '可视化模式';
      await this.log(taskId, 'info', `🚀 启动浏览器（${modeText}）...`);
      await browserAutomationService.launchBrowser({ headless: headlessMode });
      await this.log(taskId, 'info', '✅ 浏览器启动成功');

      // 创建新页面
      page = await browserAutomationService.createPage();

      // 执行登录
      await this.log(taskId, 'info', `🔐 开始登录 ${adapter.platformName}...`);
      
      let loginSuccess = false;
      
      // 如果有Cookie，先尝试Cookie登录
      if (credentials.cookies && credentials.cookies.length > 0) {
        await this.log(taskId, 'info', `📝 使用Cookie登录（${credentials.cookies.length}个Cookie）`);
        
        // 设置Cookie
        await this.log(taskId, 'info', '🔑 设置Cookie...');
        const context = browserAutomationService.getContext();
        if (context) {
          const normalizedCookies = normalizeCookies(credentials.cookies);
          await context.addCookies(normalizedCookies);
        }
        await this.log(taskId, 'info', '✅ Cookie设置成功');
        
        // 直接导航到发布页面
        await this.log(taskId, 'info', `🌐 打开 ${adapter.platformName} 发布页面（已登录状态）...`);
        await browserAutomationService.navigateTo(page, adapter.getPublishUrl(), taskId);
        
        // 等待页面加载
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 验证登录状态
        await this.log(taskId, 'info', '🔍 验证登录状态...');
        loginSuccess = await browserAutomationService.executeWithRetry(
          () => adapter.performLogin(page!, credentials),
          1,
          taskId
        );
        
        if (loginSuccess) {
          await this.log(taskId, 'info', `✅ ${adapter.platformName} Cookie有效，已登录`);
          // 更新账号状态为在线
          accountService.update(account.id, { status: 'active', error_message: undefined });
        } else {
          await this.log(taskId, 'error', `❌ ${adapter.platformName} Cookie已失效或平台已掉线`);
          accountService.update(account.id, { 
            status: 'expired', 
            error_message: 'Cookie已失效或平台已掉线' 
          });
          throw new Error(`${adapter.platformName} Cookie已失效，请重新登录`);
        }
      } else {
        throw new Error('账号没有有效的Cookie，请先登录');
      }

      // 记录账号最后使用时间
      accountService.recordLastUsed(account.id);

      // 执行发布
      await this.log(taskId, 'info', `📝 开始发布文章《${article.title}》...`);
      await this.log(taskId, 'info', '⌨️ 正在输入标题...');
      
      const publishSuccess = await browserAutomationService.executeWithRetry(
        () => adapter.performPublish(page!, article, config),
        config?.max_retries || 3,
        taskId
      );

      if (!publishSuccess) {
        throw new Error('文章发布失败');
      }

      // 发布成功后等待4秒再关闭浏览器
      await this.log(taskId, 'info', '⏳ 等待4秒后关闭浏览器...');
      await new Promise(resolve => setTimeout(resolve, 4000));

      // 更新任务状态为成功
      taskService.updateStatus(taskId, 'completed');
      await this.log(taskId, 'info', '✅ 任务执行成功');

      // 创建发布记录
      await this.log(taskId, 'info', `🎉 文章《${article.title}》发布成功！`);
      this.createPublishingRecord(taskId, task, account, article);
      await this.log(taskId, 'info', '✅ 发布记录已创建');

      return page;
    } catch (error) {
      if (page) {
        try {
          await browserAutomationService.closePage(page);
        } catch (closeError) {
          console.error('关闭页面失败:', closeError);
        }
      }
      throw error;
    }
  }

  /**
   * 创建发布记录
   */
  private createPublishingRecord(taskId: string, task: any, account: any, article: any): void {
    try {
      taskService.createRecord({
        user_id: task.user_id,
        task_id: taskId,
        article_id: task.article_id,
        account_id: task.account_id,
        account_name: account.account_name,
        platform_id: task.platform_id,
        status: 'success',
        article_title: article.title || '',
        article_content: article.content,
        article_keyword: article.keyword,
        article_image_url: article.image_url
      });
    } catch (error) {
      console.error('创建发布记录失败:', error);
    }
  }

  /**
   * 处理任务失败
   */
  private async handleTaskFailure(taskId: string, error: Error, isTimeout: boolean = false): Promise<void> {
    const task = taskService.findById(taskId);
    if (!task) {
      console.error(`❌ 任务 ${taskId} 不存在，无法处理失败`);
      return;
    }
    
    // 如果任务已被取消，不做任何处理
    if (task.status === 'cancelled') {
      console.log(`⚠️ 任务 ${taskId} 已被用户取消，跳过失败处理`);
      return;
    }
    
    const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
    const maxRetries = config?.max_retries || 3;
    const nextRetryCount = (task.retry_count || 0) + 1;
    const failureType = isTimeout ? '超时' : '失败';

    if (nextRetryCount < maxRetries) {
      // 还可以重试
      const statusMessage = `执行${failureType}，将自动重试 (${nextRetryCount}/${maxRetries})`;
      taskService.updateStatus(taskId, 'pending', statusMessage);
      taskService.incrementRetryCount(taskId);
      await this.log(taskId, 'warn', statusMessage, { error: error.message, isTimeout });
      console.log(`🔄 任务 ${taskId} 将在下次调度时重试 (${nextRetryCount}/${maxRetries})`);
    } else {
      // 重试次数已用完
      const finalStatus = isTimeout ? 'timeout' : 'failed';
      const errorMessage = `重试次数已用完: ${error.message}`;
      
      taskService.updateStatus(taskId, finalStatus, errorMessage);
      await this.log(taskId, 'error', `任务执行${failureType}，重试次数已用完`, { 
        error: error.message, 
        stack: error.stack, 
        isTimeout 
      });
    }
  }

  /**
   * 预检查：验证文章中的图片是否存在
   */
  private async validateArticleImages(taskId: string, content: string): Promise<void> {
    const imageUrls = imageUploadService.extractImageUrls(content);
    
    if (imageUrls.length === 0) {
      await this.log(taskId, 'info', '📷 文章中没有图片，跳过图片检查');
      return;
    }
    
    await this.log(taskId, 'info', `📷 检查 ${imageUrls.length} 张图片是否存在...`);
    
    const missingImages: string[] = [];
    
    for (const imageUrl of imageUrls) {
      // 跳过远程URL
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        continue;
      }
      
      const localPath = imageUploadService.resolveImagePath(imageUrl);
      if (!fs.existsSync(localPath)) {
        missingImages.push(imageUrl);
      }
    }
    
    if (missingImages.length > 0) {
      const errorMsg = `图片文件不存在: ${missingImages.join(', ')}`;
      await this.log(taskId, 'error', `❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    await this.log(taskId, 'info', '✅ 所有图片文件检查通过');
  }

  /**
   * 清理浏览器资源
   */
  private async cleanupBrowser(page: any, taskId: string): Promise<void> {
    try {
      if (page) {
        console.log(`🔄 [任务 ${taskId}] 关闭页面...`);
        await browserAutomationService.closePage(page);
        console.log(`✅ [任务 ${taskId}] 页面已关闭`);
      }
      
      console.log(`🔄 [任务 ${taskId}] 关闭浏览器...`);
      await browserAutomationService.closeBrowser();
      console.log(`✅ [任务 ${taskId}] 浏览器已关闭`);
    } catch (error) {
      console.error(`⚠️ [任务 ${taskId}] 关闭浏览器失败:`, error);
      
      try {
        console.log(`🔄 [任务 ${taskId}] 尝试强制关闭浏览器...`);
        await browserAutomationService.forceCloseBrowser();
        console.log(`✅ [任务 ${taskId}] 浏览器已强制关闭`);
      } catch (forceError) {
        console.error(`❌ [任务 ${taskId}] 强制关闭浏览器失败:`, forceError);
      }
    }
  }

  /**
   * 上报分析数据（异步，不阻塞主流程）
   */
  private reportAnalytics(
    taskId: string,
    platform: string,
    status: 'success' | 'failed',
    duration: number,
    errorCode?: string,
    errorMessage?: string
  ): void {
    // 异步上报，不等待结果
    apiClient.reportPublish({
      taskId,
      platform,
      status,
      duration,
      errorCode,
      errorMessage
    }).catch(error => {
      console.error('分析上报失败:', error);
      // 保存到本地待上报队列
      this.savePendingReport({
        taskId,
        platform,
        status,
        duration,
        errorCode,
        errorMessage
      });
    });
  }

  /**
   * 保存待上报的分析数据到本地
   */
  private savePendingReport(report: any): void {
    try {
      taskService.addPendingAnalytics('publish', report);
    } catch (error) {
      console.error('保存待上报数据失败:', error);
    }
  }

  /**
   * 批量执行任务
   */
  async executeTasks(taskIds: string[]): Promise<void> {
    for (const taskId of taskIds) {
      try {
        await this.executeTask(taskId);
      } catch (error) {
        console.error(`任务 ${taskId} 执行失败:`, error);
      }
    }
  }
}

export const publishingExecutor = new PublishingExecutor();
