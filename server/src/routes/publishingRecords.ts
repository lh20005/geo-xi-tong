import express from 'express';
import { pool } from '../db/database';
import { encryptionService } from '../services/EncryptionService';

const router = express.Router();

/**
 * 获取发布记录列表
 */
router.get('/records', async (req, res) => {
  try {
    const { 
      platform_id, 
      article_id, 
      account_id,
      page = 1, 
      pageSize = 20 
    } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM publishing_records pr ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取数据
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
        a.title as article_title,
        a.keyword as article_keyword,
        t.question as topic_question,
        pc.platform_name,
        pt.status as task_status,
        pa.credentials
       FROM publishing_records pr
       LEFT JOIN articles a ON pr.article_id = a.id
       LEFT JOIN topics t ON a.topic_id = t.id
       LEFT JOIN platforms_config pc ON pr.platform_id = pc.platform_id
       LEFT JOIN publishing_tasks pt ON pr.task_id = pt.id
       LEFT JOIN platform_accounts pa ON pr.account_id = pa.id
       ${whereClause}
       ORDER BY pr.published_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(pageSize as string), offset]
    );

    // 解密并提取真实用户名
    const records = dataResult.rows.map(row => {
      const record: any = { ...row };
      delete record.credentials; // 不返回加密的凭证
      
      if (row.credentials) {
        try {
          const decryptedCredentials = encryptionService.decryptObject(row.credentials);
          if (decryptedCredentials.userInfo && decryptedCredentials.userInfo.username) {
            record.real_username = decryptedCredentials.userInfo.username;
          } else if (decryptedCredentials.username && decryptedCredentials.username !== 'browser_login') {
            record.real_username = decryptedCredentials.username;
          }
        } catch (error) {
          console.error('解密账号凭证失败:', error);
        }
      }
      
      return record;
    });

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
 * 获取发布记录详情
 */
router.get('/records/:id', async (req, res) => {
  try {
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
        a.title as article_title,
        a.keyword as article_keyword,
        a.content as article_content,
        t.question as topic_question,
        pc.platform_name,
        pt.status as task_status,
        pt.error_message as task_error,
        pa.credentials
       FROM publishing_records pr
       LEFT JOIN articles a ON pr.article_id = a.id
       LEFT JOIN topics t ON a.topic_id = t.id
       LEFT JOIN platforms_config pc ON pr.platform_id = pc.platform_id
       LEFT JOIN publishing_tasks pt ON pr.task_id = pt.id
       LEFT JOIN platform_accounts pa ON pr.account_id = pa.id
       WHERE pr.id = $1`,
      [recordId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '发布记录不存在'
      });
    }

    const record: any = { ...result.rows[0] };
    delete record.credentials; // 不返回加密的凭证
    
    // 解密并提取真实用户名
    if (result.rows[0].credentials) {
      try {
        const decryptedCredentials = encryptionService.decryptObject(result.rows[0].credentials);
        if (decryptedCredentials.userInfo && decryptedCredentials.userInfo.username) {
          record.real_username = decryptedCredentials.userInfo.username;
        } else if (decryptedCredentials.username && decryptedCredentials.username !== 'browser_login') {
          record.real_username = decryptedCredentials.username;
        }
      } catch (error) {
        console.error('解密账号凭证失败:', error);
      }
    }

    res.json({
      success: true,
      data: record
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
 * 获取某篇文章的所有发布记录
 */
router.get('/articles/:articleId/records', async (req, res) => {
  try {
    const articleId = parseInt(req.params.articleId);

    const result = await pool.query(
      `SELECT 
        pr.id,
        pr.task_id,
        pr.platform_id,
        pr.account_id,
        pr.account_name,
        pr.platform_article_id,
        pr.platform_url,
        pr.published_at,
        pc.platform_name,
        pt.status as task_status,
        pa.credentials
       FROM publishing_records pr
       LEFT JOIN platforms_config pc ON pr.platform_id = pc.platform_id
       LEFT JOIN publishing_tasks pt ON pr.task_id = pt.id
       LEFT JOIN platform_accounts pa ON pr.account_id = pa.id
       WHERE pr.article_id = $1
       ORDER BY pr.published_at DESC`,
      [articleId]
    );

    // 解密并提取真实用户名
    const records = result.rows.map(row => {
      const record: any = { ...row };
      delete record.credentials; // 不返回加密的凭证
      
      if (row.credentials) {
        try {
          const decryptedCredentials = encryptionService.decryptObject(row.credentials);
          if (decryptedCredentials.userInfo && decryptedCredentials.userInfo.username) {
            record.real_username = decryptedCredentials.userInfo.username;
          } else if (decryptedCredentials.username && decryptedCredentials.username !== 'browser_login') {
            record.real_username = decryptedCredentials.username;
          }
        } catch (error) {
          console.error('解密账号凭证失败:', error);
        }
      }
      
      return record;
    });

    res.json({
      success: true,
      data: {
        records,
        total: records.length
      }
    });
  } catch (error: any) {
    console.error('获取文章发布记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取文章发布记录失败',
      error: error.message
    });
  }
});

/**
 * 获取发布统计数据
 */
router.get('/stats', async (req, res) => {
  try {
    // 总发布次数
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM publishing_records'
    );

    // 按平台统计
    const platformResult = await pool.query(
      `SELECT 
        pr.platform_id,
        pc.platform_name,
        COUNT(*) as count
       FROM publishing_records pr
       LEFT JOIN platforms_config pc ON pr.platform_id = pc.platform_id
       GROUP BY pr.platform_id, pc.platform_name
       ORDER BY count DESC`
    );

    // 今日发布数
    const todayResult = await pool.query(
      `SELECT COUNT(*) as today_count 
       FROM publishing_records 
       WHERE DATE(published_at) = CURRENT_DATE`
    );

    // 本周发布数
    const weekResult = await pool.query(
      `SELECT COUNT(*) as week_count 
       FROM publishing_records 
       WHERE published_at >= DATE_TRUNC('week', CURRENT_DATE)`
    );

    // 本月发布数
    const monthResult = await pool.query(
      `SELECT COUNT(*) as month_count 
       FROM publishing_records 
       WHERE published_at >= DATE_TRUNC('month', CURRENT_DATE)`
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
