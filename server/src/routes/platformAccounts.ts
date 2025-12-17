import express from 'express';
import { accountService } from '../services/AccountService';
import { pool } from '../db/database';

const router = express.Router();

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
    const accounts = await accountService.getAllAccounts();
    
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
    const { platformId } = req.params;
    const accounts = await accountService.getAccountsByPlatform(platformId);
    
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
    const accountId = parseInt(req.params.id);
    const includeCredentials = req.query.includeCredentials === 'true';
    
    const account = await accountService.getAccountById(accountId, includeCredentials);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: '账号不存在'
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
    const { platform_id, account_name, credentials } = req.body;
    
    if (!platform_id || !account_name || !credentials) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数'
      });
    }
    
    const account = await accountService.createAccount({
      platform_id,
      account_name,
      credentials
    });
    
    res.json({
      success: true,
      data: account,
      message: '账号创建成功'
    });
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
router.put('/accounts/:id', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const { account_name, credentials } = req.body;
    
    const account = await accountService.updateAccount(accountId, {
      account_name,
      credentials
    });
    
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
    const accountId = parseInt(req.params.id);
    
    await accountService.deleteAccount(accountId);
    
    res.json({
      success: true,
      message: '账号删除成功'
    });
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
router.post('/accounts/:id/set-default', async (req, res) => {
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
    const result = await accountService.loginWithBrowser(platform);
    
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
