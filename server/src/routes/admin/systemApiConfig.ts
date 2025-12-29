import express from 'express';
import { systemApiConfigService } from '../../services/SystemApiConfigService';
import { OllamaService } from '../../services/ollamaService';
import { AIService } from '../../services/aiService';

const router = express.Router();

/**
 * 获取所有系统级API配置（不返回密钥）
 * GET /api/admin/system-api-config
 */
router.get('/', async (req, res) => {
  try {
    const configs = await systemApiConfigService.getAllConfigs();
    
    res.json({
      success: true,
      data: configs
    });
  } catch (error: any) {
    console.error('获取系统API配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取系统API配置失败'
    });
  }
});

/**
 * 获取激活的系统级API配置
 * GET /api/admin/system-api-config/active
 */
router.get('/active', async (req, res) => {
  try {
    const provider = req.query.provider as any;
    const config = await systemApiConfigService.getActiveConfig(provider);
    
    if (!config) {
      return res.json({
        success: true,
        data: null,
        message: '未配置系统级API'
      });
    }
    
    // 不返回API密钥
    const { apiKey, ...safeConfig } = config;
    
    res.json({
      success: true,
      data: safeConfig
    });
  } catch (error: any) {
    console.error('获取激活的系统API配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取激活的系统API配置失败'
    });
  }
});

/**
 * 保存系统级API配置
 * POST /api/admin/system-api-config
 */
router.post('/', async (req, res) => {
  try {
    const { provider, apiKey, ollamaBaseUrl, ollamaModel, notes } = req.body;
    const adminId = (req as any).user.userId;
    
    // 参数验证
    if (!provider) {
      return res.status(400).json({
        success: false,
        message: '缺少provider参数'
      });
    }
    
    // 验证配置完整性
    if (provider === 'ollama') {
      if (!ollamaBaseUrl || !ollamaModel) {
        return res.status(400).json({
          success: false,
          message: 'Ollama配置需要baseUrl和model'
        });
      }
      
      // 验证Ollama服务可用性
      try {
        const ollamaService = new OllamaService(ollamaBaseUrl);
        const modelExists = await ollamaService.modelExists(ollamaModel);
        if (!modelExists) {
          return res.status(400).json({
            success: false,
            message: `模型 ${ollamaModel} 未安装，请先使用 'ollama pull ${ollamaModel}' 安装`
          });
        }
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          message: `Ollama服务连接失败: ${error.message}`
        });
      }
    } else {
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: '云端API需要apiKey'
        });
      }
      
      // 验证API密钥有效性（可选）
      try {
        const testService = new AIService({
          provider,
          apiKey,
          timeout: 10000
        });
        
        // 简单测试调用
        await testService.distillKeyword('测试', undefined, 1);
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          message: `API密钥验证失败: ${error.message}`
        });
      }
    }
    
    // 保存配置
    const config = await systemApiConfigService.saveConfig(
      provider,
      apiKey,
      ollamaBaseUrl,
      ollamaModel,
      adminId,
      notes
    );
    
    // 不返回API密钥
    const { apiKey: _, ...safeConfig } = config;
    
    res.json({
      success: true,
      data: safeConfig,
      message: '系统API配置保存成功'
    });
  } catch (error: any) {
    console.error('保存系统API配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '保存系统API配置失败'
    });
  }
});

/**
 * 删除系统级API配置
 * DELETE /api/admin/system-api-config/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await systemApiConfigService.deleteConfig(parseInt(id));
    
    res.json({
      success: true,
      message: '系统API配置删除成功'
    });
  } catch (error: any) {
    console.error('删除系统API配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除系统API配置失败'
    });
  }
});

/**
 * 测试系统级API配置
 * POST /api/admin/system-api-config/test
 */
router.post('/test', async (req, res) => {
  try {
    const { provider, apiKey, ollamaBaseUrl, ollamaModel } = req.body;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        message: '缺少provider参数'
      });
    }
    
    // 创建测试服务
    const testService = new AIService({
      provider,
      apiKey,
      ollamaBaseUrl,
      ollamaModel,
      timeout: 15000
    });
    
    // 执行简单测试
    const result = await testService.distillKeyword('测试', undefined, 2);
    
    res.json({
      success: true,
      message: 'API配置测试成功',
      data: {
        provider,
        testResult: result.slice(0, 2)
      }
    });
  } catch (error: any) {
    console.error('测试系统API配置失败:', error);
    res.status(500).json({
      success: false,
      message: `API配置测试失败: ${error.message}`
    });
  }
});

/**
 * 获取API使用统计
 * GET /api/admin/system-api-config/usage-stats
 */
router.get('/usage-stats', async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? parseInt(req.query.tenantId as string) : undefined;
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '缺少tenantId参数'
      });
    }
    
    const stats = await systemApiConfigService.getUsageStats(tenantId, days);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('获取使用统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取使用统计失败'
    });
  }
});

/**
 * 获取租户配额信息
 * GET /api/admin/system-api-config/quota/:tenantId
 */
router.get('/quota/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const quota = await systemApiConfigService.checkQuota(parseInt(tenantId));
    
    res.json({
      success: true,
      data: quota
    });
  } catch (error: any) {
    console.error('获取配额信息失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取配额信息失败'
    });
  }
});

export default router;
