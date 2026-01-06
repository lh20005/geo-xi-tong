import { Router } from 'express';
import { pool } from '../db/database';
import { AIService } from '../services/aiService';
import { KnowledgeBaseService } from '../services/knowledgeBaseService';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';
import { storageQuotaService } from '../services/StorageQuotaService';
import { storageService, StorageService } from '../services/StorageService';

export const articleRouter = Router();

// 所有路由都需要认证和租户上下文
articleRouter.use(authenticate);
articleRouter.use(setTenantContext);
articleRouter.use(requireTenantContext);

// 获取文章统计数据（只统计当前用户的）
articleRouter.get('/stats', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_published = true) as published,
        COUNT(*) FILTER (WHERE is_published = false) as unpublished
       FROM articles
       WHERE user_id = $1`,
      [userId]
    );
    
    const stats = result.rows[0];
    res.json({
      total: parseInt(stats.total) || 0,
      published: parseInt(stats.published) || 0,
      unpublished: parseInt(stats.unpublished) || 0
    });
  } catch (error: any) {
    console.error('获取文章统计错误:', error);
    res.status(500).json({ error: '获取文章统计失败', details: error.message });
  }
});

// 获取关键词统计数据（只统计当前用户的）
articleRouter.get('/stats/keywords', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    
    const result = await pool.query(
      `SELECT 
        keyword,
        COUNT(*) as count
       FROM articles
       WHERE user_id = $1
       GROUP BY keyword
       ORDER BY count DESC, keyword ASC`,
      [userId]
    );
    
    res.json({
      keywords: result.rows.map(row => ({
        keyword: row.keyword,
        count: parseInt(row.count)
      }))
    });
  } catch (error: any) {
    console.error('获取关键词统计错误:', error);
    res.status(500).json({ error: '获取关键词统计失败', details: error.message });
  }
});

// 生成文章
articleRouter.post('/generate', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { keyword, distillationId, requirements, topicIds, knowledgeBaseIds } = req.body;
    
    if (!keyword || !distillationId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 验证蒸馏记录所有权
    const distillationCheck = await pool.query(
      'SELECT id FROM distillations WHERE id = $1 AND user_id = $2',
      [distillationId, userId]
    );
    
    if (distillationCheck.rows.length === 0) {
      return res.status(404).json({ error: '蒸馏记录不存在或无权访问' });
    }
    
    // 获取系统级API配置
    const { systemApiConfigService } = await import('../services/SystemApiConfigService');
    const config = await systemApiConfigService.getActiveConfig();
    
    if (!config) {
      return res.status(400).json({ error: '系统未配置AI服务，请联系管理员' });
    }
    
    const { provider, apiKey: api_key, ollamaBaseUrl: ollama_base_url, ollamaModel: ollama_model } = config;
    
    // 获取选中的话题
    let topicsQuery = 'SELECT question FROM topics WHERE distillation_id = $1';
    const queryParams: any[] = [distillationId];
    
    if (topicIds && topicIds.length > 0) {
      topicsQuery += ' AND id = ANY($2)';
      queryParams.push(topicIds);
    }
    
    const topicsResult = await pool.query(topicsQuery, queryParams);
    const topics = topicsResult.rows.map(row => row.question);
    
    // 创建AI服务
    const aiService = new AIService({
      provider,
      apiKey: api_key,
      ollamaBaseUrl: ollama_base_url,
      ollamaModel: ollama_model
    });
    
    // 获取知识库上下文（如果提供了知识库ID，验证所有权）
    let knowledgeContext = '';
    if (knowledgeBaseIds && Array.isArray(knowledgeBaseIds) && knowledgeBaseIds.length > 0) {
      // 验证知识库所有权
      const kbCheck = await pool.query(
        'SELECT id FROM knowledge_bases WHERE id = ANY($1) AND user_id = $2',
        [knowledgeBaseIds, userId]
      );
      
      if (kbCheck.rows.length !== knowledgeBaseIds.length) {
        return res.status(404).json({ error: '部分知识库不存在或无权访问' });
      }
      
      const knowledgeService = new KnowledgeBaseService();
      knowledgeContext = await knowledgeService.getKnowledgeContext(knowledgeBaseIds);
    }
    
    // 生成文章
    const content = await aiService.generateArticle(
      keyword,
      topics,
      requirements || '请撰写一篇专业、有价值的文章',
      knowledgeContext
    );
    
    // 计算文章内容大小
    const contentSize = StorageService.calculateTextSize(content);
    
    // 检查存储配额
    const quotaCheck = await storageQuotaService.checkQuota(userId, contentSize);
    if (!quotaCheck.allowed) {
      return res.status(403).json({ 
        error: '存储空间不足，无法生成文章。请升级套餐以获取更多存储空间。',
        reason: quotaCheck.reason,
        currentUsage: quotaCheck.currentUsageBytes,
        quota: quotaCheck.quotaBytes,
        available: quotaCheck.availableBytes,
        needUpgrade: true
      });
    }
    
    // 使用事务保存文章并记录存储使用
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 保存文章（关联用户）
      const articleResult = await client.query(
        `INSERT INTO articles (keyword, distillation_id, requirements, content, provider, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [keyword, distillationId, requirements, content, provider, userId]
      );
      
      const articleId = articleResult.rows[0].id;
      
      // 记录存储使用（在同一事务中）
      await client.query(
        'SELECT record_storage_usage($1, $2, $3, $4, $5, $6)',
        [userId, 'article', articleId, 'add', contentSize, JSON.stringify({
          keyword,
          distillationId,
          provider
        })]
      );
      
      await client.query('COMMIT');
      
      // 清除缓存（在事务外）
      try {
        await storageService.getUserStorageUsage(userId, true);
      } catch (cacheError) {
        console.error('[Article] 清除缓存失败:', cacheError);
      }
      
      res.json({
        success: true,
        articleId,
        content
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('文章生成错误:', error);
    res.status(500).json({ 
      error: '文章生成失败',
      details: error.message
    });
  }
});

// 批量删除文章 - 必须在 /:id 路由之前定义
articleRouter.delete('/batch', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = getCurrentTenantId(req);
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids参数必须是非空数组' });
    }

    await client.query('BEGIN');
    
    // 获取要删除的文章信息（包括图片URL和大小）
    const articlesResult = await client.query(
      `SELECT id, distillation_id, image_url, image_size_bytes, content
       FROM articles
       WHERE id = ANY($1::integer[]) AND user_id = $2`,
      [ids, userId]
    );
    
    // 收集图片URL用于后续清理
    const imageUrls = articlesResult.rows
      .filter(a => a.image_url)
      .map(a => a.image_url);
    
    // 计算总存储大小
    let totalStorageSize = 0;
    for (const article of articlesResult.rows) {
      const contentSize = StorageService.calculateTextSize(article.content || '');
      const imageSize = article.image_size_bytes || 0;
      totalStorageSize += contentSize + imageSize;
    }
    
    // 获取distillation_id统计
    const distillationCounts = new Map<number, number>();
    for (const article of articlesResult.rows) {
      if (article.distillation_id) {
        const count = distillationCounts.get(article.distillation_id) || 0;
        distillationCounts.set(article.distillation_id, count + 1);
      }
    }
    
    // 删除文章
    const deleteResult = await client.query(
      'DELETE FROM articles WHERE id = ANY($1::integer[]) AND user_id = $2 RETURNING id',
      [ids, userId]
    );
    
    const deletedCount = deleteResult.rows.length;
    
    // 更新每个蒸馏结果的usage_count
    for (const [distillationId, count] of distillationCounts) {
      await client.query(
        'UPDATE distillations SET usage_count = GREATEST(usage_count - $1, 0) WHERE id = $2',
        [count, distillationId]
      );
    }
    
    await client.query('COMMIT');
    
    // 更新存储使用
    if (totalStorageSize > 0) {
      await storageService.removeStorageUsage(userId, 'article', 0, totalStorageSize);
    }
    
    // 同步用户存储使用
    await pool.query('SELECT sync_user_storage_usage($1)', [userId]);
    
    // 异步清理孤儿图片
    if (imageUrls.length > 0) {
      import('../services/OrphanImageCleanupService').then(({ orphanImageCleanupService }) => {
        imageUrls.forEach(url => {
          orphanImageCleanupService.cleanupAfterArticleDelete(url).catch(err => {
            console.error('[批量删除] 清理孤儿图片失败:', err);
          });
        });
      }).catch(() => {});
    }
    
    res.json({ 
      success: true, 
      deletedCount,
      message: `成功删除${deletedCount}篇文章`
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('批量删除文章错误:', error);
    res.status(500).json({ error: '批量删除文章失败', details: error.message });
  } finally {
    client.release();
  }
});

// 删除所有文章 - 必须在 /:id 路由之前定义
articleRouter.delete('/all', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = getCurrentTenantId(req);
    
    await client.query('BEGIN');
    
    // 获取所有文章信息（包括图片URL）
    const articlesResult = await client.query(
      `SELECT id, distillation_id, image_url, image_size_bytes, content
       FROM articles WHERE user_id = $1`,
      [userId]
    );
    
    // 收集图片URL用于后续清理
    const imageUrls = articlesResult.rows
      .filter(a => a.image_url)
      .map(a => a.image_url);
    
    // 计算总存储大小
    let totalStorageSize = 0;
    for (const article of articlesResult.rows) {
      const contentSize = StorageService.calculateTextSize(article.content || '');
      const imageSize = article.image_size_bytes || 0;
      totalStorageSize += contentSize + imageSize;
    }
    
    // 获取distillation_id统计
    const distillationCounts = new Map<number, number>();
    for (const article of articlesResult.rows) {
      if (article.distillation_id) {
        const count = distillationCounts.get(article.distillation_id) || 0;
        distillationCounts.set(article.distillation_id, count + 1);
      }
    }
    
    // 删除所有文章
    const deleteResult = await client.query(
      'DELETE FROM articles WHERE user_id = $1 RETURNING id',
      [userId]
    );
    
    const deletedCount = deleteResult.rows.length;
    
    // 更新所有蒸馏结果的usage_count
    for (const [distillationId, count] of distillationCounts) {
      await client.query(
        'UPDATE distillations SET usage_count = GREATEST(usage_count - $1, 0) WHERE id = $2',
        [count, distillationId]
      );
    }
    
    await client.query('COMMIT');
    
    // 更新存储使用
    if (totalStorageSize > 0) {
      await storageService.removeStorageUsage(userId, 'article', 0, totalStorageSize);
    }
    
    // 同步用户存储使用
    await pool.query('SELECT sync_user_storage_usage($1)', [userId]);
    
    // 异步清理孤儿图片
    if (imageUrls.length > 0) {
      import('../services/OrphanImageCleanupService').then(({ orphanImageCleanupService }) => {
        imageUrls.forEach(url => {
          orphanImageCleanupService.cleanupAfterArticleDelete(url).catch(err => {
            console.error('[删除所有] 清理孤儿图片失败:', err);
          });
        });
      }).catch(() => {});
    }
    
    res.json({ 
      success: true, 
      deletedCount,
      message: `成功删除所有${deletedCount}篇文章`
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('删除所有文章错误:', error);
    res.status(500).json({ error: '删除所有文章失败', details: error.message });
  } finally {
    client.release();
  }
});

// 获取文章列表（支持分页和多条件筛选）
articleRouter.get('/', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const taskId = req.query.taskId ? parseInt(req.query.taskId as string) : null;
    const publishStatus = req.query.publishStatus as string;
    const distillationId = req.query.distillationId ? parseInt(req.query.distillationId as string) : null;
    const keyword = req.query.keyword as string;

    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: '无效的分页参数' });
    }

    const offset = (page - 1) * pageSize;

    // 构建查询条件（首先添加用户隔离）
    const whereClauses: string[] = ['a.user_id = $1'];
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (taskId !== null) {
      whereClauses.push(`a.task_id = $${paramIndex}`);
      queryParams.push(taskId);
      paramIndex++;
    }

    // 发布状态筛选
    if (publishStatus === 'published') {
      whereClauses.push(`a.is_published = $${paramIndex}`);
      queryParams.push(true);
      paramIndex++;
    } else if (publishStatus === 'unpublished') {
      // 未发布：is_published = false 或 is_published IS NULL（兼容旧数据）
      whereClauses.push(`(a.is_published = $${paramIndex} OR a.is_published IS NULL)`);
      queryParams.push(false);
      paramIndex++;
      
      // 未发布状态下，排除有待处理发布任务的文章（避免重复选择）
      whereClauses.push(`(a.publishing_status IS NULL OR a.publishing_status = '')`);
    }

    // 话题筛选
    if (distillationId !== null) {
      whereClauses.push(`a.distillation_id = $${paramIndex}`);
      queryParams.push(distillationId);
      paramIndex++;
    }

    // 关键词搜索
    if (keyword && keyword.trim().length > 0) {
      whereClauses.push(`a.keyword ILIKE $${paramIndex}`);
      queryParams.push(`%${keyword.trim()}%`);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM articles a ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count);

    // 获取文章列表
    // 优先使用话题表的keyword快照字段，删除蒸馏记录后仍能显示关键词
    queryParams.push(pageSize, offset);
    const result = await pool.query(
      `SELECT 
        a.id,
        a.title,
        a.keyword,
        a.distillation_id,
        t.keyword as distillation_keyword,
        a.topic_id,
        t.question as topic_question,
        a.task_id,
        gt.conversion_target_id,
        gt.conversion_target_name,
        gt.article_setting_id,
        ast.name as article_setting_name,
        a.image_url,
        a.is_published,
        a.published_at,
        a.created_at,
        a.updated_at
       FROM articles a
       LEFT JOIN topics t ON a.topic_id = t.id
       LEFT JOIN generation_tasks gt ON a.task_id = gt.id
       LEFT JOIN article_settings ast ON gt.article_setting_id = ast.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    );
    
    res.json({
      articles: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        keyword: row.keyword,
        distillationId: row.distillation_id,
        distillationKeyword: row.distillation_keyword,
        topicId: row.topic_id,
        topicQuestion: row.topic_question,
        taskId: row.task_id,
        conversionTargetId: row.conversion_target_id,
        conversionTargetName: row.conversion_target_name,
        articleSettingId: row.article_setting_id,
        articleSettingName: row.article_setting_name,
        imageUrl: row.image_url,
        isPublished: row.is_published,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      total,
      page,
      pageSize
    });
  } catch (error: any) {
    console.error('获取文章列表错误:', error);
    res.status(500).json({ error: '获取文章列表失败', details: error.message });
  }
});

// 获取文章详情
articleRouter.get('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { id } = req.params;
    
    // 完全解耦：直接使用快照字段
    const result = await pool.query(
      `SELECT 
        a.id,
        a.title,
        a.keyword,
        a.distillation_id,
        t.keyword as distillation_keyword,
        a.topic_id,
        t.question as topic_question,
        a.task_id,
        gt.conversion_target_id,
        gt.conversion_target_name,
        gt.article_setting_id,
        ast.name as article_setting_name,
        a.requirements,
        a.content,
        a.image_url,
        a.provider,
        a.is_published,
        a.published_at,
        a.created_at,
        a.updated_at
       FROM articles a
       LEFT JOIN topics t ON a.topic_id = t.id
       LEFT JOIN generation_tasks gt ON a.task_id = gt.id
       LEFT JOIN article_settings ast ON gt.article_setting_id = ast.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '文章不存在或无权访问' });
    }
    
    const article = result.rows[0];
    res.json({
      id: article.id,
      title: article.title,
      keyword: article.keyword,
      distillationId: article.distillation_id,
      distillationKeyword: article.distillation_keyword,
      topicId: article.topic_id,
      topicQuestion: article.topic_question,
      taskId: article.task_id,
      conversionTargetId: article.conversion_target_id,
      conversionTargetName: article.conversion_target_name,
      articleSettingId: article.article_setting_id,
      articleSettingName: article.article_setting_name,
      requirements: article.requirements,
      content: article.content,
      imageUrl: article.image_url,
      provider: article.provider,
      isPublished: article.is_published,
      publishedAt: article.published_at,
      createdAt: article.created_at,
      updatedAt: article.updated_at
    });
  } catch (error: any) {
    console.error('获取文章详情错误:', error);
    res.status(500).json({ error: '获取文章详情失败', details: error.message });
  }
});

// 更新文章
articleRouter.put('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { id } = req.params;
    const { title, content, imageUrl } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: '文章标题不能为空' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '文章内容不能为空' });
    }

    // 验证文章所有权
    const checkResult = await pool.query(
      'SELECT id FROM articles WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '文章不存在或无权访问' });
    }

    const updateFields = ['title = $1', 'content = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const updateValues: any[] = [title.trim(), content.trim()];
    let paramIndex = 3;

    if (imageUrl !== undefined) {
      updateFields.push(`image_url = $${paramIndex}`);
      updateValues.push(imageUrl);
      paramIndex++;
    }

    updateValues.push(id);
    updateValues.push(userId);

    const result = await pool.query(
      `UPDATE articles 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING id, title, keyword, distillation_id, task_id, requirements,
                 content, image_url, provider, created_at, updated_at, is_published, published_at`,
      updateValues
    );

    const article = result.rows[0];
    res.json({
      id: article.id,
      title: article.title,
      keyword: article.keyword,
      distillationId: article.distillation_id,
      taskId: article.task_id,
      requirements: article.requirements,
      content: article.content,
      imageUrl: article.image_url,
      provider: article.provider,
      isPublished: article.is_published,
      publishedAt: article.published_at,
      createdAt: article.created_at,
      updatedAt: article.updated_at
    });
  } catch (error: any) {
    console.error('更新文章错误:', error);
    res.status(500).json({ error: '更新文章失败', details: error.message });
  }
});

// 智能排版文章
articleRouter.post('/:id/smart-format', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { id } = req.params;
    const { content, imageUrl } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '文章内容不能为空' });
    }

    // 验证文章所有权
    const checkResult = await pool.query(
      'SELECT id FROM articles WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '文章不存在或无权访问' });
    }

    // 使用系统级API配置
    const { systemApiConfigService } = await import('../services/SystemApiConfigService');
    const config = await systemApiConfigService.getActiveConfig();

    if (!config) {
      return res.status(400).json({ error: '系统未配置AI服务，请联系管理员' });
    }

    const { provider, apiKey: api_key, ollamaBaseUrl: ollama_base_url, ollamaModel: ollama_model } = config;

    const aiService = new AIService({
      provider,
      apiKey: api_key,
      ollamaBaseUrl: ollama_base_url,
      ollamaModel: ollama_model,
      timeout: 30000
    });

    const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const hasImage = !!imageUrl;
    const formattedText = await aiService.formatArticle(plainText, hasImage);

    const paragraphs = formattedText.split('\n').filter(p => p.trim().length > 0);
    let formattedHtml = '';

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      formattedHtml += `<p>${paragraph}</p>`;

      // 在第一段后插入图片
      if (i === 0 && hasImage && imageUrl) {
        formattedHtml += `<img src="${imageUrl}" alt="article image" style="max-width: 100%; height: auto; margin: 20px 0;" />`;
      }
    }

    res.json({
      content: formattedHtml
    });
  } catch (error: any) {
    console.error('智能排版错误:', error);
    res.status(500).json({ 
      error: '智能排版失败',
      details: error.message
    });
  }
});

// 更新文章发布状态
articleRouter.put('/:id/publish', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { id } = req.params;
    const { isPublished } = req.body;

    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({ error: 'isPublished必须是布尔值' });
    }

    // 验证文章所有权
    const checkResult = await pool.query(
      'SELECT id FROM articles WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '文章不存在或无权访问' });
    }

    const result = await pool.query(
      `UPDATE articles 
       SET is_published = $1, 
           published_at = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING id, is_published, published_at, updated_at`,
      [isPublished, id, userId]
    );

    const article = result.rows[0];
    res.json({
      id: article.id,
      isPublished: article.is_published,
      publishedAt: article.published_at,
      updatedAt: article.updated_at
    });
  } catch (error: any) {
    console.error('更新发布状态错误:', error);
    res.status(500).json({ error: '更新发布状态失败', details: error.message });
  }
});

// 删除单篇文章 - 必须在最后定义，避免匹配到 /batch 和 /all
articleRouter.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = getCurrentTenantId(req);
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    // 验证文章所有权并获取信息
    const articleResult = await client.query(
      'SELECT distillation_id, content, image_url, image_size_bytes FROM articles WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (articleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '文章不存在或无权访问' });
    }
    
    const article = articleResult.rows[0];
    const distillationId = article.distillation_id;
    const imageUrl = article.image_url;
    const contentSize = StorageService.calculateTextSize(article.content || '');
    const imageSize = article.image_size_bytes || 0;
    
    // 删除文章（仅当前用户的）
    await client.query('DELETE FROM articles WHERE id = $1 AND user_id = $2', [id, userId]);
    
    if (distillationId) {
      await client.query(
        'UPDATE distillations SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = $1',
        [distillationId]
      );
    }
    
    await client.query('COMMIT');
    
    // 减少存储使用（包括文章图片）
    const totalSize = contentSize + imageSize;
    await storageService.removeStorageUsage(userId, 'article', parseInt(id), totalSize);
    
    // 同步用户存储使用
    await pool.query('SELECT sync_user_storage_usage($1)', [userId]);
    
    // 异步清理孤儿图片（如果文章有图片）
    if (imageUrl) {
      // 动态导入避免循环依赖
      import('./gallery').then(() => {
        import('../services/OrphanImageCleanupService').then(({ orphanImageCleanupService }) => {
          orphanImageCleanupService.cleanupAfterArticleDelete(imageUrl).catch(err => {
            console.error('[文章删除] 清理孤儿图片失败:', err);
          });
        });
      }).catch(() => {});
    }
    
    res.json({ success: true, message: '文章删除成功' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('删除文章错误:', error);
    res.status(500).json({ error: '删除文章失败', details: error.message });
  } finally {
    client.release();
  }
});
