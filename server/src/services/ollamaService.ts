import axios, { AxiosInstance } from 'axios';

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  digest?: string;
}

export interface OllamaListResponse {
  models: OllamaModel[];
}

export interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  stream: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434', timeout: number = 120000) {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: timeout, // 可配置超时时间，默认120秒
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 检测Ollama服务是否可用
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      return response.status === 200;
    } catch (error: any) {
      console.error('Ollama连接检测失败:', error.message);
      return false;
    }
  }

  /**
   * 获取已安装的模型列表
   */
  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await this.client.get<OllamaListResponse>('/api/tags');
      return response.data.models || [];
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`无法连接到Ollama服务，请确保Ollama已启动并运行在 ${this.baseUrl}`);
      }
      if (error.code === 'ETIMEDOUT') {
        throw new Error('Ollama服务响应超时，请检查服务状态');
      }
      throw new Error(`获取模型列表失败: ${error.message}`);
    }
  }

  /**
   * 过滤DeepSeek模型
   */
  async getDeepSeekModels(): Promise<OllamaModel[]> {
    const allModels = await this.listModels();
    return allModels.filter(model => 
      model.name.toLowerCase().includes('deepseek')
    );
  }

  /**
   * 调用Ollama进行对话
   */
  async chat(request: OllamaChatRequest): Promise<string> {
    try {
      const response = await this.client.post<OllamaChatResponse>(
        '/api/chat',
        request
      );

      if (!response.data || !response.data.message) {
        throw new Error('Ollama响应格式异常，请检查Ollama版本是否兼容');
      }

      // DeepSeek-R1 模型可能返回 thinking 字段和空的 content
      // 如果 content 为空但有 thinking，说明模型正常工作（测试时限制了 num_predict）
      const content = response.data.message.content || '';
      const hasThinking = (response.data as any).thinking;
      
      // 测试连接时，即使 content 为空，只要有响应就认为连接成功
      // 实际使用时会返回完整的 content
      return content;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`无法连接到Ollama服务，请确保Ollama已启动并运行在 ${this.baseUrl}`);
      }
      if (error.code === 'ETIMEDOUT') {
        throw new Error('模型响应超时，可能是模型过大或系统资源不足');
      }
      if (error.response?.status === 404) {
        throw new Error(`模型 ${request.model} 未安装，请先使用 'ollama pull ${request.model}' 安装`);
      }
      throw new Error(`Ollama调用失败: ${error.message}`);
    }
  }

  /**
   * 验证模型是否存在
   */
  async modelExists(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some(model => model.name === modelName);
    } catch (error) {
      return false;
    }
  }

  /**
   * 格式化模型大小
   */
  static formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
