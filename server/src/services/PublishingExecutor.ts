import { browserAutomationService } from './BrowserAutomationService';
import { publishingService } from './PublishingService';
import { accountService } from './AccountService';
import { adapterRegistry } from './adapters/AdapterRegistry';
import { pool } from '../db/database';
import { TaskTimeoutError } from '../errors/TaskTimeoutError';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 发布执行器
 * 负责执行实际的文章发布流程
 */
import { normalizeCookies } from '../utils/cookieNormalizer';

export class PublishingExecutor {
  /**
   * 创建发布记录（保存文章快照）并删除原文章
   * 重要：支持原文章已被删除的情况，此时使用任务中的快照
   */
  private async createPublishingRecord(
    taskId: number,
    task: any,
    account: any
  ): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. 尝试获取文章完整信息（包括关联数据）用于快照
      // 优先使用文章表的快照字段，确保即使蒸馏结果被删除也能获取数据
      const articleResult = await client.query(
        `SELECT 
          a.id, a.title, a.content, a.keyword, a.image_url, a.image_id,
          a.distillation_id, a.topic_id, a.task_id,
          COALESCE(a.topic_question_snapshot, t.question) as topic_question,
          COALESCE(a.distillation_keyword_snapshot, d.keyword) as distillation_keyword,
          COALESCE(gt.article_setting_name, ast.name) as article_setting_name
         FROM articles a
         LEFT JOIN topics t ON a.topic_id = t.id
         LEFT JOIN distillations d ON a.distillation_id = d.id
         LEFT JOIN generation_tasks gt ON a.task_id = gt.id
         LEFT JOIN article_settings ast ON gt.article_setting_id = ast.id
         WHERE a.id = $1`,
        [task.article_id]
      );
      
      let article;
      let articleExists = false;
      
      if (articleResult.rows.length > 0) {
        // 文章存在，使用数据库中的数据
        article = articleResult.rows[0];
        articleExists = true;
        console.log(`📄 使用数据库中的文章数据创建发布记录: "${article.title}"`);
      } else if (task.article_title && task.article_content) {
        // 文章已被删除，使用任务中的快照
        article = {
          id: task.article_id,
          title: task.article_title,
          content: task.article_content,
          keyword: task.article_keyword,
          image_url: task.article_image_url,
          image_id: null,
          distillation_id: null,
          topic_question: null,
          article_setting_name: null,
          distillation_keyword: null
        };
        articleExists = false;
        console.log(`📄 原文章已删除，使用任务快照创建发布记录: "${article.title}"`);
      } else {
        throw new Error('文章不存在且任务无快照');
      }
      
      // 2. 创建发布记录（包含文章快照）
      await client.query(
        `INSERT INTO publishing_records 
         (article_id, task_id, platform_id, account_id, account_name, user_id, published_at,
          article_title, article_content, article_keyword, article_image_url,
          topic_question, article_setting_name, distillation_keyword)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP,
                 $7, $8, $9, $10, $11, $12, $13)`,
        [
          task.article_id,
          taskId,
          task.platform_id,
          task.account_id,
          account.account_name,
          task.user_id,
          article.title,
          article.content,
          article.keyword,
          article.image_url,
          article.topic_question,
          article.article_setting_name,
          article.distillation_keyword
        ]
      );
      
      // 只有当文章存在时才处理引用计数和删除
      if (articleExists) {
        // 3. 更新蒸馏结果的 usage_count（减少引用计数）
        if (article.distillation_id) {
          await client.query(
            'UPDATE distillations SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = $1',
            [article.distillation_id]
          );
        }
        
        // 4. 处理图片引用计数
        if (article.image_id) {
          const imageResult = await client.query(
            'SELECT * FROM decrement_image_reference($1)',
            [article.image_id]
          );
          // 注意：这里不删除图片文件，因为发布记录中保存了 image_url
          // 图片文件会在用户手动删除发布记录时处理
        }
      }
      
      // 5. 检查是否还有其他待处理的发布任务
      // 重要修复：无论是否有 batch_id，都要检查同一篇文章的所有待处理任务
      // 因为同一篇文章可能被发布到多个平台（可能在不同批次中，或者没有批次）
      
      // 首先检查同一篇文章是否还有其他待处理任务（无论是否在同一批次）
      const pendingTasksResult = await client.query(
        `SELECT COUNT(*) as count FROM publishing_tasks 
         WHERE article_id = $1 AND status IN ('pending', 'running') AND id != $2`,
        [task.article_id, taskId]
      );
      const pendingCount = parseInt(pendingTasksResult.rows[0].count);
      
      if (task.batch_id) {
        console.log(`📊 文章 #${task.article_id} 还有 ${pendingCount} 个待处理任务（批次: ${task.batch_id}，当前任务 #${taskId}）`);
      } else {
        console.log(`📊 文章 #${task.article_id} 还有 ${pendingCount} 个待处理任务（非批次任务 #${taskId}）`);
      }
      
      if (pendingCount > 0) {
        // 还有其他平台的发布任务，暂不删除文章
        console.log(`⏳ 文章 #${task.article_id} 还有 ${pendingCount} 个待发布任务，暂不删除`);
        await client.query('COMMIT');
        console.log(`✅ 文章 #${task.article_id} 发布记录已创建（保留原文章供其他平台发布）`);
      } else if (articleExists) {
        // 所有平台都已发布完成，且文章存在，删除原文章
        await client.query(
          'DELETE FROM articles WHERE id = $1',
          [task.article_id]
        );
        await client.query('COMMIT');
        console.log(`✅ 文章 #${task.article_id} 已发布并移至发布记录（所有平台发布完成）`);
      } else {
        // 文章已被删除（可能被之前的任务删除了），直接提交
        await client.query('COMMIT');
        console.log(`✅ 文章 #${task.article_id} 发布记录已创建（原文章已被其他任务删除）`);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('创建发布记录失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 执行发布任务（带超时控制）
   */
  async executeTask(taskId: number): Promise<void> {
    const taskStartTime = Date.now();
    console.log(`\n🚀 [任务 #${taskId}] 开始执行 at ${new Date().toISOString()}`);
    
    let page = null;

    try {
      // 获取任务详情（使用 getTaskForExecution 获取包含 article_content 的完整数据）
      const task = await publishingService.getTaskForExecution(taskId);
      if (!task) {
        throw new Error('任务不存在');
      }

      await publishingService.logMessage(taskId, 'info', '开始执行发布任务');

      // 获取超时配置（默认15分钟）
      const timeoutMinutes = task.config?.timeout_minutes || 15;
      
      // 验证超时时间
      const validatedTimeout = Math.max(1, timeoutMinutes); // 最小1分钟
      if (timeoutMinutes > 60) {
        console.log(`⚠️  任务 #${taskId} 超时时间较长: ${timeoutMinutes}分钟`);
        await publishingService.logMessage(
          taskId,
          'warning',
          `超时时间设置为 ${timeoutMinutes} 分钟（超过1小时）`
        );
      }

      await publishingService.logMessage(
        taskId,
        'info',
        `⏱️  任务超时限制: ${validatedTimeout} 分钟`
      );

      // 更新任务状态为运行中
      await publishingService.updateTaskStatus(taskId, 'running');

      // 创建超时Promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new TaskTimeoutError(validatedTimeout, taskId));
        }, validatedTimeout * 60 * 1000);
      });

      // 创建执行Promise
      const executePromise = this.performPublish(taskId, task);

      // 使用Promise.race实现超时控制
      page = await Promise.race([executePromise, timeoutPromise]);

      const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
      console.log(`✅ [任务 #${taskId}] 执行完成，耗时: ${taskDuration}秒`);

    } catch (error: any) {
      const taskDuration = Math.round((Date.now() - taskStartTime) / 1000);
      console.error(`❌ [任务 #${taskId}] 执行失败，耗时: ${taskDuration}秒`, error);
      const isTimeout = error instanceof TaskTimeoutError;
      await this.handleTaskFailure(taskId, error, isTimeout);
    } finally {
      // 确保资源总是被清理（这是阻塞的，必须等待完成）
      const cleanupStartTime = Date.now();
      console.log(`🔄 [任务 #${taskId}] 开始清理资源...`);
      await this.cleanupBrowser(page, taskId);
      const cleanupDuration = Math.round((Date.now() - cleanupStartTime) / 1000);
      console.log(`✅ [任务 #${taskId}] 资源清理完成，耗时: ${cleanupDuration}秒`);
      
      const totalDuration = Math.round((Date.now() - taskStartTime) / 1000);
      console.log(`✅ [任务 #${taskId}] 总耗时: ${totalDuration}秒\n`);
    }
  }

  /**
   * 执行发布流程（不含超时控制）
   */
  private async performPublish(taskId: number, task: any): Promise<any> {
    let page = null;

    try {
      // 获取平台适配器
      const adapter = adapterRegistry.getAdapter(task.platform_id);
      if (!adapter) {
        throw new Error(`平台 ${task.platform_id} 的适配器未实现`);
      }

      // 设置任务ID，让适配器可以记录日志
      adapter.setTaskId(taskId);

      await publishingService.logMessage(
        taskId,
        'info',
        `📦 使用适配器: ${adapter.platformName}`
      );

      // 获取账号信息（包含凭证）
      const account = await accountService.getAccountById(task.account_id, task.user_id, true);
      if (!account || !account.credentials) {
        throw new Error('账号不存在或凭证无效');
      }

      // 获取文章内容（优先使用任务中的快照，确保即使原文章被删除也能发布）
      let article;
      
      // 检查任务是否有文章快照
      if (task.article_title && task.article_content) {
        // 使用任务中保存的文章快照
        article = {
          id: task.article_id,
          title: task.article_title,
          content: task.article_content,
          keyword: task.article_keyword
        };
        console.log(`📄 使用任务快照中的文章内容: "${article.title}"`);
      } else {
        // 回退到从数据库获取文章（兼容旧任务）
        const articleResult = await pool.query(
          'SELECT id, title, content, keyword FROM articles WHERE id = $1',
          [task.article_id]
        );

        if (articleResult.rows.length === 0) {
          throw new Error('文章不存在（原文章已删除且任务无快照）');
        }

        article = articleResult.rows[0];
        console.log(`📄 从数据库获取文章内容: "${article.title}"`);
      }

      // 预检查：验证文章中的图片是否存在（在启动浏览器前检查，节省资源）
      await this.validateArticleImages(taskId, article.content);

      // 启动浏览器（根据任务配置决定是否显示浏览器窗口）
      const headlessMode = task.config?.headless !== false; // 默认为静默模式
      const modeText = headlessMode ? '静默模式' : '可视化模式';
      await publishingService.logMessage(taskId, 'info', `🚀 启动浏览器（${modeText}）...`);
      await browserAutomationService.launchBrowser({ headless: headlessMode });
      await publishingService.logMessage(taskId, 'info', '✅ 浏览器启动成功');

      // 创建新页面
      page = await browserAutomationService.createPage();

      // 执行登录
      await publishingService.logMessage(taskId, 'info', `🔐 开始登录 ${adapter.platformName}...`);
      
      let loginSuccess = false;
      
      // 如果有Cookie，先尝试Cookie登录（关键修复：像测试登录一样处理）
      if (account.credentials.cookies && account.credentials.cookies.length > 0) {
        await publishingService.logMessage(taskId, 'info', `📝 使用Cookie登录（${account.credentials.cookies.length}个Cookie）`);
        
        // 关键修复：先设置Cookie，再导航到发布页面
        // 这样打开的就是已登录状态的页面，而不是登录页面
        await publishingService.logMessage(taskId, 'info', '🔑 设置Cookie...');
        
        // Playwright: Cookie 通过 context 设置
        const context = browserAutomationService.getContext();
        if (context) {
          // 规范化 Cookie 的 sameSite 属性
          const normalizedCookies = normalizeCookies(account.credentials.cookies);
          await context.addCookies(normalizedCookies);
        }
        
        await publishingService.logMessage(taskId, 'info', '✅ Cookie设置成功');
        
        // 直接导航到发布页面（此时Cookie已设置，会自动登录）
        await publishingService.logMessage(taskId, 'info', `🌐 打开 ${adapter.platformName} 发布页面（已登录状态）...`);
        await browserAutomationService.navigateTo(page, adapter.getPublishUrl(), taskId);
        
        // 等待页面加载完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 🔍 关键改进：验证Cookie是否有效（检测是否掉线）
        await publishingService.logMessage(taskId, 'info', '🔍 验证登录状态...');
        loginSuccess = await browserAutomationService.executeWithRetry(
          () => adapter.performLogin(page!, account.credentials),
          1, // 只尝试1次，因为Cookie要么有效要么无效
          taskId
        );
        
        if (loginSuccess) {
          await publishingService.logMessage(taskId, 'info', `✅ ${adapter.platformName} Cookie有效，已登录`);
          // 标记账号为在线状态
          await accountService.markAccountOnline(account.id);
        } else {
          // 检查任务是否被用户取消
          const currentTask = await publishingService.getTaskById(taskId);
          if (currentTask && currentTask.status === 'cancelled') {
            await publishingService.logMessage(taskId, 'info', '⚠️ 任务已被用户取消，跳过账号状态更新');
            throw new Error('任务已被用户取消');
          }
          
          await publishingService.logMessage(taskId, 'error', `❌ ${adapter.platformName} Cookie已失效或平台已掉线`);
          // 🔥 关键修复：只有在任务未被取消时才标记账号为掉线状态
          await accountService.markAccountOffline(account.id, 'Cookie已失效或平台已掉线');
          throw new Error(`${adapter.platformName} Cookie已失效，请重新登录`);
        }
      } else {
        // 没有Cookie，使用表单登录
        await publishingService.logMessage(taskId, 'info', '📝 使用表单登录');
        await publishingService.logMessage(taskId, 'info', `🌐 打开 ${adapter.platformName} 登录页...`);
        await browserAutomationService.navigateTo(
          page,
          adapter.getLoginUrl(),
          taskId
        );

        await publishingService.logMessage(taskId, 'info', '⌨️  输入账号密码...');
        loginSuccess = await browserAutomationService.executeWithRetry(
          () => adapter.performLogin(page!, account.credentials),
          task.max_retries,
          taskId
        );
        
        if (!loginSuccess) {
          throw new Error(`${adapter.platformName} 表单登录失败`);
        }
        
        await publishingService.logMessage(taskId, 'info', `✅ ${adapter.platformName} 表单登录成功`);
        
        // 表单登录后，导航到发布页面
        await publishingService.logMessage(taskId, 'info', `📄 打开 ${adapter.platformName} 发布页面...`);
        await browserAutomationService.navigateTo(
          page,
          adapter.getPublishUrl(),
          taskId
        );
      }

      if (!loginSuccess) {
        throw new Error(`${adapter.platformName} 登录失败`);
      }

      // 更新账号最后使用时间
      await accountService.updateLastUsed(account.id);

      // 执行发布
      await publishingService.logMessage(taskId, 'info', `📝 开始发布文章《${article.title}》...`);
      await publishingService.logMessage(taskId, 'info', '⌨️  正在输入标题...');
      
      const publishSuccess = await browserAutomationService.executeWithRetry(
        () => adapter.performPublish(page!, article, task.config),
        task.max_retries,
        taskId
      );

      if (!publishSuccess) {
        throw new Error('文章发布失败');
      }

      // 发布成功后等待4秒再关闭浏览器
      await publishingService.logMessage(taskId, 'info', '⏳ 等待4秒后关闭浏览器...');
      await new Promise(resolve => setTimeout(resolve, 4000));

      // CRITICAL: 先更新任务状态为成功
      await publishingService.updateTaskStatus(taskId, 'success');
      await publishingService.logMessage(taskId, 'info', '✅ 任务执行成功');
      console.log(`✅ 任务 #${taskId} 状态已更新为成功`);

      // 然后创建发布记录
      await publishingService.logMessage(taskId, 'info', `🎉 文章《${article.title}》发布成功！`);
      await this.createPublishingRecord(taskId, task, account);
      await publishingService.logMessage(taskId, 'info', '✅ 发布记录已创建');

      // 清除文章锁
      await this.clearArticleLock(task.article_id);
      console.log(`✅ 文章 #${task.article_id} 发布状态已清除（已移到发布记录）`);

      return page;
    } catch (error) {
      // 如果发生错误，确保清理page
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
   * 处理任务失败，包含重试逻辑
   */
  private async handleTaskFailure(taskId: number, error: Error, isTimeout: boolean = false): Promise<void> {
    // 检查任务是否被用户取消
    const task = await publishingService.getTaskById(taskId);
    if (!task) {
      console.error(`❌ 任务 #${taskId} 不存在，无法处理失败`);
      return;
    }
    
    // 如果任务已被取消，不做任何处理
    if (task.status === 'cancelled') {
      console.log(`⚠️ 任务 #${taskId} 已被用户取消，跳过失败处理`);
      await this.clearArticleLock(task.article_id);
      return;
    }
    
    // 增加重试次数
    await publishingService.incrementRetryCount(taskId);

    const nextRetryCount = task.retry_count + 1;
    const failureType = isTimeout ? '超时' : '失败';

    if (nextRetryCount < task.max_retries) {
      // 还可以重试，保持pending状态
      const statusMessage = `执行${failureType}，将自动重试 (${nextRetryCount}/${task.max_retries})`;
      await publishingService.updateTaskStatus(
        taskId,
        'pending',
        statusMessage
      );
      await publishingService.logMessage(
        taskId,
        'warning',
        statusMessage,
        { error: error.message, isTimeout }
      );
      console.log(`🔄 任务 #${taskId} 将在下次调度时重试 (${nextRetryCount}/${task.max_retries})`);
    } else {
      // 重试次数已用完，标记为失败或超时
      const finalStatus = isTimeout ? 'timeout' : 'failed';
      const errorMessage = `重试次数已用完: ${error.message}`;
      
      await publishingService.updateTaskStatus(
        taskId,
        finalStatus,
        errorMessage
      );
      await publishingService.logMessage(
        taskId,
        'error',
        `任务执行${failureType}，重试次数已用完`,
        { error: error.message, stack: error.stack, isTimeout }
      );

      // 发布失败，清除文章锁
      await this.clearArticleLock(task.article_id);
      console.log(`✅ 文章 #${task.article_id} 发布${failureType}，已恢复显示`);
    }
  }

  /**
   * 清除文章锁（publishing_status）
   */
  private async clearArticleLock(articleId: number): Promise<void> {
    await pool.query(
      'UPDATE articles SET publishing_status = NULL WHERE id = $1',
      [articleId]
    );
  }

  /**
   * 预检查：验证文章中的图片是否存在
   * 在启动浏览器前检查，避免浪费资源
   */
  private async validateArticleImages(taskId: number, content: string): Promise<void> {
    // 提取文章中的图片路径
    const imageRegex = /!\[.*?\]\((\/uploads\/[^)]+)\)/g;
    const matches = content.matchAll(imageRegex);
    const imagePaths: string[] = [];
    
    for (const match of matches) {
      imagePaths.push(match[1]);
    }
    
    if (imagePaths.length === 0) {
      await publishingService.logMessage(taskId, 'info', '📷 文章中没有图片，跳过图片检查');
      return;
    }
    
    await publishingService.logMessage(taskId, 'info', `📷 检查 ${imagePaths.length} 张图片是否存在...`);
    
    const missingImages: string[] = [];
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    for (const imagePath of imagePaths) {
      // 将 /uploads/xxx 转换为实际文件路径
      const relativePath = imagePath.replace(/^\/uploads\//, '');
      const fullPath = path.join(uploadsDir, relativePath);
      
      if (!fs.existsSync(fullPath)) {
        missingImages.push(imagePath);
      }
    }
    
    if (missingImages.length > 0) {
      const errorMsg = `图片文件不存在: ${missingImages.join(', ')}`;
      await publishingService.logMessage(taskId, 'error', `❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    await publishingService.logMessage(taskId, 'info', '✅ 所有图片文件检查通过');
  }

  /**
   * 清理浏览器资源（同步执行，确保资源被释放）
   */
  private async cleanupBrowser(page: any, taskId: number): Promise<void> {
    try {
      // 关闭页面
      if (page) {
        console.log(`🔄 [任务 #${taskId}] 关闭页面...`);
        await browserAutomationService.closePage(page);
        console.log(`✅ [任务 #${taskId}] 页面已关闭`);
      }
      
      // 关闭浏览器
      console.log(`🔄 [任务 #${taskId}] 关闭浏览器...`);
      await browserAutomationService.closeBrowser();
      console.log(`✅ [任务 #${taskId}] 浏览器已关闭`);
    } catch (error) {
      // 记录错误但不抛出异常，避免影响任务状态更新
      console.error(`⚠️  [任务 #${taskId}] 关闭浏览器失败:`, error);
      
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
   * 批量执行任务
   */
  async executeTasks(taskIds: number[]): Promise<void> {
    for (const taskId of taskIds) {
      try {
        await this.executeTask(taskId);
      } catch (error) {
        console.error(`任务 #${taskId} 执行失败:`, error);
        // 继续执行下一个任务
      }
    }
  }
}

export const publishingExecutor = new PublishingExecutor();
