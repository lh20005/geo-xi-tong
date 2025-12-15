import { pool } from '../db/database';
import { AIService } from './aiService';
import { ContentCleaner } from './contentCleaner';

export interface TaskConfig {
  distillationId: number;
  albumId: number;
  knowledgeBaseId: number;
  articleSettingId: number;
  conversionTargetId?: number;
  articleCount: number;
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
   * 批量加载蒸馏结果数据
   * 需求: 2.1, 2.3
   * 
   * 使用单次查询批量加载所有蒸馏结果的关键词和话题列表
   * 
   * @param distillationIds 蒸馏结果ID列表
   * @returns Map<id, {keyword, topics}> 蒸馏结果数据映射
   */
  private async loadDistillationData(
    distillationIds: number[]
  ): Promise<Map<number, { keyword: string; topics: string[] }>> {
    console.log(`[批量加载] 开始加载 ${distillationIds.length} 个蒸馏结果的数据...`);
    
    if (distillationIds.length === 0) {
      console.warn(`[批量加载] ID列表为空，返回空Map`);
      return new Map();
    }
    
    // 使用array_agg聚合话题，批量查询所有蒸馏结果
    // 需求: 2.1 - 使用单次查询批量加载
    const result = await pool.query(
      `SELECT 
        d.id,
        d.keyword,
        array_agg(t.question ORDER BY t.id) as topics
       FROM distillations d
       LEFT JOIN topics t ON d.id = t.distillation_id
       WHERE d.id = ANY($1)
       GROUP BY d.id, d.keyword`,
      [distillationIds]
    );
    
    // 将查询结果转换为Map结构（需求 2.3）
    const dataMap = new Map<number, { keyword: string; topics: string[] }>();
    
    for (const row of result.rows) {
      const id = row.id;
      const keyword = row.keyword;
      // topics可能为null（如果没有话题），转换为空数组
      const topics = row.topics ? row.topics.filter((t: string) => t !== null) : [];
      
      dataMap.set(id, { keyword, topics });
    }
    
    // 检查是否有缺失的蒸馏结果（需求 2.3）
    const missingIds = distillationIds.filter(id => !dataMap.has(id));
    if (missingIds.length > 0) {
      console.warn(`[批量加载] 警告：蒸馏结果ID [${missingIds.join(', ')}] 不存在或已被删除`);
    }
    
    console.log(`[批量加载] 成功加载 ${dataMap.size} 个蒸馏结果的数据`);
    
    return dataMap;
  }

  /**
   * 创建生成任务
   * 需求: 1.4, 4.1, 4.5, 13.1
   * 
   * 实现步骤：
   * 1. 调用selectDistillationsForTask选择蒸馏结果
   * 2. 将选择的ID列表序列化为JSON字符串
   * 3. 保存到generation_tasks.selected_distillation_ids字段
   * 4. 创建任务记录
   * 5. 异步启动任务执行
   */
  async createTask(config: TaskConfig): Promise<number> {
    console.log(`[任务创建] 开始创建任务，请求生成 ${config.articleCount} 篇文章`);
    
    // 1. 智能选择蒸馏结果（需求 1.1, 1.2, 1.5）
    const selectedDistillationIds = await this.selectDistillationsForTask(config.articleCount);
    
    // 2. 将ID数组序列化为JSON字符串（需求 1.4, 4.1）
    const selectedIdsJson = JSON.stringify(selectedDistillationIds);
    console.log(`[任务创建] 选择的蒸馏结果IDs: ${selectedIdsJson}`);
    
    // 3. 保存任务记录，包含selected_distillation_ids
    const result = await pool.query(
      `INSERT INTO generation_tasks 
       (distillation_id, album_id, knowledge_base_id, article_setting_id, conversion_target_id, requested_count, selected_distillation_ids, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') 
       RETURNING id`,
      [
        config.distillationId, // 保留用于向后兼容
        config.albumId,
        config.knowledgeBaseId,
        config.articleSettingId,
        config.conversionTargetId || null,
        config.articleCount,
        selectedIdsJson
      ]
    );

    const taskId = result.rows[0].id;
    console.log(`[任务创建] 任务创建成功，ID: ${taskId}`);

    // 4. 异步执行任务（不等待完成）
    this.executeTask(taskId).catch(error => {
      console.error(`任务 ${taskId} 执行失败:`, error);
    });

    return taskId;
  }

  /**
   * 获取任务列表
   * 需求: 8.4, 8.5, 13.3
   */
  async getTasks(page: number = 1, pageSize: number = 10): Promise<{ tasks: GenerationTask[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const countResult = await pool.query('SELECT COUNT(*) FROM generation_tasks');
    const total = parseInt(countResult.rows[0].count);

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
        gt.selected_distillation_ids,
        ct.company_name as conversion_target_name,
        d.keyword,
        d.provider,
        (SELECT question FROM topics WHERE distillation_id = gt.distillation_id ORDER BY id ASC LIMIT 1) as distillation_result
       FROM generation_tasks gt
       LEFT JOIN conversion_targets ct ON gt.conversion_target_id = ct.id
       INNER JOIN distillations d ON gt.distillation_id = d.id
       ORDER BY gt.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return {
      tasks: result.rows.map(row => {
        let distillationResult = row.distillation_result || null;
        let keyword = row.keyword;
        
        // 处理多个蒸馏结果的情况（需求 8.4, 8.5）
        if (row.selected_distillation_ids) {
          try {
            const selectedIds: number[] = JSON.parse(row.selected_distillation_ids);
            if (selectedIds.length > 1) {
              // 如果使用多个蒸馏结果，显示摘要
              distillationResult = `使用了${selectedIds.length}个蒸馏结果`;
            }
            // keyword保持为第一个蒸馏结果的关键词（已经从JOIN中获取）
          } catch (error) {
            console.error('解析selected_distillation_ids失败:', error);
          }
        }
        
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
  async getTaskDetail(taskId: number): Promise<GenerationTask | null> {
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
        ct.company_name as conversion_target_name,
        d.keyword,
        d.provider,
        (SELECT question FROM topics WHERE distillation_id = gt.distillation_id ORDER BY id ASC LIMIT 1) as distillation_result
       FROM generation_tasks gt
       LEFT JOIN conversion_targets ct ON gt.conversion_target_id = ct.id
       INNER JOIN distillations d ON gt.distillation_id = d.id
       WHERE gt.id = $1`,
      [taskId]
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
      let selectedDistillationIds: number[] = [];
      
      // 反序列化JSON字符串为ID数组（需求 2.1）
      if (selectedIdsJson) {
        try {
          selectedDistillationIds = JSON.parse(selectedIdsJson);
          console.log(`[任务 ${taskId}] 读取到预选的蒸馏结果IDs: [${selectedDistillationIds.join(', ')}]`);
        } catch (error) {
          console.error(`[任务 ${taskId}] 解析selected_distillation_ids失败:`, error);
        }
      }
      
      // 2. 向后兼容逻辑：如果selected_distillation_ids为空，使用旧逻辑（需求 9.1, 9.2）
      if (!selectedDistillationIds || selectedDistillationIds.length === 0) {
        console.log(`[任务 ${taskId}] selected_distillation_ids为空，使用旧的单蒸馏结果逻辑`);
        await this.executeTaskLegacy(taskId, task);
        return;
      }

      // 3. 批量加载所有预选蒸馏结果的数据（需求 2.3）
      console.log(`[任务 ${taskId}] 批量加载蒸馏结果数据...`);
      const distillationDataMap = await this.loadDistillationData(selectedDistillationIds);
      console.log(`[任务 ${taskId}] 成功加载 ${distillationDataMap.size} 个蒸馏结果的数据`);
      
      // 详细记录每个蒸馏结果的信息
      for (const [id, data] of distillationDataMap.entries()) {
        console.log(`[任务 ${taskId}] 蒸馏结果 ID=${id}, 关键词="${data.keyword}", 话题数=${data.topics.length}`);
      }

      // 获取知识库内容
      console.log(`[任务 ${taskId}] 加载知识库内容...`);
      const knowledgeContent = await this.getKnowledgeBaseContent(task.knowledgeBaseId);
      console.log(`[任务 ${taskId}] 知识库内容长度: ${knowledgeContent.length} 字符`);

      // 获取文章设置提示词
      console.log(`[任务 ${taskId}] 加载文章设置...`);
      const articlePrompt = await this.getArticleSettingPrompt(task.articleSettingId);

      // 获取AI配置
      console.log(`[任务 ${taskId}] 加载AI配置...`);
      const aiConfig = await this.getActiveAIConfig();
      console.log(`[任务 ${taskId}] 使用AI提供商: ${aiConfig.provider}`);

      // 确定实际生成数量
      const actualCount = selectedDistillationIds.length;
      console.log(`[任务 ${taskId}] 计划生成 ${actualCount} 篇文章`);

      // 4. 逐个生成文章，为每篇文章分配不同的蒸馏结果（需求 2.2, 2.4, 2.5）
      let generatedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < actualCount; i++) {
        console.log(`\n[任务 ${taskId}] ========== 开始生成第 ${i + 1}/${actualCount} 篇文章 ==========`);
        
        // 为第i篇文章使用selected_distillation_ids[i]对应的蒸馏结果（需求 2.2）
        const distillationId = selectedDistillationIds[i];
        console.log(`[任务 ${taskId}] [文章 ${i + 1}] 从selected_distillation_ids[${i}]获取蒸馏结果ID: ${distillationId}`);
        
        const distillationData = distillationDataMap.get(distillationId);
        
        if (!distillationData) {
          const errorMsg = `文章 ${i + 1}: 蒸馏结果ID ${distillationId} 的数据不存在或已被删除`;
          console.error(`[任务 ${taskId}] ${errorMsg}`);
          errors.push(errorMsg);
          continue; // 跳过这篇文章，继续处理下一篇
        }
        
        if (!distillationData.topics || distillationData.topics.length === 0) {
          const errorMsg = `文章 ${i + 1}: 蒸馏结果ID ${distillationId} 没有话题`;
          console.error(`[任务 ${taskId}] ${errorMsg}`);
          errors.push(errorMsg);
          continue; // 跳过这篇文章，继续处理下一篇
        }
        
        console.log(`[任务 ${taskId}] [文章 ${i + 1}] 使用蒸馏结果: ID=${distillationId}, 关键词="${distillationData.keyword}", 话题数=${distillationData.topics.length}`);

        try {
          // 从图库随机选择图片
          const imageUrl = await this.selectRandomImage(task.albumId);
          console.log(`[任务 ${taskId}] 选择图片: ${imageUrl}`);

          // 生成单篇文章（需求 2.4 - 单文章数据隔离）
          const result = await this.generateSingleArticle(
            distillationData.keyword,
            distillationData.topics,
            imageUrl,
            knowledgeContent,
            articlePrompt,
            aiConfig
          );

          if (result.success && result.title && result.content) {
            console.log(`[任务 ${taskId}] [文章 ${i + 1}] 文章生成成功，标题: ${result.title}`);

            // 5. 保存文章并记录使用（使用事务）
            console.log(`[任务 ${taskId}] [文章 ${i + 1}] 开始保存文章并更新usage_count...`);
            const articleId = await this.saveArticleWithUsageTracking(
              taskId,
              distillationId,
              distillationData.keyword,
              result.title,
              result.content,
              imageUrl,
              aiConfig.provider
            );
            console.log(`[任务 ${taskId}] [文章 ${i + 1}] 文章保存成功，ID: ${articleId}，蒸馏结果ID: ${distillationId} 的usage_count已更新`);

            generatedCount++;

            // 更新进度
            await this.updateTaskProgress(taskId, generatedCount, actualCount);
            console.log(`[任务 ${taskId}] [文章 ${i + 1}] 进度更新: ${generatedCount}/${actualCount}`);
          } else {
            // 文章生成失败
            const errorMsg = `文章 ${i + 1} (关键词: ${distillationData.keyword}): ${result.error || '未知错误'}`;
            console.error(`[任务 ${taskId}] ${errorMsg}`);
            errors.push(errorMsg);
            // 继续处理下一篇文章（需求 6.1）
          }
        } catch (error: any) {
          // 捕获其他意外错误（如保存失败）
          const errorMsg = `文章 ${i + 1} (关键词: ${distillationData.keyword}): ${error.message}`;
          console.error(`[任务 ${taskId}] ${errorMsg}`);
          errors.push(errorMsg);
          // 继续处理下一篇文章（需求 6.1, 6.3）
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
        // 从图库随机选择图片
        const imageUrl = await this.selectRandomImage(task.albumId);
        console.log(`[任务 ${taskId}] 选择图片: ${imageUrl}`);

        // 生成单篇文章
        const result = await this.generateSingleArticle(
          pair.keyword,
          pair.topics,
          imageUrl,
          knowledgeContent,
          articlePrompt,
          aiConfig
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
            aiConfig.provider
          );
          console.log(`[任务 ${taskId}] 文章保存成功，ID: ${articleId}`);

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
   * 从图库随机选择图片
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
   * 获取活跃的AI配置
   */
  async getActiveAIConfig(): Promise<any> {
    const result = await pool.query(
      'SELECT provider, api_key, ollama_base_url, ollama_model FROM api_configs WHERE is_active = true LIMIT 1'
    );

    if (result.rows.length === 0) {
      throw new Error('没有活跃的AI配置');
    }

    return result.rows[0];
  }

  /**
   * 在文章内容中插入图片标记
   * Feature: article-image-embedding, Property 1: 图片标记插入完整性
   * Feature: article-image-embedding, Property 2: 多段落图片位置正确性
   */
  private insertImageIntoContent(
    content: string,
    imageUrl: string
  ): string {
    // 检查内容是否已包含图片占位符（AI生成的）
    // Feature: article-image-embedding, Property 13: 占位符替换正确性
    const placeholderRegex = /\[IMAGE_PLACEHOLDER\]/i;
    if (placeholderRegex.test(content)) {
      // 替换占位符为实际图片
      return content.replace(
        placeholderRegex,
        `![文章配图](${imageUrl})`
      );
    }

    // 如果没有占位符，智能插入图片
    // Feature: article-image-embedding, Property 14: 无占位符自动插入
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    
    if (paragraphs.length === 0) {
      // 空内容，直接返回图片
      return `![文章配图](${imageUrl})\n\n${content}`;
    } else if (paragraphs.length === 1) {
      // 只有一段，图片放在末尾
      return `${content}\n\n![文章配图](${imageUrl})`;
    } else {
      // 多段，图片放在第一段或第二段后
      const insertIndex = 1; // 在第一段后插入
      paragraphs.splice(
        insertIndex,
        0,
        `![文章配图](${imageUrl})`
      );
      return paragraphs.join('\n\n');
    }
  }

  /**
   * 构建包含图片指示的AI提示词
   * Feature: article-image-embedding, Property 12: AI提示词包含占位符指示
   */
  private buildPromptWithImageInstruction(
    basePrompt: string,
    keyword: string,
    topics: string[],
    knowledgeContent: string
  ): string {
    const topicsList = topics.map((t, i) => `${i + 1}. ${t}`).join('\n');

    let prompt = '【重要输出要求】\n';
    prompt += '1. 直接输出文章内容，不要包含任何思考过程\n';
    prompt += '2. 使用纯文本格式，不要使用Markdown符号（如#、*、-等）\n';
    prompt += '3. 在文章的适当位置（建议在第一段或第二段之后）插入 [IMAGE_PLACEHOLDER] 标记，用于后续插入配图\n';
    prompt += '4. 按照"标题：[标题内容]"格式开始，然后是正文\n';
    prompt += '5. 文章内容要自然流畅，段落之间用空行分隔\n\n';
    prompt += basePrompt + '\n\n';
    prompt += `核心关键词：${keyword}\n\n`;
    prompt += '相关话题：\n' + topicsList;

    if (knowledgeContent && knowledgeContent.trim().length > 0) {
      prompt += '\n\n企业知识库参考资料：\n' + knowledgeContent;
      prompt += '\n\n请基于以上企业知识库的内容，确保文章的专业性和准确性。';
    }

    prompt += '\n\n请撰写一篇专业、高质量的文章。严格按照以下格式输出：\n\n';
    prompt += '标题：[文章标题]\n\n[文章正文内容，在适当位置包含 [IMAGE_PLACEHOLDER]]';

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
    aiConfig: any
  ): Promise<{ success: boolean; title?: string; content?: string; error?: string }> {
    try {
      // 构建包含图片指示的AI prompt
      const prompt = this.buildPromptWithImageInstruction(
        articlePrompt,
        keyword,
        topics,
        knowledgeContent
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
        response = await aiService['callAI'](prompt);
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
   * 智能选择蒸馏结果（按使用次数升序）
   * 需求: 1.1, 1.2, 1.5, 5.1, 5.3, 5.4
   * 
   * 实现步骤：
   * 1. 查询所有有话题的蒸馏结果（排除没有话题的）
   * 2. 按usage_count ASC, created_at ASC排序
   * 3. 使用LIMIT限制返回数量为requestedCount
   * 4. 验证可用数量是否充足
   * 5. 如果可用数量少于请求数量，抛出清晰的错误消息
   * 
   * @param requestedCount 请求的蒸馏结果数量
   * @returns 选择的蒸馏结果ID数组
   */
  async selectDistillationsForTask(requestedCount: number): Promise<number[]> {
    console.log(`[智能选择] 开始选择 ${requestedCount} 个蒸馏结果...`);
    
    // 首先查询所有有话题的蒸馏结果数量（用于验证）
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT d.id) as available_count
       FROM distillations d
       INNER JOIN topics t ON d.id = t.distillation_id
       WHERE d.id IS NOT NULL`
    );
    
    const availableCount = parseInt(countResult.rows[0].available_count);
    console.log(`[智能选择] 可用蒸馏结果数量: ${availableCount}`);
    
    // 验证可用数量是否充足（需求 1.3, 5.1, 5.2）
    if (availableCount < requestedCount) {
      const errorMsg = `可用蒸馏结果不足，当前只有${availableCount}个可用，但请求生成${requestedCount}篇文章`;
      console.error(`[智能选择] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    // 查询并选择蒸馏结果（需求 1.1, 1.2, 1.5）
    // 按usage_count升序、created_at升序排序，选择前N个
    const result = await pool.query(
      `SELECT d.id
       FROM distillations d
       INNER JOIN topics t ON d.id = t.distillation_id
       GROUP BY d.id, d.usage_count, d.created_at
       HAVING COUNT(t.id) > 0
       ORDER BY d.usage_count ASC, d.created_at ASC
       LIMIT $1`,
      [requestedCount]
    );
    
    // 处理空结果情况
    if (result.rows.length === 0) {
      const errorMsg = '没有找到任何有话题的蒸馏结果';
      console.error(`[智能选择] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    const selectedIds = result.rows.map((row: any) => row.id);
    console.log(`[智能选择] 成功选择 ${selectedIds.length} 个蒸馏结果: [${selectedIds.join(', ')}]`);
    
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
   * 在事务中保存文章并记录使用
   * 1. 保存文章
   * 2. 创建使用记录
   * 3. 更新usage_count
   * 4. 如果任何步骤失败，回滚整个事务
   */
  private async saveArticleWithUsageTracking(
    taskId: number,
    distillationId: number,
    keyword: string,
    title: string,
    content: string,
    imageUrl: string,
    provider: string
  ): Promise<number> {
    const client = await pool.connect();
    
    try {
      // 查询更新前的usage_count
      const beforeResult = await client.query(
        'SELECT usage_count FROM distillations WHERE id = $1',
        [distillationId]
      );
      const usageCountBefore = beforeResult.rows[0]?.usage_count || 0;
      console.log(`[保存文章] 蒸馏结果ID ${distillationId} 当前usage_count: ${usageCountBefore}`);
      
      await client.query('BEGIN');
      console.log(`[保存文章] 事务开始`);

      // 1. 保存文章
      const articleResult = await client.query(
        `INSERT INTO articles 
         (title, keyword, distillation_id, task_id, content, image_url, provider) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id`,
        [title, keyword, distillationId, taskId, content, imageUrl, provider]
      );

      const articleId = articleResult.rows[0].id;
      console.log(`[保存文章] 文章已插入，ID: ${articleId}`);

      // 2. 创建使用记录
      await this.recordDistillationUsage(distillationId, taskId, articleId, client);
      console.log(`[保存文章] 使用记录已创建: distillation_id=${distillationId}, task_id=${taskId}, article_id=${articleId}`);

      // 3. 更新usage_count
      await this.incrementUsageCount(distillationId, client);
      console.log(`[保存文章] usage_count已更新（+1）`);

      await client.query('COMMIT');
      console.log(`[保存文章] 事务提交成功`);
      
      // 验证更新后的usage_count
      const afterResult = await client.query(
        'SELECT usage_count FROM distillations WHERE id = $1',
        [distillationId]
      );
      const usageCountAfter = afterResult.rows[0]?.usage_count || 0;
      console.log(`[保存文章] 蒸馏结果ID ${distillationId} 更新后usage_count: ${usageCountAfter} (增加了 ${usageCountAfter - usageCountBefore})`);

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
    provider: string
  ): Promise<number> {
    const result = await pool.query(
      `INSERT INTO articles 
       (title, keyword, distillation_id, task_id, content, image_url, provider) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id`,
      [title, keyword, distillationId, taskId, content, imageUrl, provider]
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

    // 验证AI配置
    const aiConfigResult = await pool.query(
      'SELECT provider, api_key, ollama_base_url, ollama_model FROM api_configs WHERE is_active = true LIMIT 1'
    );
    if (aiConfigResult.rows.length === 0) {
      throw new Error('没有活跃的AI配置，请先配置AI服务');
    }

    const config = aiConfigResult.rows[0];
    if (config.provider === 'ollama') {
      if (!config.ollama_base_url || !config.ollama_model) {
        throw new Error('Ollama配置不完整，缺少base_url或model');
      }
    } else {
      if (!config.api_key) {
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

    // 检查AI配置
    try {
      const aiConfigResult = await pool.query(
        'SELECT provider, api_key, ollama_base_url, ollama_model FROM api_configs WHERE is_active = true LIMIT 1'
      );
      checks.aiConfigExists = aiConfigResult.rows.length > 0;
      
      if (!checks.aiConfigExists) {
        recommendations.push('没有活跃的AI配置，请先配置AI服务');
      } else {
        const config = aiConfigResult.rows[0];
        if (config.provider === 'ollama') {
          checks.aiConfigValid = !!(config.ollama_base_url && config.ollama_model);
          if (!checks.aiConfigValid) {
            recommendations.push('Ollama配置不完整，缺少base_url或model');
          }
        } else {
          checks.aiConfigValid = !!config.api_key;
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
