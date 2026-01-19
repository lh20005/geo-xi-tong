import { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Tabs, message, Spin } from 'antd';
import { SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import DOMPurify from 'dompurify';
import 'react-quill/dist/quill.snow.css';
import ArticleContent from './ArticleContent';
import { apiClient } from '../api/client';
import { isElectron, localArticleApi } from '../api';
import { logArticleFormat } from '../utils/debugArticleFormat';

const { TabPane } = Tabs;

interface ArticleEditorModalProps {
  visible: boolean;
  article: any | null;
  onClose: () => void;
  onSave: () => void;
}

// Quill编辑器配置
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    [{ 'font': [] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'align': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link', 'image'],
    ['clean']
  ]
};

const quillFormats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'align',
  'list', 'bullet',
  'link', 'image'
];

const formatContentLocally = (raw: string) => {
  const text = raw.trim();
  if (!text) return '';

  const hasHtmlTags = /<[^>]+>/.test(text);
  if (hasHtmlTags) return text;

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return text;
  }

  return paragraphs.map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
};

export default function ArticleEditorModal({ visible, article, onClose, onSave }: ArticleEditorModalProps) {
  const [form] = Form.useForm();
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState('edit');
  const [saving, setSaving] = useState(false);
  const [formatting, setFormatting] = useState(false);

  useEffect(() => {
    if (article) {
      // 调试：输出文章格式信息
      logArticleFormat(article);
      
      form.setFieldsValue({
        title: article.title || '',
      });
      
      // 处理文章内容：保持原有格式，确保图片显示
      let processedContent = article.content || '';
      
      if (processedContent.trim().length === 0) {
        setContent('');
        return;
      }
      
      // 检查内容是否已经包含图片标签
      const hasImageTag = /<img[^>]*>/i.test(processedContent);
      
      // 检查内容是否已经是HTML格式（包含HTML标签）
      const hasHtmlTags = /<[^>]+>/.test(processedContent);
      
      if (!hasHtmlTags) {
        // 纯文本内容：按双换行符分割段落（保留原有段落结构）
        const paragraphs = processedContent
          .split(/\n\n+/)  // 按双换行符分割
          .map((p: string) => p.trim())
          .filter((p: string) => p.length > 0);
        
        if (paragraphs.length === 0) {
          // 如果没有双换行符，按单换行符分割
          const singleParagraphs = processedContent
            .split('\n')
            .map((p: string) => p.trim())
            .filter((p: string) => p.length > 0);
          
          processedContent = singleParagraphs.map((p: string) => `<p>${p}</p>`).join('');
        } else {
          // 将每个段落转换为HTML，保留段落内的换行为<br>
          processedContent = paragraphs.map((p: string) => {
            const lines = p.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            return `<p>${lines.join('<br>')}</p>`;
          }).join('');
        }
      }
      
      // 如果有图片URL但内容中没有图片标签，在第一段后插入图片
      if (article.imageUrl && !hasImageTag) {
        const firstParagraphEnd = processedContent.indexOf('</p>');
        if (firstParagraphEnd !== -1) {
          const imageTag = `<p><img src="${article.imageUrl}" alt="article image" style="max-width: 100%; height: auto; display: block; margin: 20px 0;" /></p>`;
          processedContent = 
            processedContent.substring(0, firstParagraphEnd + 4) + 
            imageTag + 
            processedContent.substring(firstParagraphEnd + 4);
        } else {
          // 如果没有段落标签，在开头插入
          const imageTag = `<p><img src="${article.imageUrl}" alt="article image" style="max-width: 100%; height: auto; display: block; margin: 20px 0;" /></p>`;
          processedContent = imageTag + processedContent;
        }
      }
      
      setContent(processedContent);
    }
  }, [article, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // 验证内容
      if (!content || content.trim().length === 0) {
        message.error('文章内容不能为空');
        return;
      }

      setSaving(true);

      // 使用DOMPurify清理HTML内容
      const cleanContent = DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img', 'span', 'div'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class', 'width', 'height']
      });

      const result = await localArticleApi.update(article.id, {
        title: values.title,
        content: cleanContent,
        imageUrl: article.imageUrl
      });

      if (!result.success) {
        throw new Error(result.error || '保存失败');
      }

      message.success('文章保存成功');
      onSave();
      onClose();
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请填写所有必填字段');
      } else {
        message.error(error.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSmartFormat = async () => {
    try {
      if (!content || content.trim().length === 0) {
        message.error('请先输入文章内容');
        return;
      }

      setFormatting(true);
      message.loading({ content: '正在智能排版...', key: 'formatting', duration: 0 });

      if (isElectron()) {
        const formatted = formatContentLocally(content);
        setContent(formatted);
        message.success({ content: '智能排版完成', key: 'formatting' });
        return;
      }

      const response = await apiClient.post(`/articles/${article.id}/smart-format`, {
        content: content,
        imageUrl: article.imageUrl
      });

      setContent(response.data.content);
      message.success({ content: '智能排版完成', key: 'formatting' });
    } catch (error: any) {
      message.error({ content: error.message || '智能排版失败', key: 'formatting' });
    } finally {
      setFormatting(false);
    }
  };

  return (
    <Modal
      title="编辑文章"
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="format"
          icon={<ThunderboltOutlined />}
          onClick={handleSmartFormat}
          loading={formatting}
          disabled={saving}
        >
          智能排版
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
          disabled={formatting}
        >
          保存
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="文章标题"
          name="title"
          rules={[
            { required: true, message: '请输入文章标题' },
            { whitespace: true, message: '标题不能为空' },
          ]}
        >
          <Input placeholder="请输入文章标题" disabled={formatting} />
        </Form.Item>

        <Form.Item label="文章内容">
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="编辑" key="edit">
              <Spin spinning={formatting} tip="正在智能排版...">
                <ReactQuill
                  theme="snow"
                  value={content}
                  onChange={setContent}
                  modules={quillModules}
                  formats={quillFormats}
                  style={{ height: '400px', marginBottom: '50px' }}
                  readOnly={formatting}
                />
              </Spin>
            </TabPane>
            <TabPane tab="预览" key="preview">
              <div
                style={{
                  height: '450px',
                  overflow: 'auto',
                  padding: '16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                }}
              >
                <ArticleContent
                  content={content}
                  imageUrl={article?.imageUrl}
                />
              </div>
            </TabPane>
          </Tabs>
        </Form.Item>
      </Form>
    </Modal>
  );
}
