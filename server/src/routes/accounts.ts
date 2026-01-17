// [已迁移到 Windows 端] 平台账号管理已迁移到 Windows 端本地执行
// 此文件保留仅为避免编译错误，实际功能已不再使用

import express from 'express';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext } from '../middleware/tenantContext';

const router = express.Router();

// 所有路由都需要认证和租户上下文
router.use(authenticate);
router.use(setTenantContext);
router.use(requireTenantContext);

// [已迁移到 Windows 端] 所有平台账号管理功能已迁移到 Windows 端
router.all('*', (req, res) => {
  res.status(410).json({
    success: false,
    message: '此功能已迁移到 Windows 端本地执行'
  });
});

export default router;
