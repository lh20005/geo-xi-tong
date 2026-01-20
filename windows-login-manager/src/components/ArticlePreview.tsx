import React from 'react';
import { Card, Typography, Empty } from 'antd';
import { processArticleContent } from '../utils/articleUtils';
import { API_BASE_URL } from '../config/env';

const { Text } = Typography;

// 从环境变量获取服务器地址，确保不会使用 localhost
const getServerUrl = (): string => {
  // 优先使用环境变量配置的地址
  if (API_BASE_URL && !API_BASE_URL.includes('localhost')) {
    // API_BASE_URL 已经包含了完整的服务器地址，去掉 /api 后缀
    return API_BASE_URL.replace(/\/api$/, '');
  }
  // 默认使用生产环境地址（注意：必须带 www）
  return 'https://www.jzgeo.cc';
};

interface ArticlePreviewProps {
  content: string;
  title?: string;
  imageUrl?: string;
  showTitle?: boolean;
  showImage?: boolean;
}

/**
 * ArticlePreview组件
 * 
 * 用于统一的文章预览展示，保留段落格式和排版
 * 适用于：文章管理页面、发布任务页面、发布记录页面等所有需要预览文章的地方
 */
const ArticlePreview: React.FC<ArticlePreviewProps> = ({ 
  content, 
  title,
  imageUrl,
  showTitle = true,
  showImage = true
}) => {
  if (!content) {
    return <Empty description="暂无文章内容" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  // 处理图片 URL - 将相对路径转换为完整 URL
  const getFullImageUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    
    // 如果已经是完整 URL，直接返回
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // 如果是相对路径，添加服务器地址
    const serverUrl = getServerUrl();
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${serverUrl}${path}`;
  };

  const fullImageUrl = getFullImageUrl(imageUrl);

  // 渲染文章内容
  const renderContent = () => {
    const cleanContent = processArticleContent(content, imageUrl);
    
    // 使用pre-wrap保留换行和空格，这样复制时不会有HTML标签
    return (
      <div 
        style={{ 
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.8,
          fontSize: 16,
          color: '#333'
        }}
      >
        {cleanContent}
      </div>
    );
  };

  return (
    <div>
      {/* 文章标题 */}
      {showTitle && title && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 18, display: 'block', lineHeight: 1.6 }}>
            {title}
          </Text>
        </Card>
      )}

      {/* 文章图片 */}
      {showImage && fullImageUrl && (
        <Card size="small" style={{ marginBottom: 16, textAlign: 'center' }}>
          <img 
            src={fullImageUrl} 
            alt="文章配图" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: 400,
              borderRadius: 8,
              objectFit: 'contain'
            }}
            onError={(e) => {
              console.error('图片加载失败:', fullImageUrl);
              // 图片加载失败时隐藏
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </Card>
      )}

      {/* 文章内容 */}
      <Card 
        size="small" 
        title={<Text strong>文章内容</Text>}
      >
        {renderContent()}
      </Card>
    </div>
  );
};

export default ArticlePreview;
