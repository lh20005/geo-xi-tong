import { browserAutomationService } from './BrowserAutomationService';
import { publishingService } from './PublishingService';
import { accountService } from './AccountService';
import { adapterRegistry } from './adapters/AdapterRegistry';
import { pool } from '../db/database';

/**
 * 发布执行器
 * 负责执行实际的文章发布流程
 */
export class PublishingExecutor {
  /**
   * 创建发布记录并更新文章状态
   */
  private async createPublishingRecord(
    taskId: number,
    task: any,
    account: any
  ): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 创建发布记录
      await client.query(
        `INSERT INTO publishing_records 
         (article_id, task_id, platform_id, account_id, account_name, published_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          task.article_id,
          taskId,
          task.platform_id,
          task.account_id,
          account.account_name
        ]
      );
      
      // 更新文章发布状态（只在第一次发布时更新）
      await client.query(
        `UPDATE articles 
         SET is_published = true,
             published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [task.article_id]
      );
      
      await client.query('COMMIT');
      
      console.log(`✅ 文章 #${task.article_id} 发布记录已创建`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('创建发布记录失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 执行发布任务
   */
  async executeTask(taskId: number): Promise<void> {
    let page = null;

    try {
      // 获取任务详情
      const task = await publishingService.getTaskById(taskId);
      if (!task) {
        throw new Error('任务不存在');
      }

      await publishingService.logMessage(taskId, 'info', '开始执行发布任务');

      // 更新任务状态为运行中
      await publishingService.updateTaskStatus(taskId, 'running');

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
      const account = await accountService.getAccountById(task.account_id, true);
      if (!account || !account.credentials) {
        throw new Error('账号不存在或凭证无效');
      }

      // 获取文章内容
      const articleResult = await pool.query(
        'SELECT id, title, content FROM articles WHERE id = $1',
        [task.article_id]
      );

      if (articleResult.rows.length === 0) {
        throw new Error('文章不存在');
      }

      const article = articleResult.rows[0];

      // 启动浏览器（显示浏览器窗口以便用户看到发布过程）
      await publishingService.logMessage(taskId, 'info', '🚀 启动浏览器...');
      await browserAutomationService.launchBrowser({ headless: false });
      await publishingService.logMessage(taskId, 'info', '✅ 浏览器启动成功');

      // 创建新页面
      page = await browserAutomationService.createPage();

      // 执行登录
      await publishingService.logMessage(taskId, 'info', `🔐 开始登录 ${adapter.platformName}...`);
      
      let loginSuccess = false;
      
      // 如果有Cookie，先尝试Cookie登录
      if (account.credentials.cookies && account.credentials.cookies.length > 0) {
        await publishingService.logMessage(taskId, 'info', `📝 使用Cookie登录（${account.credentials.cookies.length}个Cookie）`);
        
        // 先导航到主页（不是登录页）
        const homeUrl = adapter.getPublishUrl().split('/').slice(0, 3).join('/'); // 获取域名
        await publishingService.logMessage(taskId, 'info', `🌐 打开 ${adapter.platformName} 主页...`);
        await browserAutomationService.navigateTo(page, homeUrl, taskId);
        
        await publishingService.logMessage(taskId, 'info', '🔑 设置登录凭证...');
        // 执行登录（适配器会使用Cookie）
        loginSuccess = await browserAutomationService.executeWithRetry(
          () => adapter.performLogin(page!, account.credentials),
          task.max_retries,
          taskId
        );
        
        if (!loginSuccess) {
          throw new Error('Cookie登录失败');
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
          throw new Error('表单登录失败');
        }
      }

      if (!loginSuccess) {
        throw new Error('登录失败');
      }

      await publishingService.logMessage(taskId, 'info', `✅ ${adapter.platformName} 登录成功`);

      // 更新账号最后使用时间
      await accountService.updateLastUsed(account.id);

      // 导航到发布页面
      await publishingService.logMessage(taskId, 'info', `📄 打开 ${adapter.platformName} 发布页面...`);
      await browserAutomationService.navigateTo(
        page,
        adapter.getPublishUrl(),
        taskId
      );

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

      // 更新任务状态为成功
      await publishingService.updateTaskStatus(taskId, 'success');
      await publishingService.logMessage(taskId, 'info', `🎉 文章《${article.title}》发布成功！`);

      // 创建发布记录并更新文章状态
      await this.createPublishingRecord(taskId, task, account);
      await publishingService.logMessage(taskId, 'info', '✅ 发布记录已创建，文章状态已更新');

      // 清除文章的 publishing_status（发布成功，文章已移到发布记录）
      await pool.query(
        `UPDATE articles 
         SET publishing_status = NULL 
         WHERE id = $1`,
        [task.article_id]
      );
      console.log(`✅ 文章 #${task.article_id} 发布状态已清除（已移到发布记录）`);

      console.log(`✅ 任务 #${taskId} 执行成功`);

    } catch (error: any) {
      console.error(`❌ 任务 #${taskId} 执行失败:`, error);

      // 增加重试次数
      await publishingService.incrementRetryCount(taskId);

      // 获取当前任务信息
      const task = await publishingService.getTaskById(taskId);

      if (task && task.retry_count < task.max_retries) {
        // 还可以重试，保持pending状态
        await publishingService.updateTaskStatus(
          taskId,
          'pending',
          `执行失败，将自动重试 (${task.retry_count + 1}/${task.max_retries})`
        );
        await publishingService.logMessage(
          taskId,
          'warning',
          `执行失败，将自动重试 (${task.retry_count + 1}/${task.max_retries})`,
          { error: error.message }
        );
      } else {
        // 重试次数已用完，标记为失败
        await publishingService.updateTaskStatus(
          taskId,
          'failed',
          error.message
        );
        await publishingService.logMessage(
          taskId,
          'error',
          '任务执行失败',
          { error: error.message, stack: error.stack }
        );

        // 发布失败，恢复文章的显示状态（清除 publishing_status）
        if (task) {
          await pool.query(
            `UPDATE articles 
             SET publishing_status = NULL 
             WHERE id = $1`,
            [task.article_id]
          );
          console.log(`✅ 文章 #${task.article_id} 发布失败，已恢复显示`);
        }
      }
    } finally {
      // 异步关闭浏览器，不阻塞任务完成
      // 这样批次执行器可以立即继续执行下一个任务
      this.closeBrowserAsync(page, taskId);
    }
  }

  /**
   * 异步关闭浏览器（不阻塞任务完成）
   */
  private closeBrowserAsync(page: any, taskId: number): void {
    // 使用 setTimeout 异步执行，不阻塞主流程
    setTimeout(async () => {
      try {
        console.log(`⏳ [任务 #${taskId}] 等待30秒后关闭浏览器...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // 清理资源
        if (page) {
          await browserAutomationService.closePage(page);
        }
        await browserAutomationService.closeBrowser();
        console.log(`✅ [任务 #${taskId}] 浏览器已关闭`);
      } catch (error) {
        console.error(`❌ [任务 #${taskId}] 关闭浏览器失败:`, error);
      }
    }, 0);
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
