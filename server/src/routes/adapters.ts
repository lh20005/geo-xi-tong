/**
 * 适配器版本管理路由
 * 
 * 用于平台适配器热更新支持。
 * 
 * API:
 * - GET /api/adapters/versions - 获取所有适配器版本列表
 * - GET /api/adapters/:platform/download - 下载适配器代码
 * - GET /api/adapters/:platform/changelog - 获取适配器更新日志
 * - POST /api/adapters/check-updates - 检查需要更新的适配器
 * - POST /api/admin/adapters/:platform/update - 更新适配器版本（管理员）
 */

import { Router } from 'express';
import { adapterVersionService } from '../services/AdapterVersionService';
import { authenticate, requireAdmin } from '../middleware/adminAuth';

export const adaptersRouter = Router();

/**
 * 获取所有适配器版本列表
 * GET /api/adapters/versions
 */
adaptersRouter.get('/versions', async (req, res) => {
  try {
    const result = await adapterVersionService.getVersions();

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('获取适配器版本列表错误:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: '获取版本列表失败',
      details: error.message
    });
  }
});

/**
 * 下载适配器代码
 * GET /api/adapters/:platform/download
 */
adaptersRouter.get('/:platform/download', authenticate, async (req, res) => {
  try {
    const { platform } = req.params;

    if (!platform) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PLATFORM',
        message: '缺少平台参数'
      });
    }

    const result = await adapterVersionService.downloadAdapter(platform);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'ADAPTER_NOT_FOUND',
        message: '适配器不存在'
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('X-Adapter-Version', result.version);
    res.setHeader('X-Adapter-Hash', result.hash);

    res.send(result.code);
  } catch (error: any) {
    console.error('下载适配器错误:', error);
    res.status(500).json({
      success: false,
      error: 'DOWNLOAD_FAILED',
      message: '下载失败',
      details: error.message
    });
  }
});

/**
 * 获取适配器更新日志
 * GET /api/adapters/:platform/changelog
 */
adaptersRouter.get('/:platform/changelog', async (req, res) => {
  try {
    const { platform } = req.params;

    if (!platform) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PLATFORM',
        message: '缺少平台参数'
      });
    }

    const result = await adapterVersionService.getChangelog(platform);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'ADAPTER_NOT_FOUND',
        message: '适配器不存在'
      });
    }

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('获取更新日志错误:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: '获取更新日志失败',
      details: error.message
    });
  }
});

/**
 * 检查需要更新的适配器
 * POST /api/adapters/check-updates
 * 
 * Request Body:
 * {
 *   clientVersion: string,
 *   localVersions: { [platform: string]: string }
 * }
 */
adaptersRouter.post('/check-updates', authenticate, async (req, res) => {
  try {
    const { clientVersion, localVersions } = req.body;

    if (!clientVersion) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CLIENT_VERSION',
        message: '缺少客户端版本'
      });
    }

    // 检查客户端版本兼容性
    const versionCheck = await adapterVersionService.checkClientVersion(clientVersion);

    if (!versionCheck.compatible) {
      return res.status(426).json({
        success: false,
        error: 'CLIENT_VERSION_TOO_LOW',
        message: versionCheck.message,
        minRequired: versionCheck.minRequired
      });
    }

    // 获取需要更新的适配器列表
    const updates = await adapterVersionService.getUpdatesNeeded(localVersions || {});

    res.json({
      success: true,
      compatible: true,
      updates,
      updateCount: updates.length
    });
  } catch (error: any) {
    console.error('检查更新错误:', error);
    res.status(500).json({
      success: false,
      error: 'CHECK_FAILED',
      message: '检查更新失败',
      details: error.message
    });
  }
});

/**
 * 获取适配器详情
 * GET /api/adapters/:platform
 */
adaptersRouter.get('/:platform', async (req, res) => {
  try {
    const { platform } = req.params;

    if (!platform) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PLATFORM',
        message: '缺少平台参数'
      });
    }

    const adapter = await adapterVersionService.getAdapterVersion(platform);

    if (!adapter) {
      return res.status(404).json({
        success: false,
        error: 'ADAPTER_NOT_FOUND',
        message: '适配器不存在'
      });
    }

    res.json({
      success: true,
      adapter
    });
  } catch (error: any) {
    console.error('获取适配器详情错误:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: '获取详情失败',
      details: error.message
    });
  }
});

// ==================== 管理员 API ====================

/**
 * 更新适配器版本（管理员）
 * POST /api/admin/adapters/:platform/update
 * 
 * Request Body:
 * {
 *   version: string,
 *   code: string,
 *   changes: string[],
 *   minClientVersion?: string
 * }
 */
adaptersRouter.post('/admin/:platform/update', authenticate, requireAdmin, async (req, res) => {
  try {
    const { platform } = req.params;
    const { version, code, changes, minClientVersion } = req.body;

    if (!platform) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PLATFORM',
        message: '缺少平台参数'
      });
    }

    if (!version || !code || !changes || !Array.isArray(changes)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: '缺少必填字段: version, code, changes'
      });
    }

    await adapterVersionService.updateAdapterVersion(
      platform,
      version,
      code,
      changes,
      minClientVersion
    );

    res.json({
      success: true,
      message: '适配器版本更新成功',
      platform,
      version
    });
  } catch (error: any) {
    console.error('更新适配器版本错误:', error);
    res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: '更新失败',
      details: error.message
    });
  }
});
