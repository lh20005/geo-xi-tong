import axios from 'axios';
import { OllamaService } from './ollamaService';

export type AIProvider = 'deepseek' | 'gemini' | 'ollama';

interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  timeout?: number; // 超时时间（毫秒），默认120秒
  maxRetries?: number; // 最大重试次数，默认2次
}

export class AIService {
  private config: AIConfig;
  private ollamaService?: OllamaService;
  private timeout: number;
  private maxRetries: number;

  constructor(config: AIConfig) {
    this.config = config;
    this.timeout = config.timeout || 120000; // 默认120秒
    this.maxRetries = config.maxRetries || 2; // 默认重试2次
    
    // 如果provider是ollama，初始化OllamaService
    if (config.provider === 'ollama') {
      if (!config.ollamaBaseUrl || !config.ollamaModel) {
        throw new Error('Ollama配置不完整：需要ollamaBaseUrl和ollamaModel');
      }
      this.ollamaService = new OllamaService(config.ollamaBaseUrl, this.timeout);
    }
  }

  /**
   * 关键词蒸馏 - 生成真实用户提问
   * @param keyword 关键词
   * @param promptTemplate 提示词模板（可选，如果不提供则使用默认模板）
   * @param topicCount 生成话题数量（可选，如果不提供则使用默认值12）
   */
  async distillKeyword(
    keyword: string, 
    promptTemplate?: string, 
    topicCount?: number
  ): Promise<string[]> {
    // 使用提供的模板或默认模板
    const template = promptTemplate || `你是一个专业的搜索行为分析专家。请根据关键词"{keyword}"，生成{count}个真实用户在互联网搜索时可能提出的问题。

要求：
1. 问题要符合真实用户的搜索习惯
2. 包含不同的搜索意图（比较、推荐、评价等）
3. 使用常见的搜索词组合，如"哪家好"、"靠谱的"、"口碑好的"、"性价比高的"、"专业的"等
4. 问题要自然、口语化

示例（关键词：英国留学）：
- 专业的英国留学哪家好
- 靠谱的英国留学机构哪家好
- 口碑好的英国留学企业哪家好
- 性价比高的英国留学公司哪家好
- 专业的英国留学服务商哪家专业

请直接返回问题列表，每行一个问题，不要编号，不要其他说明文字。`;

    // 使用提供的数量或默认值
    const count = topicCount || 12;
    
    // 替换模板中的占位符
    const prompt = template
      .replace(/\{keyword\}/g, keyword)
      .replace(/\{count\}/g, count.toString());

    const response = await this.callAI(prompt);
    const questions = response
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.match(/^[\d\-\.\)]/));
    
    return questions;
  }

  /**
   * 生成文章
   */
  async generateArticle(
    keyword: string,
    topics: string[],
    requirements: string,
    knowledgeContext?: string
  ): Promise<string> {
    const topicsList = topics.map((t, i) => `${i + 1}. ${t}`).join('\n');
    
    let prompt = `你是一个专业的内容创作专家，擅长撰写高质量的SEO优化文章。

核心关键词：${keyword}

相关话题：
${topicsList}`;

    // 如果有知识库上下文，添加到prompt中
    if (knowledgeContext && knowledgeContext.trim().length > 0) {
      prompt += `\n\n企业知识库参考资料：
${knowledgeContext}

请基于以上企业知识库的内容，确保文章的专业性和准确性。文章内容应该与企业知识库中的信息保持一致。`;
    }

    prompt += `\n\n文章要求：
${requirements}

请撰写一篇专业、高质量的文章，要求：
1. 文章要围绕核心关键词展开
2. 自然融入相关话题中的问题和答案
3. 内容要有价值、有深度，对读者有实际帮助
4. 语言流畅、专业，符合SEO优化标准
5. 结构清晰，包含标题、段落、小标题等
6. 字数在1500-2500字之间

请直接输出文章内容：`;

    return await this.callAI(prompt);
  }

  /**
   * 智能排版文章
   */
  async formatArticle(content: string, hasImage: boolean): Promise<string> {
    const prompt = `你是一个专业的新闻编辑。请将以下文章内容按照通用新闻稿格式重新排版。

要求：
1. 保持原文的核心信息和观点
2. 优化段落结构，使其更符合新闻稿标准
3. 第一段应该是导语，概括全文要点
4. 段落之间要有清晰的逻辑关系
5. 保持专业、客观的语言风格
6. 每个段落应该简洁明了，避免过长

原文内容：
${content}

请直接输出排版后的文章内容：`;

    return await this.callAI(prompt);
  }

  /**
   * 调用AI接口（带重试机制）
   */
  private async callAI(prompt: string): Promise<string> {
    return await this.callAIWithRetry(prompt, this.maxRetries);
  }

  /**
   * 带重试机制的AI调用
   */
  private async callAIWithRetry(prompt: string, maxRetries: number = 2): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AI调用] 尝试 ${attempt + 1}/${maxRetries + 1}`);
        
        switch (this.config.provider) {
          case 'deepseek':
            return await this.callDeepSeek(prompt);
          case 'gemini':
            return await this.callGemini(prompt);
          case 'ollama':
            return await this.callOllama(prompt);
          default:
            throw new Error(`不支持的AI提供商: ${this.config.provider}`);
        }
      } catch (error: any) {
        lastError = error;
        console.error(`[AI调用] 尝试 ${attempt + 1} 失败:`, error.message);
        
        if (attempt < maxRetries) {
          const waitTime = 5000 * (attempt + 1); // 5s, 10s
          console.log(`[AI调用] 等待 ${waitTime}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw new Error(`AI调用失败，已重试 ${maxRetries + 1} 次: ${lastError?.message || '未知错误'}`);
  }

  /**
   * 调用DeepSeek API
   */
  private async callDeepSeek(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('DeepSeek API错误:', error.response?.data || error.message);
      throw new Error(`DeepSeek API调用失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * 调用Gemini API
   */
  private async callGemini(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${this.config.apiKey}`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4000
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      return response.data.candidates[0].content.parts[0].text;
    } catch (error: any) {
      console.error('Gemini API错误:', error.response?.data || error.message);
      throw new Error(`Gemini API调用失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * 调用Ollama本地模型
   */
  private async callOllama(prompt: string): Promise<string> {
    if (!this.ollamaService || !this.config.ollamaModel) {
      throw new Error('Ollama服务未初始化');
    }

    try {
      const response = await this.ollamaService.chat({
        model: this.config.ollamaModel,
        messages: [
          { role: 'user', content: prompt }
        ],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 4000
        }
      });

      return response;
    } catch (error: any) {
      console.error('Ollama API错误:', error.message);
      throw new Error(`Ollama API调用失败: ${error.message}`);
    }
  }
}
