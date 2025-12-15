import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';

interface ArticleContentProps {
  content: string;
  imageUrl?: string; // 用于向后兼容旧格式
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ArticleContent组件
 * 
 * 用于渲染文章内容，支持HTML和Markdown格式，支持图片嵌入和向后兼容
 * 
 * Feature: article-image-embedding, article-editor-enhancement
 */
const ArticleContent: React.FC<ArticleContentProps> = ({ 
  content, 
  imageUrl, 
  className, 
  style 
}) => {
  // 检测内容格式：HTML 或 Markdown
  const isHtmlContent = /<[^>]+>/.test(content);
  
  if (isHtmlContent) {
    // HTML格式内容：使用DOMPurify清理后直接渲染
    let processedContent = content;
    
    // 如果内容中没有图片标签，但有imageUrl，在第一段后插入图片
    const hasImageTag = /<img[^>]*>/i.test(content);
    if (!hasImageTag && imageUrl) {
      // 在第一个</p>标签后插入图片
      const firstParagraphEnd = content.indexOf('</p>');
      if (firstParagraphEnd !== -1) {
        const imageTag = `<p><img src="${imageUrl}" alt="article image" style="max-width: 100%; height: auto; margin: 20px 0; display: block; border-radius: 6px; border: 1px solid #e2e8f0;" /></p>`;
        processedContent = 
          content.substring(0, firstParagraphEnd + 4) + 
          imageTag + 
          content.substring(firstParagraphEnd + 4);
      } else {
        // 如果没有段落标签，在开头插入
        const imageTag = `<p><img src="${imageUrl}" alt="article image" style="max-width: 100%; height: auto; margin: 20px 0; display: block; border-radius: 6px; border: 1px solid #e2e8f0;" /></p>`;
        processedContent = imageTag + processedContent;
      }
    }
    
    // 清理HTML内容以防止XSS攻击，保留更多样式属性
    const cleanContent = DOMPurify.sanitize(processedContent, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img', 'span', 'div', 'blockquote', 'pre', 'code'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class', 'width', 'height', 'target', 'rel']
    });
    
    return (
      <div 
        className={className} 
        style={{
          ...style,
          lineHeight: '1.8',
          fontSize: '16px'
        }}
        dangerouslySetInnerHTML={{ __html: cleanContent }}
      />
    );
  }
  
  // Markdown格式内容：使用ReactMarkdown渲染
  // 向后兼容：检查内容是否包含图片标记
  const hasImageInContent = /!\[.*?\]\(.*?\)/.test(content);
  
  // 如果没有图片标记但有imageUrl，在开头插入
  // Feature: article-image-embedding, Property 10: 旧格式自动转换
  const finalContent = !hasImageInContent && imageUrl
    ? `![文章配图](${imageUrl})\n\n${content}`
    : content;

  return (
    <div className={className} style={style}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // 自定义图片组件，应用统一样式
        // Feature: article-image-embedding, Property 17: 自定义图片组件应用
        img: ({ node, ...props }) => (
          <img
            {...props}
            style={{
              width: '100%',
              maxHeight: 400,
              objectFit: 'cover',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              margin: '16px 0',
              display: 'block',
            }}
            onError={(e) => {
              // 图片加载失败时显示占位图
              (e.target as HTMLImageElement).src =
                'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E图片加载失败%3C/text%3E%3C/svg%3E';
            }}
            alt={props.alt || '文章配图'}
          />
        ),
      }}
      >
        {finalContent}
      </ReactMarkdown>
    </div>
  );
};

export default ArticleContent;
