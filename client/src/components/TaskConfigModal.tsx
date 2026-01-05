import { useState, useEffect } from 'react';
import { Modal, Form, Select, InputNumber, Spin, Tag, Tooltip, App } from 'antd';
import { StarOutlined } from '@ant-design/icons';
import type { TaskConfig, Album, KnowledgeBase, ArticleSetting, ConversionTarget } from '../types/articleGeneration';
import {
  fetchAlbums,
  fetchKnowledgeBases,
  fetchArticleSettings,
  fetchConversionTargets
} from '../api/articleGenerationApi';
import { getDistillationsWithStats, type DistillationUsageStats } from '../api/distillationApi';

interface TaskConfigModalProps {
  visible: boolean;
  onSubmit: (config: TaskConfig) => Promise<void>;
  onCancel: () => void;
}

export default function TaskConfigModal({ visible, onSubmit, onCancel }: TaskConfigModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [dataLoading, setDataLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [distillations, setDistillations] = useState<DistillationUsageStats[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [articleSettings, setArticleSettings] = useState<ArticleSetting[]>([]);
  const [conversionTargets, setConversionTargets] = useState<ConversionTarget[]>([]);

  // 加载所有数据源
  useEffect(() => {
    if (visible) {
      loadAllData();
    }
  }, [visible]);

  const loadAllData = async () => {
    setDataLoading(true);
    try {
      console.log('🔄 开始加载下拉列表数据...');
      
      const [distillationsData, albumsData, knowledgeBasesData, articleSettingsData, conversionTargetsData] = await Promise.all([
        getDistillationsWithStats(1, 100).then(data => {
          console.log('✅ 蒸馏数据加载成功:', data);
          return data;
        }).catch(err => {
          console.error('❌ 蒸馏数据加载失败:', err);
          throw err;
        }),
        fetchAlbums().then(data => {
          console.log('✅ 相册数据加载成功:', data);
          return data;
        }).catch(err => {
          console.error('❌ 相册数据加载失败:', err);
          throw err;
        }),
        fetchKnowledgeBases().then(data => {
          console.log('✅ 知识库数据加载成功:', data);
          return data;
        }).catch(err => {
          console.error('❌ 知识库数据加载失败:', err);
          throw err;
        }),
        fetchArticleSettings().then(data => {
          console.log('✅ 文章设置数据加载成功:', data);
          return data;
        }).catch(err => {
          console.error('❌ 文章设置数据加载失败:', err);
          throw err;
        }),
        fetchConversionTargets().then(data => {
          console.log('✅ 转化目标数据加载成功:', data);
          return data;
        }).catch(err => {
          console.error('❌ 转化目标数据加载失败:', err);
          throw err;
        })
      ]);

      console.log('📊 设置状态数据...');
      console.log('  - 蒸馏记录数:', distillationsData.distillations?.length || 0);
      console.log('  - 相册数:', albumsData?.length || 0);
      console.log('  - 知识库数:', knowledgeBasesData?.length || 0);
      console.log('  - 文章设置数:', articleSettingsData?.length || 0);
      console.log('  - 转化目标数:', conversionTargetsData?.length || 0);

      setDistillations(distillationsData.distillations || []);
      setAlbums(albumsData || []);
      setKnowledgeBases(knowledgeBasesData || []);
      setArticleSettings(articleSettingsData || []);
      setConversionTargets(conversionTargetsData || []);
      
      console.log('✅ 所有数据加载完成');
    } catch (error: any) {
      console.error('❌ 加载数据失败:', error);
      console.error('错误详情:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      message.error('加载数据失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setDataLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      await onSubmit({
        distillationId: values.distillationId,
        albumId: values.albumId,
        knowledgeBaseId: values.knowledgeBaseId,
        articleSettingId: values.articleSettingId,
        conversionTargetId: values.conversionTargetId,
        articleCount: values.articleCount
      });

      form.resetFields();
      message.success('任务创建成功！');
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error('创建任务失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="新建文章生成任务"
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={submitting}
      width={600}
      okText="生成文章"
      cancelText="取消"
    >
      <Spin spinning={dataLoading}>
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="distillationId"
            label="选择蒸馏历史"
            rules={[{ required: true, message: '请选择蒸馏历史' }]}
          >
            <Select
              placeholder="请选择蒸馏历史"
              showSearch
              optionFilterProp="children"
            >
              {distillations.map((item, index) => {
                const isRecommended = index < 3; // Top 3 are recommended (already sorted by usage count)
                const hasNoTopics = item.topicCount === 0;
                
                return (
                  <Select.Option 
                    key={item.distillationId} 
                    value={item.distillationId}
                    disabled={hasNoTopics}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>
                        {item.keyword} ({item.provider})
                        {hasNoTopics && <span style={{ color: '#999', marginLeft: 8 }}>(无可用话题)</span>}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#666', fontSize: '12px' }}>
                          使用 {item.usageCount} 次
                        </span>
                        {isRecommended && !hasNoTopics && (
                          <Tooltip title={`推荐：使用次数较少 (${item.usageCount}次)`}>
                            <Tag color="gold" icon={<StarOutlined />} style={{ margin: 0 }}>
                              推荐
                            </Tag>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>

          <Form.Item
            name="conversionTargetId"
            label="选择转化目标"
            rules={[{ required: true, message: '请选择转化目标' }]}
          >
            <Select
              placeholder="请选择转化目标"
              showSearch
              optionFilterProp="children"
              notFoundContent={conversionTargets.length === 0 ? '暂无转化目标' : undefined}
            >
              {conversionTargets.map(item => (
                <Select.Option key={item.id} value={item.id}>
                  {item.company_name} ({item.industry})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="albumId"
            label="选择企业图库"
            rules={[{ required: true, message: '请选择企业图库' }]}
          >
            <Select placeholder="请选择企业图库">
              {albums.map(item => (
                <Select.Option key={item.id} value={item.id}>
                  {item.name} ({item.image_count} 张图片)
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="knowledgeBaseId"
            label="选择企业知识库"
            rules={[{ required: true, message: '请选择企业知识库' }]}
          >
            <Select placeholder="请选择企业知识库">
              {knowledgeBases.map(item => (
                <Select.Option key={item.id} value={item.id}>
                  {item.name} ({item.document_count} 个文档)
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="articleSettingId"
            label="选择文章设置"
            rules={[{ required: true, message: '请选择文章设置' }]}
          >
            <Select placeholder="请选择文章设置">
              {articleSettings.map(item => (
                <Select.Option key={item.id} value={item.id}>
                  {item.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="articleCount"
            label="生成文章数量"
            rules={[
              { required: true, message: '请输入文章数量' },
              { type: 'number', min: 1, message: '数量必须大于0' },
              { type: 'number', max: 100, message: '数量不能超过100' }
            ]}
          >
            <InputNumber
              min={1}
              max={100}
              placeholder="请输入生成数量"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
}
