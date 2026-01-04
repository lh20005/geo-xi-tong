import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  message,
  Input,
  Typography,
  Spin,
  Select,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  DownloadOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { apiClient } from '../api/client';
import ArticleContent from '../components/ArticleContent';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  document_count: number;
}

export default function ArticlePage() {
  const { distillationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [requirements, setRequirements] = useState('');
  const [article, setArticle] = useState('');
  const [keyword, setKeyword] = useState('');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<number[]>([]);

  useEffect(() => {
    loadKeyword();
    loadKnowledgeBases();
  }, [distillationId]);

  const loadKeyword = async () => {
    try {
      const response = await apiClient.get(`/distillations/${distillationId}`);
      if (response.data && response.data.keyword) {
        setKeyword(response.data.keyword);
      }
    } catch (error) {
      console.error('加载关键词失败:', error);
    }
  };

  const loadKnowledgeBases = async () => {
    try {
      const response = await apiClient.get('/knowledge-bases');
      setKnowledgeBases(response.data.knowledgeBases);
    } catch (error) {
      console.error('加载知识库失败:', error);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const selectedTopics = location.state?.selectedTopics || [];
      
      const response = await apiClient.post('/articles/generate', {
        keyword,
        distillationId,
        requirements,
        topicIds: selectedTopics.length > 0 ? selectedTopics : undefined,
        knowledgeBaseIds: selectedKnowledgeBases.length > 0 ? selectedKnowledgeBases : undefined,
      });

      setArticle(response.data.content);
      message.success('文章生成成功！');
    } catch (error: any) {
      message.error(error.response?.data?.error || '文章生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(article);
    message.success('文章已复制到剪贴板');
  };

  const handleDownload = () => {
    const blob = new Blob([article], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${keyword}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('文章已下载');
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(`/topics/${distillationId}`)}
            />
            <span>文章生成</span>
          </Space>
        }
        variant="borderless"
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4}>关键词: {keyword}</Title>
          <Paragraph style={{ color: '#64748b' }}>
            根据蒸馏的话题，AI将为您生成高质量的SEO优化文章
          </Paragraph>
        </div>

        <Card type="inner" title="选择知识库（可选）" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="选择要使用的知识库"
              value={selectedKnowledgeBases}
              onChange={setSelectedKnowledgeBases}
              options={knowledgeBases.map(kb => ({
                label: `${kb.name} (${kb.document_count}个文档)`,
                value: kb.id,
              }))}
              suffixIcon={<BookOutlined />}
            />
            {selectedKnowledgeBases.length > 0 && (
              <Alert
                message="知识库已选择"
                description={`已选择 ${selectedKnowledgeBases.length} 个知识库。AI将基于这些知识库的内容生成更专业、准确的文章。`}
                type="info"
                showIcon
              />
            )}
          </Space>
        </Card>

        <Card type="inner" title="文章要求" style={{ marginBottom: 24 }}>
          <TextArea
            rows={6}
            placeholder="请输入文章生成要求，例如：&#10;- 文章字数在2000字左右&#10;- 语言风格专业、权威&#10;- 包含实际案例和数据支持&#10;- 结构清晰，包含小标题&#10;- 自然融入关键词，符合SEO标准"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            style={{ fontSize: 14 }}
          />
          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              loading={loading}
              onClick={handleGenerate}
            >
              生成文章
            </Button>
          </div>
        </Card>

        {loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#64748b' }}>
              AI正在为您生成文章，请稍候...
            </div>
          </div>
        )}

        {article && !loading && (
          <Card
            type="inner"
            title="生成的文章"
            extra={
              <Space>
                <Button icon={<CopyOutlined />} onClick={handleCopy}>
                  复制
                </Button>
                <Button icon={<DownloadOutlined />} onClick={handleDownload}>
                  下载
                </Button>
              </Space>
            }
          >
            <div
              style={{
                maxHeight: 600,
                overflow: 'auto',
                padding: 16,
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
              }}
            >
              <ArticleContent content={article} />
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
}
