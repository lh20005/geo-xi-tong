import { Router } from 'express';
import { pool } from '../db/database';
import { AIService } from '../services/aiService';
import { DistillationService } from '../services/distillationService';

export const distillationRouter = Router();
const distillationService = new DistillationService();

// 执行关键词蒸馏
distillationRouter.post('/', async (req, res) => {
  try {
    const { keyword } = req.body;
    
    if (!keyword) {
      return res.status(400).json({ error: '请提供关键词' });
    }
    
    // 获取当前激活的API配置
    const configResult = await pool.query(
      'SELECT provider, api_key, ollama_base_url, ollama_model FROM api_configs WHERE is_active = true LIMIT 1'
    );
    
    if (configResult.rows.length === 0) {
      return res.status(400).json({ error: '请先配置AI API' });
    }
    
    const { provider, api_key, ollama_base_url, ollama_model } = configResult.rows[0];
    
    // 创建AI服务实例
    const aiService = new AIService({
      provider,
      apiKey: api_key,
      ollamaBaseUrl: ollama_base_url,
      ollamaModel: ollama_model
    });
    
    // 执行蒸馏
    const questions = await aiService.distillKeyword(keyword);
    
    // 保存蒸馏记录
    const distillationResult = await pool.query(
      'INSERT INTO distillations (keyword, provider) VALUES ($1, $2) RETURNING id',
      [keyword, provider]
    );
    
    const distillationId = distillationResult.rows[0].id;
    
    // 保存话题
    for (const question of questions) {
      await pool.query(
        'INSERT INTO topics (distillation_id, question) VALUES ($1, $2)',
        [distillationId, question]
      );
    }
    
    res.json({
      success: true,
      distillationId,
      keyword,
      questions,
      count: questions.length
    });
  } catch (error: any) {
    console.error('蒸馏错误:', error);
    res.status(500).json({ 
      error: '关键词蒸馏失败', 
      details: error.message 
    });
  }
});

// ==================== 特定路径路由（必须在 /:id 之前）====================

// 获取所有唯一的关键词列表
distillationRouter.get('/keywords', async (req, res) => {
  try {
    const keywords = await distillationService.getAllKeywords();
    res.json({ keywords });
  } catch (error: any) {
    console.error('获取关键词列表错误:', error);
    res.status(500).json({ 
      error: '获取关键词列表失败', 
      details: error.message 
    });
  }
});

// 获取蒸馏历史（扩展版：支持排序、筛选、分页）
distillationRouter.get('/history', async (req, res) => {
  try {
    // 解析查询参数
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const sortBy = (req.query.sortBy as string) || 'created_at';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const filterUsage = (req.query.filterUsage as string) || 'all';

    // 参数验证
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: '无效的分页参数' });
    }

    if (!['created_at', 'usage_count'].includes(sortBy)) {
      return res.status(400).json({ error: '无效的排序字段' });
    }

    if (!['asc', 'desc'].includes(sortOrder)) {
      return res.status(400).json({ error: '无效的排序顺序' });
    }

    if (!['all', 'used', 'unused'].includes(filterUsage)) {
      return res.status(400).json({ error: '无效的筛选条件' });
    }

    // 构建WHERE子句
    let whereClause = '';
    if (filterUsage === 'used') {
      whereClause = 'WHERE d.usage_count > 0';
    } else if (filterUsage === 'unused') {
      whereClause = 'WHERE d.usage_count = 0';
    }

    // 构建ORDER BY子句
    const orderByClause = `ORDER BY d.${sortBy} ${sortOrder.toUpperCase()}`;

    // 计算偏移量
    const offset = (page - 1) * pageSize;

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM distillations d
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].total);

    // 查询数据（包含usage_count和lastUsedAt）
    const dataQuery = `
      SELECT 
        d.id, 
        d.keyword, 
        d.provider, 
        d.created_at,
        d.usage_count,
        COUNT(t.id) as topic_count,
        (
          SELECT MAX(du.used_at)
          FROM distillation_usage du
          WHERE du.distillation_id = d.id
        ) as last_used_at
      FROM distillations d
      LEFT JOIN topics t ON d.id = t.distillation_id
      ${whereClause}
      GROUP BY d.id
      ${orderByClause}
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(dataQuery, [pageSize, offset]);
    
    res.json({
      data: result.rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error: any) {
    console.error('获取历史记录失败:', error);
    res.status(500).json({ 
      error: '获取历史记录失败',
      details: error.message 
    });
  }
});

// 获取带引用次数的蒸馏结果列表（新的表格视图API）
distillationRouter.get('/results', async (req, res) => {
  try {
    const keyword = req.query.keyword as string | undefined;
    const provider = req.query.provider as string | undefined;
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    // 参数验证
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: '无效的分页参数' });
    }

    if (provider && !['deepseek', 'gemini', 'ollama'].includes(provider)) {
      return res.status(400).json({ error: '无效的AI模型参数' });
    }

    // 调用服务层方法
    // search参数优先级最高，如果提供了search，其他筛选条件会被忽略
    const result = await distillationService.getResultsWithReferences({
      keyword,
      provider,
      search,
      page,
      pageSize
    });

    res.json(result);
  } catch (error: any) {
    console.error('获取蒸馏结果列表错误:', error);
    res.status(500).json({ 
      error: '获取蒸馏结果列表失败', 
      details: error.message 
    });
  }
});

// 获取蒸馏结果列表（包含使用统计）
// Task 2.1: 扩展蒸馏结果列表API - 已完成，现在使用扩展的service方法
distillationRouter.get('/stats', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const sortBy = (req.query.sortBy as 'created_at' | 'usage_count') || 'usage_count';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc';
    const filterUsage = (req.query.filterUsage as 'all' | 'used' | 'unused') || 'all';

    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: '无效的分页参数' });
    }

    if (!['created_at', 'usage_count'].includes(sortBy)) {
      return res.status(400).json({ error: '无效的排序字段' });
    }

    if (!['asc', 'desc'].includes(sortOrder)) {
      return res.status(400).json({ error: '无效的排序顺序' });
    }

    if (!['all', 'used', 'unused'].includes(filterUsage)) {
      return res.status(400).json({ error: '无效的筛选条件' });
    }

    const result = await distillationService.getDistillationsWithStats(
      page,
      pageSize,
      sortBy,
      sortOrder,
      filterUsage
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('获取使用统计错误:', error);
    res.status(500).json({ 
      error: '获取使用统计失败', 
      details: error.message 
    });
  }
});

// 获取推荐的蒸馏结果
distillationRouter.get('/recommended', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 3;

    if (limit < 1 || limit > 10) {
      return res.status(400).json({ error: '推荐数量必须在1-10之间' });
    }

    const result = await distillationService.getRecommendedDistillations(limit);
    
    res.json(result);
  } catch (error: any) {
    console.error('获取推荐结果错误:', error);
    res.status(500).json({ 
      error: '获取推荐结果失败', 
      details: error.message 
    });
  }
});

// 修复使用计数API
distillationRouter.post('/fix-usage-count', async (req, res) => {
  try {
    const { distillationId } = req.body;

    // 如果提供了distillationId,只修复单个
    if (distillationId !== undefined) {
      const id = parseInt(distillationId);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: '无效的蒸馏结果ID' });
      }

      // 检查记录是否存在
      const checkResult = await pool.query(
        'SELECT id, keyword, usage_count FROM distillations WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: '蒸馏结果不存在' });
      }

      const oldCount = checkResult.rows[0].usage_count;

      // 重新计算usage_count
      const countResult = await pool.query(
        'SELECT COUNT(*) as actual_count FROM distillation_usage WHERE distillation_id = $1',
        [id]
      );

      const actualCount = parseInt(countResult.rows[0].actual_count);

      // 更新usage_count
      await pool.query(
        'UPDATE distillations SET usage_count = $1 WHERE id = $2',
        [actualCount, id]
      );

      res.json({
        success: true,
        message: '使用计数修复完成',
        fixedCount: 1,
        details: [{
          distillationId: id,
          keyword: checkResult.rows[0].keyword,
          oldCount,
          newCount: actualCount,
          actualCount
        }]
      });
    } else {
      // 修复所有蒸馏结果
      const allDistillations = await pool.query(
        'SELECT id, keyword, usage_count FROM distillations'
      );

      const details = [];
      let fixedCount = 0;

      for (const dist of allDistillations.rows) {
        const oldCount = dist.usage_count;

        // 重新计算usage_count
        const countResult = await pool.query(
          'SELECT COUNT(*) as actual_count FROM distillation_usage WHERE distillation_id = $1',
          [dist.id]
        );

        const actualCount = parseInt(countResult.rows[0].actual_count);

        if (oldCount !== actualCount) {
          // 更新usage_count
          await pool.query(
            'UPDATE distillations SET usage_count = $1 WHERE id = $2',
            [actualCount, dist.id]
          );

          details.push({
            distillationId: dist.id,
            keyword: dist.keyword,
            oldCount,
            newCount: actualCount,
            actualCount
          });

          fixedCount++;
        }
      }

      res.json({
        success: true,
        message: `使用计数修复完成,共修复${fixedCount}条记录`,
        fixedCount,
        details
      });
    }
  } catch (error: any) {
    console.error('修复使用计数错误:', error);
    res.status(500).json({ 
      error: '修复使用计数失败', 
      details: error.message 
    });
  }
});

// ==================== 其他操作（必须在动态路由之前）====================

// 批量删除话题
distillationRouter.delete('/topics', async (req, res) => {
  try {
    const { topicIds } = req.body;

    // 参数验证
    if (!topicIds || !Array.isArray(topicIds)) {
      return res.status(400).json({ error: '请提供要删除的话题ID数组' });
    }

    if (topicIds.length === 0) {
      return res.json({ success: true, deletedCount: 0 });
    }

    // 尝试将所有ID转换为数字
    const convertedIds = topicIds.map(id => {
      const num = typeof id === 'string' ? parseInt(id, 10) : Number(id);
      return { original: id, converted: num };
    });

    // 验证转换后的值是否为有效的正整数
    const invalidIds = convertedIds.filter(
      ({ converted }) => !Number.isInteger(converted) || converted <= 0
    );

    if (invalidIds.length > 0) {
      console.error('批量删除话题验证失败 - 无效的ID:', invalidIds.map(({ original }) => original));
      return res.status(400).json({ 
        error: '部分话题ID无效', 
        details: '话题ID必须是正整数',
        invalidIds: invalidIds.map(({ original }) => original)
      });
    }

    // 使用转换后的有效数字ID
    const validIds = convertedIds.map(({ converted }) => converted);

    // 调用服务层方法
    const result = await distillationService.deleteTopics(validIds);

    res.json(result);
  } catch (error: any) {
    console.error('批量删除话题错误:', error);
    res.status(500).json({ 
      error: '批量删除话题失败', 
      details: error.message 
    });
  }
});

// ==================== 动态路由（必须在特定路径之后）====================

// 获取单条蒸馏记录的详细信息（扩展版：包含usage_count和lastUsedAt）
distillationRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID格式
    const distillationId = parseInt(id);
    if (isNaN(distillationId) || distillationId <= 0) {
      return res.status(400).json({ error: '无效的记录ID' });
    }
    
    // 获取蒸馏记录和所有关联的话题（包含usage_count和lastUsedAt）
    const result = await pool.query(
      `SELECT 
        d.id, 
        d.keyword, 
        d.provider, 
        d.created_at,
        d.usage_count,
        COALESCE(json_agg(t.question ORDER BY t.created_at) FILTER (WHERE t.question IS NOT NULL), '[]') as questions,
        (
          SELECT MAX(du.used_at)
          FROM distillation_usage du
          WHERE du.distillation_id = d.id
        ) as last_used_at
       FROM distillations d
       LEFT JOIN topics t ON d.id = t.distillation_id
       WHERE d.id = $1
       GROUP BY d.id`,
      [distillationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('获取记录详情错误:', error);
    res.status(500).json({ 
      error: '获取记录详情失败', 
      details: error.message 
    });
  }
});

// 删除单条蒸馏记录
distillationRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID格式
    const distillationId = parseInt(id);
    if (isNaN(distillationId) || distillationId <= 0) {
      return res.status(400).json({ error: '无效的记录ID' });
    }
    
    // 检查记录是否存在
    const checkResult = await pool.query(
      'SELECT id FROM distillations WHERE id = $1',
      [distillationId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    // 删除记录（级联删除会自动删除关联的话题）
    await pool.query('DELETE FROM distillations WHERE id = $1', [distillationId]);
    
    res.json({
      success: true,
      message: '记录删除成功'
    });
  } catch (error: any) {
    console.error('删除记录错误:', error);
    res.status(500).json({ 
      error: '删除记录失败', 
      details: error.message 
    });
  }
});

// 更新蒸馏记录的关键词
distillationRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { keyword } = req.body;
    
    // 验证ID格式
    const distillationId = parseInt(id);
    if (isNaN(distillationId) || distillationId <= 0) {
      return res.status(400).json({ error: '无效的记录ID' });
    }
    
    // 验证关键词
    if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
      return res.status(400).json({ error: '关键词不能为空' });
    }
    
    // 检查记录是否存在
    const checkResult = await pool.query(
      'SELECT id FROM distillations WHERE id = $1',
      [distillationId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    // 更新关键词
    await pool.query(
      'UPDATE distillations SET keyword = $1 WHERE id = $2',
      [keyword.trim(), distillationId]
    );
    
    res.json({
      success: true,
      message: '关键词更新成功'
    });
  } catch (error: any) {
    console.error('更新关键词错误:', error);
    res.status(500).json({ 
      error: '更新关键词失败', 
      details: error.message 
    });
  }
});

// 删除所有蒸馏记录
distillationRouter.delete('/all/records', async (req, res) => {
  try {
    // 获取删除前的记录数量
    const countResult = await pool.query('SELECT COUNT(*) as count FROM distillations');
    const deletedCount = parseInt(countResult.rows[0].count);
    
    // 删除所有记录（级联删除会自动删除关联的话题）
    await pool.query('DELETE FROM distillations');
    
    res.json({
      success: true,
      message: '所有记录删除成功',
      deletedCount
    });
  } catch (error: any) {
    console.error('删除所有记录错误:', error);
    res.status(500).json({ 
      error: '删除所有记录失败', 
      details: error.message 
    });
  }
});

// 获取单条蒸馏结果的使用历史（扩展版）
distillationRouter.get('/:id/usage', async (req, res) => {
  try {
    const distillationId = parseInt(req.params.id);
    if (isNaN(distillationId) || distillationId <= 0) {
      return res.status(400).json({ error: '无效的记录ID' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: '无效的分页参数' });
    }

    // 检查蒸馏结果是否存在
    const distCheck = await pool.query(
      'SELECT id, keyword, usage_count FROM distillations WHERE id = $1',
      [distillationId]
    );

    if (distCheck.rows.length === 0) {
      return res.status(404).json({ error: '蒸馏结果不存在' });
    }

    const { keyword, usage_count } = distCheck.rows[0];

    // 计算偏移量
    const offset = (page - 1) * pageSize;

    // 查询总数
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM distillation_usage WHERE distillation_id = $1',
      [distillationId]
    );
    const total = parseInt(countResult.rows[0].total);

    // 查询使用历史
    const historyResult = await pool.query(
      `SELECT 
        du.id,
        du.task_id,
        du.article_id,
        du.used_at,
        a.title as article_title,
        CASE WHEN a.id IS NULL THEN true ELSE false END as article_deleted
       FROM distillation_usage du
       LEFT JOIN articles a ON du.article_id = a.id
       WHERE du.distillation_id = $1
       ORDER BY du.used_at DESC
       LIMIT $2 OFFSET $3`,
      [distillationId, pageSize, offset]
    );

    res.json({
      distillationId,
      keyword,
      totalUsageCount: usage_count,
      usageHistory: historyResult.rows,
      total,
      page,
      pageSize
    });
  } catch (error: any) {
    console.error('获取使用历史错误:', error);
    res.status(500).json({ 
      error: '获取使用历史失败', 
      details: error.message 
    });
  }
});

// 保留旧的API路径以保持向后兼容
distillationRouter.get('/:id/usage-history', async (req, res) => {
  try {
    const distillationId = parseInt(req.params.id);
    if (isNaN(distillationId) || distillationId <= 0) {
      return res.status(400).json({ error: '无效的记录ID' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: '无效的分页参数' });
    }

    const result = await distillationService.getUsageHistory(distillationId, page, pageSize);
    
    res.json(result);
  } catch (error: any) {
    console.error('获取使用历史错误:', error);
    res.status(500).json({ 
      error: '获取使用历史失败', 
      details: error.message 
    });
  }
});

// 重置单条蒸馏结果的使用统计
distillationRouter.post('/:id/reset-usage', async (req, res) => {
  try {
    const distillationId = parseInt(req.params.id);
    if (isNaN(distillationId) || distillationId <= 0) {
      return res.status(400).json({ error: '无效的记录ID' });
    }

    // 检查记录是否存在
    const checkResult = await pool.query(
      'SELECT id FROM distillations WHERE id = $1',
      [distillationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    await distillationService.resetUsageStats(distillationId);
    
    res.json({
      success: true,
      message: '使用统计重置成功'
    });
  } catch (error: any) {
    console.error('重置使用统计错误:', error);
    res.status(500).json({ 
      error: '重置使用统计失败', 
      details: error.message 
    });
  }
});

// 重置所有蒸馏结果的使用统计
distillationRouter.post('/reset-all-usage', async (req, res) => {
  try {
    await distillationService.resetAllUsageStats();
    
    res.json({
      success: true,
      message: '所有使用统计重置成功'
    });
  } catch (error: any) {
    console.error('重置所有使用统计错误:', error);
    res.status(500).json({ 
      error: '重置所有使用统计失败', 
      details: error.message 
    });
  }
});

// 修复使用统计（重新计算usage_count）
distillationRouter.post('/repair-usage-stats', async (req, res) => {
  try {
    const result = await distillationService.repairUsageStats();
    
    res.json({
      success: true,
      message: `修复完成，共修复${result.fixed}条记录`,
      ...result
    });
  } catch (error: any) {
    console.error('修复使用统计错误:', error);
    res.status(500).json({ 
      error: '修复使用统计失败', 
      details: error.message 
    });
  }
});
