import express from 'express';
import { pool } from '../db/database';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

const router = express.Router();

// 应用认证和租户中间件
router.use(authenticate);
router.use(setTenantContext);
router.use(requireTenantContext);

/**
 * 获取发布记录列表（完全使用快照数据，不依赖外键关联）
 */
router.get('/records', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { 
      platform_id, 
      article_id, 
      account_id,
      page = 1, 
      pageSize = 20 
    } = req.query;

    // 添加用户隔离条件
    const conditions: string[] = ['pr.user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (platform_id) {
      conditions.push(`pr.platform_id = $${paramIndex}`);
      params.push(platform_id);
      paramIndex++;
    }

    if (article_id) {
      conditions.push(`pr.article_id = $${paramIndex}`);
      params.push(parseInt(article_id as string));
      paramIndex++;
    }

    if (account_id) {
      conditions.push(`pr.account_id = $${paramIndex}`);
      params.push(parseInt(account_id as string));
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM publishing_records pr ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取数据（完全使用快照字段，删除源数据不影响发布记录）
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const dataResult = await pool.query(
      `SELECT 
        pr.id,
        pr.article_id,
        pr.task_id,
        pr.platform_id,
        pr.account_id,
        pr.account_name,
        pr.platform_article_id,
        pr.platform_url,
        pr.published_at,
        pr.created_at,
        pr.article_title,
        pr.article_keyword,
        pr.article_content,
        pr.article_image_url,
        pr.topic_question,
        pr.article_setting_name,
        pr.distillation_keyword,
        COALESCE(pr.platform_name, pc.platform_name) as platform_name,
        pr.real_username_snapshot as real_username
       FROM publishing_records pr
       LEFT JOIN platforms_config pc ON pr.platform_id = pc.platform_id
       ${whereClause}
       ORDER BY pr.published_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(pageSize as string), offset]
    );

    const records = dataResult.rows;

    res.json({
      success: true,
      data: {
        records,
        total,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string)
      }
    });
  } catch (error: any) {
    console.error('获取发布记录列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取发布记录列表失败',
      error: error.message
    });
  }
});

/**
 * 获取发布记录详情（完全使用快照数据）
 */
router.get('/records/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const recordId = parseInt(req.params.id);

    const result = await pool.query(
      `SELECT 
        pr.id,
        pr.article_id,
        pr.task_id,
        pr.platform_id,
        pr.account_id,
        pr.account_name,
        pr.platform_article_id,
        pr.platform_url,
        pr.published_at,
        pr.created_at,
        pr.article_title,
        pr.article_keyword,
        pr.article_content,
        pr.article_image_url,
        pr.topic_question,
        pr.article_setting_name,
        pr.distillation_keyword,
        COALESCE(pr.platform_name, pc.platform_name) as platform_name,
        pr.real_username_snapshot as real_username
       FROM publishing_records pr
       LEFT JOIN platforms_config pc ON pr.platform_id = pc.platform_id
       WHERE pr.id = $1 AND pr.user_id = $2`,
      [recordId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '发布记录不存在或无权访问'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('获取发布记录详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取发布记录详情失败',
      error: error.message
    });
  }
});


/**
 * 删除发布记录
 */
router.delete('/records/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const recordId = parseInt(req.params.id);

    // 验证记录所有权并删除
    const result = await pool.query(
      'DELETE FROM publishing_records WHERE id = $1 AND user_id = $2 RETURNING id',
      [recordId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '发布记录不存在或无权删除'
      });
    }

    res.json({
      success: true,
      message: '发布记录已删除'
    });
  } catch (error: any) {
    console.error('删除发布记录失败:', error);
    res.status(500).json({
      success: false,
      message: '删除发布记录失败',
      error: error.message
    });
  }
});

/**
 * 批量删除发布记录
 */
router.delete('/records', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ids参数必须是非空数组'
      });
    }

    const result = await pool.query(
      'DELETE FROM publishing_records WHERE id = ANY($1::integer[]) AND user_id = $2 RETURNING id',
      [ids, userId]
    );

    res.json({
      success: true,
      message: `已删除 ${result.rows.length} 条发布记录`,
      deletedCount: result.rows.length
    });
  } catch (error: any) {
    console.error('批量删除发布记录失败:', error);
    res.status(500).json({
      success: false,
      message: '批量删除发布记录失败',
      error: error.message
    });
  }
});

/**
 * 获取发布统计数据
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);

    // 总发布次数（仅当前用户）
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM publishing_records WHERE user_id = $1',
      [userId]
    );

    // 按平台统计（使用快照的 platform_name，兼容旧数据用 platforms_config）
    const platformResult = await pool.query(
      `SELECT 
        pr.platform_id,
        COALESCE(pr.platform_name, pc.platform_name) as platform_name,
        COUNT(*) as count
       FROM publishing_records pr
       LEFT JOIN platforms_config pc ON pr.platform_id = pc.platform_id
       WHERE pr.user_id = $1
       GROUP BY pr.platform_id, pr.platform_name, pc.platform_name
       ORDER BY count DESC`,
      [userId]
    );

    // 今日发布数（仅当前用户）
    const todayResult = await pool.query(
      `SELECT COUNT(*) as today_count 
       FROM publishing_records 
       WHERE DATE(published_at) = CURRENT_DATE AND user_id = $1`,
      [userId]
    );

    // 本周发布数（仅当前用户）
    const weekResult = await pool.query(
      `SELECT COUNT(*) as week_count 
       FROM publishing_records 
       WHERE published_at >= DATE_TRUNC('week', CURRENT_DATE) AND user_id = $1`,
      [userId]
    );

    // 本月发布数（仅当前用户）
    const monthResult = await pool.query(
      `SELECT COUNT(*) as month_count 
       FROM publishing_records 
       WHERE published_at >= DATE_TRUNC('month', CURRENT_DATE) AND user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        total: parseInt(totalResult.rows[0].total),
        today: parseInt(todayResult.rows[0].today_count),
        week: parseInt(weekResult.rows[0].week_count),
        month: parseInt(monthResult.rows[0].month_count),
        byPlatform: platformResult.rows.map(row => ({
          platformId: row.platform_id,
          platformName: row.platform_name,
          count: parseInt(row.count)
        }))
      }
    });
  } catch (error: any) {
    console.error('获取发布统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取发布统计失败',
      error: error.message
    });
  }
});

export default router;
