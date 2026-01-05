import { useState } from 'react';
import { Modal, Form, Input, Switch, message, Alert } from 'antd';
import {
  ExclamationCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { pauseSubscription, resumeSubscription, cancelSubscription } from '../../api/userSubscriptions';

interface Props {
  visible: boolean;
  userId: number;
  action: 'pause' | 'resume' | 'cancel';
  onClose: () => void;
  onSuccess: () => void;
}

export default function ControlSubscriptionModal({
  visible,
  userId,
  action,
  onClose,
  onSuccess,
}: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [immediate, setImmediate] = useState(false);

  const getConfig = () => {
    switch (action) {
      case 'pause':
        return {
          title: '暂停订阅',
          icon: <PauseCircleOutlined style={{ color: '#faad14' }} />,
          description: '暂停后用户将无法使用订阅功能，但数据会保留。可以随时恢复订阅。',
          okText: '确认暂停',
          danger: false,
        };
      case 'resume':
        return {
          title: '恢复订阅',
          icon: <PlayCircleOutlined style={{ color: '#52c41a' }} />,
          description: '恢复后用户将立即可以使用订阅功能。',
          okText: '确认恢复',
          danger: false,
        };
      case 'cancel':
        return {
          title: '取消订阅',
          icon: <StopOutlined style={{ color: '#ff4d4f' }} />,
          description: '取消订阅后用户将失去所有订阅权益。此操作不可撤销！',
          okText: '确认取消',
          danger: true,
        };
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      switch (action) {
        case 'pause':
          await pauseSubscription(userId, values.reason);
          message.success('订阅已暂停');
          break;
        case 'resume':
          await resumeSubscription(userId, values.reason);
          message.success('订阅已恢复');
          break;
        case 'cancel':
          await cancelSubscription(userId, immediate, values.reason);
          message.success('订阅已取消');
          break;
      }

      form.resetFields();
      onSuccess();
      onClose();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const config = getConfig();

  return (
    <Modal
      title={
        <span>
          {config.icon} {config.title}
        </span>
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      okText={config.okText}
      cancelText="取消"
      okButtonProps={{ danger: config.danger }}
      width={600}
    >
      <Alert
        message={config.danger ? '警告' : '提示'}
        description={config.description}
        type={config.danger ? 'error' : 'info'}
        showIcon
        icon={config.danger ? <ExclamationCircleOutlined /> : undefined}
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        {action === 'cancel' && (
          <Form.Item label="取消方式">
            <Switch
              checked={immediate}
              onChange={setImmediate}
              checkedChildren="立即取消"
              unCheckedChildren="到期后取消"
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              {immediate
                ? '立即取消：用户将立即失去所有订阅权益'
                : '到期后取消：用户可以使用到当前订阅到期'}
            </div>
          </Form.Item>
        )}

        <Form.Item
          name="reason"
          label="操作原因"
          rules={[{ required: true, message: '请输入操作原因' }]}
        >
          <Input.TextArea
            rows={4}
            placeholder={`请输入${config.title}的原因，如：用户申请、违规处理、系统维护等`}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
