/**
 * 文章处理工具函数
 */

/**
 * 处理文章内容，移除HTML标签和图片标记，保留纯文本格式
 * 用于复制、预览等场景
 */
export function processArticleContent(content: string, imageUrl?: string): string {
  if (!content) return '';
  
  let processed = content;
  
  // 1. 移除 [IMAGE_PLACEHOLDER] 占位符
  processed = processed.replace(/\[IMAGE_PLACEHOLDER\]/gi, '');
  
  // 2. 移除 Markdown 图片标记 ![alt](url)
  processed = processed.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  
  // 3. 处理HTML标签，保留段落结构
  // 将 </p> 转换为双换行
  processed = processed.replace(/<\/p>/gi, '\n\n');
  // 移除 <p> 开始标签
  processed = processed.replace(/<p[^>]*>/gi, '');
  // 将 <br> 转换为单换行
  processed = processed.replace(/<br\s*\/?>/gi, '\n');
  
  // 4. 移除其他所有HTML标签
  processed = processed.replace(/<[^>]+>/g, '');
  
  // 5. 解码HTML实体字符
  processed = processed.replace(/&nbsp;/g, ' ');
  processed = processed.replace(/&lt;/g, '<');
  processed = processed.replace(/&gt;/g, '>');
  processed = processed.replace(/&amp;/g, '&');
  processed = processed.replace(/&quot;/g, '"');
  processed = processed.replace(/&#39;/g, "'");
  
  // 6. 清理多余的空行（超过2个连续换行符的合并为2个）
  processed = processed.replace(/\n{3,}/g, '\n\n');
  
  // 7. 移除首尾空白
  processed = processed.trim();
  
  return processed;
}
