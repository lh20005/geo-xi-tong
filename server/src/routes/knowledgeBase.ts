import { Router } from 'express';
import { pool } from '../db/database';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { DocumentParserService } from '../services/documentParser';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

export const knowledgeBaseRouter = Router();

// 所有路由都需要认证和租户上下文
knowledgeBaseRouter.use(authenticate);
knowledgeBaseRouter.use(setTenantContext);
knowledgeBaseRouter.use(requireTenantContext);

// 配置文件上传
const uploadDir = path.join(__dirname, '../../uploads/knowledge');

// 确保上传目录存在
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 修复中文文件名编码问题
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // 修复中文文件名编码问题
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const allowedTypes = ['.txt', '.md', '.pdf', '.doc', '.docx'];
    const ext = path.extname(originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件格式。支持的格式: ${allowedTypes.join(', ')}`));
    }
  }
});

// Zod验证schemas
const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().optional()
});

const updateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().optional()
});

// 获取所有知识库（只获取当前用户的）
knowledgeBaseRouter.get('/', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    
    const result = await pool.query(
      `SELECT 
        kb.id, 
        kb.name, 
        kb.description,
        kb.created_at,
        kb.updated_at,
        COUNT(kd.id) as document_count
       FROM knowledge_bases kb
       LEFT JOIN knowledge_documents kd ON kb.id = kd.knowledge_base_id
       WHERE kb.user_id = $1
       GROUP BY kb.id
       ORDER BY kb.created_at DESC`,
      [userId]
    );
    
    res.json({ knowledgeBases: result.rows });
  } catch (error: any) {
    console.error('获取知识库列表错误:', error);
    res.status(500).json({ error: '获取知识库列表失败', details: error.message });
  }
});

// 创建知识库（关联到当前用户）
knowledgeBaseRouter.post('/', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const validatedData = createKnowledgeBaseSchema.parse(req.body);
    
    const result = await pool.query(
      'INSERT INTO knowledge_bases (name, description, user_id) VALUES ($1, $2, $3) RETURNING id, name, description, created_at',
      [validatedData.name, validatedData.description || null, userId]
    );
    
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '数据验证失败', details: error.errors });
    }
    console.error('创建知识库错误:', error);
    res.status(500).json({ error: '创建知识库失败', details: error.message });
  }
});

// 获取知识库详情（验证所有权）
knowledgeBaseRouter.get('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const kbId = parseInt(req.params.id);
    if (isNaN(kbId) || kbId <= 0) {
      return res.status(400).json({ error: '无效的知识库ID' });
    }
    
    // 获取知识库信息（验证所有权）
    const kbResult = await pool.query(
      'SELECT id, name, description, created_at, updated_at FROM knowledge_bases WHERE id = $1 AND user_id = $2',
      [kbId, userId]
    );
    
    if (kbResult.rows.length === 0) {
      return res.status(404).json({ error: '知识库不存在或无权访问' });
    }
    
    // 获取文档列表
    const docsResult = await pool.query(
      `SELECT id, filename, file_type, file_size, 
              LEFT(content, 200) as content_preview,
              created_at 
       FROM knowledge_documents 
       WHERE knowledge_base_id = $1 
       ORDER BY created_at DESC`,
      [kbId]
    );
    
    res.json({
      ...kbResult.rows[0],
      document_count: docsResult.rows.length,
      documents: docsResult.rows
    });
  } catch (error: any) {
    console.error('获取知识库详情错误:', error);
    res.status(500).json({ error: '获取知识库详情失败', details: error.message });
  }
});

// 更新知识库
knowledgeBaseRouter.patch('/:id', async (req, res) => {
  try {
    const kbId = parseInt(req.params.id);
    if (isNaN(kbId) || kbId <= 0) {
      return res.status(400).json({ error: '无效的知识库ID' });
    }
    
    const validatedData = updateKnowledgeBaseSchema.parse(req.body);
    
    // 检查知识库是否存在
    const checkResult = await pool.query('SELECT id FROM knowledge_bases WHERE id = $1', [kbId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '知识库不存在' });
    }
    
    // 构建更新语句
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (validatedData.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(validatedData.name);
    }
    
    if (validatedData.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(validatedData.description);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(kbId);
    
    const result = await pool.query(
      `UPDATE knowledge_bases SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, description, updated_at`,
      values
    );
    
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '数据验证失败', details: error.errors });
    }
    console.error('更新知识库错误:', error);
    res.status(500).json({ error: '更新知识库失败', details: error.message });
  }
});

// 删除知识库（验证所有权）
knowledgeBaseRouter.delete('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const kbId = parseInt(req.params.id);
    if (isNaN(kbId) || kbId <= 0) {
      return res.status(400).json({ error: '无效的知识库ID' });
    }
    
    // 获取文档数量（验证所有权）
    const docsResult = await pool.query(
      `SELECT COUNT(*) as count FROM knowledge_documents kd
       JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id
       WHERE kb.id = $1 AND kb.user_id = $2`,
      [kbId, userId]
    );
    const deletedDocuments = parseInt(docsResult.rows[0].count);
    
    // 删除知识库（级联删除文档，验证所有权）
    const result = await pool.query(
      'DELETE FROM knowledge_bases WHERE id = $1 AND user_id = $2 RETURNING id',
      [kbId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '知识库不存在或无权访问' });
    }
    
    res.json({
      success: true,
      deletedDocuments
    });
  } catch (error: any) {
    console.error('删除知识库错误:', error);
    res.status(500).json({ error: '删除知识库失败', details: error.message });
  }
});

// 上传文档到知识库（验证所有权）
knowledgeBaseRouter.post('/:id/documents', upload.array('files', 20), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  
  try {
    const userId = getCurrentTenantId(req);
    const kbId = parseInt(req.params.id);
    if (isNaN(kbId) || kbId <= 0) {
      // 清理已上传的文件
      if (files) {
        files.forEach(file => fs.existsSync(file.path) && fs.unlinkSync(file.path));
      }
      return res.status(400).json({ error: '无效的知识库ID' });
    }
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }
    
    // 检查知识库是否存在且属于当前用户
    const checkResult = await pool.query(
      'SELECT id FROM knowledge_bases WHERE id = $1 AND user_id = $2',
      [kbId, userId]
    );
    
    if (checkResult.rows.length === 0) {
      // 清理已上传的文件
      files.forEach(file => fs.existsSync(file.path) && fs.unlinkSync(file.path));
      return res.status(404).json({ error: '知识库不存在或无权访问' });
    }
    
    const parser = new DocumentParserService();
    const uploadedDocuments = [];
    const errors = [];
    
    // 使用事务处理所有文档
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const file of files) {
        try {
          // 修复中文文件名编码问题
          const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
          
          // 解析文件内容
          const content = await parser.parseFile(file);
          
          // 插入文档记录
          const result = await client.query(
            `INSERT INTO knowledge_documents (knowledge_base_id, filename, file_type, file_size, content) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, filename, file_type, file_size, created_at`,
            [kbId, originalname, path.extname(originalname), file.size, content]
          );
          
          uploadedDocuments.push(result.rows[0]);
          
          // 删除临时文件
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (error: any) {
          // 修复中文文件名编码问题
          const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
          errors.push({
            filename: originalname,
            error: error.message
          });
          
          // 删除临时文件
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }
      
      await client.query('COMMIT');
      
      res.json({
        uploadedCount: uploadedDocuments.length,
        documents: uploadedDocuments,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    // 清理所有临时文件
    if (files) {
      files.forEach(file => fs.existsSync(file.path) && fs.unlinkSync(file.path));
    }
    
    console.error('上传文档错误:', error);
    res.status(500).json({ error: '上传文档失败', details: error.message });
  }
});

// 获取文档详情
knowledgeBaseRouter.get('/documents/:id', async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    if (isNaN(docId) || docId <= 0) {
      return res.status(400).json({ error: '无效的文档ID' });
    }
    
    const result = await pool.query(
      'SELECT * FROM knowledge_documents WHERE id = $1',
      [docId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '文档不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('获取文档详情错误:', error);
    res.status(500).json({ error: '获取文档详情失败', details: error.message });
  }
});

// 删除文档
knowledgeBaseRouter.delete('/documents/:id', async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    if (isNaN(docId) || docId <= 0) {
      return res.status(400).json({ error: '无效的文档ID' });
    }
    
    // 检查文档是否存在
    const checkResult = await pool.query('SELECT id FROM knowledge_documents WHERE id = $1', [docId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '文档不存在' });
    }
    
    // 删除文档
    await pool.query('DELETE FROM knowledge_documents WHERE id = $1', [docId]);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('删除文档错误:', error);
    res.status(500).json({ error: '删除文档失败', details: error.message });
  }
});

// 搜索文档
knowledgeBaseRouter.get('/:id/documents/search', async (req, res) => {
  try {
    const kbId = parseInt(req.params.id);
    const query = req.query.q as string;
    
    if (isNaN(kbId) || kbId <= 0) {
      return res.status(400).json({ error: '无效的知识库ID' });
    }
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: '请提供搜索关键词' });
    }
    
    // 使用PostgreSQL全文搜索
    const result = await pool.query(
      `SELECT id, filename, file_type, file_size, 
              LEFT(content, 200) as content_preview,
              created_at
       FROM knowledge_documents
       WHERE knowledge_base_id = $1 
         AND (filename ILIKE $2 OR content ILIKE $2)
       ORDER BY created_at DESC
       LIMIT 50`,
      [kbId, `%${query}%`]
    );
    
    res.json({ documents: result.rows });
  } catch (error: any) {
    console.error('搜索文档错误:', error);
    res.status(500).json({ error: '搜索文档失败', details: error.message });
  }
});
