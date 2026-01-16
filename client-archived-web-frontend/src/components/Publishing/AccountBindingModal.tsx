import { useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { Platform, createAccount } from '../../api/publishing';

interface AccountBindingModalProps {
  visible: boolean;
  platform: Platform;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AccountBindingModal({
  visible,
  platform,
  onSuccess,
  onCancel
}: AccountBindingModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await createAccount({
        platform_id: platform.platform_id,
        account_name: values.account_name,
        credentials: {
          username: values.username,
          password: values.password
        }
      });

      message.success('账号绑定成功');
      form.resetFields();
      onSuccess();
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.response?.data?.message || '账号绑定失败');
      console.error('账号绑定失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={`绑定${platform.platform_name}账号`}
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={500}
      destroyOnClose
    >
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
          extra="用于区分多个账号，例如：主账号、备用账号等"
        >
          <Input placeholder="请输入账号名称" />
        </Form.Item>

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

        <Form.Item
          label="密码"
          name="password"
          rules={[
            { required: true, message: '请输入密码' },
            { max: 100, message: '密码不能超过100个字符' }
          ]}
        >
          <Input.Password placeholder="请输入密码" />
        </Form.Item>

        <div style={{ 
          padding: '12px', 
          background: '#f0f7ff', 
          borderRadius: 4,
          fontSize: 12,
          color: '#666'
        }}>
          <div style={{ marginBottom: 4 }}>
            <strong>安全提示：</strong>
          </div>
          <div>• 您的账号凭证将使用 AES-256 加密存储</div>
          <div>• 系统仅在发布文章时使用您的凭证</div>
          <div>• 请确保账号密码的安全性</div>
        </div>
      </Form>
    </Modal>
  );
}
