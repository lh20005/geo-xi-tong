import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Space, Alert, Tabs, InputNumber } from 'antd';
import { CheckCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
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
  const [systemConfig, setSystemConfig] = useState<any>(null);

  useEffect(() => {
    loadSystemConfig();
  }, []);

  const loadSystemConfig = async () => {
    try {
      const response = await apiClient.get('/config/active');
      setSystemConfig(response.data);
    } catch (error) {
      console.error('加载系统配置失败:', error);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Card
        title="系统配置"
        bordered={false}
      >
        {/* AI服务状态提示 */}
        <Alert
          message="AI服务配置"
          description="AI服务由系统管理员统一配置和管理，您无需单独设置API密钥。如有问题，请联系管理员。"
          type="info"
          icon={<CheckCircleOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* 显示当前配置状态 */}
        {systemConfig?.configured && (
          <Alert
            message="当前AI服务"
            description={
              systemConfig.provider === 'ollama'
                ? `系统正在使用本地Ollama - 模型: ${systemConfig.ollamaModel}`
                : `系统正在使用 ${systemConfig.provider === 'deepseek' ? 'DeepSeek' : systemConfig.provider === 'gemini' ? 'Gemini' : systemConfig.provider} 提供AI服务`
            }
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {!systemConfig?.configured && (
          <Alert
            message="AI服务未配置"
            description="系统管理员尚未配置AI服务，部分功能可能无法使用。请联系管理员配置。"
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* 只保留关键词蒸馏配置 */}
        <Tabs
          defaultActiveKey="distillation"
          items={[
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
