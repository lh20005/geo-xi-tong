import React, { useState, useCallback, useMemo } from 'react';
import { Card, Table, Button, Modal, Select, message, Space, Tag, Popconfirm, Tooltip } from 'antd';
import { SafetyOutlined, PlusOutlined, DeleteOutlined, CloudSyncOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '../api/client';
import type { ColumnsType } from 'antd/es/table';
import { useCachedData } from '../hooks/useCachedData';
import { useCacheStore } from '../stores/cacheStore';

const { Option } = Select;

interface Permission {
  id: number;
  name: string;
  description: string;
  category: string;
}

interface User {
  id: number;
  username: string;
  role: string;
}

// 类型别名用于 permissionsByCategory
type PermissionsByCategory = Record<string, Permission[]>;

interface UserPermission {
  id: number;
  user_id: number;
  permission_id: number;
  granted_by: number | null;
  granted_at: string;
  permission_name: string;
  permission_description: string;
  username?: string;
}

const PermissionsPage: React.FC = () => {
  const { invalidateCacheByPrefix } = useCacheStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<string | null>(null);

  // 数据获取函数
  const fetchData = useCallback(async () => {
    const [permsRes, usersRes, userPermsRes] = await Promise.all([
      apiClient.get('/security/permissions'),
      apiClient.get('/admin/users?page=1&pageSize=1000'),
      apiClient.get('/security/user-permissions')
    ]);

    const permissions = permsRes.data.success ? (permsRes.data.data || []) : (permsRes.data || []);
    const users = usersRes.data?.data?.users || [];
    const userPermissions = userPermsRes.data || [];

    return { permissions, users, userPermissions };
  }, []);

  // 使用缓存 Hook
  const {
    data,
    loading,
    refreshing,
    refresh,
    isFromCache
  } = useCachedData('permissions:all', fetchData, {
    onError: (error) => message.error(error.message || '获取数据失败'),
  });

  const permissions = data?.permissions || [];
  const users = data?.users || [];
  const userPermissions = data?.userPermissions || [];

  // 使缓存失效并刷新
  const invalidateAndRefresh = useCallback(async () => {
    invalidateCacheByPrefix('permissions:');
    await refresh(true);
  }, [invalidateCacheByPrefix, refresh]);

  // 按类别分组权限
  const permissionsByCategory = useMemo((): PermissionsByCategory => {
    return permissions.reduce((acc: PermissionsByCategory, perm: Permission) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {} as PermissionsByCategory);
  }, [permissions]);

  const handleGrantPermission = async () => {
    if (!selectedUser || !selectedPermission) {
      message.warning('请选择用户和权限');
      return;
    }

    try {
      const response = await apiClient.post(
        '/security/permissions/grant',
        {
          userId: selectedUser,
          permissionName: selectedPermission
        }
      );

      if (response.data.success) {
        message.success(response.data.message || '权限授予成功');
        setModalVisible(false);
        setSelectedUser(null);
        setSelectedPermission(null);
        invalidateAndRefresh();
      } else {
        message.error(response.data.message || '授予权限失败');
      }
    } catch (error: any) {
      console.error('Failed to grant permission:', error);
      message.error(error.response?.data?.message || '授予权限失败');
    }
  };

  const handleRevokePermission = async (userId: number, permissionName: string) => {
    try {
      const response = await apiClient.post(
        '/security/permissions/revoke',
        {
          userId,
          permissionName
        }
      );

      if (response.data.success) {
        message.success(response.data.message || '权限撤销成功');
        invalidateAndRefresh();
      } else {
        message.error(response.data.message || '撤销权限失败');
      }
    } catch (error: any) {
      console.error('Failed to revoke permission:', error);
      message.error(error.response?.data?.message || '撤销权限失败');
    }
  };

  const columns: ColumnsType<UserPermission> = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 150,
      render: (username: string, record: UserPermission) => username || `ID: ${record.user_id}`
    },
    {
      title: '权限',
      dataIndex: 'permission_name',
      key: 'permission_name',
      width: 200,
      render: (name: string) => <Tag color="blue">{name}</Tag>
    },
    {
      title: '描述',
      dataIndex: 'permission_description',
      key: 'permission_description',
      ellipsis: true
    },
    {
      title: '授予时间',
      dataIndex: 'granted_at',
      key: 'granted_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record: UserPermission) => (
        <Popconfirm
          title="确定要撤销此权限吗？"
          onConfirm={() => handleRevokePermission(record.user_id, record.permission_name)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            撤销
          </Button>
        </Popconfirm>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>
        <SafetyOutlined /> 权限管理
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
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            授予权限
          </Button>
        </Space>
      </Card>

      <Card title="用户权限列表">
        <Table
          columns={columns}
          dataSource={userPermissions}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="授予权限"
        open={modalVisible}
        onOk={handleGrantPermission}
        onCancel={() => {
          setModalVisible(false);
          setSelectedUser(null);
          setSelectedPermission(null);
        }}
        okText="授予"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <label>选择用户：</label>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="请选择用户"
              value={selectedUser}
              onChange={setSelectedUser}
            >
              {users.map((user: User) => (
                <Option key={user.id} value={user.id}>
                  {user.username} ({user.role})
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <label>选择权限：</label>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="请选择权限"
              value={selectedPermission}
              onChange={setSelectedPermission}
            >
              {Object.entries(permissionsByCategory).map(([category, perms]: [string, Permission[]]) => (
                <Select.OptGroup key={category} label={category}>
                  {perms.map((perm: Permission) => (
                    <Option key={perm.name} value={perm.name}>
                      {perm.name} - {perm.description}
                    </Option>
                  ))}
                </Select.OptGroup>
              ))}
            </Select>
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default PermissionsPage;
