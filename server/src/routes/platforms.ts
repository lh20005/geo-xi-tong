import express from 'express';
import { pool } from '../db/database';

const router = express.Router();

/**
 * 获取所有平台配置
 * 用于 Electron 登录管理器
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM platforms_config WHERE is_enabled = true ORDER BY platform_name'
    );
    
    // 转换为 Electron 应用期望的格式
    const platforms = result.rows.map(row => ({
      platform_id: row.platform_id,
      platform_name: row.platform_name,
      icon_url: row.icon_url,
      login_url: row.login_url,
      selectors: row.selectors || {
        username: [],
        loginSuccess: []
      },
      enabled: row.is_enabled
    }));
    
    res.json(platforms);
  } catch (error) {
    console.error('获取平台配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取平台配置失败'
    });
  }
});

/**
 * 获取单个平台配置
 */
router.get('/:platformId', async (req, res) => {
  try {
    const { platformId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM platforms_config WHERE platform_id = $1 AND is_enabled = true',
      [platformId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '平台不存在或未启用'
      });
    }
    
    const row = result.rows[0];
    const platform = {
      platform_id: row.platform_id,
      platform_name: row.platform_name,
      icon_url: row.icon_url,
      login_url: row.login_url,
      selectors: row.selectors || {
        username: [],
        loginSuccess: []
      },
      enabled: row.is_enabled
    };
    
    res.json(platform);
  } catch (error) {
    console.error('获取平台配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取平台配置失败'
    });
  }
});

export default router;
