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
  // 检测内容格式：HTML、Markdown 或纯文本
  const isHtmlContent = /<[^>]+>/.test(content);
  const isMarkdownContent = /!\[.*?\]\(.*?\)/.test(content); // 只检测图片语法，更准确
  
  // 如果是纯文本（既不是HTML也不是Markdown），直接渲染并保留换行
  if (!isHtmlContent && !isMarkdownContent) {
    // 处理纯文本：将连续的换行符转换为段落
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    
    return (
      <div 
        className={className} 
        style={{
          ...style,
          lineHeight: '1.8',
          fontSize: '16px'
        }}
      >
        {paragraphs.map((paragraph, index) => (
          <p 
            key={index} 
            style={{ 
              marginBottom: index < paragraphs.length - 1 ? '16px' : 0,
              textIndent: '2em' // 首行缩进
            }}
          >
            {paragraph.trim()}
          </p>
        ))}
      </div>
    );
  }
  
  if (isHtmlContent) {
    // HTML格式内容：清理HTML标签，转换为纯文本并保留段落格式
    let processedContent = content;
    
    // 1. 移除Markdown图片语法 ![alt](url)
    processedContent = processedContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '');
    
    // 2. 处理HTML标签，保留段落结构
    // 将 <p>、</p>、<br>、<br/> 转换为换行符
    processedContent = processedContent.replace(/<\/p>/gi, '\n\n');
    processedContent = processedContent.replace(/<p[^>]*>/gi, '');
    processedContent = processedContent.replace(/<br\s*\/?>/gi, '\n');
    
    // 3. 移除其他所有HTML标签（保留文本内容）
    processedContent = processedContent.replace(/<[^>]+>/g, '');
    
    // 4. 移除HTML实体字符
    processedContent = processedContent.replace(/&nbsp;/g, ' ');
    processedContent = processedContent.replace(/&lt;/g, '<');
    processedContent = processedContent.replace(/&gt;/g, '>');
    processedContent = processedContent.replace(/&amp;/g, '&');
    processedContent = processedContent.replace(/&quot;/g, '"');
    
    // 5. 移除图片URL（http开头的链接）
    processedContent = processedContent.replace(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/gi, '');
    
    // 6. 清理多余的空行（超过2个连续换行符的合并为2个）
    processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
    
    // 7. 移除首尾空白
    processedContent = processedContent.trim();
    
    // 8. 如果有imageUrl，在适当位置添加图片提示
    if (imageUrl) {
      // 在第一段后添加图片提示
      const firstParagraphEnd = processedContent.indexOf('\n\n');
      if (firstParagraphEnd !== -1) {
        processedContent = 
          processedContent.substring(0, firstParagraphEnd) + 
          '\n\n【此处显示文章配图】\n\n' + 
          processedContent.substring(firstParagraphEnd + 2);
      } else {
        processedContent = '【此处显示文章配图】\n\n' + processedContent;
      }
    }
    
    return (
      <div 
        className={className} 
        style={{
          ...style,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: '1.8',
          fontSize: '16px'
        }}
      >
        {processedContent}
      </div>
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
