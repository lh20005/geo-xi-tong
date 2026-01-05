import { useState } from 'react';
import { Modal, Form, Select, InputNumber, Input, Switch, message, Alert, Space } from 'antd';
import { adjustQuota, resetQuota, SubscriptionFeature } from '../../api/userSubscriptions';

interface Props {
  visible: boolean;
  userId: number;
  features: SubscriptionFeature[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdjustQuotaModal({ visible, userId, features, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<'adjust' | 'reset'>('adjust');
  const [selectedFeature, setSelectedFeature] = useState<SubscriptionFeature | null>(null);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (actionType === 'reset') {
        await resetQuota(userId, values.featureCode, values.reason);
        message.success('配额重置成功');
      } else {
        await adjustQuota(
          userId,
          values.featureCode,
          values.newValue,
          values.isPermanent || false,
          values.reason
        );
        message.success('配额调整成功');
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

  const handleFeatureChange = (featureCode: string) => {
    const feature = features.find((f) => f.feature_code === featureCode);
    setSelectedFeature(feature || null);
  };

  return (
    <Modal
      title="配额管理"
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      okText="确认"
      cancelText="取消"
      width={600}
    >
      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        <Alert
          message="配额调整说明"
          description="可以临时或永久调整用户的功能配额，也可以重置当前周期的使用量。"
          type="info"
          showIcon
        />
      </Space>

      <Form form={form} layout="vertical" initialValues={{ isPermanent: false }}>
        <Form.Item label="操作类型">
          <Select
            value={actionType}
            onChange={setActionType}
            options={[
              { label: '调整配额', value: 'adjust' },
              { label: '重置使用量', value: 'reset' },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="featureCode"
          label="选择功能"
          rules={[{ required: true, message: '请选择功能' }]}
        >
          <Select
            placeholder="请选择要调整的功能"
            onChange={handleFeatureChange}
            options={features.map((feature) => {
              // 格式化显示值，存储空间使用 MB 单位
              const formatValue = (value: number, featureCode: string) => {
                if (value === -1) return '无限制';
                if (featureCode === 'storage_space') {
                  // 存储空间显示为 MB
                  return value >= 1024 ? `${(value / 1024).toFixed(1)} GB` : `${value} MB`;
                }
                return value.toString();
              };

              return {
                label: `${feature.feature_name} (当前: ${formatValue(feature.feature_value, feature.feature_code)}, 已用: ${formatValue(feature.current_usage, feature.feature_code)})`,
                value: feature.feature_code,
              };
            })}
          />
        </Form.Item>

        {selectedFeature && (
          <Alert
            message="当前配额信息"
            description={
              <div>
                <p>功能名称：{selectedFeature.feature_name}</p>
                <p>
                  配额限制：
                  {selectedFeature.feature_value === -1 
                    ? '无限制' 
                    : selectedFeature.feature_code === 'storage_space'
                      ? (selectedFeature.feature_value >= 1024 
                          ? `${(selectedFeature.feature_value / 1024).toFixed(1)} GB` 
                          : `${selectedFeature.feature_value} MB`)
                      : selectedFeature.feature_value}
                </p>
                <p>
                  当前使用：
                  {selectedFeature.feature_code === 'storage_space'
                    ? (selectedFeature.current_usage >= 1024 
                        ? `${(selectedFeature.current_usage / 1024).toFixed(1)} GB` 
                        : `${selectedFeature.current_usage} MB`)
                    : selectedFeature.current_usage}
                </p>
                <p>使用率：{selectedFeature.usage_percentage.toFixed(2)}%</p>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {actionType === 'adjust' && (
          <>
            <Form.Item
              name="newValue"
              label={
                selectedFeature?.feature_code === 'storage_space' 
                  ? '新配额值 (MB)' 
                  : '新配额值'
              }
              rules={[
                { required: true, message: '请输入新配额值' },
                { type: 'number', min: -1, message: '配额值必须大于等于 -1' },
              ]}
              extra={
                selectedFeature?.feature_code === 'storage_space'
                  ? '-1 表示无限制，单位为 MB（1024 MB = 1 GB）'
                  : '-1 表示无限制'
              }
            >
              <InputNumber
                style={{ width: '100%' }}
                min={-1}
                placeholder={
                  selectedFeature?.feature_code === 'storage_space'
                    ? '请输入新配额值（MB）'
                    : '请输入新配额值'
                }
                addonAfter={selectedFeature?.feature_code === 'storage_space' ? 'MB' : undefined}
              />
            </Form.Item>

            <Form.Item name="isPermanent" label="是否永久生效" valuePropName="checked">
              <Switch
                checkedChildren="永久"
                unCheckedChildren="临时"
              />
            </Form.Item>
          </>
        )}

        <Form.Item
          name="reason"
          label={actionType === 'adjust' ? '调整原因' : '重置原因'}
          rules={[{ required: true, message: '请输入原因' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder={
              actionType === 'adjust'
                ? '请输入调整原因，如：用户申请、特殊需求等'
                : '请输入重置原因，如：误操作、测试需要等'
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
