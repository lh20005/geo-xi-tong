import { useState, useEffect } from 'react';
import { Card, Form, Select, Input, Button, message, Space, Alert, Spin, Tabs, InputNumber } from 'antd';
import { ApiOutlined, CheckCircleOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { apiClient } from '../api/client';

const { TextArea } = Input;

// 关键词蒸馏配置组件
function DistillationConfigTab() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await apiClient.get('/config/distillation');
      setCurrentConfig(response.data);
      if (response.data.configured) {
        form.setFieldsValue({
          prompt: response.data.prompt,
          topicCount: response.data.topicCount
        });
      } else {
        // 设置默认值
        form.setFieldsValue({
          prompt: response.data.prompt,
          topicCount: response.data.topicCount
        });
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      message.error('加载配置失败');
    }
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // 第一步：获取确认令牌
      const confirmResponse = await apiClient.post('/confirm/initiate', {
        action: 'update-distillation-config',
        data: values
      });

      if (!confirmResponse.data.success) {
        throw new Error('获取确认令牌失败');
      }

      const confirmationToken = confirmResponse.data.data.token;

      // 第二步：使用确认令牌保存配置
      await apiClient.post('/config/distillation', values, {
        headers: {
          'X-Confirmation-Token': confirmationToken
        }
      });

      message.success('关键词蒸馏配置保存成功！');
      loadConfig();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || '保存配置失败';
      message.error(errorMsg);
      console.error('保存配置错误:', error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (currentConfig) {
      form.setFieldsValue({
        prompt: currentConfig.prompt,
        topicCount: currentConfig.topicCount
      });
    }
  };

  return (
    <div style={{ padding: '24px 0' }}>
      {currentConfig?.configured && (
        <Alert
          message="当前配置"
          description={`已配置关键词蒸馏 - 生成话题数量: ${currentConfig.topicCount}个`}
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
          label="关键词蒸馏提示词"
          name="prompt"
          rules={[
            { required: true, message: '请输入关键词蒸馏提示词' },
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                if (!value.includes('{keyword}')) {
                  return Promise.reject(new Error('提示词必须包含 {keyword} 占位符'));
                }
                if (!value.includes('{count}')) {
                  return Promise.reject(new Error('提示词必须包含 {count} 占位符'));
                }
                return Promise.resolve();
              }
            }
          ]}
          extra={
            <div style={{ marginTop: 8 }}>
              <div>提示词中必须包含以下占位符：</div>
              <div style={{ color: '#1890ff', marginTop: 4 }}>
                • <code>{'{keyword}'}</code> - 将被替换为用户输入的关键词
              </div>
              <div style={{ color: '#1890ff' }}>
                • <code>{'{count}'}</code> - 将被替换为生成话题数量
              </div>
            </div>
          }
        >
          <TextArea
            rows={12}
            placeholder="请输入关键词蒸馏提示词..."
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item
          label="生成话题数量"
          name="topicCount"
          rules={[
            { required: true, message: '请输入生成话题数量' },
            { type: 'number', min: 5, max: 30, message: '数量必须在5-30之间' }
          ]}
          extra="每次蒸馏生成的话题数量，建议10-15个"
        >
          <InputNumber
            min={5}
            max={30}
            style={{ width: 200 }}
            placeholder="请输入数量"
          />
        </Form.Item>

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
            <Button size="large" onClick={handleReset}>
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>

      <Card
        type="inner"
        title="配置说明"
        style={{ marginTop: 24, background: '#f8fafc' }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <strong>关键词蒸馏提示词：</strong>
            <br />
            这是发送给AI大模型的指令，用于指导AI如何根据关键词生成相关话题。
            提示词中的 <code>{'{keyword}'}</code> 会被替换为实际的关键词，
            <code>{'{count}'}</code> 会被替换为生成话题数量。
          </div>
          <div>
            <strong>生成话题数量：</strong>
            <br />
            控制每次蒸馏生成多少个话题。数量越多，覆盖的搜索意图越广泛，
            但也会增加AI处理时间。建议设置为10-15个。
          </div>
          <div>
            <strong>使用建议：</strong>
            <br />
            • 提示词应该清晰地说明生成话题的要求和格式
            <br />
            • 可以在提示词中加入示例，帮助AI理解期望的输出格式
            <br />
            • 修改配置后，新的蒸馏任务会立即使用新配置
          </div>
        </Space>
      </Card>
    </div>
  );
}

export default function ConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [ollamaModels, setOllamaModels] = useState<any[]>([]);
  const [detectingModels, setDetectingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [canEdit, setCanEdit] = useState(false);  // 是否可以编辑（管理员权限）

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await apiClient.get('/config/active');
      setCurrentConfig(response.data);
      setCanEdit(response.data.canEdit || false);  // 从后端获取权限
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
      const response = await apiClient.get('/config/ollama/models', {
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
      const response = await apiClient.post('/config/ollama/test', {
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
      // 第一步：获取确认令牌
      const confirmResponse = await apiClient.post('/confirm/initiate', {
        action: 'update-api-config',
        data: values
      });

      if (!confirmResponse.data.success) {
        throw new Error('获取确认令牌失败');
      }

      const confirmationToken = confirmResponse.data.data.token;

      // 第二步：使用确认令牌保存配置
      await apiClient.post('/config', values, {
        headers: {
          'X-Confirmation-Token': confirmationToken
        }
      });

      message.success('API配置保存成功！');
      loadConfig();
      form.resetFields();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || '保存配置失败，请检查网络连接';
      message.error(errorMsg);
      console.error('保存配置错误:', error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Card
        title="系统配置"
        variant="borderless"
      >
        <Tabs
          defaultActiveKey="api"
          items={[
            {
              key: 'api',
              label: (
                <Space>
                  <ApiOutlined />
                  <span>AI API配置</span>
                </Space>
              ),
              children: (
                <div>
        {/* 普通用户：只读视图 */}
        {!canEdit && currentConfig?.configured && (
          <Alert
            message="AI服务已配置"
            description={
              currentConfig.provider === 'ollama'
                ? `系统已配置本地Ollama服务 - 模型: ${currentConfig.ollamaModel}`
                : `系统已配置 ${currentConfig.provider === 'deepseek' ? 'DeepSeek' : 'Gemini'} API服务`
            }
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {!canEdit && !currentConfig?.configured && (
          <Alert
            message="AI服务未配置"
            description="系统尚未配置AI服务，请联系管理员进行配置"
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* 管理员：配置表单 */}
        {canEdit && currentConfig?.configured && (
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

        {canEdit && (
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
              extra="您的API密钥将被加密存储，仅用于调用AI服务"
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
        )}

        {canEdit && (
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
        )}

        {!canEdit && (
          <Card
            type="inner"
            title="提示"
            style={{ marginTop: 24, background: '#f8fafc' }}
          >
            <p>您当前没有配置AI服务的权限。如需配置，请联系系统管理员。</p>
            <p>所有用户共享系统级AI配置，无需单独设置即可使用AI功能。</p>
          </Card>
        )}
                </div>
              ),
            },
            {
              key: 'distillation',
              label: (
                <Space>
                  <ThunderboltOutlined />
                  <span>关键词蒸馏配置</span>
                </Space>
              ),
              children: <DistillationConfigTab />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
