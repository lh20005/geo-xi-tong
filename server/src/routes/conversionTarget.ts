import { Router } from 'express';
import { pool } from '../db/database';
import { z } from 'zod';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

export const conversionTargetRouter = Router();

// 所有路由都需要认证和租户上下文
conversionTargetRouter.use(authenticate);
conversionTargetRouter.use(setTenantContext);
conversionTargetRouter.use(requireTenantContext);

// Zod验证schemas
const createConversionTargetSchema = z.object({
  companyName: z.string().min(2).max(255).trim(),
  industry: z.string().max(100).optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal(''))
});

const updateConversionTargetSchema = z.object({
  companyName: z.string().min(2).max(255).trim().optional(),
  industry: z.string().max(100).optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal(''))
});

// 获取转化目标列表（支持分页、搜索、排序）
conversionTargetRouter.get('/', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = (req.query.search as string) || '';
    const sortField = (req.query.sortField as string) || 'created_at';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    
    const offset = (page - 1) * pageSize;
    
    // 构建WHERE子句（包含租户隔离）
    const queryParams: any[] = [userId];
    let whereClause = 'WHERE user_id = $1';
    
    if (search.trim()) {
      whereClause += ' AND (company_name ILIKE $2 OR industry ILIKE $2)';
      queryParams.push(`%${search}%`);
    }
    
    // 验证排序字段
    const allowedSortFields = ['company_name', 'industry', 'created_at'];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';
    const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM conversion_targets ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);
    
    // 获取分页数据
    const dataParams = [...queryParams, pageSize, offset];
    const paramIndexLimit = queryParams.length + 1;
    const paramIndexOffset = queryParams.length + 2;
    const result = await pool.query(
      `SELECT 
        id, 
        company_name, 
        industry, 
        website, 
        address,
        created_at, 
        updated_at
       FROM conversion_targets 
       ${whereClause}
       ORDER BY ${validSortField} ${validSortOrder}
       LIMIT $${paramIndexLimit} OFFSET $${paramIndexOffset}`,
      dataParams
    );
    
    res.json({
      success: true,
      data: {
        targets: result.rows,
        total,
        page,
        pageSize
      }
    });
  } catch (error: any) {
    console.error('获取转化目标列表错误:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取转化目标列表失败', 
      code: 'DATABASE_ERROR' 
    });
  }
});

// 创建转化目标
conversionTargetRouter.post('/', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const validatedData = createConversionTargetSchema.parse(req.body);
    
    // 检查公司名称是否已存在（同一用户下）
    const checkResult = await pool.query(
      'SELECT id FROM conversion_targets WHERE company_name = $1 AND user_id = $2',
      [validatedData.companyName, userId]
    );
    
    if (checkResult.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: '公司名称已存在', 
        code: 'DUPLICATE_ENTRY' 
      });
    }
    
    const result = await pool.query(
      `INSERT INTO conversion_targets 
       (company_name, industry, website, address, user_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, company_name, industry, website, address, created_at, updated_at`,
      [
        validatedData.companyName,
        validatedData.industry || null,
        validatedData.website || null,
        validatedData.address || null,
        userId
      ]
    );
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    console.error('创建转化目标错误:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error', 
      code: 'DATABASE_ERROR' 
    });
  }
});

// 获取单个转化目标详情
conversionTargetRouter.get('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的ID' 
      });
    }
    
    const result = await pool.query(
      `SELECT 
        id, 
        company_name, 
        industry, 
        website, 
        address,
        created_at, 
        updated_at
       FROM conversion_targets 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversion target not found', 
        code: 'NOT_FOUND' 
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('获取转化目标详情错误:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error', 
      code: 'DATABASE_ERROR' 
    });
  }
});

// 更新转化目标
conversionTargetRouter.patch('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的ID' 
      });
    }
    
    const validatedData = updateConversionTargetSchema.parse(req.body);
    
    // 检查记录是否存在且属于当前用户
    const checkResult = await pool.query(
      'SELECT id FROM conversion_targets WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversion target not found', 
        code: 'NOT_FOUND' 
      });
    }
    
    // 如果更新公司名称，检查是否与其他记录重复（同一用户下）
    if (validatedData.companyName) {
      const duplicateCheck = await pool.query(
        'SELECT id FROM conversion_targets WHERE company_name = $1 AND id != $2 AND user_id = $3',
        [validatedData.companyName, id, userId]
      );
      
      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({ 
          success: false, 
          error: '公司名称已存在', 
          code: 'DUPLICATE_ENTRY' 
        });
      }
    }
    
    // 构建更新语句
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (validatedData.companyName !== undefined) {
      updates.push(`company_name = $${paramIndex++}`);
      values.push(validatedData.companyName);
    }
    
    if (validatedData.industry !== undefined) {
      updates.push(`industry = $${paramIndex++}`);
      values.push(validatedData.industry || null);
    }
    
    if (validatedData.website !== undefined) {
      updates.push(`website = $${paramIndex++}`);
      values.push(validatedData.website || null);
    }
    
    if (validatedData.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(validatedData.address || null);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    values.push(userId);
    
    const result = await pool.query(
      `UPDATE conversion_targets 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING id, company_name, industry, website, address, created_at, updated_at`,
      values
    );
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    console.error('更新转化目标错误:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error', 
      code: 'DATABASE_ERROR' 
    });
  }
});

// 删除转化目标
conversionTargetRouter.delete('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的ID' 
      });
    }
    
    // 检查记录是否存在且属于当前用户
    const checkResult = await pool.query(
      'SELECT id FROM conversion_targets WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversion target not found', 
        code: 'NOT_FOUND' 
      });
    }
    
    // 删除记录
    await pool.query('DELETE FROM conversion_targets WHERE id = $1 AND user_id = $2', [id, userId]);
    
    res.json({
      success: true,
      message: '转化目标删除成功'
    });
  } catch (error: any) {
    console.error('删除转化目标错误:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error', 
      code: 'DATABASE_ERROR' 
    });
  }
});
