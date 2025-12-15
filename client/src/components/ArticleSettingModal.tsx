import { Modal, Form, Input, message } from 'antd';
import { useEffect } from 'react';
import type { ArticleSetting, ArticleSettingFormData } from '../types/articleSettings';

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
          label="提示词"
          name="prompt"
          rules={[{ required: true, message: '请输入提示词' }]}
          extra={mode !== 'view' && '提示词将用于指导AI生成符合要求的文章内容'}
        >
          <Input.TextArea
            placeholder="请输入提示词内容，例如：请以专业的技术写作风格，生成一篇关于...的文章"
            rows={12}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
