import express from 'express';
import { accountService } from '../services/AccountService';
import { webSocketService } from '../services/WebSocketService';

const router = express.Router();

/**
 * 获取所有账号
 * 用于 Electron 登录管理器
 */
router.get('/', async (req, res) => {
  try {
    const accounts = await accountService.getAllAccounts();
    
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
    const accountId = parseInt(req.params.id);
    const includeCredentials = req.query.includeCredentials !== 'false'; // 默认包含凭证
    
    const account = await accountService.getAccountById(accountId, includeCredentials);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: '账号不存在'
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
    });
    
    // 如果设置为默认账号
    if (is_default) {
      await accountService.setDefaultAccount(platform_id, account.id);
    }
    
    // 广播账号创建事件
    webSocketService.broadcastAccountEvent('created', account);
    
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
    const accountId = parseInt(req.params.id);
    const { account_name, real_username, credentials, is_default, status } = req.body;
    
    const account = await accountService.updateAccount(accountId, {
      account_name,
      real_username,
      credentials,
      status
    });
    
    // 如果设置为默认账号
    if (is_default && account) {
      await accountService.setDefaultAccount(account.platform_id, accountId);
    }
    
    // 广播账号更新事件
    webSocketService.broadcastAccountEvent('updated', account);
    
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
    const accountId = parseInt(req.params.id);
    
    await accountService.deleteAccount(accountId);
    
    // 广播账号删除事件
    webSocketService.broadcastAccountEvent('deleted', { id: accountId });
    
    res.status(204).send();
  } catch (error: any) {
    console.error('删除账号失败:', error);
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
    const accountId = parseInt(req.params.id);
    const { platform_id } = req.body;
    
    if (!platform_id) {
      return res.status(400).json({
        success: false,
        message: '缺少平台ID'
      });
    }
    
    await accountService.setDefaultAccount(platform_id, accountId);
    
    res.status(204).send();
  } catch (error: any) {
    console.error('设置默认账号失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '设置默认账号失败'
    });
  }
});

export default router;
