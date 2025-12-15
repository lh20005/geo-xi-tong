import { useState, useEffect } from 'react';
import { Card, Form, Select, Input, Button, message, Space, Alert, Spin } from 'antd';
import { ApiOutlined, CheckCircleOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios';

export default function ConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [ollamaModels, setOllamaModels] = useState<any[]>([]);
  const [detectingModels, setDetectingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await axios.get('/api/config/active');
      setCurrentConfig(response.data);
      if (response.data.provider) {
        setSelectedProvider(response.data.provider);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const detectOllamaModels = async (baseUrl: string) => {
    setDetectingModels(true);
    try {
      const response = await axios.get('/api/config/ollama/models', {
        params: { baseUrl }
      });
      
      if (response.data.models.length === 0) {
        message.warning(response.data.message || '未检测到DeepSeek模型');
        if (response.data.installCommand) {
          message.info(`安装命令: ${response.data.installCommand}`);
        }
      } else {
        message.success(`检测到 ${response.data.count} 个DeepSeek模型`);
      }
      
      setOllamaModels(response.data.models);
    } catch (error: any) {
      message.error(error.response?.data?.error || '检测模型失败');
      setOllamaModels([]);
    } finally {
      setDetectingModels(false);
    }
  };

  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    if (value === 'ollama') {
      const baseUrl = form.getFieldValue('ollamaBaseUrl') || 'http://localhost:11434';
      detectOllamaModels(baseUrl);
    }
  };

  const handleOllamaBaseUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const baseUrl = e.target.value;
    if (baseUrl && selectedProvider === 'ollama') {
      detectOllamaModels(baseUrl);
    }
  };

  const testOllamaConnection = async () => {
    const baseUrl = form.getFieldValue('ollamaBaseUrl');
    const model = form.getFieldValue('ollamaModel');
    
    if (!baseUrl || !model) {
      message.warning('请先选择Ollama服务地址和模型');
      return;
    }
    
    setTestingConnection(true);
    try {
      const response = await axios.post('/api/config/ollama/test', {
        baseUrl,
        model
      });
      
      if (response.data.success) {
        message.success(response.data.message);
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '连接测试失败');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await axios.post('/api/config', values);
      message.success('API配置保存成功！');
      loadConfig();
      form.resetFields();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || '保存配置失败，请检查网络连接';
      message.error(errorMsg);
      console.error('保存配置错误:', error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Card
        title={
          <Space>
            <ApiOutlined style={{ color: '#0ea5e9' }} />
            <span>AI API 配置</span>
          </Space>
        }
        bordered={false}
      >
        {currentConfig?.configured && (
          <Alert
            message="当前配置"
            description={
              currentConfig.provider === 'ollama'
                ? `已配置本地Ollama - 模型: ${currentConfig.ollamaModel}`
                : `已配置 ${currentConfig.provider === 'deepseek' ? 'DeepSeek' : 'Gemini'} API`
            }
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            label="选择 AI 模型"
            name="provider"
            rules={[{ required: true, message: '请选择AI模型' }]}
          >
            <Select
              size="large"
              placeholder="请选择要使用的AI模型"
              onChange={handleProviderChange}
              options={[
                { value: 'deepseek', label: 'DeepSeek' },
                { value: 'gemini', label: 'Google Gemini' },
                { value: 'ollama', label: '本地 Ollama' },
              ]}
            />
          </Form.Item>

          {selectedProvider !== 'ollama' && (
            <Form.Item
              label="API Key"
              name="apiKey"
              rules={[{ required: selectedProvider !== 'ollama', message: '请输入API Key' }]}
              extra="您的API密钥将被安全存储，仅用于调用AI服务"
            >
              <Input.Password
                size="large"
                placeholder="请输入您的API Key"
                autoComplete="new-password"
              />
            </Form.Item>
          )}

          {selectedProvider === 'ollama' && (
            <>
              <Form.Item
                label="Ollama 服务地址"
                name="ollamaBaseUrl"
                initialValue="http://localhost:11434"
                rules={[{ required: true, message: '请输入Ollama服务地址' }]}
                extra="本地Ollama服务的地址，默认为 http://localhost:11434"
              >
                <Input
                  size="large"
                  placeholder="http://localhost:11434"
                  onChange={handleOllamaBaseUrlChange}
                  suffix={
                    detectingModels ? (
                      <Spin size="small" />
                    ) : (
                      <ReloadOutlined 
                        onClick={() => {
                          const baseUrl = form.getFieldValue('ollamaBaseUrl');
                          if (baseUrl) detectOllamaModels(baseUrl);
                        }}
                        style={{ cursor: 'pointer', color: '#1890ff' }}
                      />
                    )
                  }
                />
              </Form.Item>

              <Form.Item
                label="选择模型"
                name="ollamaModel"
                rules={[{ required: true, message: '请选择模型' }]}
                extra={ollamaModels.length === 0 ? '未检测到DeepSeek模型，请先安装' : `检测到 ${ollamaModels.length} 个可用模型`}
              >
                <Select
                  size="large"
                  placeholder="请选择要使用的模型"
                  loading={detectingModels}
                  options={ollamaModels.map(model => ({
                    value: model.name,
                    label: `${model.name} (${model.size})`
                  }))}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={testOllamaConnection}
                  loading={testingConnection}
                >
                  测试连接
                </Button>
              </Form.Item>
            </>
          )}

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                icon={<CheckCircleOutlined />}
              >
                保存配置
              </Button>
              <Button size="large" onClick={() => form.resetFields()}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Card
          type="inner"
          title={selectedProvider === 'ollama' ? '使用本地 Ollama' : '获取 API Key'}
          style={{ marginTop: 24, background: '#f8fafc' }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {selectedProvider === 'ollama' ? (
              <>
                <div>
                  <strong>安装 Ollama:</strong>
                  <br />
                  访问 <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer">
                    https://ollama.ai
                  </a> 下载并安装Ollama
                </div>
                <div>
                  <strong>安装 DeepSeek 模型:</strong>
                  <br />
                  在终端运行: <code>ollama pull deepseek-r1:latest</code>
                  <br />
                  或: <code>ollama pull deepseek-coder:latest</code>
                </div>
                <div>
                  <strong>启动 Ollama 服务:</strong>
                  <br />
                  Ollama安装后会自动在后台运行，默认端口为 11434
                </div>
              </>
            ) : (
              <>
                <div>
                  <strong>DeepSeek:</strong>
                  <br />
                  访问 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer">
                    https://platform.deepseek.com
                  </a> 注册并获取API密钥
                </div>
                <div>
                  <strong>Google Gemini:</strong>
                  <br />
                  访问 <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                    https://makersuite.google.com/app/apikey
                  </a> 获取API密钥
                </div>
              </>
            )}
          </Space>
        </Card>
      </Card>
    </div>
  );
}
