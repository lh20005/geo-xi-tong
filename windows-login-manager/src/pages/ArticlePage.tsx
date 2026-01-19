import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  message,
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
import { localDistillationApi } from '../api/localDistillationApi';
import {
  createTask,
  fetchTaskDetail,
  fetchAlbums,
  fetchKnowledgeBases,
  fetchArticleSettings,
  fetchConversionTargets,
} from '../api/articleGenerationApi';
import type { Album, KnowledgeBase, ArticleSetting, ConversionTarget, TaskDetail } from '../types/articleGeneration';
import ArticleContent from '../components/ArticleContent';

const { Title, Paragraph } = Typography;

export default function ArticlePage() {
  const { distillationId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [article, setArticle] = useState('');
  const [keyword, setKeyword] = useState('');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [articleSettings, setArticleSettings] = useState<ArticleSetting[]>([]);
  const [conversionTargets, setConversionTargets] = useState<ConversionTarget[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<number | null>(null);
  const [selectedArticleSettingId, setSelectedArticleSettingId] = useState<number | null>(null);
  const [selectedConversionTargetId, setSelectedConversionTargetId] = useState<number | null>(null);

  useEffect(() => {
    loadKeyword();
    loadConfigData();
  }, [distillationId]);

  const loadKeyword = async () => {
    if (!distillationId) return;
    try {
      const result = await localDistillationApi.findById(Number(distillationId));
      if (result.success && result.data?.keyword) {
        setKeyword(result.data.keyword);
      }
    } catch (error) {
      console.error('加载关键词失败:', error);
    }
  };

  const loadConfigData = async () => {
    setConfigLoading(true);
    try {
      const [albumData, knowledgeBaseData, articleSettingData, conversionTargetData] = await Promise.all([
        fetchAlbums(),
        fetchKnowledgeBases(),
        fetchArticleSettings(),
        fetchConversionTargets()
      ]);

      setAlbums(albumData || []);
      setKnowledgeBases(knowledgeBaseData || []);
      setArticleSettings(articleSettingData || []);
      setConversionTargets(conversionTargetData || []);
    } catch (error) {
      console.error('加载配置数据失败:', error);
      message.error('加载配置数据失败');
    } finally {
      setConfigLoading(false);
    }
  };

  const waitForTaskCompletion = async (taskId: number): Promise<TaskDetail> => {
    const maxAttempts = 60;
    const intervalMs = 2000;

    for (let i = 0; i < maxAttempts; i += 1) {
      const detail = await fetchTaskDetail(taskId);

      if (detail.status === 'completed') {
        return detail;
      }

      if (detail.status === 'failed') {
        throw new Error(detail.errorMessage || '文章生成失败');
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('生成超时，请到文章生成任务中查看');
  };

  const handleGenerate = async () => {
    if (!distillationId) {
      message.error('缺少蒸馏记录');
      return;
    }

    if (!selectedAlbumId || !selectedKnowledgeBaseId || !selectedArticleSettingId || !selectedConversionTargetId) {
      message.error('请先选择完整的生成配置');
      return;
    }

    setLoading(true);
    try {
      const task = await createTask({
        distillationId: Number(distillationId),
        albumId: selectedAlbumId,
        knowledgeBaseId: selectedKnowledgeBaseId,
        articleSettingId: selectedArticleSettingId,
        conversionTargetId: selectedConversionTargetId,
        articleCount: 1,
      });

      const detail = await waitForTaskCompletion(task.taskId);
      const generatedArticle = detail.generatedArticles?.[0];

      if (!generatedArticle) {
        throw new Error('文章生成完成，但未找到文章内容');
      }

      const articleResponse = await apiClient.get(`/article-generation/articles/${generatedArticle.id}`);
      setArticle(articleResponse.data?.content || '');
      message.success('文章生成成功！');
    } catch (error: any) {
      message.error(error.response?.data?.error || error.message || '文章生成失败');
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

  const selectedKnowledgeBase = knowledgeBases.find((kb) => kb.id === selectedKnowledgeBaseId);

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

        <Card type="inner" title="生成配置" style={{ marginBottom: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              style={{ width: '100%' }}
              placeholder="选择转化目标"
              value={selectedConversionTargetId ?? undefined}
              onChange={setSelectedConversionTargetId}
              loading={configLoading}
              options={conversionTargets.map(target => ({
                label: `${target.company_name} (${target.industry})`,
                value: target.id,
              }))}
            />
            <Select
              style={{ width: '100%' }}
              placeholder="选择文章设置"
              value={selectedArticleSettingId ?? undefined}
              onChange={setSelectedArticleSettingId}
              loading={configLoading}
              options={articleSettings.map(setting => ({
                label: setting.name,
                value: setting.id,
              }))}
            />
            <Select
              style={{ width: '100%' }}
              placeholder="选择企业图库"
              value={selectedAlbumId ?? undefined}
              onChange={setSelectedAlbumId}
              loading={configLoading}
              options={albums.map(album => ({
                label: `${album.name} (${album.image_count} 张图片)`,
                value: album.id,
              }))}
            />
            <Select
              style={{ width: '100%' }}
              placeholder="选择企业知识库"
              value={selectedKnowledgeBaseId ?? undefined}
              onChange={setSelectedKnowledgeBaseId}
              loading={configLoading}
              options={knowledgeBases.map(kb => ({
                label: `${kb.name} (${kb.document_count}个文档)`,
                value: kb.id,
              }))}
              suffixIcon={<BookOutlined />}
            />
            {selectedKnowledgeBase && (
              <Alert
                message="知识库已选择"
                description={`当前选择：${selectedKnowledgeBase.name}（${selectedKnowledgeBase.document_count} 个文档）`}
                type="info"
                showIcon
              />
            )}
          </Space>
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
