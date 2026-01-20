/**
 * 调试工具：分析文章内容格式
 */

export interface ArticleFormatInfo {
  hasHtmlTags: boolean;
  hasImageTag: boolean;
  hasParagraphTags: boolean;
  paragraphCount: number;
  lineBreakCount: number;
  doubleLineBreakCount: number;
  contentLength: number;
  contentPreview: string;
  imageUrl?: string;
}

export interface ArticleSummary {
  id?: number | string;
  title?: string;
  content: string;
  imageUrl?: string;
}

export function analyzeArticleFormat(content: string, imageUrl?: string): ArticleFormatInfo {
  const hasHtmlTags = /<[^>]+>/.test(content);
  const hasImageTag = /<img[^>]*>/i.test(content);
  const hasParagraphTags = /<p[^>]*>/i.test(content);
  
  // 计算段落数（HTML或纯文本）
  let paragraphCount = 0;
  if (hasParagraphTags) {
    const matches = content.match(/<p[^>]*>/gi);
    paragraphCount = matches ? matches.length : 0;
  } else {
    // 纯文本：按双换行符分割
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    paragraphCount = paragraphs.length;
  }
  
  const lineBreakCount = (content.match(/\n/g) || []).length;
  const doubleLineBreakCount = (content.match(/\n\n/g) || []).length;
  
  return {
    hasHtmlTags,
    hasImageTag,
    hasParagraphTags,
    paragraphCount,
    lineBreakCount,
    doubleLineBreakCount,
    contentLength: content.length,
    contentPreview: content.substring(0, 200),
    imageUrl
  };
}

export function logArticleFormat(article: ArticleSummary): void {
  console.group('📄 文章格式分析');
  console.log('文章ID:', article.id);
  console.log('标题:', article.title);
  
  const info = analyzeArticleFormat(article.content, article.imageUrl);
  
  console.log('格式信息:', {
    'HTML格式': info.hasHtmlTags ? '✅' : '❌',
    '包含图片标签': info.hasImageTag ? '✅' : '❌',
    '包含段落标签': info.hasParagraphTags ? '✅' : '❌',
    '段落数': info.paragraphCount,
    '换行符数': info.lineBreakCount,
    '双换行符数': info.doubleLineBreakCount,
    '内容长度': info.contentLength,
    '图片URL': info.imageUrl || '无'
  });
  
  console.log('内容预览:', info.contentPreview);
  console.groupEnd();
}
