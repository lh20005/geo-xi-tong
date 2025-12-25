import { Router, Request, Response } from 'express';
import { securityConfigService } from '../services/SecurityConfigService';
import { authenticate, requireAdmin } from '../middleware/adminAuth';
import { checkPermission } from '../middleware/checkPermission';

const router = Router();

// 所有安全配置路由都需要认证和管理员权限
router.use(authenticate);
router.use(requireAdmin);

/**
 * 获取所有安全配置
 * GET /api/security-config
 * Requirement 18.1
 */
router.get(
  '/',
  async (req: Request, res: Response) => {
    try {
      const configs = await securityConfigService.getAllConfigs();
      res.json({ success: true, data: configs });
    } catch (error) {
      console.error('获取安全配置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取安全配置失败',
        error: (error as Error).message
      });
    }
  }
);

/**
 * 获取单个配置
 * GET /api/security-config/:key
 * Requirement 18.1
 */
router.get(
  '/:key',
  async (req: Request, res: Response) => {
    try {
      const config = await securityConfigService.getConfig(req.params.key);
      if (!config) {
        return res.status(404).json({
          success: false,
          message: '配置项不存在'
        });
      }
      res.json({ success: true, data: config });
    } catch (error) {
      console.error('获取配置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取配置失败',
        error: (error as Error).message
      });
    }
  }
);

/**
 * 更新配置
 * PUT /api/security-config/:key
 * Requirement 18.2, 18.3
 */
router.put(
  '/:key',
  async (req: Request, res: Response) => {
    try {
      const { value, reason } = req.body;

      if (value === undefined) {
        return res.status(400).json({
          success: false,
          message: '缺少配置值'
        });
      }

      const updatedConfig = await securityConfigService.updateConfig(
        req.params.key,
        String(value),
        (req as any).user.id,
        reason
      );

      res.json({
        success: true,
        message: '配置更新成功',
        data: updatedConfig
      });
    } catch (error) {
      console.error('更新配置失败:', error);
      res.status(500).json({
        success: false,
        message: '更新配置失败',
        error: (error as Error).message
      });
    }
  }
);

/**
 * 获取配置历史
 * GET /api/security-config/:key/history
 * Requirement 18.3
 */
router.get(
  '/:key/history',
  async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const history = await securityConfigService.getConfigHistory(
        req.params.key,
        limit
      );
      res.json({ success: true, data: history });
    } catch (error) {
      console.error('获取配置历史失败:', error);
      res.status(500).json({
        success: false,
        message: '获取配置历史失败',
        error: (error as Error).message
      });
    }
  }
);

/**
 * 导出配置
 * GET /api/security-config/export
 * Requirement 18.4
 */
router.get(
  '/actions/export',
  async (req: Request, res: Response) => {
    try {
      const exportData = await securityConfigService.exportConfigs();
      res.json({ success: true, data: exportData });
    } catch (error) {
      console.error('导出配置失败:', error);
      res.status(500).json({
        success: false,
        message: '导出配置失败',
        error: (error as Error).message
      });
    }
  }
);

/**
 * 导入配置
 * POST /api/security-config/import
 * Requirement 18.4
 */
router.post(
  '/actions/import',
  async (req: Request, res: Response) => {
    try {
      const { configs } = req.body;

      if (!configs) {
        return res.status(400).json({
          success: false,
          message: '缺少配置数据'
        });
      }

      const result = await securityConfigService.importConfigs(
        configs,
        (req as any).user.id
      );

      res.json({
        success: true,
        message: '配置导入完成',
        data: result
      });
    } catch (error) {
      console.error('导入配置失败:', error);
      res.status(500).json({
        success: false,
        message: '导入配置失败',
        error: (error as Error).message
      });
    }
  }
);

/**
 * 重置配置到默认值
 * POST /api/security-config/reset
 * Requirement 18.2
 */
router.post(
  '/actions/reset',
  async (req: Request, res: Response) => {
    try {
      const count = await securityConfigService.resetToDefaults(
        (req as any).user.id
      );

      res.json({
        success: true,
        message: '配置已重置到默认值',
        data: { count }
      });
    } catch (error) {
      console.error('重置配置失败:', error);
      res.status(500).json({
        success: false,
        message: '重置配置失败',
        error: (error as Error).message
      });
    }
  }
);

export default router;
