import { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, message, Alert } from 'antd';
import axios from 'axios';
import { config } from '../../config/env';
import { upgradePlan } from '../../api/userSubscriptions';

interface Props {
  visible: boolean;
  userId: number;
  currentPlanId: number;
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

export default function UpgradePlanModal({ visible, userId, currentPlanId, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

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

      console.log('[UpgradePlanModal] 获取到的套餐列表:', response.data.data);

      // 显示所有套餐（除了当前套餐），让管理员可以选择任意套餐
      const availablePlans = response.data.data.filter(
        (plan: Plan) => plan.id !== currentPlanId
      );
      
      console.log('[UpgradePlanModal] 可选套餐:', availablePlans);
      setPlans(availablePlans);
    } catch (error: any) {
      console.error('[UpgradePlanModal] 加载套餐列表失败:', error);
      message.error('加载套餐列表失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await upgradePlan(userId, values.newPlanId, values.reason);

      message.success('套餐升级成功');
      form.resetFields();
      onSuccess();
      onClose();
    } catch (error: any) {
      message.error(error.response?.data?.message || '升级套餐失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = (planId: number) => {
    const plan = plans.find((p) => p.id === planId);
    setSelectedPlan(plan || null);
  };

  return (
    <Modal
      title="升级套餐"
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      okText="确认升级"
      cancelText="取消"
      width={600}
    >
      <Alert
        message="升级说明"
        description="升级后将立即生效，用户将获得新套餐的所有功能和配额。原套餐剩余时间将保留并累加到新套餐时长。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="newPlanId"
          label="选择新套餐"
          rules={[{ required: true, message: '请选择新套餐' }]}
        >
          <Select
            placeholder="请选择套餐"
            onChange={handlePlanChange}
            options={plans.map((plan) => ({
              label: `${plan.planName} - ¥${plan.price} / ${plan.durationDays}天`,
              value: plan.id,
            }))}
          />
        </Form.Item>

        {selectedPlan && (
          <Alert
            message="套餐信息"
            description={
              <div>
                <p>套餐名称：{selectedPlan.planName}</p>
                <p>套餐价格：¥{selectedPlan.price}</p>
                <p>套餐时长：{selectedPlan.durationDays}天</p>
              </div>
            }
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item
          name="reason"
          label="升级原因"
          rules={[{ required: true, message: '请输入升级原因' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="请输入升级原因，如：用户申请升级、活动赠送等"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
