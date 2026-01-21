import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, DatePicker, Select, Button, Space, message } from 'antd';
import { FileTextOutlined, DownloadOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '../api/client';
import type { ColumnsType } from 'antd/es/table';
import { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface AuditLog {
  id: number;
  adminId: number;
  action: string;
  targetType: string | null;
  targetId: number | null;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string | null;
  createdAt: string;
  username?: string;
}

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<{
    action?: string;
    targetType?: string;
    dateRange?: [Dayjs, Dayjs];
  }>({});

  // 数据获取函数
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        pageSize
      };

      if (filters.action) params.action = filters.action;
      if (filters.targetType) params.targetType = filters.targetType;
      if (filters.dateRange) {
        params.startDate = filters.dateRange[0].toISOString();
        params.endDate = filters.dateRange[1].toISOString();
      }

      const response = await apiClient.get('/security/audit-logs', {
        params
      });

      if (response.data.success) {
        setLogs(response.data.logs || []);
        setTotal(response.data.total || 0);
      } else {
        throw new Error(response.data.message || '获取审计日志失败');
      }
    } catch (error: any) {
      message.error(error.message || '获取审计日志失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  // 初始加载和依赖变化时重新加载
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const params: any = { format };

      if (filters.action) params.action = filters.action;
      if (filters.targetType) params.targetType = filters.targetType;
      if (filters.dateRange) {
        params.startDate = filters.dateRange[0].toISOString();
        params.endDate = filters.dateRange[1].toISOString();
      }

      const response = await apiClient.get('/security/audit-logs/export', {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${Date.now()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      message.success('导出成功');
    } catch (error) {
      console.error('Failed to export logs:', error);
      message.error('导出失败');
    }
  };

  const columns: ColumnsType<AuditLog> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 200,
      render: (action: string) => <Tag color="blue">{action}</Tag>
    },
    {
      title: '操作者',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (username: string, record: AuditLog) => username || `ID: ${record.adminId}`
    },
    {
      title: '目标类型',
      dataIndex: 'targetType',
      key: 'targetType',
      width: 100,
      render: (type: string | null) => type ? <Tag>{type}</Tag> : '-'
    },
    {
      title: '目标ID',
      dataIndex: 'targetId',
      key: 'targetId',
      width: 100,
      render: (id: number | null) => id || '-'
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 150
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (details: Record<string, any>) => JSON.stringify(details)
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>
        <FileTextOutlined /> 审计日志
        <Space style={{ marginLeft: 16, fontSize: 14, fontWeight: 'normal' }}>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined spin={loading} />}
            onClick={fetchLogs}
          />
        </Space>
      </h1>

      <Card style={{ marginBottom: '24px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space wrap>
            <Select
              placeholder="操作类型"
              style={{ width: 200 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, action: value })}
            >
              <Option value="CREATE_USER">创建用户</Option>
              <Option value="UPDATE_USER">更新用户</Option>
              <Option value="DELETE_USER">删除用户</Option>
              <Option value="LOGIN_FAILED">登录失败</Option>
              <Option value="GRANT_PERMISSION">授予权限</Option>
              <Option value="REVOKE_PERMISSION">撤销权限</Option>
              <Option value="UPDATE_SECURITY_CONFIG">更新安全配置</Option>
            </Select>

            <Select
              placeholder="目标类型"
              style={{ width: 150 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, targetType: value })}
            >
              <Option value="user">用户</Option>
              <Option value="config">配置</Option>
              <Option value="system">系统</Option>
            </Select>

            <RangePicker
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setFilters({ ...filters, dateRange: [dates[0], dates[1]] });
                } else {
                  const { dateRange, ...rest } = filters;
                  setFilters(rest);
                }
              }}
            />

            <Button icon={<SearchOutlined />} type="primary" onClick={fetchLogs}>
              查询
            </Button>
          </Space>

          <Space>
            <Button icon={<DownloadOutlined />} onClick={() => handleExport('json')}>
              导出JSON
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => handleExport('csv')}>
              导出CSV
            </Button>
          </Space>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            }
          }}
        />
      </Card>
    </div>
  );
};

export default AuditLogsPage;
