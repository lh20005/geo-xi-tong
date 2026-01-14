import React, { useState, useCallback } from 'react';
import { Card, Table, Button, Modal, Input, message, Space, Tag, Form, Tooltip } from 'antd';
import { SettingOutlined, EditOutlined, HistoryOutlined, DownloadOutlined, CloudSyncOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '../api/client';
import type { ColumnsType } from 'antd/es/table';
import { useCachedData } from '../hooks/useCachedData';
import { useCacheStore } from '../stores/cacheStore';

const { TextArea } = Input;

interface SecurityConfig {
  id: number;
  config_key: string;
  config_value: string;
  config_type: string;
  description?: string;
  version: number;
  updated_at: string;
}

interface ConfigHistory {
  id: number;
  old_value?: string;
  new_value: string;
  version: number;
  changed_by_username?: string;
  change_reason?: string;
  created_at: string;
}

const SecurityConfigPage: React.FC = () => {
  const { invalidateCacheByPrefix } = useCacheStore();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<SecurityConfig | null>(null);
  const [configHistory, setConfigHistory] = useState<ConfigHistory[]>([]);
  const [form] = Form.useForm();

  // 数据获取函数
  const fetchConfigs = useCallback(async () => {
    const response = await apiClient.get('/security/config');
    if (response.data.success) {
      return response.data.data || [];
    }
    return response.data || [];
  }, []);

  // 使用缓存 Hook
  const {
    data: configs,
    loading,
    refreshing,
    refresh,
    isFromCache
  } = useCachedData<SecurityConfig[]>('config:security', fetchConfigs, {
    onError: (error) => message.error(error.message || '获取配置失败'),
  });

  // 使缓存失效并刷新
  const invalidateAndRefresh = useCallback(async () => {
    invalidateCacheByPrefix('config:');
    await refresh(true);
  }, [invalidateCacheByPrefix, refresh]);

  const handleEdit = (config: SecurityConfig) => {
    setSelectedConfig(config);
    form.setFieldsValue({
      config_value: config.config_value,
      change_reason: ''
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      
      const response = await apiClient.put(
        `/security/config/${selectedConfig?.config_key}`,
        {
          value: values.config_value,
          reason: values.change_reason
        }
      );

      if (response.data.success) {
        message.success('配置更新成功');
        setEditModalVisible(false);
        setSelectedConfig(null);
        form.resetFields();
        invalidateAndRefresh();
      } else {
        message.error(response.data.message || '更新配置失败');
      }
    } catch (error: any) {
      console.error('Failed to update config:', error);
      message.error(error.response?.data?.message || '更新配置失败');
    }
  };

  const handleViewHistory = async (config: SecurityConfig) => {
    try {
      const response = await apiClient.get(
        `/security/config/${config.config_key}/history`
      );
      setConfigHistory(response.data || []);
      setSelectedConfig(config);
      setHistoryModalVisible(true);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      message.error('获取历史记录失败');
    }
  };

  const handleExport = async () => {
    try {
      const response = await apiClient.get('/security/config/export', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `security-config-${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      message.success('导出成功');
    } catch (error) {
      console.error('Failed to export config:', error);
      message.error('导出失败');
    }
  };

  const columns: ColumnsType<SecurityConfig> = [
    {
      title: '配置项',
      dataIndex: 'config_key',
      key: 'config_key',
      width: 250,
      fixed: 'left'
    },
    {
      title: '当前值',
      dataIndex: 'config_value',
      key: 'config_value',
      width: 150,
      ellipsis: true
    },
    {
      title: '类型',
      dataIndex: 'config_type',
      key: 'config_type',
      width: 100,
      render: (type: string) => <Tag>{type}</Tag>
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record: SecurityConfig) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            icon={<HistoryOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            历史
          </Button>
        </Space>
      )
    }
  ];

  const historyColumns: ColumnsType<ConfigHistory> = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80
    },
    {
      title: '旧值',
      dataIndex: 'old_value',
      key: 'old_value',
      width: 150,
      ellipsis: true,
      render: (text: string) => text || '-'
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value',
      width: 150,
      ellipsis: true
    },
    {
      title: '修改人',
      dataIndex: 'changed_by_username',
      key: 'changed_by_username',
      width: 120,
      render: (text: string) => text || '-'
    },
    {
      title: '修改原因',
      dataIndex: 'change_reason',
      key: 'change_reason',
      ellipsis: true,
      render: (text: string) => text || '-'
    },
    {
      title: '修改时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>
        <SettingOutlined /> 安全配置管理
        <Space style={{ marginLeft: 16, fontSize: 14, fontWeight: 'normal' }}>
          {isFromCache && !refreshing && (
            <Tooltip title="数据来自缓存">
              <Tag color="gold">缓存</Tag>
            </Tooltip>
          )}
          {refreshing && <Tag icon={<CloudSyncOutlined spin />} color="processing">更新中</Tag>}
        </Space>
      </h1>

      <Card style={{ marginBottom: '24px' }}>
        <Space>
          <Tooltip title="刷新数据">
            <Button icon={<ReloadOutlined spin={refreshing} />} onClick={() => refresh(true)}>
              刷新
            </Button>
          </Tooltip>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出配置
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={configs || []}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title="编辑配置"
        open={editModalVisible}
        onOk={handleUpdate}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedConfig(null);
          form.resetFields();
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="配置项">
            <Input value={selectedConfig?.config_key} disabled />
          </Form.Item>
          <Form.Item
            label="配置值"
            name="config_value"
            rules={[{ required: true, message: '请输入配置值' }]}
          >
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item label="修改原因" name="change_reason">
            <TextArea rows={2} placeholder="可选：说明修改原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`配置历史 - ${selectedConfig?.config_key}`}
        open={historyModalVisible}
        onCancel={() => {
          setHistoryModalVisible(false);
          setSelectedConfig(null);
          setConfigHistory([]);
        }}
        footer={null}
        width={900}
      >
        <Table
          columns={historyColumns}
          dataSource={configHistory}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Modal>
    </div>
  );
};

export default SecurityConfigPage;
