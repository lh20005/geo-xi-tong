import { useState } from 'react';
import { Modal, List, Button, Space, Popconfirm, message, Tag, Form, Input } from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  StarOutlined, 
  StarFilled,
  PlusOutlined 
} from '@ant-design/icons';
import { 
  Platform, 
  Account, 
  deleteAccount, 
  setDefaultAccount,
  createAccount,
  updateAccount
} from '../../api/publishing';

interface AccountManagementModalProps {
  visible: boolean;
  platform: Platform;
  accounts: Account[];
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AccountManagementModal({
  visible,
  platform,
  accounts,
  onSuccess,
  onCancel
}: AccountManagementModalProps) {
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [addingAccount, setAddingAccount] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleDelete = async (accountId: number) => {
    try {
      console.log('[删除账号] 开始删除账号:', accountId);
      await deleteAccount(accountId);
      console.log('[删除账号] 删除成功，显示成功提示');
      message.success('账号删除成功');
      console.log('[删除账号] 调用 onSuccess 回调');
      onSuccess();
    } catch (error: any) {
      console.error('[删除账号] 删除失败:', error);
      const errorMessage = error?.message || '账号删除失败';
      message.error(errorMessage);
    }
  };

  const handleSetDefault = async (accountId: number) => {
    try {
      await setDefaultAccount(accountId, platform.platform_id);
      message.success('默认账号设置成功');
      onSuccess();
    } catch (error) {
      message.error('设置默认账号失败');
      console.error('设置默认账号失败:', error);
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    form.setFieldsValue({
      account_name: account.account_name
    });
  };

  const handleAdd = () => {
    setAddingAccount(true);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (editingAccount) {
        // 更新账号
        await updateAccount(editingAccount.id, {
          account_name: values.account_name,
          ...(values.password ? {
            credentials: {
              username: values.username || editingAccount.credentials?.username,
              password: values.password
            }
          } : {})
        });
        message.success('账号更新成功');
      } else {
        // 添加新账号
        await createAccount({
          platform_id: platform.platform_id,
          account_name: values.account_name,
          credentials: {
            username: values.username,
            password: values.password
          }
        });
        message.success('账号添加成功');
      }

      form.resetFields();
      setEditingAccount(null);
      setAddingAccount(false);
      onSuccess();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.response?.data?.message || '操作失败');
      console.error('操作失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingAccount(null);
    setAddingAccount(false);
    form.resetFields();
  };



  return (
    <Modal
      title={`管理${platform.platform_name}账号`}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={700}
      destroyOnClose
    >
      {!editingAccount && !addingAccount && (
        <>
          <div style={{ marginBottom: 16 }}>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              添加账号
            </Button>
          </div>

          <List
            dataSource={accounts}
            renderItem={(account) => (
              <List.Item
                actions={[
                  <Button
                    type="text"
                    icon={account.is_default ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                    onClick={() => !account.is_default && handleSetDefault(account.id)}
                    disabled={account.is_default}
                  >
                    {account.is_default ? '默认' : '设为默认'}
                  </Button>,
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(account)}
                  >
                    编辑
                  </Button>,
                  <Popconfirm
                    title="确定要删除这个账号吗？"
                    description="删除后将无法恢复"
                    onConfirm={() => handleDelete(account.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{account.account_name}</span>
                      {account.real_username && (
                        <Tag color="blue" style={{ fontSize: '12px' }}>
                          真实用户名: {account.real_username}
                        </Tag>
                      )}
                      {account.is_default && <Tag color="gold">默认</Tag>}
                      <Tag color={account.status === 'active' ? 'green' : 'default'}>
                        {account.status === 'active' ? '正常' : '未激活'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      {account.real_username && (
                        <div style={{ color: '#1890ff', marginBottom: 4 }}>
                          平台账号：{account.real_username}
                        </div>
                      )}
                      <div>创建时间：{new Date(account.created_at).toLocaleString()}</div>
                      {account.last_used_at && (
                        <div>最后使用：{new Date(account.last_used_at).toLocaleString()}</div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}

      {(editingAccount || addingAccount) && (
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            label="账号名称"
            name="account_name"
            rules={[
              { required: true, message: '请输入账号名称' },
              { max: 50, message: '账号名称不能超过50个字符' }
            ]}
          >
            <Input placeholder="请输入账号名称" />
          </Form.Item>

          {addingAccount && (
            <Form.Item
              label="用户名"
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { max: 50, message: '用户名不能超过50个字符' }
              ]}
            >
              <Input placeholder="请输入用户名" />
            </Form.Item>
          )}

          <Form.Item
            label={editingAccount ? "新密码（留空则不修改）" : "密码"}
            name="password"
            rules={addingAccount ? [
              { required: true, message: '请输入密码' },
              { max: 100, message: '密码不能超过100个字符' }
            ] : [
              { max: 100, message: '密码不能超过100个字符' }
            ]}
          >
            <Input.Password placeholder={editingAccount ? "留空则不修改密码" : "请输入密码"} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSubmit} loading={loading}>
                {editingAccount ? '保存' : '添加'}
              </Button>
              <Button onClick={handleCancelEdit}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
