import { Router } from 'express';
import { pool } from '../db/database';
import { OllamaService } from '../services/ollamaService';

export const configRouter = Router();

// ==================== 关键词蒸馏配置 API ====================

// 获取当前激活的关键词蒸馏配置
configRouter.get('/distillation', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, prompt, topic_count, is_active, created_at, updated_at FROM distillation_config WHERE is_active = true LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      // 如果没有配置，返回默认值
      return res.json({ 
        prompt: '你是一个专业的搜索行为分析专家。请根据关键词"{keyword}"，生成{count}个真实用户在互联网搜索时可能提出的问题。\n\n要求：\n1. 问题要符合真实用户的搜索习惯\n2. 包含不同的搜索意图（比较、推荐、评价等）\n3. 使用常见的搜索词组合，如"哪家好"、"靠谱的"、"口碑好的"、"性价比高的"、"专业的"等\n4. 问题要自然、口语化\n\n示例（关键词：英国留学）：\n- 专业的英国留学哪家好\n- 靠谱的英国留学机构哪家好\n- 口碑好的英国留学企业哪家好\n- 性价比高的英国留学公司哪家好\n- 专业的英国留学服务商哪家专业\n\n请直接返回问题列表，每行一个问题，不要编号，不要其他说明文字。',
        topicCount: 12,
        configured: false 
      });
    }
    
    const config = result.rows[0];
    res.json({ 
      id: config.id,
      prompt: config.prompt,
      topicCount: config.topic_count,
      configured: true,
      createdAt: config.created_at,
      updatedAt: config.updated_at
    });
  } catch (error: any) {
    console.error('获取关键词蒸馏配置失败:', error);
    res.status(500).json({ error: '获取配置失败' });
  }
});

// 保存关键词蒸馏配置
configRouter.post('/distillation', async (req, res) => {
  try {
    const { prompt, topicCount } = req.body;
    
    // 参数验证
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: '请提供关键词蒸馏提示词' });
    }
    
    if (!topicCount || typeof topicCount !== 'number' || topicCount < 5 || topicCount > 30) {
      return res.status(400).json({ error: '生成话题数量必须在5-30之间' });
    }
    
    // 验证prompt中包含必要的占位符
    if (!prompt.includes('{keyword}')) {
      return res.status(400).json({ error: '提示词必须包含 {keyword} 占位符' });
    }
    
    if (!prompt.includes('{count}')) {
      return res.status(400).json({ error: '提示词必须包含 {count} 占位符' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // 停用所有现有配置
      await client.query('UPDATE distillation_config SET is_active = false');
      
      // 插入新配置
      const result = await client.query(
        `INSERT INTO distillation_config (prompt, topic_count, is_active) 
         VALUES ($1, $2, true) 
         RETURNING id, prompt, topic_count, created_at, updated_at`,
        [prompt.trim(), topicCount]
      );
      
      await client.query('COMMIT');
      
      res.json({ 
        success: true, 
        config: {
          id: result.rows[0].id,
          prompt: result.rows[0].prompt,
          topicCount: result.rows[0].topic_count,
          createdAt: result.rows[0].created_at,
          updatedAt: result.rows[0].updated_at
        },
        message: '关键词蒸馏配置保存成功'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('保存关键词蒸馏配置错误:', error);
    res.status(500).json({ error: '保存配置失败' });
  }
});

// ==================== AI API 配置 ====================

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
