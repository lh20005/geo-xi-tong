import { Modal, Form, Input, message, Space, Button, Tooltip } from 'antd';
import { useEffect } from 'react';
import { 
  ThunderboltOutlined, 
  TrophyOutlined, 
  RocketOutlined,
  CrownOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import type { ArticleSetting, ArticleSettingFormData } from '../types/articleSettings';
import { PROMPT_TEMPLATES, TEMPLATE_DESCRIPTIONS } from '../constants/promptTemplates';

interface ArticleSettingModalProps {
  visible: boolean;
  mode: 'create' | 'edit' | 'view';
  setting: ArticleSetting | null;
  onSubmit: (data: ArticleSettingFormData) => Promise<void>;
  onCancel: () => void;
}

export default function ArticleSettingModal({
  visible,
  mode,
  setting,
  onSubmit,
  onCancel,
}: ArticleSettingModalProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && setting && (mode === 'edit' || mode === 'view')) {
      form.setFieldsValue({
        name: setting.name,
        prompt: setting.prompt,
      });
    } else if (visible && mode === 'create') {
      form.resetFields();
    }
  }, [visible, setting, mode, form]);

  const handleOk = async () => {
    if (mode === 'view') {
      onCancel();
      return;
    }

    try {
      const values = await form.validateFields();
      await onSubmit(values);
      form.resetFields();
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误，不需要显示消息
        return;
      }
      message.error(error.message || '操作失败');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  // 处理模板选择
  const handleTemplateSelect = (templateType: keyof typeof PROMPT_TEMPLATES) => {
    const template = PROMPT_TEMPLATES[templateType];
    form.setFieldsValue({ prompt: template });
    message.success(`已应用${TEMPLATE_DESCRIPTIONS[templateType].name}模板`);
  };

  const getTitle = () => {
    switch (mode) {
      case 'create':
        return '新建文章设置';
      case 'edit':
        return '编辑文章设置';
      case 'view':
        return '查看文章设置';
      default:
        return '文章设置';
    }
  };

  const isReadOnly = mode === 'view';

  return (
    <Modal
      title={getTitle()}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={mode === 'view' ? '关闭' : mode === 'create' ? '创建' : '保存'}
      cancelText="取消"
      cancelButtonProps={{ style: { display: mode === 'view' ? 'none' : 'inline-block' } }}
      width={720}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        disabled={isReadOnly}
      >
        <Form.Item
          label="设置名称"
          name="name"
          rules={[
            { required: true, message: '请输入设置名称' },
            { max: 255, message: '名称不能超过255个字符' },
          ]}
        >
          <Input placeholder="请输入设置名称" maxLength={255} />
        </Form.Item>

        <Form.Item
          label={
            <Space>
              <span>提示词</span>
              {mode !== 'view' && (
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 'normal' }}>
                  （支持占位符：{'{keyword}'}, {'{topics}'}, {'{companyName}'}, {'{knowledgeBase}'}）
                </span>
              )}
            </Space>
          }
          name="prompt"
          rules={[{ required: true, message: '请输入提示词' }]}
          extra={
            mode !== 'view' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 8, color: '#64748b' }}>
                  快速选择模板（点击按钮自动填充）：
                </div>
                <Space wrap>
                  <Tooltip title={TEMPLATE_DESCRIPTIONS.BALANCED.description}>
                    <Button
                      icon={<ThunderboltOutlined />}
                      onClick={() => handleTemplateSelect('BALANCED')}
                      style={{ 
                        borderColor: TEMPLATE_DESCRIPTIONS.BALANCED.color,
                        color: TEMPLATE_DESCRIPTIONS.BALANCED.color 
                      }}
                    >
                      {TEMPLATE_DESCRIPTIONS.BALANCED.icon} {TEMPLATE_DESCRIPTIONS.BALANCED.name}
                    </Button>
                  </Tooltip>
                  <Tooltip title={TEMPLATE_DESCRIPTIONS.PROFESSIONAL.description}>
                    <Button
                      icon={<TrophyOutlined />}
                      onClick={() => handleTemplateSelect('PROFESSIONAL')}
                      style={{ 
                        borderColor: TEMPLATE_DESCRIPTIONS.PROFESSIONAL.color,
                        color: TEMPLATE_DESCRIPTIONS.PROFESSIONAL.color 
                      }}
                    >
                      {TEMPLATE_DESCRIPTIONS.PROFESSIONAL.icon} {TEMPLATE_DESCRIPTIONS.PROFESSIONAL.name}
                    </Button>
                  </Tooltip>
                  <Tooltip title={TEMPLATE_DESCRIPTIONS.MARKETING.description}>
                    <Button
                      icon={<RocketOutlined />}
                      onClick={() => handleTemplateSelect('MARKETING')}
                      style={{ 
                        borderColor: TEMPLATE_DESCRIPTIONS.MARKETING.color,
                        color: TEMPLATE_DESCRIPTIONS.MARKETING.color 
                      }}
                    >
                      {TEMPLATE_DESCRIPTIONS.MARKETING.icon} {TEMPLATE_DESCRIPTIONS.MARKETING.name}
                    </Button>
                  </Tooltip>
                  <Tooltip title={TEMPLATE_DESCRIPTIONS.NATIONAL_RANKING.description}>
                    <Button
                      icon={<CrownOutlined />}
                      onClick={() => handleTemplateSelect('NATIONAL_RANKING')}
                      style={{ 
                        borderColor: TEMPLATE_DESCRIPTIONS.NATIONAL_RANKING.color,
                        color: TEMPLATE_DESCRIPTIONS.NATIONAL_RANKING.color 
                      }}
                    >
                      {TEMPLATE_DESCRIPTIONS.NATIONAL_RANKING.icon} {TEMPLATE_DESCRIPTIONS.NATIONAL_RANKING.name}
                    </Button>
                  </Tooltip>
                  <Tooltip title={TEMPLATE_DESCRIPTIONS.REGIONAL_RANKING.description}>
                    <Button
                      icon={<EnvironmentOutlined />}
                      onClick={() => handleTemplateSelect('REGIONAL_RANKING')}
                      style={{ 
                        borderColor: TEMPLATE_DESCRIPTIONS.REGIONAL_RANKING.color,
                        color: TEMPLATE_DESCRIPTIONS.REGIONAL_RANKING.color 
                      }}
                    >
                      {TEMPLATE_DESCRIPTIONS.REGIONAL_RANKING.icon} {TEMPLATE_DESCRIPTIONS.REGIONAL_RANKING.name}
                    </Button>
                  </Tooltip>
                </Space>
              </div>
            )
          }
        >
          <Input.TextArea
            placeholder="请输入提示词内容，或点击上方按钮选择模板"
            rows={16}
            showCount
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
