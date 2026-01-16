import { useState, useEffect } from 'react';
import { Modal, Form, Select, InputNumber, Input, message, Alert } from 'antd';
import axios from 'axios';
import { config } from '../../config/env';
import { giftSubscription } from '../../api/userSubscriptions';

interface Props {
  visible: boolean;
  userId: number;
  username: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Plan {
  id: number;
  planCode: string;
  planName: string;
  price: number;
  durationDays: number;
}

export default function GiftSubscriptionModal({
  visible,
  userId,
  username,
  onClose,
  onSuccess,
}: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [durationDays, setDurationDays] = useState<number>(30);

  useEffect(() => {
    if (visible) {
      loadPlans();
    }
  }, [visible]);

  const loadPlans = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${config.apiUrl}/admin/products/plans`, {
        params: { include_inactive: false },
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlans(response.data.data);
    } catch (error: any) {
      message.error('加载套餐列表失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await giftSubscription(userId, values.planId, values.durationDays, values.reason);

      message.success('套餐赠送成功');
      form.resetFields();
      onSuccess();
      onClose();
    } catch (error: any) {
      message.error(error.response?.data?.message || '赠送套餐失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = (planId: number) => {
    const plan = plans.find((p) => p.id === planId);
    setSelectedPlan(plan || null);
  };

  const calculateEndDate = (days: number) => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    return endDate.toLocaleDateString('zh-CN');
  };

  return (
    <Modal
      title="赠送套餐"
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      okText="确认赠送"
      cancelText="取消"
      width={600}
    >
      <Alert
        message="赠送说明"
        description={`将为用户 ${username} 免费赠送指定套餐和时长。赠送的订阅将立即生效。`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical" initialValues={{ durationDays: 30 }}>
        <Form.Item
          name="planId"
          label="选择套餐"
          rules={[{ required: true, message: '请选择套餐' }]}
        >
          <Select
            placeholder="请选择要赠送的套餐"
            onChange={handlePlanChange}
            options={plans.map((plan) => ({
              label: `${plan.planName} - ¥${plan.price}`,
              value: plan.id,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="durationDays"
          label="赠送时长（天）"
          rules={[
            { required: true, message: '请输入赠送时长' },
            { type: 'number', min: 1, max: 3650, message: '时长必须在 1-3650 天之间' },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            max={3650}
            placeholder="请输入赠送天数"
            onChange={(value) => setDurationDays(value || 30)}
          />
        </Form.Item>

        {selectedPlan && (
          <Alert
            message="赠送预览"
            description={
              <div>
                <p>套餐名称：{selectedPlan.planName}</p>
                <p>套餐价值：¥{selectedPlan.price}</p>
                <p>赠送时长：{durationDays}天</p>
                <p style={{ fontWeight: 'bold', color: '#52c41a' }}>
                  到期日期：{calculateEndDate(durationDays)}
                </p>
              </div>
            }
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item
          name="reason"
          label="赠送原因"
          rules={[{ required: true, message: '请输入赠送原因' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="请输入赠送原因，如：活动奖励、补偿赠送、测试账号等"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
