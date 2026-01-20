import express from 'express';
import { accountService } from '../services/AccountService';
import { getWebSocketService } from '../services/WebSocketService';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

const router = express.Router();

// 所有路由都需要认证和租户上下文
router.use(authenticate);
router.use(setTenantContext);
router.use(requireTenantContext);

/**
 * 获取所有账号
 * 用于 Electron 登录管理器（仅返回当前用户的账号）
 */
router.get('/', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const accounts = await accountService.getAllAccounts(userId);
    
    res.json(accounts);
  } catch (error) {
    console.error('获取账号列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取账号列表失败'
    });
  }
});

/**
 * 获取账号详情（包含凭证）
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const accountId = parseInt(req.params.id);
    const includeCredentials = req.query.includeCredentials !== 'false'; // 默认包含凭证
    
    const account = await accountService.getAccountById(accountId, userId, includeCredentials);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: '账号不存在或无权访问'
      });
    }
    
    res.json(account);
  } catch (error) {
    console.error('获取账号详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取账号详情失败'
    });
  }
});

/**
 * 创建账号
 */
router.post('/', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { platform_id, account_name, real_username, credentials, is_default } = req.body;
    
    if (!platform_id || !account_name || !credentials) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: platform_id, account_name, credentials'
      });
    }
    
    const account = await accountService.createAccount({
      platform_id,
      account_name,
      real_username,
      credentials
    }, userId);
    
    // 如果设置为默认账号
    if (is_default) {
      await accountService.setDefaultAccount(platform_id, account.id, userId);
    }
    
    // 广播账号创建事件（只发送给当前用户）
    getWebSocketService().broadcastAccountEvent('created', account, userId);
    
    res.status(201).json(account);
  } catch (error: any) {
    console.error('创建账号失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '创建账号失败'
    });
  }
});

/**
 * 更新账号
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const accountId = parseInt(req.params.id);
    const { account_name, real_username, credentials, is_default, status } = req.body;
    
    const account = await accountService.updateAccount(accountId, {
      account_name,
      real_username,
      credentials,
      status
    }, userId);
    
    // 如果设置为默认账号
    if (is_default && account) {
      await accountService.setDefaultAccount(account.platform_id, accountId, userId);
    }
    
    // 广播账号更新事件（只发送给当前用户）
    getWebSocketService().broadcastAccountEvent('updated', account, userId);
    
    res.json(account);
  } catch (error: any) {
    console.error('更新账号失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '更新账号失败'
    });
  }
});

/**
 * 删除账号
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const accountId = parseInt(req.params.id);
    
    console.log(`[DELETE] 收到删除账号请求: ID=${accountId}, UserID=${userId}`);
    
    await accountService.deleteAccount(accountId, userId);
    
    console.log(`[DELETE] 账号删除成功: ID=${accountId}`);
    
    // 广播账号删除事件（只发送给当前用户）
    getWebSocketService().broadcastAccountEvent('deleted', { id: accountId }, userId);
    
    res.json({
      success: true,
      message: '账号删除成功'
    });
  } catch (error: any) {
    console.error('[DELETE] 删除账号失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '删除账号失败'
    });
  }
});

/**
 * 设置默认账号
 */
router.post('/:id/set-default', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const accountId = parseInt(req.params.id);
    const { platform_id } = req.body;
    
    if (!platform_id) {
      return res.status(400).json({
        success: false,
        message: '缺少平台ID'
      });
    }
    
    await accountService.setDefaultAccount(platform_id, accountId, userId);
    
    res.json({
      success: true,
      message: '默认账号设置成功'
    });
  } catch (error: any) {
    console.error('设置默认账号失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '设置默认账号失败'
    });
  }
});

/**
 * 更新账号在线状态（供本地执行器调用）
 * 任务 1.4：新增账号状态更新 API
 */
router.put('/:id/online-status', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const accountId = parseInt(req.params.id);
    const { is_online, offline_reason } = req.body;
    
    if (typeof is_online !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_online 必须是布尔值'
      });
    }
    
    // 验证账号所有权
    const account = await accountService.getAccountById(accountId, userId, false);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: '账号不存在或无权访问'
      });
    }
    
    // 更新账号状态
    if (is_online) {
      await accountService.markAccountOnline(accountId);
    } else {
      await accountService.markAccountOffline(accountId, offline_reason || 'Cookie已失效');
    }
    
    // 广播账号状态更新事件
    getWebSocketService().broadcastAccountEvent('updated', { 
      id: accountId, 
      is_online,
      offline_reason: is_online ? null : offline_reason 
    }, userId);
    
    res.json({
      success: true,
      message: is_online ? '账号已标记为在线' : '账号已标记为离线'
    });
  } catch (error: any) {
    console.error('更新账号在线状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '更新账号在线状态失败'
    });
  }
});

export default router;
