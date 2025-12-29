import express from 'express';
import { pool } from '../db/database';
import { getCurrentTenantId, requireTenantContext } from '../middleware/tenantContext';
import { tenantService } from '../services/TenantService';

const router = express.Router();

/**
 * 多租户相册路由示例
 * 展示如何修改现有路由以支持数据隔离
 */

/**
 * 获取当前用户的相册列表
 * GET /api/albums
 */
router.get('/', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    
    // 只查询当前用户的相册
    const result = await pool.query(
      `SELECT * FROM albums 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('获取相册列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取相册列表失败'
    });
  }
});

/**
 * 创建相册
 * POST /api/albums
 */
router.post('/', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: '相册名称不能为空'
      });
    }

    // 自动关联到当前用户
    const result = await pool.query(
      `INSERT INTO albums (name, user_id) 
       VALUES ($1, $2) 
       RETURNING *`,
      [name, userId]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('创建相册失败:', error);
    res.status(500).json({
      success: false,
      message: '创建相册失败'
    });
  }
});

/**
 * 更新相册
 * PUT /api/albums/:id
 */
router.put('/:id', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const albumId = parseInt(req.params.id);
    const { name } = req.body;

    // 验证所有权并更新
    const result = await pool.query(
      `UPDATE albums 
       SET name = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND user_id = $3 
       RETURNING *`,
      [name, albumId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '相册不存在或无权访问'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('更新相册失败:', error);
    res.status(500).json({
      success: false,
      message: '更新相册失败'
    });
  }
});

/**
 * 删除相册
 * DELETE /api/albums/:id
 */
router.delete('/:id', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const albumId = parseInt(req.params.id);

    // 验证所有权并删除
    const result = await pool.query(
      `DELETE FROM albums 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [albumId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '相册不存在或无权访问'
      });
    }

    res.json({
      success: true,
      message: '相册删除成功'
    });
  } catch (error) {
    console.error('删除相册失败:', error);
    res.status(500).json({
      success: false,
      message: '删除相册失败'
    });
  }
});

/**
 * 获取相册详情（包括图片）
 * GET /api/albums/:id
 */
router.get('/:id', requireTenantContext, async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const albumId = parseInt(req.params.id);

    // 验证所有权
    const albumResult = await pool.query(
      `SELECT * FROM albums WHERE id = $1 AND user_id = $2`,
      [albumId, userId]
    );

    if (albumResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '相册不存在或无权访问'
      });
    }

    // 获取相册中的图片
    const imagesResult = await pool.query(
      `SELECT * FROM images WHERE album_id = $1 ORDER BY created_at DESC`,
      [albumId]
    );

    res.json({
      success: true,
      data: {
        ...albumResult.rows[0],
        images: imagesResult.rows
      }
    });
  } catch (error) {
    console.error('获取相册详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取相册详情失败'
    });
  }
});

export default router;
