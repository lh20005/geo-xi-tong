import express from 'express';
import { authenticate, requireAdmin } from '../middleware/adminAuth';
import { auditLogService } from '../services/AuditLogService';
import { securityMonitorService } from '../services/SecurityMonitorService';
import { permissionService } from '../services/PermissionService';
import { securityConfigService } from '../services/SecurityConfigService';

const router = express.Router();

// 所有安全路由都需要管理员权限
router.use(authenticate, requireAdmin);

/**
 * 获取安全指标
 */
router.get('/metrics', async (req, res) => {
  try {
    const timeRange = parseInt(req.query.timeRange as string) || 24 * 60 * 60 * 1000;
    const metrics = await securityMonitorService.getSecurityMetrics(timeRange);
    res.json(metrics);
  } catch (error) {
    console.error('Error getting security metrics:', error);
    res.status(500).json({ error: 'Failed to get security metrics' });
  }
});

/**
 * 获取安全事件列表
 */
router.get('/events', async (req, res) => {
  try {
    const filters = {
      severity: req.query.severity as string,
      type: req.query.type as string,
      userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0
    };

    const result = await securityMonitorService.getSecurityEvents(filters);
    res.json(result);
  } catch (error) {
    console.error('Error getting security events:', error);
    res.status(500).json({ error: 'Failed to get security events' });
  }
});

/**
 * 获取审计日志
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const filters = {
      adminId: req.query.adminId ? parseInt(req.query.adminId as string) : undefined,
      action: req.query.action as string,
      targetType: req.query.targetType as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 20
    };

    const result = await auditLogService.queryLogs(filters);
    res.json(result);
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

/**
 * 导出审计日志
 */
router.get('/audit-logs/export', async (req, res) => {
  try {
    const filters = {
      adminId: req.query.adminId ? parseInt(req.query.adminId as string) : undefined,
      action: req.query.action as string,
      targetType: req.query.targetType as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    };

    const format = (req.query.format as 'json' | 'csv') || 'json';
    const data = await auditLogService.exportLogs(filters, format);

    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    const filename = `audit-logs-${Date.now()}.${format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

/**
 * 获取所有权限
 */
router.get('/permissions', async (req, res) => {
  try {
    const permissions = await permissionService.getAllPermissions();
    res.json(permissions);
  } catch (error) {
    console.error('Error getting permissions:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

/**
 * 获取所有用户权限
 */
router.get('/user-permissions', async (req, res) => {
  try {
    const { pool } = await import('../db/database');
    const result = await pool.query(`
      SELECT 
        up.id,
        up.user_id,
        up.permission_id,
        up.granted_by,
        up.granted_at,
        p.name as permission_name,
        p.description as permission_description,
        u.username
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      JOIN users u ON up.user_id = u.id
      ORDER BY u.username, p.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({ error: 'Failed to get user permissions' });
  }
});

/**
 * 授予权限
 */
router.post('/permissions/grant', async (req, res) => {
  try {
    const { userId, permissionName } = req.body;
    const grantedBy = (req as any).user.id;

    await permissionService.grantPermission(userId, permissionName, grantedBy);
    res.json({ success: true });
  } catch (error) {
    console.error('Error granting permission:', error);
    res.status(500).json({ error: 'Failed to grant permission' });
  }
});

/**
 * 撤销权限
 */
router.post('/permissions/revoke', async (req, res) => {
  try {
    const { userId, permissionName } = req.body;
    const revokedBy = (req as any).user.id;

    await permissionService.revokePermission(userId, permissionName, revokedBy);
    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking permission:', error);
    res.status(500).json({ error: 'Failed to revoke permission' });
  }
});

/**
 * 获取所有安全配置
 */
router.get('/config', async (req, res) => {
  try {
    const configs = await securityConfigService.getAllConfigs();
    res.json(configs);
  } catch (error) {
    console.error('Error getting security config:', error);
    res.status(500).json({ error: 'Failed to get security config' });
  }
});

/**
 * 更新安全配置
 */
router.put('/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value, reason } = req.body;
    const updatedBy = (req as any).user.id;

    const config = await securityConfigService.updateConfig(key, value, updatedBy, reason);
    res.json(config);
  } catch (error) {
    console.error('Error updating security config:', error);
    res.status(500).json({ error: 'Failed to update security config' });
  }
});

/**
 * 获取配置历史
 */
router.get('/config/:key/history', async (req, res) => {
  try {
    const { key } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const history = await securityConfigService.getConfigHistory(key, limit);
    res.json(history);
  } catch (error) {
    console.error('Error getting config history:', error);
    res.status(500).json({ error: 'Failed to get config history' });
  }
});

/**
 * 导出安全配置
 */
router.get('/config/export', async (req, res) => {
  try {
    const configExport = await securityConfigService.exportConfigs();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="security-config-${Date.now()}.json"`);
    res.json(configExport);
  } catch (error) {
    console.error('Error exporting config:', error);
    res.status(500).json({ error: 'Failed to export config' });
  }
});

/**
 * 导入安全配置
 */
router.post('/config/import', async (req, res) => {
  try {
    const configExport = req.body;
    const importedBy = (req as any).user.id;

    const result = await securityConfigService.importConfigs(configExport, importedBy);
    res.json(result);
  } catch (error) {
    console.error('Error importing config:', error);
    res.status(500).json({ error: 'Failed to import config' });
  }
});

export default router;
