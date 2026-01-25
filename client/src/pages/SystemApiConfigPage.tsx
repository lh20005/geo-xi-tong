import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, message, Table, Space, Modal, Tag, Statistic, Row, Col } from 'antd';
import { ApiOutlined, CheckCircleOutlined, ExclamationCircleOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { TextArea } = Input;

interface SystemApiConfig {
  id: number;
  provider: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

interface ApiQuota {
  tenantId: number;
  monthlyLimit: number;
  dailyLimit: number;
  monthlyUsed: number;
  dailyUsed: number;
}

const SystemApiConfigPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configs, setConfigs] = useState<SystemApiConfig[]>([]);
  const [quota, setQuota] = useState<ApiQuota | null>(null);
  const [provider, setProvider] = useState<string>('deepseek');

  useEffect(() => {
    loadConfigs();
    loadQuota();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await axios.get('/api/admin/system-api-config');
      if (response.data.success) {
        setConfigs(response.data.data);
      }
    } catch (error: any) {
      message.error('加载配置失败');
    }
  };

  const loadQuota = async () => {
    try {
      // 假设当前用户的tenantId可以从用户信息中获取
      const userResponse = await axios.get('/api/auth/me');
      const tenantId = userResponse.data.tenantId;
      
      if (tenantId) {
        const response = await axios.get(`/api/admin/system-api-config/quota/${tenantId}`);
        if (response.data.success) {
          setQuota(response.data.data);
        }
      }
    } catch (error: any) {
      console.error('加载配额失败:', error);
    }
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    form.resetFields(['apiKey', 'ollamaBaseUrl', 'ollamaModel']);
  };

  const handleTest = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();
      
      setTesting(true);
      const response = await axios.post('/api/admin/system-api-config/test', values);
      
      if (response.data.success) {
        message.success('API配置测试成功！');
        Modal.success({
          title: '测试成功',
          content: (
            <div>
              <p>API配置正常工作</p>
              <p>测试结果示例：</p>
              <ul>
                {response.data.data.testResult.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )
        });
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'API配置测试失败');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();
      
      setLoading(true);
      const response = await axios.post('/api/admin/system-api-config', values);
      
      if (response.data.success) {
        message.success('系统API配置保存成功！');
        form.resetFields();
        loadConfigs();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '保存配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个配置吗？',
      onOk: async () => {
        try {
          const response = await axios.delete(`/api/admin/system-api-config/${id}`);
          if (response.data.success) {
            message.success('配置删除成功');
            loadConfigs();
          }
        } catch (error: any) {
          message.error('删除配置失败');
        }
      }
    });
  };

  const columns = [
    {
      title: 'AI服务',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string) => {
        const providerMap: Record<string, { label: string; color: string }> = {
          deepseek: { label: 'DeepSeek', color: 'purple' },
          gemini: { label: 'Gemini', color: 'orange' },
          ollama: { label: 'Ollama', color: 'green' }
        };
        const info = providerMap[provider] || { label: provider, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        isActive ? (
          <Tag icon={<CheckCircleOutlined />} color="success">激活</Tag>
        ) : (
          <Tag color="default">未激活</Tag>
        )
      )
    },
    {
      title: '配置信息',
      key: 'config',
      render: (record: SystemApiConfig) => {
        if (record.provider === 'ollama') {
          return (
            <div>
              <div>地址: {record.ollamaBaseUrl}</div>
              <div>模型: {record.ollamaModel}</div>
            </div>
          );
        }
        return <div>API密钥: ********</div>;
      }
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (record: SystemApiConfig) => (
        <Space>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1>
        <ApiOutlined /> 系统级AI配置管理
      </h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        配置系统级AI服务，所有用户将共享此配置。API密钥将被加密存储，确保安全。
      </p>

      {quota && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic
                title="每日配额"
                value={quota.dailyLimit - quota.dailyUsed}
                suffix={`/ ${quota.dailyLimit}`}
                valueStyle={{ color: quota.dailyUsed >= quota.dailyLimit ? '#cf1322' : '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic
                title="每月配额"
                value={quota.monthlyLimit - quota.monthlyUsed}
                suffix={`/ ${quota.monthlyLimit}`}
                valueStyle={{ color: quota.monthlyUsed >= quota.monthlyLimit ? '#cf1322' : '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card title="添加新配置" style={{ marginBottom: '24px' }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ provider: 'deepseek' }}
        >
          <Form.Item
            label="AI服务提供商"
            name="provider"
            rules={[{ required: true, message: '请选择AI服务提供商' }]}
          >
            <Select onChange={handleProviderChange}>
              <Option value="deepseek">DeepSeek</Option>
              <Option value="gemini">Google Gemini</Option>
              <Option value="ollama">本地 Ollama</Option>
            </Select>
          </Form.Item>

          {provider !== 'ollama' && (
            <Form.Item
              label="API密钥"
              name="apiKey"
              rules={[{ required: true, message: '请输入API密钥' }]}
              extra="API密钥将被加密存储，不会明文保存"
            >
              <Input.Password placeholder="sk-xxxxxxxxxxxxxxxx" />
            </Form.Item>
          )}

          {provider === 'ollama' && (
            <>
              <Form.Item
                label="Ollama服务地址"
                name="ollamaBaseUrl"
                rules={[{ required: true, message: '请输入Ollama服务地址' }]}
              >
                <Input placeholder="http://localhost:11434" />
              </Form.Item>

              <Form.Item
                label="模型名称"
                name="ollamaModel"
                rules={[{ required: true, message: '请输入模型名称' }]}
              >
                <Input placeholder="deepseek-r1:latest" />
              </Form.Item>
            </>
          )}

          <Form.Item
            label="备注"
            name="notes"
          >
            <TextArea
              rows={2}
              placeholder="例如：密钥有效期、用途说明等"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                onClick={handleSave}
                loading={loading}
                icon={<CheckCircleOutlined />}
              >
                保存配置
              </Button>
              <Button
                onClick={handleTest}
                loading={testing}
                icon={<ExclamationCircleOutlined />}
              >
                测试配置
              </Button>
              <Button onClick={() => form.resetFields()}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="现有配置"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadConfigs}
          >
            刷新
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={configs}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default SystemApiConfigPage;
