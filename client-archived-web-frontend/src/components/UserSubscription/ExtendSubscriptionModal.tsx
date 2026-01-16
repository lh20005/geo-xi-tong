import { useState } from 'react';
import { Modal, Form, InputNumber, Input, message, Alert } from 'antd';
import { extendSubscription } from '../../api/userSubscriptions';

interface Props {
  visible: boolean;
  userId: number;
  currentEndDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ExtendSubscriptionModal({
  visible,
  userId,
  currentEndDate,
  onClose,
  onSuccess,
}: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [daysToAdd, setDaysToAdd] = useState<number>(30);

  const calculateNewEndDate = (days: number) => {
    const current = new Date(currentEndDate);
    const newDate = new Date(current);
    newDate.setDate(newDate.getDate() + days);
    return newDate.toLocaleDateString('zh-CN');
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await extendSubscription(userId, values.daysToAdd, values.reason);

      message.success('订阅延期成功');
      form.resetFields();
      onSuccess();
      onClose();
    } catch (error: any) {
      message.error(error.response?.data?.message || '延期订阅失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="延期订阅"
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      okText="确认延期"
      cancelText="取消"
      width={600}
    >
      <Alert
        message="延期说明"
        description="延期将在当前到期日期基础上增加指定天数，不影响当前套餐配置。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical" initialValues={{ daysToAdd: 30 }}>
        <Form.Item
          name="daysToAdd"
          label="延长天数"
          rules={[
            { required: true, message: '请输入延长天数' },
            { type: 'number', min: 1, max: 3650, message: '天数必须在 1-3650 之间' },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            max={3650}
            placeholder="请输入延长天数"
            onChange={(value) => setDaysToAdd(value || 30)}
          />
        </Form.Item>

        <Alert
          message="延期预览"
          description={
            <div>
              <p>当前到期日期：{new Date(currentEndDate).toLocaleDateString('zh-CN')}</p>
              <p>延长天数：{daysToAdd}天</p>
              <p style={{ fontWeight: 'bold', color: '#52c41a' }}>
                新到期日期：{calculateNewEndDate(daysToAdd)}
              </p>
            </div>
          }
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item
          name="reason"
          label="延期原因"
          rules={[{ required: true, message: '请输入延期原因' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="请输入延期原因，如：用户申请、补偿延期、活动赠送等"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
