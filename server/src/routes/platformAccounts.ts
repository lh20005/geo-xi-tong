import express from 'express';
import { accountService } from '../services/AccountService';
import { pool } from '../db/database';
import { getWebSocketService } from '../services/WebSocketService';
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

const router = express.Router();

// 所有路由都需要认证和租户上下文
router.use(authenticate);
router.use(setTenantContext);
router.use(requireTenantContext);

/**
 * 获取所有平台配置
 */
router.get('/platforms', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM platforms_config WHERE is_enabled = true ORDER BY platform_name'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('获取平台配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取平台配置失败'
    });
  }
});

/**
 * 获取所有账号
 */
router.get('/accounts', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const accounts = await accountService.getAllAccounts(userId);
    
    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('获取账号列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取账号列表失败'
    });
  }
});

/**
 * 根据平台ID获取账号
 */
router.get('/accounts/platform/:platformId', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { platformId } = req.params;
    const accounts = await accountService.getAccountsByPlatform(platformId, userId);
    
    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('获取平台账号失败:', error);
    res.status(500).json({
      success: false,
      message: '获取平台账号失败'
    });
  }
});

/**
 * 获取账号详情（包含凭证）
 */
router.get('/accounts/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const accountId = parseInt(req.params.id);
    const includeCredentials = req.query.includeCredentials === 'true';
    
    const account = await accountService.getAccountById(accountId, userId, includeCredentials);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: '账号不存在或无权访问'
      });
    }
    
    res.json({
      success: true,
      data: account
    });
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
router.post('/accounts', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { platform_id, account_name, credentials, real_username } = req.body;
    
    console.log('[创建账号] 开始处理请求');
    console.log('[创建账号] platform_id:', platform_id);
    console.log('[创建账号] account_name:', account_name);
    console.log('[创建账号] real_username:', real_username);
    console.log('[创建账号] userId:', userId);
    console.log('[创建账号] credentials 类型:', typeof credentials);
    console.log('[创建账号] credentials 是否有 cookies:', credentials?.cookies ? 'yes' : 'no');
    console.log('[创建账号] cookies 数量:', credentials?.cookies?.length || 0);
    
    if (!platform_id || !account_name || !credentials) {
      console.log('[创建账号] 缺少必需参数');
      return res.status(400).json({
        success: false,
        message: '缺少必需参数'
      });
    }
    
    console.log('[创建账号] 参数验证通过，开始创建/更新账号');
    
    // 使用 createOrUpdateAccount 实现去重
    let result;
    if (real_username) {
      result = await accountService.createOrUpdateAccount({
        platform_id,
        account_name,
        credentials
      }, real_username, userId);
    } else {
      // 如果没有 real_username，使用 account_name 作为唯一标识
      result = await accountService.createOrUpdateAccount({
        platform_id,
        account_name,
        credentials
      }, account_name, userId);
    }
    
    const { account, isNew } = result;
    
    console.log('[创建账号] 账号保存成功, ID:', account.id, 'isNew:', isNew);
    
    // 广播账号事件
    if (isNew) {
      getWebSocketService().broadcastAccountEvent('created', account);
    } else {
      getWebSocketService().broadcastAccountEvent('updated', account);
    }
    
    res.json({
      success: true,
      data: account,
      message: isNew ? '账号创建成功' : '账号已更新',
      isNew
    });
  } catch (error: any) {
    console.error('[创建账号] 失败:', error);
    console.error('[创建账号] 错误堆栈:', error.stack);
    res.status(400).json({
      success: false,
      message: error.message || '创建/更新账号失败',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * 更新账号
 */
router.put('/accounts/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const accountId = parseInt(req.params.id);
    const { account_name, credentials, real_username } = req.body;
    
    const account = await accountService.updateAccountWithRealUsername(accountId, {
      account_name,
      credentials
    }, real_username || '', userId);
    
    // 广播账号更新事件
    getWebSocketService().broadcastAccountEvent('updated', account);
    
    res.json({
      success: true,
      data: account,
      message: '账号更新成功'
    });
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
router.delete('/accounts/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const accountId = parseInt(req.params.id);
    
    console.log(`[DELETE] 收到删除账号请求: ID=${accountId}, UserID=${userId}`);
    
    await accountService.deleteAccount(accountId, userId);
    
    console.log(`[DELETE] 账号删除成功: ID=${accountId}`);
    
    // 广播账号删除事件
    getWebSocketService().broadcastAccountEvent('deleted', { id: accountId });
    
    console.log(`[DELETE] WebSocket事件已广播: account.deleted, ID=${accountId}`);
    
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
router.post('/accounts/:id/set-default', async (req, res) => {
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
 * 使用浏览器登录平台
 */
router.post('/browser-login', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { platform_id } = req.body;
    
    if (!platform_id) {
      return res.status(400).json({
        success: false,
        message: '缺少平台ID'
      });
    }
    
    // 获取平台配置
    const platformResult = await pool.query(
      'SELECT * FROM platforms_config WHERE platform_id = $1 AND is_enabled = true',
      [platform_id]
    );
    
    if (platformResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '平台不存在或未启用'
      });
    }
    
    const platform = platformResult.rows[0];
    
    // 调用浏览器登录服务
    const result = await accountService.loginWithBrowser(platform, userId);
    
    res.json(result);
  } catch (error: any) {
    console.error('浏览器登录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '浏览器登录失败'
    });
  }
});

export default router;
