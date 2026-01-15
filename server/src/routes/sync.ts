/**
 * 数据同步路由
 * 
 * 用于 Windows 端数据备份和恢复。
 * 
 * API:
 * - POST /api/sync/upload - 上传数据快照
 * - GET /api/sync/snapshots - 获取快照列表
 * - GET /api/sync/download/:snapshotId - 下载快照
 * - DELETE /api/sync/snapshots/:snapshotId - 删除快照
 */

import { Router } from 'express';
import multer from 'multer';
import { syncService, SnapshotMetadata } from '../services/SyncService';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

export const syncRouter = Router();

// 配置 multer 用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// 所有路由都需要认证和租户上下文
syncRouter.use(authenticate);
syncRouter.use(setTenantContext);
syncRouter.use(requireTenantContext);

/**
 * 上传数据快照
 * POST /api/sync/upload
 * 
 * Request: multipart/form-data
 * - snapshot: File (加密的 SQLite 数据库文件)
 * - checksum: string (SHA-256 校验和)
 * - metadata: JSON string (快照元数据)
 */
syncRouter.post('/upload', upload.single('snapshot'), async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    
    // 验证文件
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FILE',
        message: '缺少快照文件'
      });
    }

    // 验证校验和
    const checksum = req.body.checksum;
    if (!checksum || typeof checksum !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CHECKSUM',
        message: '缺少文件校验和'
      });
    }

    // 解析元数据
    let metadata: SnapshotMetadata;
    try {
      metadata = JSON.parse(req.body.metadata || '{}');
      if (!metadata.version) {
        metadata.version = '1.0.0';
      }
      if (!metadata.createdAt) {
        metadata.createdAt = new Date().toISOString();
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_METADATA',
        message: '元数据格式无效'
      });
    }

    // 上传快照
    const result = await syncService.uploadSnapshot(
      userId,
      req.file.buffer,
      checksum,
      metadata
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('上传快照错误:', error);
    
    if (error.message.includes('限制')) {
      return res.status(413).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: error.message
      });
    }
    
    if (error.message.includes('校验和')) {
      return res.status(400).json({
        success: false,
        error: 'CHECKSUM_MISMATCH',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: '上传失败',
      details: error.message
    });
  }
});

/**
 * 获取快照列表
 * GET /api/sync/snapshots
 */
syncRouter.get('/snapshots', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    
    const result = await syncService.getSnapshots(userId);

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('获取快照列表错误:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: '获取快照列表失败',
      details: error.message
    });
  }
});

/**
 * 下载快照
 * GET /api/sync/download/:snapshotId
 */
syncRouter.get('/download/:snapshotId', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { snapshotId } = req.params;

    if (!snapshotId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SNAPSHOT_ID',
        message: '缺少快照 ID'
      });
    }

    const { buffer, checksum, metadata } = await syncService.downloadSnapshot(snapshotId, userId);

    // 设置响应头
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${snapshotId}.snapshot"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Checksum', checksum);
    res.setHeader('X-Metadata', JSON.stringify(metadata));

    res.send(buffer);
  } catch (error: any) {
    console.error('下载快照错误:', error);
    
    if (error.message.includes('不存在') || error.message.includes('无权')) {
      return res.status(404).json({
        success: false,
        error: 'SNAPSHOT_NOT_FOUND',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'DOWNLOAD_FAILED',
      message: '下载失败',
      details: error.message
    });
  }
});

/**
 * 获取快照详情
 * GET /api/sync/snapshots/:snapshotId
 */
syncRouter.get('/snapshots/:snapshotId', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { snapshotId } = req.params;

    if (!snapshotId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SNAPSHOT_ID',
        message: '缺少快照 ID'
      });
    }

    const snapshot = await syncService.getSnapshotDetail(snapshotId, userId);

    if (!snapshot) {
      return res.status(404).json({
        success: false,
        error: 'SNAPSHOT_NOT_FOUND',
        message: '快照不存在或无权访问'
      });
    }

    res.json({
      success: true,
      snapshot
    });
  } catch (error: any) {
    console.error('获取快照详情错误:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: '获取快照详情失败',
      details: error.message
    });
  }
});

/**
 * 删除快照
 * DELETE /api/sync/snapshots/:snapshotId
 */
syncRouter.delete('/snapshots/:snapshotId', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { snapshotId } = req.params;

    if (!snapshotId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SNAPSHOT_ID',
        message: '缺少快照 ID'
      });
    }

    const deleted = await syncService.deleteSnapshot(snapshotId, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'SNAPSHOT_NOT_FOUND',
        message: '快照不存在或无权访问'
      });
    }

    res.json({
      success: true,
      message: '快照已删除'
    });
  } catch (error: any) {
    console.error('删除快照错误:', error);
    res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: '删除失败',
      details: error.message
    });
  }
});
