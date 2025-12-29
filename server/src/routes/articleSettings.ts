import { Router } from 'express';
import { pool } from '../db/database';
import { z } from 'zod';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

export const articleSettingsRouter = Router();

// 所有路由都需要认证和租户上下文
articleSettingsRouter.use(authenticate);
articleSettingsRouter.use(setTenantContext);
articleSettingsRouter.use(requireTenantContext);

// Zod验证schemas
const createArticleSettingSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(255, '名称不能超过255字符').trim(),
  prompt: z.string().min(1, '提示词不能为空').trim()
});

const updateArticleSettingSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(255, '名称不能超过255字符').trim().optional(),
  prompt: z.string().min(1, '提示词不能为空').trim().optional()
});


// 获取所有文章设置（分页）
articleSettingsRouter.get('/', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: '无效的分页参数' });
    }
    
    const offset = (page - 1) * pageSize;
    
    // 获取总数（只统计当前用户的）
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM article_settings WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);
    
    // 获取分页数据（只查询当前用户的）
    const result = await pool.query(
      `SELECT id, name, prompt, created_at, updated_at 
       FROM article_settings 
       WHERE user_id = $1
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset]
    );
    
    res.json({
      settings: result.rows,
      total,
      page,
      pageSize
    });
  } catch (error: any) {
    console.error('获取文章设置列表错误:', error);
    res.status(500).json({ error: '获取文章设置列表失败', details: error.message });
  }
});


// 创建文章设置
articleSettingsRouter.post('/', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const validatedData = createArticleSettingSchema.parse(req.body);
    
    const result = await pool.query(
      'INSERT INTO article_settings (name, prompt, user_id) VALUES ($1, $2, $3) RETURNING id, name, prompt, created_at, updated_at',
      [validatedData.name, validatedData.prompt, userId]
    );
    
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '数据验证失败', details: error.errors });
    }
    console.error('创建文章设置错误:', error);
    res.status(500).json({ error: '创建文章设置失败', details: error.message });
  }
});


// 获取单个文章设置
articleSettingsRouter.get('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: '无效的文章设置ID' });
    }
    
    const result = await pool.query(
      'SELECT id, name, prompt, created_at, updated_at FROM article_settings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '文章设置不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('获取文章设置详情错误:', error);
    res.status(500).json({ error: '获取文章设置详情失败', details: error.message });
  }
});


// 更新文章设置
articleSettingsRouter.patch('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: '无效的文章设置ID' });
    }
    
    const validatedData = updateArticleSettingSchema.parse(req.body);
    
    // 检查记录是否存在且属于当前用户
    const checkResult = await pool.query(
      'SELECT id FROM article_settings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '文章设置不存在' });
    }
    
    // 构建更新语句
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (validatedData.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(validatedData.name);
    }
    
    if (validatedData.prompt !== undefined) {
      updates.push(`prompt = $${paramIndex++}`);
      values.push(validatedData.prompt);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: '没有提供要更新的字段' });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    values.push(userId);
    
    const result = await pool.query(
      `UPDATE article_settings SET ${updates.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} RETURNING id, name, prompt, created_at, updated_at`,
      values
    );
    
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '数据验证失败', details: error.errors });
    }
    console.error('更新文章设置错误:', error);
    res.status(500).json({ error: '更新文章设置失败', details: error.message });
  }
});


// 删除文章设置
articleSettingsRouter.delete('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: '无效的文章设置ID' });
    }
    
    // 检查记录是否存在且属于当前用户
    const checkResult = await pool.query(
      'SELECT id FROM article_settings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '文章设置不存在' });
    }
    
    // 删除记录
    await pool.query('DELETE FROM article_settings WHERE id = $1 AND user_id = $2', [id, userId]);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('删除文章设置错误:', error);
    res.status(500).json({ error: '删除文章设置失败', details: error.message });
  }
});
