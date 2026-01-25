import { useState, useEffect } from 'react';
import { Input, Button, Tag, Modal, Form, Select, Space, Card, Badge, App } from 'antd';
import { SearchOutlined, EditOutlined, DeleteOutlined, KeyOutlined, UserOutlined, CrownOutlined } from '@ant-design/icons';
import axios from 'axios';
import { config } from '../config/env';
import { getUserWebSocketService } from '../services/UserWebSocketService';
import ResizableTable from '../components/ResizableTable';
import SubscriptionDetailDrawer from '../components/UserSubscription/SubscriptionDetailDrawer';

const { Search } = Input;

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  invitationCode: string;
  invitedCount: number;
  createdAt: string;
  lastLoginAt?: string;
  isTempPassword?: boolean;
  subscriptionPlanName?: string;
  isOnline?: boolean;
  isAgent?: boolean;
}

interface SubscriptionPlan {
  plan_code: string;
  plan_name: string;
}

export default function UserManagementPage() {
  const { message, modal } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>(''); // 新增：订阅套餐筛选
  const [onlineFilter, setOnlineFilter] = useState<string>(''); // 新增：在线状态筛选
  const [roleFilter, setRoleFilter] = useState<string>(''); // 新增：角色筛选
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [form] = Form.useForm();

  // 订阅管理抽屉
  const [subscriptionDrawerVisible, setSubscriptionDrawerVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUsername, setSelectedUsername] = useState('');

  // 套餐列表
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  // 获取套餐颜色
  const getPlanColor = (planName?: string) => {
    if (!planName || planName === '无订阅') return 'default';
    // 根据套餐名称动态分配颜色
    const colors = ['cyan', 'green', 'gold', 'purple', 'blue', 'magenta'];
    const index = plans.findIndex(p => p.plan_name === planName);
    return index >= 0 ? colors[index % colors.length] : 'purple';
  };

  // 加载套餐列表
  const loadPlans = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${config.apiUrl}/subscription/plans`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setPlans(response.data.data);
      }
    } catch (error) {
      console.error('[UserManagement] Load plans error:', error);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [page, search, subscriptionFilter, onlineFilter, roleFilter]); // 添加 roleFilter 依赖

  useEffect(() => {
    // 连接 WebSocket
    const wsService = getUserWebSocketService();
    wsService.connect().catch((error) => {
      console.error('[UserManagement] WebSocket connection failed:', error);
    });

    // 订阅用户更新和删除事件
    const handleUserUpdated = () => {
      console.log('[UserManagement] User updated, refreshing list');
      loadUsers();
    };

    const handleUserDeleted = () => {
      console.log('[UserManagement] User deleted, refreshing list');
      loadUsers();
    };

    wsService.on('user:updated', handleUserUpdated);
    wsService.on('user:deleted', handleUserDeleted);

    // 清理
    return () => {
      wsService.off('user:updated', handleUserUpdated);
      wsService.off('user:deleted', handleUserDeleted);
    };
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${config.apiUrl}/admin/users`, {
        params: { 
          page, 
          pageSize, 
          search: search || undefined,
          subscriptionPlan: subscriptionFilter || undefined, // 添加套餐筛选参数
          onlineStatus: onlineFilter || undefined, // 添加在线状态筛选参数
          roleFilter: roleFilter || undefined // 添加角色筛选参数
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setUsers(response.data.data.users);
        setTotal(response.data.data.total);
      }
    } catch (error: any) {
      console.error('[UserManagement] Load users error:', error);
      message.error(error.response?.data?.message || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    form.setFieldsValue({
      username: user.username,
      role: user.role
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('auth_token');
      
      // 先获取确认令牌
      const confirmResponse = await axios.post(
        `${config.apiUrl}/confirm/initiate`,
        { action: 'update-user', data: { userId: selectedUser?.id } },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!confirmResponse.data.success) {
        message.error('获取确认令牌失败');
        return;
      }

      const confirmationToken = confirmResponse.data.data.token;
      
      const response = await axios.put(
        `${config.apiUrl}/admin/users/${selectedUser?.id}`,
        values,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'X-Confirmation-Token': confirmationToken
          } 
        }
      );

      if (response.data.success) {
        message.success('用户信息更新成功');
        setEditModalVisible(false);
        loadUsers();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新用户信息失败');
    }
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setTempPassword('');
    setResetPasswordModalVisible(true);
  };

  const confirmResetPassword = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      // 先获取确认令牌
      const confirmResponse = await axios.post(
        `${config.apiUrl}/confirm/initiate`,
        { action: 'reset-password', data: { userId: selectedUser?.id } },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!confirmResponse.data.success) {
        message.error('获取确认令牌失败');
        return;
      }

      const confirmationToken = confirmResponse.data.data.token;
      
      const response = await axios.post(
        `${config.apiUrl}/admin/users/${selectedUser?.id}/reset-password`,
        {},
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'X-Confirmation-Token': confirmationToken
          } 
        }
      );

      if (response.data.success) {
        setTempPassword(response.data.data.temporaryPassword);
        message.success('密码重置成功');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '重置密码失败');
    }
  };

  const handleDelete = (user: User) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除用户 "${user.username}" 吗？此操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const token = localStorage.getItem('auth_token');
          
          // 先获取确认令牌
          const confirmResponse = await axios.post(
            `${config.apiUrl}/confirm/initiate`,
            { action: 'delete-user', data: { userId: user.id } },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (!confirmResponse.data.success) {
            message.error('获取确认令牌失败');
            return;
          }

          const confirmationToken = confirmResponse.data.data.token;
          
          const response = await axios.delete(
            `${config.apiUrl}/admin/users/${user.id}`,
            { 
              headers: { 
                Authorization: `Bearer ${token}`,
                'X-Confirmation-Token': confirmationToken
              } 
            }
          );

          if (response.data.success) {
            message.success('用户删除成功');
            loadUsers();
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || '删除用户失败');
        }
      }
    });
  };

  const handleManageSubscription = (user: User) => {
    setSelectedUserId(user.id);
    setSelectedUsername(user.username);
    setSubscriptionDrawerVisible(true);
  };

  const copyTempPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    message.success('临时密码已复制到剪贴板');
  };

  const columns = [
    {
      title: '用户ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: User) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
          {record.isTempPassword && (
            <Tag color="warning" style={{ fontSize: 10 }}>临时密码</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '订阅套餐',
      dataIndex: 'subscriptionPlanName',
      key: 'subscriptionPlanName',
      width: 120,
      render: (planName: string) => (
        <Tag color={getPlanColor(planName)}>
          {planName || '无订阅'}
        </Tag>
      ),
    },
    {
      title: '在线状态',
      dataIndex: 'isOnline',
      key: 'isOnline',
      width: 100,
      render: (isOnline: boolean) => (
        <Badge 
          status={isOnline ? 'success' : 'default'} 
          text={isOnline ? '在线' : '离线'} 
        />
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (_: string, record: User) => {
        // 系统管理员优先显示
        if (record.role === 'admin') {
          return <Tag color="purple">管理员</Tag>;
        }
        // 代理商显示
        if (record.isAgent) {
          return <Tag color="orange">代理商</Tag>;
        }
        // 普通用户
        return <Tag color="blue">普通用户</Tag>;
      },
    },
    {
      title: '邀请码',
      dataIndex: 'invitationCode',
      key: 'invitationCode',
      width: 120,
      render: (code: string) => <code style={{ fontSize: 12 }}>{code}</code>,
    },
    {
      title: '邀请人数',
      dataIndex: 'invitedCount',
      key: 'invitedCount',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: User) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CrownOutlined />}
            onClick={() => handleManageSubscription(record)}
          >
            订阅管理
          </Button>
          <Button
            type="link"
            size="small"
            icon={<KeyOutlined />}
            onClick={() => handleResetPassword(record)}
          >
            重置密码
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>用户管理</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>管理系统中的所有用户</p>
          
          <Space size="middle" style={{ marginBottom: 16, width: '100%', flexWrap: 'wrap' }}>
            <Search
              placeholder="搜索用户名..."
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              onSearch={setSearch}
              style={{ width: 300 }}
            />
            
            <Select
              placeholder="筛选订阅套餐"
              allowClear
              size="large"
              style={{ width: 200 }}
              onChange={(value) => {
                setSubscriptionFilter(value || '');
                setPage(1); // 重置到第一页
              }}
              value={subscriptionFilter || undefined}
            >
              <Select.Option value="">全部套餐</Select.Option>
              {plans.map((plan, index) => (
                <Select.Option key={plan.plan_code} value={plan.plan_name}>
                  <Tag color={['cyan', 'green', 'gold', 'purple', 'blue', 'magenta'][index % 6]}>{plan.plan_name}</Tag>
                </Select.Option>
              ))}
              <Select.Option value="无订阅">
                <Tag color="default">无订阅</Tag>
              </Select.Option>
            </Select>

            <Select
              placeholder="筛选在线状态"
              allowClear
              size="large"
              style={{ width: 160 }}
              onChange={(value) => {
                setOnlineFilter(value || '');
                setPage(1); // 重置到第一页
              }}
              value={onlineFilter || undefined}
            >
              <Select.Option value="">全部状态</Select.Option>
              <Select.Option value="online">
                <Badge status="success" text="在线" />
              </Select.Option>
              <Select.Option value="offline">
                <Badge status="default" text="离线" />
              </Select.Option>
            </Select>

            <Select
              placeholder="筛选角色"
              allowClear
              size="large"
              style={{ width: 160 }}
              onChange={(value) => {
                setRoleFilter(value || '');
                setPage(1); // 重置到第一页
              }}
              value={roleFilter || undefined}
            >
              <Select.Option value="">全部角色</Select.Option>
              <Select.Option value="admin">
                <Tag color="purple">管理员</Tag>
              </Select.Option>
              <Select.Option value="agent">
                <Tag color="orange">代理商</Tag>
              </Select.Option>
              <Select.Option value="user">
                <Tag color="blue">普通用户</Tag>
              </Select.Option>
            </Select>
          </Space>
        </div>

        <ResizableTable<User>
          tableId="user-management"
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 个用户`,
          }}
        />
      </Card>

      {/* 编辑用户模态框 */}
      <Modal
        title="编辑用户信息"
        open={editModalVisible}
        onOk={handleUpdate}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select>
              <Select.Option value="user">普通用户</Select.Option>
              <Select.Option value="admin">管理员</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码模态框 */}
      <Modal
        title="重置密码"
        open={resetPasswordModalVisible}
        onCancel={() => setResetPasswordModalVisible(false)}
        footer={
          tempPassword ? (
            <Button type="primary" onClick={() => setResetPasswordModalVisible(false)}>
              关闭
            </Button>
          ) : (
            <>
              <Button onClick={() => setResetPasswordModalVisible(false)}>取消</Button>
              <Button type="primary" onClick={confirmResetPassword}>
                确认重置
              </Button>
            </>
          )
        }
      >
        {tempPassword ? (
          <div>
            <p style={{ marginBottom: 12 }}>临时密码已生成：</p>
            <Input.Group compact>
              <Input
                value={tempPassword}
                readOnly
                style={{ width: 'calc(100% - 80px)' }}
              />
              <Button type="primary" onClick={copyTempPassword}>
                复制
              </Button>
            </Input.Group>
            <p style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
              请将此密码发送给用户，用户下次登录时需要修改密码
            </p>
          </div>
        ) : (
          <p>
            确定要重置用户 <strong>{selectedUser?.username}</strong> 的密码吗？
            系统将生成一个临时密码，用户下次登录时需要修改密码。
          </p>
        )}
      </Modal>

      {/* 订阅管理抽屉 */}
      <SubscriptionDetailDrawer
        visible={subscriptionDrawerVisible}
        userId={selectedUserId}
        username={selectedUsername}
        onClose={() => {
          setSubscriptionDrawerVisible(false);
          setSelectedUserId(null);
          setSelectedUsername('');
        }}
        onSubscriptionChange={loadUsers}
      />
    </div>
  );
}
