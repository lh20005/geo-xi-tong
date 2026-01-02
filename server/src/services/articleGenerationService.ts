import { pool } from '../db/database';
import { AIService } from './aiService';
import { ContentCleaner } from './contentCleaner';
import { TopicSelectionService } from './topicSelectionService';
import { ImageSelectionService } from './imageSelectionService';

/**
 * 全局任务队列执行器（单例模式）
 * 确保所有任务按顺序执行，新任务加入队列等待
 */
class TaskQueueExecutor {
  private static instance: TaskQueueExecutor;
  private isRunning: boolean = false;
  private taskQueue: number[] = [];
  private service: ArticleGenerationService | null = null;

  private constructor() {}

  static getInstance(): TaskQueueExecutor {
    if (!TaskQueueExecutor.instance) {
      TaskQueueExecutor.instance = new TaskQueueExecutor();
    }
    return TaskQueueExecutor.instance;
  }

  setService(service: ArticleGenerationService) {
    this.service = service;
  }

  /**
   * 将任务添加到队列
   */
  addTasks(taskIds: number[]) {
    console.log(`[任务队列] 添加 ${taskIds.length} 个任务到队列: [${taskIds.join(', ')}]`);
    this.taskQueue.push(...taskIds);
    console.log(`[任务队列] 当前队列长度: ${this.taskQueue.length}`);
    
    // 如果执行器没有运行，启动它
    if (!this.isRunning) {
      this.startExecutor();
    }
  }

  /**
   * 启动执行器
   */
  private async startExecutor() {
    if (this.isRunning) {
      console.log(`[任务队列] 执行器已在运行中`);
      return;
    }

    this.isRunning = true;
    console.log(`[任务队列] 启动执行器`);

    while (this.taskQueue.length > 0) {
      const taskId = this.taskQueue.shift()!;
      console.log(`[任务队列] 从队列取出任务 ${taskId}，剩余队列长度: ${this.taskQueue.length}`);

      // 检查任务状态
      const taskStatus = await this.service?.getTaskStatus(taskId);
      console.log(`[任务队列] 任务 ${taskId} 当前状态: ${taskStatus}`);

      if (taskStatus === 'failed') {
        console.log(`[任务队列] 任务 ${taskId} 已被取消，跳过执行`);
        continue;
      }

      if (taskStatus !== 'pending') {
        console.log(`[任务队列] 任务 ${taskId} 状态为 ${taskStatus}，跳过执行`);
        continue;
      }

      try {
        console.log(`[任务队列] 开始执行任务 ${taskId}`);
        await this.service?.executeTask(taskId);
        console.log(`[任务队列] 任务 ${taskId} 执行完成`);
      } catch (error: any) {
        console.error(`[任务队列] 任务 ${taskId} 执行出错:`, error.message);
      }

      // 添加短暂延迟
      if (this.taskQueue.length > 0) {
        console.log(`[任务队列] 等待1秒后执行下一个任务...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.isRunning = false;
    console.log(`[任务队列] 执行器停止，队列已清空`);
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      queueLength: this.taskQueue.length,
      queuedTaskIds: [...this.taskQueue]
    };
  }
}

// 导出全局队列执行器实例
export const taskQueueExecutor = TaskQueueExecutor.getInstance();

export interface TaskConfig {
  distillationId: number;
  albumId: number;
  knowledgeBaseId: number;
  articleSettingId: number;
  conversionTargetId?: number;
  articleCount: number;
  userId: number; // 用户ID，用于多租户隔离
}

export interface GenerationTask {
  id: number;
  distillationId: number;
  albumId: number;
  knowledgeBaseId: number;
  articleSettingId: number;
  conversionTargetId?: number | null;
  requestedCount: number;
  generatedCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  conversionTargetName?: string | null;
  keyword: string;
  provider: string;
  distillationResult?: string | null;
  userId: number; // 添加用户ID
}

export interface KeywordTopicPair {
  keyword: string;
  topics: string[];
}

export interface DiagnosticReport {
  taskId: number;
  taskStatus: string;
  requestedCount: number;
  generatedCount: number;
  errorMessage: string | null;
  checks: {
    distillationExists: boolean;
    topicsExist: boolean;
    topicCount: number;
    albumExists: boolean;
    imageCount: number;
    knowledgeBaseExists: boolean;
    articleSettingExists: boolean;
    aiConfigExists: boolean;
    aiConfigValid: boolean;
  };
  recommendations: string[];
}

export class ArticleGenerationService {
  /**
   * 批量加载蒸馏结果数据（支持单关键词多话题模式）
   * 
   * 新逻辑：
   * 1. 如果distillationIds中有重复ID，为每个位置选择不同的话题
   * 2. 返回数组而不是Map，保持顺序
   * 
   * @param distillationIds 蒸馏结果ID列表（可能有重复）
   * @returns 数组，每个元素对应一个文章的数据
   */
  private async loadDistillationDataArray(
    distillationIds: number[]
  ): Promise<Array<{ distillationId: number; keyword: string; topicId: number; topic: string }>> {
    console.log(`[批量加载] 开始加载 ${distillationIds.length} 个蒸馏结果的数据...`);
    
    if (distillationIds.length === 0) {
      console.warn(`[批量加载] ID列表为空，返回空数组`);
      return [];
    }
    
    // 1. 获取唯一的蒸馏结果ID
    const uniqueIds = Array.from(new Set(distillationIds));
    console.log(`[批量加载] 唯一的蒸馏结果ID: [${uniqueIds.join(', ')}]`);
    
    // 2. 批量查询蒸馏结果的关键词
    const distillationResult = await pool.query(
      `SELECT id, keyword FROM distillations WHERE id = ANY($1)`,
      [uniqueIds]
    );
    
    const keywordMap = new Map<number, string>();
    for (const row of distillationResult.rows) {
      keywordMap.set(row.id, row.keyword);
    }
    
    // 3. 为每个蒸馏结果ID（包括重复的）选择话题
    const topicService = new TopicSelectionService();
    const dataArray: Array<{ distillationId: number; keyword: string; topicId: number; topic: string }> = [];
    
    // 跟踪每个蒸馏结果已使用的话题ID，避免重复
    const usedTopicIds = new Map<number, Set<number>>();
    
    for (let i = 0; i < distillationIds.length; i++) {
      const distillationId = distillationIds[i];
      const keyword = keywordMap.get(distillationId);
      
      if (!keyword) {
        console.warn(`[批量加载] 警告：蒸馏结果ID ${distillationId} 不存在`);
        continue;
      }
      
      // 获取该蒸馏结果已使用的话题ID集合
      if (!usedTopicIds.has(distillationId)) {
        usedTopicIds.set(distillationId, new Set());
      }
      const usedIds = usedTopicIds.get(distillationId)!;
      
      // 选择一个未使用的话题
      const topicData = await topicService.selectLeastUsedTopic(distillationId);
      
      if (!topicData) {
        console.warn(`[批量加载] 警告：蒸馏结果ID ${distillationId} 没有可用话题`);
        continue;
      }
      
      // 如果这个话题已经在本次任务中使用过，尝试选择下一个
      let selectedTopic = topicData;
      if (usedIds.has(topicData.topicId)) {
        // 查询下一个未使用的话题
        const nextTopicResult = await pool.query(
          `SELECT id, question, usage_count
           FROM topics
           WHERE distillation_id = $1 AND id NOT IN (${Array.from(usedIds).join(',') || '0'})
           ORDER BY usage_count ASC, created_at ASC
           LIMIT 1`,
          [distillationId]
        );
        
        if (nextTopicResult.rows.length > 0) {
          selectedTopic = {
            topicId: nextTopicResult.rows[0].id,
            question: nextTopicResult.rows[0].question,
            usageCount: nextTopicResult.rows[0].usage_count || 0
          };
        }
      }
      
      // 记录已使用的话题
      usedIds.add(selectedTopic.topicId);
      
      dataArray.push({
        distillationId,
        keyword,
        topicId: selectedTopic.topicId,
        topic: selectedTopic.question
      });
      
      console.log(`[批量加载] [${i + 1}/${distillationIds.length}] 蒸馏结果 ID=${distillationId}, 关键词="${keyword}", 选中话题ID=${selectedTopic.topicId}, 使用次数=${selectedTopic.usageCount}`);
    }
    
    console.log(`[批量加载] 成功加载 ${dataArray.length} 个文章数据`);
    
    return dataArray;
  }

  /**
   * 创建生成任务（拆分为多个独立任务，预先分配话题）
   * 
   * 新逻辑：
   * 1. 预先为每篇文章选择不同的话题（避免并发冲突）
   * 2. 将一个批次拆分成多个独立的任务，每个任务生成1篇文章
   * 3. 每个任务使用预先分配的话题ID
   * 4. 串行执行任务，确保话题不重复
   * 5. 返回第一个任务的ID（用于前端显示）
   */
  async createTask(config: TaskConfig): Promise<number> {
    console.log(`[任务创建] 开始创建批次任务，请求生成 ${config.articleCount} 篇文章`);
    console.log(`[任务创建] 使用蒸馏结果ID: ${config.distillationId}`);
    
    // 1. 预先为每篇文章选择不同的话题（一次性选择，避免并发冲突）
    console.log(`[任务创建] 预先选择 ${config.articleCount} 个不同的话题...`);
    const topicService = new TopicSelectionService();
    const selectedTopics: Array<{ topicId: number; question: string }> = [];
    const usedTopicIds = new Set<number>();
    
    for (let i = 0; i < config.articleCount; i++) {
      // 查询下一个未使用的话题
      const topicResult = await pool.query(
        `SELECT id, question, usage_count
         FROM topics
         WHERE distillation_id = $1 ${usedTopicIds.size > 0 ? `AND id NOT IN (${Array.from(usedTopicIds).join(',')})` : ''}
         ORDER BY usage_count ASC, created_at ASC
         LIMIT 1`,
        [config.distillationId]
      );
      
      if (topicResult.rows.length === 0) {
        console.warn(`[任务创建] 警告：没有更多可用话题，已选择 ${selectedTopics.length} 个话题`);
        break;
      }
      
      const topic = topicResult.rows[0];
      selectedTopics.push({
        topicId: topic.id,
        question: topic.question
      });
      usedTopicIds.add(topic.id);
      
      console.log(`[任务创建] 选择话题 ${i + 1}/${config.articleCount}: ID=${topic.id}, 问题="${topic.question.substring(0, 30)}...", 使用次数=${topic.usage_count || 0}`);
    }
    
    if (selectedTopics.length === 0) {
      throw new Error('没有可用的话题，无法创建任务');
    }
    
    console.log(`[任务创建] 成功预选 ${selectedTopics.length} 个不同的话题`);
    console.log(`[任务创建] 将创建 ${selectedTopics.length} 个独立任务，每个任务生成1篇文章`);
    
    // 2. 为每篇文章创建一个独立的任务，并保存预选的话题ID
    const taskIds: number[] = [];
    
    for (let i = 0; i < selectedTopics.length; i++) {
      const topic = selectedTopics[i];
      
      // 将话题ID保存到selected_distillation_ids中（虽然字段名是distillation_ids，但我们用它来存储话题ID）
      // 注意：这里需要修改数据结构，暂时先用一个特殊格式
      const selectedIdsJson = JSON.stringify({
        distillationId: config.distillationId,
        topicId: topic.topicId
      });
      
      // 创建独立任务
      const result = await pool.query(
        `INSERT INTO generation_tasks 
         (distillation_id, album_id, knowledge_base_id, article_setting_id, conversion_target_id, requested_count, selected_distillation_ids, user_id, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') 
         RETURNING id`,
        [
          config.distillationId,
          config.albumId,
          config.knowledgeBaseId,
          config.articleSettingId,
          config.conversionTargetId || null,
          1, // 每个任务只生成1篇文章
          selectedIdsJson,
          config.userId // 添加用户ID
        ]
      );
      
      const taskId = result.rows[0].id;
      taskIds.push(taskId);
      console.log(`[任务创建] 创建子任务 ${i + 1}/${selectedTopics.length}，ID: ${taskId}，话题ID: ${topic.topicId}`);
    }
    
    console.log(`[任务创建] 批次任务创建成功，共创建 ${taskIds.length} 个独立任务`);
    
    // 3. 将任务添加到全局队列（而不是直接执行）
    console.log(`[任务创建] 将任务添加到全局队列...`);
    taskQueueExecutor.setService(this);
    taskQueueExecutor.addTasks(taskIds);
    
    // 4. 返回第一个任务的ID（用于前端显示）
    return taskIds[0];
  }
  
  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: number): Promise<string | null> {
    const result = await pool.query(
      'SELECT status FROM generation_tasks WHERE id = $1',
      [taskId]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0].status;
  }

  /**
   * 获取任务列表
   * 需求: 8.4, 8.5, 13.3
   */
  async getTasks(page: number = 1, pageSize: number = 10, userId?: number): Promise<{ tasks: GenerationTask[]; total: number }> {
    const offset = (page - 1) * pageSize;

    // 添加用户ID过滤
    const countQuery = userId 
      ? 'SELECT COUNT(*) FROM generation_tasks WHERE user_id = $1'
      : 'SELECT COUNT(*) FROM generation_tasks';
    const countParams = userId ? [userId] : [];
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // 添加用户ID过滤到主查询
    const whereClause = userId ? 'WHERE gt.user_id = $3' : '';
    const queryParams = userId ? [pageSize, offset, userId] : [pageSize, offset];

    const result = await pool.query(
      `SELECT 
        gt.id, 
        gt.distillation_id, 
        gt.album_id, 
        gt.knowledge_base_id, 
        gt.article_setting_id, 
        gt.conversion_target_id,
        gt.requested_count, 
        gt.generated_count, 
        gt.status, 
        gt.progress, 
        gt.error_message,
        gt.created_at, 
        gt.updated_at,
        gt.user_id,
        gt.selected_distillation_ids,
        ct.company_name as conversion_target_name,
        d.keyword,
        d.provider,
        (
          SELECT STRING_AGG(t.question, '|||' ORDER BY a.id)
          FROM articles a
          INNER JOIN topics t ON a.topic_id = t.id
          WHERE a.task_id = gt.id
        ) as distillation_result
       FROM generation_tasks gt
       LEFT JOIN conversion_targets ct ON gt.conversion_target_id = ct.id
       INNER JOIN distillations d ON gt.distillation_id = d.id
       ${whereClause}
       ORDER BY gt.created_at DESC
       LIMIT $1 OFFSET $2`,
      queryParams
    );

    return {
      tasks: result.rows.map(row => {
        // 直接使用SQL查询的distillation_result，不再进行额外处理
        // 这样可以显示每篇文章对应的具体话题内容
        const distillationResult = row.distillation_result || null;
        const keyword = row.keyword;
        
        return {
          id: row.id,
          distillationId: row.distillation_id,
          albumId: row.album_id,
          knowledgeBaseId: row.knowledge_base_id,
          articleSettingId: row.article_setting_id,
          conversionTargetId: row.conversion_target_id,
          requestedCount: row.requested_count,
          generatedCount: row.generated_count,
          status: row.status,
          progress: row.progress,
          errorMessage: row.error_message,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          userId: row.user_id,
          conversionTargetName: row.conversion_target_name || null,
          keyword,
          provider: row.provider,
          distillationResult
        };
      }),
      total
    };
  }

  /**
   * 获取任务详情
   */
  async getTaskDetail(taskId: number, userId?: number): Promise<GenerationTask | null> {
    // 添加用户ID过滤
    const whereClause = userId ? 'WHERE gt.id = $1 AND gt.user_id = $2' : 'WHERE gt.id = $1';
    const queryParams = userId ? [taskId, userId] : [taskId];

    const result = await pool.query(
      `SELECT 
        gt.id, 
        gt.distillation_id, 
        gt.album_id, 
        gt.knowledge_base_id, 
        gt.article_setting_id, 
        gt.conversion_target_id,
        gt.requested_count, 
        gt.generated_count, 
        gt.status, 
        gt.progress, 
        gt.error_message,
        gt.created_at, 
        gt.updated_at,
        gt.user_id,
        ct.company_name as conversion_target_name,
        d.keyword,
        d.provider,
        (
          SELECT STRING_AGG(DISTINCT t.question, ', ' ORDER BY t.question)
          FROM articles a
          INNER JOIN topics t ON a.topic_id = t.id
          WHERE a.task_id = gt.id
        ) as distillation_result
       FROM generation_tasks gt
       LEFT JOIN conversion_targets ct ON gt.conversion_target_id = ct.id
       INNER JOIN distillations d ON gt.distillation_id = d.id
       ${whereClause}`,
      queryParams
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      distillationId: row.distillation_id,
      albumId: row.album_id,
      knowledgeBaseId: row.knowledge_base_id,
      articleSettingId: row.article_setting_id,
      conversionTargetId: row.conversion_target_id,
      requestedCount: row.requested_count,
      generatedCount: row.generated_count,
      status: row.status,
      progress: row.progress,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userId: row.user_id,
      conversionTargetName: row.conversion_target_name || null,
      keyword: row.keyword,
      provider: row.provider,
      distillationResult: row.distillation_result || null
    };
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(
    taskId: number,
    status: 'pending' | 'running' | 'completed' | 'failed',
    generatedCount?: number,
    errorMessage?: string
  ): Promise<void> {
    const updates: string[] = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [taskId, status];
    let paramIndex = 3;

    if (generatedCount !== undefined) {
      updates.push(`generated_count = $${paramIndex}`);
      values.push(generatedCount);
      paramIndex++;
    }

    if (errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex}`);
      values.push(errorMessage);
      paramIndex++;
    }

    await pool.query(
      `UPDATE generation_tasks SET ${updates.join(', ')} WHERE id = $1`,
      values
    );
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(taskId: number, generatedCount: number, requestedCount: number): Promise<void> {
    const progress = Math.round((generatedCount / requestedCount) * 100);

    await pool.query(
      `UPDATE generation_tasks 
       SET generated_count = $2, progress = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [taskId, generatedCount, progress]
    );
  }

  /**
   * 执行生成任务（异步）
   * 需求: 2.1, 2.2, 2.4, 2.5, 4.3, 9.1, 9.2
   * 
   * 新的实现逻辑：
   * 1. 从任务记录中读取selected_distillation_ids
   * 2. 如果为空，使用旧逻辑（向后兼容）
   * 3. 批量加载所有预选蒸馏结果的数据
   * 4. 为每篇文章分配不同的蒸馏结果
   * 5. 生成文章并更新usage_count
   */
  async executeTask(taskId: number): Promise<void> {
    console.log(`[任务 ${taskId}] 开始执行`);
    
    // 首先检查任务状态
    const currentStatus = await this.getTaskStatus(taskId);
    if (currentStatus === 'failed') {
      console.log(`[任务 ${taskId}] 任务已被取消（状态为failed），跳过执行`);
      return;
    }
    if (currentStatus !== 'pending') {
      console.log(`[任务 ${taskId}] 任务状态为 ${currentStatus}，跳过执行`);
      return;
    }
    
    try {
      // 更新状态为运行中
      await this.updateTaskStatus(taskId, 'running');
      console.log(`[任务 ${taskId}] 状态更新为运行中`);

      // 验证配置（快速失败）
      console.log(`[任务 ${taskId}] 验证配置...`);
      await this.validateTaskConfiguration(taskId);
      console.log(`[任务 ${taskId}] 配置验证通过`);

      // 获取任务配置
      const task = await this.getTaskDetail(taskId);
      if (!task) {
        throw new Error('任务不存在');
      }

      // 1. 从数据库读取selected_distillation_ids（需求 2.1, 4.3）
      const selectedIdsResult = await pool.query(
        'SELECT selected_distillation_ids FROM generation_tasks WHERE id = $1',
        [taskId]
      );
      
      const selectedIdsJson = selectedIdsResult.rows[0]?.selected_distillation_ids;
      let distillationDataArray: Array<{ distillationId: number; keyword: string; topicId: number; topic: string }> = [];
      
      // 反序列化JSON字符串
      if (selectedIdsJson) {
        try {
          const parsedData = JSON.parse(selectedIdsJson);
          
          // 检查是否是新格式（包含预分配的话题ID）
          if (parsedData && typeof parsedData === 'object' && 'distillationId' in parsedData && 'topicId' in parsedData) {
            console.log(`[任务 ${taskId}] 检测到新格式：预分配的话题ID=${parsedData.topicId}`);
            
            // 加载蒸馏结果和话题数据
            const distillationResult = await pool.query(
              'SELECT id, keyword FROM distillations WHERE id = $1',
              [parsedData.distillationId]
            );
            
            const topicResult = await pool.query(
              'SELECT id, question FROM topics WHERE id = $1',
              [parsedData.topicId]
            );
            
            if (distillationResult.rows.length > 0 && topicResult.rows.length > 0) {
              distillationDataArray = [{
                distillationId: parsedData.distillationId,
                keyword: distillationResult.rows[0].keyword,
                topicId: parsedData.topicId,
                topic: topicResult.rows[0].question
              }];
              
              console.log(`[任务 ${taskId}] 使用预分配的话题: ID=${parsedData.topicId}, 问题="${topicResult.rows[0].question.substring(0, 30)}..."`);
            } else {
              throw new Error('预分配的蒸馏结果或话题不存在');
            }
          } else if (Array.isArray(parsedData)) {
            // 旧格式：数组
            console.log(`[任务 ${taskId}] 检测到旧格式：蒸馏结果ID数组 [${parsedData.join(', ')}]`);
            distillationDataArray = await this.loadDistillationDataArray(parsedData);
          } else {
            throw new Error('无法识别的selected_distillation_ids格式');
          }
        } catch (error: any) {
          console.error(`[任务 ${taskId}] 解析selected_distillation_ids失败:`, error.message);
        }
      }
      
      // 2. 向后兼容逻辑：如果没有数据，使用旧逻辑（需求 9.1, 9.2）
      if (distillationDataArray.length === 0) {
        console.log(`[任务 ${taskId}] 没有预选数据，使用旧的单蒸馏结果逻辑`);
        await this.executeTaskLegacy(taskId, task);
        return;
      }

      // 3. 记录加载的数据
      console.log(`[任务 ${taskId}] 成功加载 ${distillationDataArray.length} 个文章数据`);
      
      for (let i = 0; i < distillationDataArray.length; i++) {
        const data = distillationDataArray[i];
        console.log(`[任务 ${taskId}] [文章 ${i + 1}] 蒸馏结果 ID=${data.distillationId}, 关键词="${data.keyword}", 话题ID=${data.topicId}, 话题="${data.topic.substring(0, 30)}..."`);
      }

      // 获取知识库内容
      console.log(`[任务 ${taskId}] 加载知识库内容...`);
      const knowledgeContent = await this.getKnowledgeBaseContent(task.knowledgeBaseId);
      console.log(`[任务 ${taskId}] 知识库内容长度: ${knowledgeContent.length} 字符`);

      // 获取文章设置提示词
      console.log(`[任务 ${taskId}] 加载文章设置...`);
      const articlePrompt = await this.getArticleSettingPrompt(task.articleSettingId);

      // 获取转化目标（公司名称、行业、网站、地址）
      let companyName: string | undefined;
      let companyIndustry: string | undefined;
      let companyWebsite: string | undefined;
      let companyAddress: string | undefined;
      if (task.conversionTargetId) {
        console.log(`[任务 ${taskId}] 加载转化目标...`);
        const targetResult = await pool.query(
          'SELECT company_name, industry, website, address FROM conversion_targets WHERE id = $1',
          [task.conversionTargetId]
        );
        if (targetResult.rows.length > 0) {
          companyName = targetResult.rows[0].company_name;
          companyIndustry = targetResult.rows[0].industry;
          companyWebsite = targetResult.rows[0].website;
          companyAddress = targetResult.rows[0].address;
          console.log(`[任务 ${taskId}] 转化目标: ${companyName}${companyAddress ? ` (地址: ${companyAddress})` : ''}`);
        }
      }

      // 获取AI配置
      console.log(`[任务 ${taskId}] 加载AI配置...`);
      const aiConfig = await this.getActiveAIConfig();
      console.log(`[任务 ${taskId}] 使用AI提供商: ${aiConfig.provider}`);

      // 确定实际生成数量
      const actualCount = distillationDataArray.length;
      console.log(`[任务 ${taskId}] 计划生成 ${actualCount} 篇文章`);

      // 4. 逐个生成文章，每篇使用不同的话题
      let generatedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < actualCount; i++) {
        // 在生成每篇文章前检查任务是否已被取消
        const currentStatus = await this.getTaskStatus(taskId);
        if (currentStatus === 'failed') {
          console.log(`[任务 ${taskId}] 任务已被用户取消（状态变为failed），停止生成`);
          return; // 直接返回，任务队列会继续执行下一个任务
        }
        
        console.log(`\n[任务 ${taskId}] ========== 开始生成第 ${i + 1}/${actualCount} 篇文章 ==========`);
        
        const distillationData = distillationDataArray[i];
        const distillationId = distillationData.distillationId;
        
        console.log(`[任务 ${taskId}] [文章 ${i + 1}] 使用蒸馏结果: ID=${distillationId}, 关键词="${distillationData.keyword}", 话题ID=${distillationData.topicId}, 话题="${distillationData.topic.substring(0, 30)}..."`);

        try {
          // 从图库均衡选择图片（使用次数最少的优先）
          let imageUrl: string;
          let imageId: number | undefined;
          
          try {
            const imageData = await this.selectBalancedImage(task.albumId);
            
            if (imageData) {
              imageUrl = imageData.imageUrl;
              imageId = imageData.imageId;
              console.log(`[任务 ${taskId}] [文章 ${i + 1}] 选择图片: ID=${imageId}, URL=${imageUrl}`);
            } else {
              // 如果图库为空，使用默认占位图片
              imageUrl = '/uploads/gallery/placeholder.png';
              console.log(`[任务 ${taskId}] [文章 ${i + 1}] 图库为空，使用默认占位图片`);
            }
          } catch (imageError: any) {
            // 图片选择失败，使用默认图片继续执行
            console.error(`[任务 ${taskId}] [文章 ${i + 1}] 图片选择失败:`, imageError.message);
            imageUrl = '/uploads/gallery/placeholder.png';
            console.log(`[任务 ${taskId}] [文章 ${i + 1}] 使用默认占位图片继续执行`);
          }

          // 生成单篇文章（使用单个话题，包含转化目标）
          // 传入文章序号和总数，用于增加标题多样性
          const result = await this.generateSingleArticle(
            distillationData.keyword,
            [distillationData.topic], // 只使用一个话题
            imageUrl,
            knowledgeContent,
            articlePrompt,
            aiConfig,
            companyName, // 传入公司名称
            companyIndustry,
            companyWebsite,
            companyAddress,
            i + 1, // 当前文章序号
            actualCount // 总文章数
          );

          if (result.success && result.title && result.content) {
            console.log(`[任务 ${taskId}] [文章 ${i + 1}] 文章生成成功，标题: ${result.title}`);

            // 5. 保存文章并记录使用（包括话题使用记录和图片使用记录）
            console.log(`[任务 ${taskId}] [文章 ${i + 1}] 开始保存文章并更新usage_count...`);
            const articleId = await this.saveArticleWithTopicTracking(
              taskId,
              distillationId,
              distillationData.topicId,
              distillationData.keyword,
              result.title,
              result.content,
              imageUrl,
              aiConfig.provider,
              task.userId,
              imageId
            );
            console.log(`[任务 ${taskId}] [文章 ${i + 1}] 文章保存成功，ID: ${articleId}，话题ID: ${distillationData.topicId} 的usage_count已更新${imageId ? `，图片ID: ${imageId} 的usage_count已更新` : ''}`);

            generatedCount++;

            // 更新进度
            await this.updateTaskProgress(taskId, generatedCount, actualCount);
            console.log(`[任务 ${taskId}] [文章 ${i + 1}] 进度更新: ${generatedCount}/${actualCount}`);
          } else {
            // 文章生成失败
            const errorMsg = `文章 ${i + 1} (关键词: ${distillationData.keyword}, 话题: ${distillationData.topic.substring(0, 20)}): ${result.error || '未知错误'}`;
            console.error(`[任务 ${taskId}] ${errorMsg}`);
            errors.push(errorMsg);
            // 继续处理下一篇文章
          }
        } catch (error: any) {
          // 捕获其他意外错误（如保存失败）
          const errorMsg = `文章 ${i + 1} (关键词: ${distillationData.keyword}, 话题: ${distillationData.topic.substring(0, 20)}): ${error.message}`;
          console.error(`[任务 ${taskId}] ${errorMsg}`);
          errors.push(errorMsg);
          // 继续处理下一篇文章
        }
      }

      // 根据实际生成数量决定最终状态（需求 6.4）
      if (generatedCount > 0) {
        console.log(`[任务 ${taskId}] 成功生成 ${generatedCount} 篇文章，标记为完成`);
        await this.updateTaskStatus(taskId, 'completed', generatedCount);
      } else {
        const errorMessage = `所有文章生成失败: ${errors.join('; ')}`;
        console.error(`[任务 ${taskId}] ${errorMessage}`);
        await this.updateTaskStatus(taskId, 'failed', 0, errorMessage);
      }

      console.log(`[任务 ${taskId}] 执行完成`);
    } catch (error: any) {
      console.error(`[任务 ${taskId}] 致命错误:`, error);
      await this.updateTaskStatus(taskId, 'failed', undefined, error.message);
    }
  }

  /**
   * 执行任务（旧逻辑，用于向后兼容）
   * 需求: 9.1, 9.2, 9.3
   * 
   * 当任务没有selected_distillation_ids时，使用distillation_id字段作为后备
   */
  private async executeTaskLegacy(taskId: number, task: GenerationTask): Promise<void> {
    console.log(`[任务 ${taskId}] 使用旧的单蒸馏结果逻辑`);
    
    // 获取蒸馏历史的关键词-话题对
    console.log(`[任务 ${taskId}] 提取关键词和话题...`);
    const keywordTopicPairs = await this.extractKeywordTopicPairs(task.distillationId);
    console.log(`[任务 ${taskId}] 找到 ${keywordTopicPairs.length} 个关键词-话题对`);

    // 获取知识库内容
    console.log(`[任务 ${taskId}] 加载知识库内容...`);
    const knowledgeContent = await this.getKnowledgeBaseContent(task.knowledgeBaseId);
    console.log(`[任务 ${taskId}] 知识库内容长度: ${knowledgeContent.length} 字符`);

    // 获取文章设置提示词
    console.log(`[任务 ${taskId}] 加载文章设置...`);
    const articlePrompt = await this.getArticleSettingPrompt(task.articleSettingId);

    // 获取转化目标（公司名称、行业、网站、地址）
    let companyName: string | undefined;
    let companyIndustry: string | undefined;
    let companyWebsite: string | undefined;
    let companyAddress: string | undefined;
    if (task.conversionTargetId) {
      console.log(`[任务 ${taskId}] 加载转化目标...`);
      const targetResult = await pool.query(
        'SELECT company_name, industry, website, address FROM conversion_targets WHERE id = $1',
        [task.conversionTargetId]
      );
      if (targetResult.rows.length > 0) {
        companyName = targetResult.rows[0].company_name;
        companyIndustry = targetResult.rows[0].industry;
        companyWebsite = targetResult.rows[0].website;
        companyAddress = targetResult.rows[0].address;
        console.log(`[任务 ${taskId}] 转化目标: ${companyName}${companyAddress ? ` (地址: ${companyAddress})` : ''}`);
      }
    }

    // 获取AI配置
    console.log(`[任务 ${taskId}] 加载AI配置...`);
    const aiConfig = await this.getActiveAIConfig();
    console.log(`[任务 ${taskId}] 使用AI提供商: ${aiConfig.provider}`);

    // 确定实际生成数量（不超过关键词数量）
    const actualCount = Math.min(task.requestedCount, keywordTopicPairs.length);
    console.log(`[任务 ${taskId}] 计划生成 ${actualCount} 篇文章`);

    // 逐个生成文章（容错处理）
    let generatedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < actualCount; i++) {
      console.log(`[任务 ${taskId}] 开始生成第 ${i + 1}/${actualCount} 篇文章...`);
      const pair = keywordTopicPairs[i];

      try {
        // 从图库均衡选择图片（使用次数最少的优先）
        let imageUrl: string;
        let imageId: number | undefined;
        
        try {
          const imageData = await this.selectBalancedImage(task.albumId);
          
          if (imageData) {
            imageUrl = imageData.imageUrl;
            imageId = imageData.imageId;
            console.log(`[任务 ${taskId}] 选择图片: ID=${imageId}, URL=${imageUrl}`);
          } else {
            // 如果图库为空，使用默认占位图片
            imageUrl = '/uploads/gallery/placeholder.png';
            console.log(`[任务 ${taskId}] 图库为空，使用默认占位图片`);
          }
        } catch (imageError: any) {
          // 图片选择失败，使用默认图片继续执行
          console.error(`[任务 ${taskId}] 图片选择失败:`, imageError.message);
          imageUrl = '/uploads/gallery/placeholder.png';
          console.log(`[任务 ${taskId}] 使用默认占位图片继续执行`);
        }

        // 生成单篇文章（包含转化目标）
        const result = await this.generateSingleArticle(
          pair.keyword,
          pair.topics,
          imageUrl,
          knowledgeContent,
          articlePrompt,
          aiConfig,
          companyName,
          companyIndustry,
          companyWebsite,
          companyAddress
        );

        if (result.success && result.title && result.content) {
          console.log(`[任务 ${taskId}] 文章生成成功，标题: ${result.title}`);

          // 保存文章并记录使用（使用事务）
          const articleId = await this.saveArticleWithUsageTracking(
            taskId,
            task.distillationId,
            pair.keyword,
            result.title,
            result.content,
            imageUrl,
            aiConfig.provider,
            task.userId,
            imageId
          );
          console.log(`[任务 ${taskId}] 文章保存成功，ID: ${articleId}${imageId ? `，图片ID: ${imageId} 的usage_count已更新` : ''}`);

          generatedCount++;

          // 更新进度
          await this.updateTaskProgress(taskId, generatedCount, actualCount);
          console.log(`[任务 ${taskId}] 进度更新: ${generatedCount}/${actualCount}`);
        } else {
          // 文章生成失败
          const errorMsg = `文章 ${i + 1} (关键词: ${pair.keyword}): ${result.error || '未知错误'}`;
          console.error(`[任务 ${taskId}] ${errorMsg}`);
          errors.push(errorMsg);
          // 继续处理下一篇文章
        }
      } catch (error: any) {
        // 捕获其他意外错误（如保存失败）
        const errorMsg = `文章 ${i + 1} (关键词: ${pair.keyword}): ${error.message}`;
        console.error(`[任务 ${taskId}] ${errorMsg}`);
        errors.push(errorMsg);
        // 继续处理下一篇文章
      }
    }

    // 根据实际生成数量决定最终状态
    if (generatedCount > 0) {
      console.log(`[任务 ${taskId}] 成功生成 ${generatedCount} 篇文章，标记为完成`);
      await this.updateTaskStatus(taskId, 'completed', generatedCount);
    } else {
      const errorMessage = `所有文章生成失败: ${errors.join('; ')}`;
      console.error(`[任务 ${taskId}] ${errorMessage}`);
      await this.updateTaskStatus(taskId, 'failed', 0, errorMessage);
    }
  }

  /**
   * 从蒸馏历史提取关键词-话题对
   */
  async extractKeywordTopicPairs(distillationId: number): Promise<KeywordTopicPair[]> {
    // 获取蒸馏记录
    const distillationResult = await pool.query(
      'SELECT keyword FROM distillations WHERE id = $1',
      [distillationId]
    );

    if (distillationResult.rows.length === 0) {
      throw new Error('蒸馏记录不存在');
    }

    const keyword = distillationResult.rows[0].keyword;

    // 获取话题列表
    const topicsResult = await pool.query(
      'SELECT question FROM topics WHERE distillation_id = $1 ORDER BY id ASC',
      [distillationId]
    );

    const topics = topicsResult.rows.map(row => row.question);

    // 返回单个关键词-话题对（一个蒸馏记录对应一个关键词）
    return [{
      keyword,
      topics
    }];
  }

  /**
   * 从图库均衡选择图片（使用次数最少的优先）
   * 
   * 新逻辑：
   * 1. 选择使用次数最少的图片
   * 2. 如果有多张图片使用次数相同，按创建时间升序选择
   * 3. 返回图片ID和路径，供后续记录使用
   */
  async selectBalancedImage(albumId: number): Promise<{ imageId: number; imageUrl: string } | null> {
    const imageService = new ImageSelectionService();
    const imageData = await imageService.selectLeastUsedImage(albumId);
    
    if (!imageData) {
      console.log(`[图片选择] 相册 ${albumId} 为空，返回null`);
      return null;
    }
    
    return {
      imageId: imageData.imageId,
      imageUrl: `/uploads/gallery/${imageData.filepath}`
    };
  }

  /**
   * 从图库随机选择图片（旧方法，保留用于向后兼容）
   * @deprecated 请使用 selectBalancedImage 实现均衡选择
   */
  async selectRandomImage(albumId: number): Promise<string> {
    const result = await pool.query(
      'SELECT filepath FROM images WHERE album_id = $1 ORDER BY RANDOM() LIMIT 1',
      [albumId]
    );

    if (result.rows.length === 0) {
      // 如果图库为空，返回默认占位图片
      return '/uploads/gallery/placeholder.png';
    }

    return `/uploads/gallery/${result.rows[0].filepath}`;
  }

  /**
   * 获取知识库内容
   */
  async getKnowledgeBaseContent(knowledgeBaseId: number): Promise<string> {
    const result = await pool.query(
      'SELECT content FROM knowledge_documents WHERE knowledge_base_id = $1',
      [knowledgeBaseId]
    );

    // 合并所有文档内容
    return result.rows.map(row => row.content).join('\n\n');
  }

  /**
   * 获取文章设置提示词
   */
  async getArticleSettingPrompt(articleSettingId: number): Promise<string> {
    const result = await pool.query(
      'SELECT prompt FROM article_settings WHERE id = $1',
      [articleSettingId]
    );

    if (result.rows.length === 0) {
      throw new Error('文章设置不存在');
    }

    return result.rows[0].prompt;
  }

  /**
   * 获取活跃的AI配置（使用系统级配置）
   */
  async getActiveAIConfig(): Promise<any> {
    // 使用系统级API配置服务
    const { systemApiConfigService } = await import('./SystemApiConfigService');
    const config = await systemApiConfigService.getActiveConfig();

    if (!config) {
      throw new Error('没有活跃的系统级AI配置，请联系管理员配置');
    }

    // 返回格式化的配置对象
    return {
      provider: config.provider,
      api_key: config.apiKey,
      ollama_base_url: config.ollamaBaseUrl,
      ollama_model: config.ollamaModel
    };
  }

  /**
   * 在文章内容中插入图片标记
   * 图片统一放在文章末尾
   */
  private insertImageIntoContent(
    content: string,
    imageUrl: string
  ): string {
    // 图片统一放在文章末尾
    return `${content}\n\n![文章配图](${imageUrl})`;
  }

  /**
   * 构建AI提示词（包含转化目标要求）
   */
  /**
   * 替换提示词中的占位符变量
   * 支持的占位符：
   * - {keyword} - 核心关键词
   * - {topics} - 话题列表（带编号）
   * - {topicsList} - 话题列表（纯文本，逗号分隔）
   * - {companyName} - 公司名称
   * - {companyIndustry} - 行业类型（可能为空）
   * - {companyWebsite} - 官方网站（可能为空）
   * - {companyAddress} - 公司地址（可能为空）
   * - {knowledgeBase} - 知识库内容
   */
  private replacePromptVariables(
    prompt: string,
    keyword: string,
    topics: string[],
    knowledgeContent: string,
    companyName?: string,
    companyIndustry?: string,
    companyWebsite?: string,
    companyAddress?: string
  ): string {
    // 格式化话题列表（带编号）
    const topicsFormatted = topics.map((t, i) => `${i + 1}. ${t}`).join('\n');
    
    // 格式化话题列表（纯文本）
    const topicsListText = topics.join('、');
    
    // 替换所有占位符
    let result = prompt
      .replace(/\{keyword\}/g, keyword)
      .replace(/\{topics\}/g, topicsFormatted)
      .replace(/\{topicsList\}/g, topicsListText)
      .replace(/\{companyName\}/g, companyName || '')
      .replace(/\{companyIndustry\}/g, companyIndustry || '')
      .replace(/\{companyWebsite\}/g, companyWebsite || '')
      .replace(/\{companyAddress\}/g, companyAddress || '')
      .replace(/\{knowledgeBase\}/g, knowledgeContent || '');
    
    return result;
  }

  /**
   * 构建AI提示词（支持用户自定义模板）
   * 
   * 新逻辑：
   * 1. 如果用户的提示词包含占位符，直接替换占位符
   * 2. 如果用户的提示词不包含占位符，使用旧的拼接逻辑（向后兼容）
   */
  private buildPromptWithImageInstruction(
    basePrompt: string,
    keyword: string,
    topics: string[],
    knowledgeContent: string,
    companyName?: string,
    companyIndustry?: string,
    companyWebsite?: string,
    companyAddress?: string,
    articleIndex?: number,
    totalArticles?: number
  ): string {
    // 检查用户提示词是否包含占位符
    const hasPlaceholders = /\{(keyword|topics|topicsList|companyName|companyIndustry|companyWebsite|companyAddress|knowledgeBase)\}/.test(basePrompt);
    
    if (hasPlaceholders) {
      // 用户使用了占位符，直接替换
      console.log('[提示词构建] 检测到占位符，使用用户自定义模板');
      console.log(`[提示词构建] 转化目标字段值: companyName="${companyName}", industry="${companyIndustry}", website="${companyWebsite}", address="${companyAddress}"`);
      const finalPrompt = this.replacePromptVariables(
        basePrompt, 
        keyword, 
        topics, 
        knowledgeContent, 
        companyName,
        companyIndustry,
        companyWebsite,
        companyAddress
      );
      console.log('[提示词构建] 最终提示词前200字符:', finalPrompt.substring(0, 200));
      console.log('[提示词构建] 提示词总长度:', finalPrompt.length, '字符');
      return finalPrompt;
    }
    
    // 向后兼容：用户没有使用占位符，使用简化的拼接逻辑
    // 注意：建议用户使用占位符模板，这样可以完全自定义所有要求
    console.log('[提示词构建] 未检测到占位符，使用简化拼接逻辑（建议使用占位符模板）');
    
    const topicsList = topics.map((t, i) => `${i + 1}. ${t}`).join('\n');

    // 只添加最基本的格式要求，其他要求应该在用户的basePrompt中定义
    let prompt = basePrompt + '\n\n';
    
    // 添加数据
    prompt += `参考关键词：${keyword}\n\n`;
    prompt += '用户关心的话题：\n' + topicsList;

    if (knowledgeContent && knowledgeContent.trim().length > 0) {
      prompt += '\n\n企业知识库参考资料：\n' + knowledgeContent;
    }

    // 添加转化目标信息
    if (companyName && companyName.trim().length > 0) {
      prompt += `\n\n【转化目标信息】\n`;
      prompt += `公司名称：${companyName}\n`;
      
      if (companyIndustry && companyIndustry.trim().length > 0) {
        prompt += `行业类型：${companyIndustry}\n`;
      }
      
      if (companyWebsite && companyWebsite.trim().length > 0) {
        prompt += `官方网站：${companyWebsite}\n`;
      }
      
      if (companyAddress && companyAddress.trim().length > 0) {
        prompt += `公司地址：${companyAddress}\n`;
      }
    }

    prompt += '\n\n请按照"标题：[标题内容]"格式开始，然后是正文。';

    return prompt;
  }

  /**
   * 生成单篇文章（返回结果对象）
   */
  async generateSingleArticle(
    keyword: string,
    topics: string[],
    imageUrl: string,
    knowledgeContent: string,
    articlePrompt: string,
    aiConfig: any,
    companyName?: string,
    companyIndustry?: string,
    companyWebsite?: string,
    companyAddress?: string,
    articleIndex?: number, // 当前文章序号（从1开始）
    totalArticles?: number // 总文章数
  ): Promise<{ success: boolean; title?: string; content?: string; error?: string }> {
    try {
      // 构建包含转化目标的AI prompt
      const prompt = this.buildPromptWithImageInstruction(
        articlePrompt,
        keyword,
        topics,
        knowledgeContent,
        companyName,
        companyIndustry,
        companyWebsite,
        companyAddress,
        articleIndex,
        totalArticles
      );

      // 调用AI服务
      let aiService: AIService;
      try {
        aiService = new AIService({
          provider: aiConfig.provider,
          apiKey: aiConfig.api_key,
          ollamaBaseUrl: aiConfig.ollama_base_url,
          ollamaModel: aiConfig.ollama_model
        });
      } catch (error: any) {
        throw new Error(`创建AI服务失败: ${error.message}`);
      }

      let response: string;
      try {
        console.log('[AI调用] 发送提示词长度:', prompt.length, '字符');
        console.log('[AI调用] 提示词包含字数限制要求:', prompt.includes('700-800') ? '是' : '否');
        response = await aiService['callAI'](prompt);
        console.log('[AI调用] 收到响应长度:', response.length, '字符');
      } catch (error: any) {
        throw new Error(`AI调用失败: ${error.message}`);
      }

      if (!response || response.trim().length === 0) {
        throw new Error('AI返回了空响应');
      }

      // 解析响应提取标题和内容
      try {
        const parsed = this.parseArticleResponse(response);
        
        // 在内容中插入图片
        // Feature: article-image-embedding, Property 1: 图片标记插入完整性
        const contentWithImage = this.insertImageIntoContent(
          parsed.content,
          imageUrl
        );
        
        return {
          success: true,
          title: parsed.title,
          content: contentWithImage
        };
      } catch (error: any) {
        return {
          success: false,
          error: `解析AI响应失败: ${error.message}`
        };
      }
    } catch (error: any) {
      // 返回失败结果，带上关键词信息
      return {
        success: false,
        error: `生成文章失败 (关键词: ${keyword}): ${error.message}`
      };
    }
  }

  /**
   * 解析AI响应提取标题和内容
   */
  parseArticleResponse(response: string): { title: string; content: string } {
    // 先清理AI响应中的思考过程和Markdown符号
    const cleanedResponse = ContentCleaner.cleanArticleContent(response);

    // 验证清理后的内容
    if (!ContentCleaner.validateCleanedContent(cleanedResponse)) {
      console.warn('[文章解析] 清理后内容无效，使用原始内容');
      // 如果清理后内容无效，使用原始内容但仍然尝试解析
      return this.parseResponseWithoutCleaning(response);
    }

    // 尝试匹配 "标题：xxx" 格式
    const titleMatch = cleanedResponse.match(/标题[：:]\s*(.+?)(?:\n|$)/);

    if (titleMatch) {
      const title = titleMatch[1].trim();
      // 移除标题部分，剩余的作为内容
      const content = cleanedResponse.replace(/标题[：:]\s*.+?(?:\n|$)/, '').trim();
      return { title, content };
    }

    // 如果没有找到标题标记，尝试使用第一行作为标题
    const lines = cleanedResponse.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const title = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();
      return { title, content };
    }

    // 如果都失败了，使用默认标题
    return {
      title: '未命名文章',
      content: cleanedResponse
    };
  }

  /**
   * 不进行清理的解析（备用方案）
   */
  private parseResponseWithoutCleaning(response: string): { title: string; content: string } {
    const titleMatch = response.match(/标题[：:]\s*(.+?)(?:\n|$)/);

    if (titleMatch) {
      const title = titleMatch[1].trim();
      const content = response.replace(/标题[：:]\s*.+?(?:\n|$)/, '').trim();
      return { title, content };
    }

    const lines = response.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const title = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();
      return { title, content };
    }

    return {
      title: '未命名文章',
      content: response
    };
  }

  /**
   * 验证蒸馏结果ID列表的有效性
   * 需求: 4.5
   * 
   * 验证规则：
   * 1. 所有ID都必须是有效的蒸馏结果ID（在distillations表中存在）
   * 2. 所有蒸馏结果都必须有话题
   * 
   * @param distillationIds 要验证的蒸馏结果ID列表
   * @throws Error 如果验证失败，抛出包含详细信息的错误
   */
  async validateDistillationIds(distillationIds: number[]): Promise<void> {
    console.log(`[ID验证] 开始验证 ${distillationIds.length} 个蒸馏结果ID...`);
    
    if (distillationIds.length === 0) {
      throw new Error('蒸馏结果ID列表不能为空');
    }
    
    // 查询所有ID对应的蒸馏结果，并检查是否有话题
    const result = await pool.query(
      `SELECT 
        d.id,
        COUNT(t.id) as topic_count
       FROM distillations d
       LEFT JOIN topics t ON d.id = t.distillation_id
       WHERE d.id = ANY($1)
       GROUP BY d.id`,
      [distillationIds]
    );
    
    // 检查是否所有ID都存在
    const foundIds = result.rows.map((row: any) => row.id);
    const missingIds = distillationIds.filter(id => !foundIds.includes(id));
    
    if (missingIds.length > 0) {
      const errorMsg = `蒸馏结果ID [${missingIds.join(', ')}] 不存在`;
      console.error(`[ID验证] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    // 检查是否所有蒸馏结果都有话题
    const idsWithoutTopics = result.rows
      .filter((row: any) => parseInt(row.topic_count) === 0)
      .map((row: any) => row.id);
    
    if (idsWithoutTopics.length > 0) {
      const errorMsg = `蒸馏结果ID [${idsWithoutTopics.join(', ')}] 没有话题`;
      console.error(`[ID验证] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    console.log(`[ID验证] 所有ID验证通过`);
  }

  /**
   * 为任务选择蒸馏结果（单关键词多话题模式）
   * 
   * 新逻辑：
   * 1. 使用用户指定的distillationId
   * 2. 验证该蒸馏结果有足够的话题
   * 3. 返回重复的distillationId数组（长度=requestedCount）
   * 
   * @param requestedCount 请求的文章数量
   * @param distillationId 用户选择的蒸馏结果ID
   * @returns 蒸馏结果ID数组（重复的同一个ID）
   */
  async selectDistillationsForTask(requestedCount: number, distillationId: number): Promise<number[]> {
    console.log(`[智能选择] 为蒸馏结果 ${distillationId} 选择 ${requestedCount} 个话题...`);
    
    // 验证蒸馏结果是否存在
    const distillationCheck = await pool.query(
      'SELECT id, keyword FROM distillations WHERE id = $1',
      [distillationId]
    );
    
    if (distillationCheck.rows.length === 0) {
      throw new Error(`蒸馏结果ID ${distillationId} 不存在`);
    }
    
    const keyword = distillationCheck.rows[0].keyword;
    console.log(`[智能选择] 蒸馏结果: ID=${distillationId}, 关键词="${keyword}"`);
    
    // 查询该蒸馏结果有多少个话题
    const topicCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM topics WHERE distillation_id = $1',
      [distillationId]
    );
    
    const topicCount = parseInt(topicCountResult.rows[0].count);
    console.log(`[智能选择] 该蒸馏结果有 ${topicCount} 个话题`);
    
    // 验证话题数量是否充足
    if (topicCount === 0) {
      throw new Error(`蒸馏结果"${keyword}"没有话题，无法生成文章`);
    }
    
    if (topicCount < requestedCount) {
      console.warn(`[智能选择] 警告：话题数量(${topicCount})少于请求数量(${requestedCount})，部分话题会被重复使用`);
    }
    
    // 返回重复的distillationId数组
    const selectedIds = Array(requestedCount).fill(distillationId);
    console.log(`[智能选择] 将为关键词"${keyword}"生成 ${requestedCount} 篇文章，使用不同的话题`);
    
    return selectedIds;
  }

  /**
   * 记录蒸馏结果使用
   * 在distillation_usage表中插入新记录
   */
  private async recordDistillationUsage(
    distillationId: number,
    taskId: number,
    articleId: number,
    client: any
  ): Promise<void> {
    await client.query(
      `INSERT INTO distillation_usage 
       (distillation_id, task_id, article_id, used_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [distillationId, taskId, articleId]
    );
  }

  /**
   * 更新蒸馏结果使用次数（原子操作）
   * 使用SQL的INCREMENT确保并发安全
   */
  private async incrementUsageCount(
    distillationId: number,
    client: any
  ): Promise<void> {
    await client.query(
      `UPDATE distillations 
       SET usage_count = usage_count + 1 
       WHERE id = $1`,
      [distillationId]
    );
  }

  /**
   * 重试包装函数（处理并发冲突）
   * 最多重试3次
   */
  private async retryOnConflict<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // 检查是否是并发冲突错误
        const isConflictError = 
          error.message?.includes('could not serialize') ||
          error.message?.includes('deadlock') ||
          error.code === '40P01' || // deadlock_detected
          error.code === '40001';   // serialization_failure
        
        if (!isConflictError || attempt === maxRetries) {
          // 不是并发错误或已达到最大重试次数，直接抛出
          throw error;
        }
        
        // 等待一小段时间后重试（指数退避）
        const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log(`[并发控制] 检测到冲突，第 ${attempt} 次重试...`);
      }
    }
    
    throw lastError || new Error('重试失败');
  }

  /**
   * 在事务中保存文章并记录使用（包含话题追踪）
   * 1. 保存文章
   * 2. 创建蒸馏使用记录
   * 3. 创建话题使用记录
   * 4. 更新蒸馏usage_count
   * 5. 更新话题usage_count
   * 6. 如果任何步骤失败，回滚整个事务
   */
  private async saveArticleWithTopicTracking(
    taskId: number,
    distillationId: number,
    topicId: number,
    keyword: string,
    title: string,
    content: string,
    imageUrl: string,
    provider: string,
    userId: number,
    imageId?: number
  ): Promise<number> {
    const client = await pool.connect();
    const topicService = new TopicSelectionService();
    
    try {
      await client.query('BEGIN');
      console.log(`[保存文章] 事务开始`);

      // 1. 保存文章（包含topic_id和user_id）
      const articleResult = await client.query(
        `INSERT INTO articles 
         (title, keyword, distillation_id, topic_id, task_id, content, image_url, provider, user_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING id`,
        [title, keyword, distillationId, topicId, taskId, content, imageUrl, provider, userId]
      );

      const articleId = articleResult.rows[0].id;
      console.log(`[保存文章] 文章已插入，ID: ${articleId}, topic_id: ${topicId}`);

      // 2. 创建蒸馏使用记录
      await this.recordDistillationUsage(distillationId, taskId, articleId, client);
      console.log(`[保存文章] 蒸馏使用记录已创建`);

      // 3. 创建话题使用记录并更新话题usage_count
      await topicService.recordTopicUsage(topicId, distillationId, articleId, taskId, client);
      console.log(`[保存文章] 话题使用记录已创建，话题usage_count已更新`);

      // 4. 更新蒸馏usage_count
      await this.incrementUsageCount(distillationId, client);
      console.log(`[保存文章] 蒸馏usage_count已更新`);

      // 5. 如果提供了imageId，记录图片使用并更新usage_count
      if (imageId) {
        await client.query(
          `UPDATE images 
           SET usage_count = COALESCE(usage_count, 0) + 1 
           WHERE id = $1`,
          [imageId]
        );
        
        await client.query(
          `INSERT INTO image_usage (image_id, article_id)
           VALUES ($1, $2)
           ON CONFLICT (image_id, article_id) DO NOTHING`,
          [imageId, articleId]
        );
        
        console.log(`[保存文章] 图片 ${imageId} 的usage_count已更新`);
      }

      await client.query('COMMIT');
      console.log(`[保存文章] 事务提交成功`);

      return articleId;
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error(`[保存文章] 事务回滚，错误: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 在事务中保存文章并记录使用（旧版，保留用于向后兼容）
   * @deprecated 使用 saveArticleWithTopicTracking 代替
   */
  private async saveArticleWithUsageTracking(
    taskId: number,
    distillationId: number,
    keyword: string,
    title: string,
    content: string,
    imageUrl: string,
    provider: string,
    userId: number,
    imageId?: number
  ): Promise<number> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. 保存文章（包含user_id）
      const articleResult = await client.query(
        `INSERT INTO articles 
         (title, keyword, distillation_id, task_id, content, image_url, provider, user_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id`,
        [title, keyword, distillationId, taskId, content, imageUrl, provider, userId]
      );

      const articleId = articleResult.rows[0].id;

      // 2. 创建使用记录
      await this.recordDistillationUsage(distillationId, taskId, articleId, client);

      // 3. 更新usage_count
      await this.incrementUsageCount(distillationId, client);

      // 4. 如果提供了imageId，记录图片使用并更新usage_count
      if (imageId) {
        await client.query(
          `UPDATE images 
           SET usage_count = COALESCE(usage_count, 0) + 1 
           WHERE id = $1`,
          [imageId]
        );
        
        await client.query(
          `INSERT INTO image_usage (image_id, article_id)
           VALUES ($1, $2)
           ON CONFLICT (image_id, article_id) DO NOTHING`,
          [imageId, articleId]
        );
      }

      await client.query('COMMIT');

      return articleId;
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 保存文章到数据库（旧方法，保留用于向后兼容）
   * @deprecated 使用 saveArticleWithUsageTracking 代替
   */
  async saveArticle(
    taskId: number,
    distillationId: number,
    keyword: string,
    title: string,
    content: string,
    imageUrl: string,
    provider: string,
    userId: number
  ): Promise<number> {
    const result = await pool.query(
      `INSERT INTO articles 
       (title, keyword, distillation_id, task_id, content, image_url, provider, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id`,
      [title, keyword, distillationId, taskId, content, imageUrl, provider, userId]
    );

    return result.rows[0].id;
  }

  /**
   * 重试失败的任务
   */
  async retryTask(taskId: number): Promise<void> {
    const task = await this.getTaskDetail(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    // 重置任务状态
    await pool.query(
      `UPDATE generation_tasks 
       SET status = 'pending', 
           error_message = NULL, 
           generated_count = 0, 
           progress = 0,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [taskId]
    );

    console.log(`[任务 ${taskId}] 已重置，准备重新执行`);

    // 异步执行任务（不等待完成）
    this.executeTask(taskId).catch(error => {
      console.error(`任务 ${taskId} 重试执行失败:`, error);
    });
  }

  /**
   * 验证任务配置
   * 快速失败：如果关键配置缺失，立即抛出错误
   */
  async validateTaskConfiguration(taskId: number): Promise<void> {
    const task = await this.getTaskDetail(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    // 验证蒸馏记录
    const distillationResult = await pool.query(
      'SELECT id FROM distillations WHERE id = $1',
      [task.distillationId]
    );
    if (distillationResult.rows.length === 0) {
      throw new Error(`蒸馏记录ID ${task.distillationId} 不存在`);
    }

    // 验证话题
    const topicsResult = await pool.query(
      'SELECT COUNT(*) as count FROM topics WHERE distillation_id = $1',
      [task.distillationId]
    );
    const topicCount = parseInt(topicsResult.rows[0].count);
    if (topicCount === 0) {
      throw new Error('蒸馏记录没有关联的话题，无法生成文章');
    }

    // 验证图库
    const albumResult = await pool.query(
      'SELECT id FROM albums WHERE id = $1',
      [task.albumId]
    );
    if (albumResult.rows.length === 0) {
      throw new Error(`图库ID ${task.albumId} 不存在`);
    }

    // 验证知识库
    const kbResult = await pool.query(
      'SELECT id FROM knowledge_bases WHERE id = $1',
      [task.knowledgeBaseId]
    );
    if (kbResult.rows.length === 0) {
      throw new Error(`知识库ID ${task.knowledgeBaseId} 不存在`);
    }

    // 验证文章设置
    const settingResult = await pool.query(
      'SELECT id FROM article_settings WHERE id = $1',
      [task.articleSettingId]
    );
    if (settingResult.rows.length === 0) {
      throw new Error(`文章设置ID ${task.articleSettingId} 不存在`);
    }

    // 验证系统级AI配置
    const { systemApiConfigService } = await import('./SystemApiConfigService');
    const config = await systemApiConfigService.getActiveConfig();
    
    if (!config) {
      throw new Error('没有活跃的系统级AI配置，请联系管理员配置AI服务');
    }

    if (config.provider === 'ollama') {
      if (!config.ollamaBaseUrl || !config.ollamaModel) {
        throw new Error('Ollama配置不完整，缺少base_url或model');
      }
    } else {
      if (!config.apiKey) {
        throw new Error(`${config.provider}配置不完整，缺少API密钥`);
      }
    }
  }

  /**
   * 诊断任务执行问题
   */
  async diagnoseTask(taskId: number): Promise<DiagnosticReport> {
    // 获取任务详情
    const task = await this.getTaskDetail(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const recommendations: string[] = [];
    const checks = {
      distillationExists: false,
      topicsExist: false,
      topicCount: 0,
      albumExists: false,
      imageCount: 0,
      knowledgeBaseExists: false,
      articleSettingExists: false,
      aiConfigExists: false,
      aiConfigValid: false
    };

    // 检查蒸馏记录
    try {
      const distillationResult = await pool.query(
        'SELECT id FROM distillations WHERE id = $1',
        [task.distillationId]
      );
      checks.distillationExists = distillationResult.rows.length > 0;
      
      if (!checks.distillationExists) {
        recommendations.push(`蒸馏记录ID ${task.distillationId} 不存在`);
      } else {
        // 检查话题
        const topicsResult = await pool.query(
          'SELECT COUNT(*) as count FROM topics WHERE distillation_id = $1',
          [task.distillationId]
        );
        checks.topicCount = parseInt(topicsResult.rows[0].count);
        checks.topicsExist = checks.topicCount > 0;
        
        if (!checks.topicsExist) {
          recommendations.push('蒸馏记录没有关联的话题，无法生成文章');
        }
      }
    } catch (error: any) {
      recommendations.push(`检查蒸馏记录时出错: ${error.message}`);
    }

    // 检查图库
    try {
      const albumResult = await pool.query(
        'SELECT id FROM albums WHERE id = $1',
        [task.albumId]
      );
      checks.albumExists = albumResult.rows.length > 0;
      
      if (!checks.albumExists) {
        recommendations.push(`图库ID ${task.albumId} 不存在`);
      } else {
        // 检查图片数量
        const imagesResult = await pool.query(
          'SELECT COUNT(*) as count FROM images WHERE album_id = $1',
          [task.albumId]
        );
        checks.imageCount = parseInt(imagesResult.rows[0].count);
        
        if (checks.imageCount === 0) {
          recommendations.push('图库中没有图片，将使用默认占位图');
        }
      }
    } catch (error: any) {
      recommendations.push(`检查图库时出错: ${error.message}`);
    }

    // 检查知识库
    try {
      const kbResult = await pool.query(
        'SELECT id FROM knowledge_bases WHERE id = $1',
        [task.knowledgeBaseId]
      );
      checks.knowledgeBaseExists = kbResult.rows.length > 0;
      
      if (!checks.knowledgeBaseExists) {
        recommendations.push(`知识库ID ${task.knowledgeBaseId} 不存在`);
      }
    } catch (error: any) {
      recommendations.push(`检查知识库时出错: ${error.message}`);
    }

    // 检查文章设置
    try {
      const settingResult = await pool.query(
        'SELECT id FROM article_settings WHERE id = $1',
        [task.articleSettingId]
      );
      checks.articleSettingExists = settingResult.rows.length > 0;
      
      if (!checks.articleSettingExists) {
        recommendations.push(`文章设置ID ${task.articleSettingId} 不存在`);
      }
    } catch (error: any) {
      recommendations.push(`检查文章设置时出错: ${error.message}`);
    }

    // 检查系统级AI配置
    try {
      const { systemApiConfigService } = await import('./SystemApiConfigService');
      const config = await systemApiConfigService.getActiveConfig();
      
      checks.aiConfigExists = config !== null;
      
      if (!checks.aiConfigExists) {
        recommendations.push('没有活跃的系统级AI配置，请联系管理员配置AI服务');
      } else if (config) {
        if (config.provider === 'ollama') {
          checks.aiConfigValid = !!(config.ollamaBaseUrl && config.ollamaModel);
          if (!checks.aiConfigValid) {
            recommendations.push('Ollama配置不完整，缺少base_url或model');
          }
        } else {
          checks.aiConfigValid = !!config.apiKey;
          if (!checks.aiConfigValid) {
            recommendations.push(`${config.provider}配置不完整，缺少API密钥`);
          }
        }
      }
    } catch (error: any) {
      recommendations.push(`检查AI配置时出错: ${error.message}`);
    }

    // 添加任务状态相关的建议
    if (task.status === 'completed' && task.generatedCount === 0) {
      recommendations.push('任务标记为已完成但没有生成任何文章，这是一个bug');
    }

    if (task.status === 'failed' && task.errorMessage) {
      recommendations.push(`任务失败原因: ${task.errorMessage}`);
    }

    return {
      taskId: task.id,
      taskStatus: task.status,
      requestedCount: task.requestedCount,
      generatedCount: task.generatedCount,
      errorMessage: task.errorMessage,
      checks,
      recommendations
    };
  }
}
