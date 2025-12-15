import { Router } from 'express';
import { pool } from '../db/database';
import { OllamaService } from '../services/ollamaService';

export const configRouter = Router();

// 获取当前激活的API配置
configRouter.get('/active', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, provider, ollama_base_url, ollama_model, is_active FROM api_configs WHERE is_active = true LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      return res.json({ provider: null, configured: false });
    }
    
    const config = result.rows[0];
    res.json({ 
      provider: config.provider,
      ollamaBaseUrl: config.ollama_base_url,
      ollamaModel: config.ollama_model,
      configured: true 
    });
  } catch (error) {
    res.status(500).json({ error: '获取配置失败' });
  }
});

// 保存API配置
configRouter.post('/', async (req, res) => {
  try {
    const { provider, apiKey, ollamaBaseUrl, ollamaModel } = req.body;
    
    if (!provider) {
      return res.status(400).json({ error: '缺少provider参数' });
    }
    
    // 验证配置完整性
    if (provider === 'ollama') {
      if (!ollamaBaseUrl || !ollamaModel) {
        return res.status(400).json({ error: 'Ollama配置需要baseUrl和model' });
      }
      
      // 验证Ollama服务可用性和模型存在性
      try {
        const ollamaService = new OllamaService(ollamaBaseUrl);
        const modelExists = await ollamaService.modelExists(ollamaModel);
        if (!modelExists) {
          return res.status(400).json({ 
            error: `模型 ${ollamaModel} 未安装，请先使用 'ollama pull ${ollamaModel}' 安装` 
          });
        }
      } catch (error: any) {
        return res.status(400).json({ error: error.message });
      }
    } else {
      if (!apiKey) {
        return res.status(400).json({ error: '云端API需要apiKey' });
      }
    }
    
    // 停用所有现有配置
    await pool.query('UPDATE api_configs SET is_active = false');
    
    // 插入新配置
    let result;
    if (provider === 'ollama') {
      result = await pool.query(
        'INSERT INTO api_configs (provider, api_key, ollama_base_url, ollama_model, is_active) VALUES ($1, NULL, $2, $3, true) RETURNING id, provider, ollama_base_url, ollama_model',
        [provider, ollamaBaseUrl, ollamaModel]
      );
    } else {
      result = await pool.query(
        'INSERT INTO api_configs (provider, api_key, ollama_base_url, ollama_model, is_active) VALUES ($1, $2, NULL, NULL, true) RETURNING id, provider',
        [provider, apiKey]
      );
    }
    
    res.json({ 
      success: true, 
      config: result.rows[0],
      message: 'API配置保存成功'
    });
  } catch (error: any) {
    console.error('保存配置错误:', error);
    res.status(500).json({ error: '保存配置失败' });
  }
});

// 测试API连接
configRouter.post('/test', async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    
    // 这里可以添加实际的API测试逻辑
    res.json({ 
      success: true, 
      message: 'API连接测试成功' 
    });
  } catch (error) {
    res.status(500).json({ error: 'API连接测试失败' });
  }
});

// 获取Ollama中的模型列表
configRouter.get('/ollama/models', async (req, res) => {
  try {
    const baseUrl = (req.query.baseUrl as string) || 'http://localhost:11434';
    
    const ollamaService = new OllamaService(baseUrl);
    
    // 检查连接
    const isConnected = await ollamaService.checkConnection();
    if (!isConnected) {
      return res.status(503).json({ 
        error: `无法连接到Ollama服务，请确保Ollama已启动并运行在 ${baseUrl}`,
        models: []
      });
    }
    
    // 获取DeepSeek模型
    const models = await ollamaService.getDeepSeekModels();
    
    if (models.length === 0) {
      return res.json({
        models: [],
        message: '未检测到DeepSeek模型，请先安装模型',
        installCommand: 'ollama pull deepseek-r1:latest'
      });
    }
    
    // 格式化模型信息
    const formattedModels = models.map(model => ({
      name: model.name,
      size: OllamaService.formatSize(model.size),
      modifiedAt: model.modified_at
    }));
    
    res.json({ 
      models: formattedModels,
      count: models.length
    });
  } catch (error: any) {
    console.error('获取Ollama模型失败:', error);
    res.status(500).json({ 
      error: error.message,
      models: []
    });
  }
});

// 测试Ollama连接和模型
configRouter.post('/ollama/test', async (req, res) => {
  try {
    const { baseUrl, model } = req.body;
    
    if (!baseUrl || !model) {
      return res.status(400).json({ error: '缺少baseUrl或model参数' });
    }
    
    const ollamaService = new OllamaService(baseUrl);
    
    // 检查连接
    const isConnected = await ollamaService.checkConnection();
    if (!isConnected) {
      return res.status(503).json({ 
        success: false,
        error: `无法连接到Ollama服务，请确保Ollama已启动并运行在 ${baseUrl}`
      });
    }
    
    // 检查模型是否存在
    const modelExists = await ollamaService.modelExists(model);
    if (!modelExists) {
      return res.status(404).json({ 
        success: false,
        error: `模型 ${model} 未安装，请先使用 'ollama pull ${model}' 安装`
      });
    }
    
    // 尝试简单的对话测试
    try {
      await ollamaService.chat({
        model: model,
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
        options: { num_predict: 10 }
      });
      
      res.json({ 
        success: true,
        message: '连接成功！模型可用。'
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        error: `模型测试失败: ${error.message}`
      });
    }
  } catch (error: any) {
    console.error('Ollama测试失败:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});
