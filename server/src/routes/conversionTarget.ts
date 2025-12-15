import { Router } from 'express';
import { pool } from '../db/database';
import { z } from 'zod';

export const conversionTargetRouter = Router();

// Zod验证schemas
const createConversionTargetSchema = z.object({
  companyName: z.string().min(2).max(255).trim(),
  industry: z.enum(['互联网', '金融', '制造业', '教育', '医疗', '零售', '其他']),
  companySize: z.enum(['1-50人', '51-200人', '201-500人', '501-1000人', '1000人以上']),
  features: z.string().max(1000).optional(),
  contactInfo: z.string().min(1).max(255).trim()
    .refine((val) => {
      // 验证手机号或邮箱格式
      const phoneRegex = /^1[3-9]\d{9}$/;
      const emailRegex = /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/;
      return phoneRegex.test(val) || emailRegex.test(val);
    }, { message: '请输入有效的手机号或邮箱' }),
  website: z.string().url().optional().or(z.literal('')),
  targetAudience: z.string().max(500).optional(),
  coreProducts: z.string().max(1000).optional()
});

const updateConversionTargetSchema = createConversionTargetSchema.partial();

// 获取转化目标列表（支持分页、搜索、排序）
conversionTargetRouter.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = (req.query.search as string) || '';
    const sortField = (req.query.sortField as string) || 'created_at';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    
    const offset = (page - 1) * pageSize;
    
    // 构建WHERE子句
    let whereClause = '';
    const queryParams: any[] = [];
    
    if (search.trim()) {
      whereClause = 'WHERE (company_name ILIKE $1 OR industry ILIKE $1)';
      queryParams.push(`%${search}%`);
    }
    
    // 验证排序字段
    const allowedSortFields = ['company_name', 'industry', 'company_size', 'created_at'];
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
    const result = await pool.query(
      `SELECT 
        id, 
        company_name, 
        industry, 
        company_size, 
        features,
        contact_info, 
        website, 
        target_audience,
        core_products,
        created_at, 
        updated_at
       FROM conversion_targets 
       ${whereClause}
       ORDER BY ${validSortField} ${validSortOrder}
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
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
    const validatedData = createConversionTargetSchema.parse(req.body);
    
    // 检查公司名称是否已存在
    const checkResult = await pool.query(
      'SELECT id FROM conversion_targets WHERE company_name = $1',
      [validatedData.companyName]
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
       (company_name, industry, company_size, features, contact_info, website, target_audience, core_products) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id, company_name, industry, company_size, features, contact_info, website, target_audience, core_products, created_at, updated_at`,
      [
        validatedData.companyName,
        validatedData.industry,
        validatedData.companySize,
        validatedData.features || null,
        validatedData.contactInfo,
        validatedData.website || null,
        validatedData.targetAudience || null,
        validatedData.coreProducts || null
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
        company_size, 
        features,
        contact_info, 
        website, 
        target_audience,
        core_products,
        created_at, 
        updated_at
       FROM conversion_targets 
       WHERE id = $1`,
      [id]
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
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的ID' 
      });
    }
    
    const validatedData = updateConversionTargetSchema.parse(req.body);
    
    // 检查记录是否存在
    const checkResult = await pool.query(
      'SELECT id FROM conversion_targets WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversion target not found', 
        code: 'NOT_FOUND' 
      });
    }
    
    // 如果更新公司名称，检查是否与其他记录重复
    if (validatedData.companyName) {
      const duplicateCheck = await pool.query(
        'SELECT id FROM conversion_targets WHERE company_name = $1 AND id != $2',
        [validatedData.companyName, id]
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
      values.push(validatedData.industry);
    }
    
    if (validatedData.companySize !== undefined) {
      updates.push(`company_size = $${paramIndex++}`);
      values.push(validatedData.companySize);
    }
    
    if (validatedData.features !== undefined) {
      updates.push(`features = $${paramIndex++}`);
      values.push(validatedData.features || null);
    }
    
    if (validatedData.contactInfo !== undefined) {
      updates.push(`contact_info = $${paramIndex++}`);
      values.push(validatedData.contactInfo);
    }
    
    if (validatedData.website !== undefined) {
      updates.push(`website = $${paramIndex++}`);
      values.push(validatedData.website || null);
    }
    
    if (validatedData.targetAudience !== undefined) {
      updates.push(`target_audience = $${paramIndex++}`);
      values.push(validatedData.targetAudience || null);
    }
    
    if (validatedData.coreProducts !== undefined) {
      updates.push(`core_products = $${paramIndex++}`);
      values.push(validatedData.coreProducts || null);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const result = await pool.query(
      `UPDATE conversion_targets 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING id, company_name, industry, company_size, features, contact_info, website, target_audience, core_products, created_at, updated_at`,
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
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的ID' 
      });
    }
    
    // 检查记录是否存在
    const checkResult = await pool.query(
      'SELECT id FROM conversion_targets WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversion target not found', 
        code: 'NOT_FOUND' 
      });
    }
    
    // 删除记录
    await pool.query('DELETE FROM conversion_targets WHERE id = $1', [id]);
    
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
