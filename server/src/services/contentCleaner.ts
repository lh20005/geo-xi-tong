/**
 * 内容清理模块
 * 负责清理AI生成内容中的思考过程和Markdown符号
 */
export class ContentCleaner {
  /**
   * 清理AI思考过程
   * 移除思考过程关键词和XML标签
   */
  static removeThinkingProcess(content: string): string {
    let cleaned = content;

    // 移除XML思考标签及其内容
    // 匹配 <thinking>...</thinking>, <analysis>...</analysis> 等
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    cleaned = cleaned.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    cleaned = cleaned.replace(/<reflection>[\s\S]*?<\/reflection>/gi, '');

    // 移除包含思考过程关键词的段落
    const thinkingKeywords = [
      '让我思考',
      '让我来思考',
      '首先分析',
      '首先，',
      '让我分析',
      '分析一下',
      '让我们分析',
      '让我们思考',
      '思考过程',
      '推理过程',
      '让我理解',
      '理解一下'
    ];

    // 按行分割，过滤包含思考关键词的行
    const lines = cleaned.split('\n');
    const filteredLines = lines.filter(line => {
      const lowerLine = line.toLowerCase().trim();
      // 如果行以思考关键词开头，则移除
      return !thinkingKeywords.some(keyword => 
        lowerLine.startsWith(keyword.toLowerCase())
      );
    });

    cleaned = filteredLines.join('\n');

    return cleaned;
  }

  /**
   * 移除Markdown符号
   * 转换为纯文本格式
   */
  static removeMarkdownSymbols(content: string): string {
    let cleaned = content;

    // 1. 移除代码块标记 (```) - 先处理，避免影响其他规则
    cleaned = cleaned.replace(/```[\s\S]*?\n([\s\S]*?)```/g, '$1');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

    // 2. 移除标题标记 (# ## ### 等)
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

    // 3. 移除加粗标记 (**text** 或 __text__)
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
    cleaned = cleaned.replace(/__(.+?)__/g, '$1');

    // 4. 移除斜体标记 (*text* 或 _text_)
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
    cleaned = cleaned.replace(/_(.+?)_/g, '$1');

    // 5. 转换Markdown链接 [text](url) 为 text (url)
    cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

    // 6. 移除列表标记
    // 无序列表 (- item 或 * item)
    cleaned = cleaned.replace(/^[\s]*[-*]\s+/gm, '');
    // 有序列表 (1. item)
    cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '');

    // 7. 移除引用标记 (> text)
    cleaned = cleaned.replace(/^>\s+/gm, '');

    // 8. 移除水平线 (--- 或 ***)
    cleaned = cleaned.replace(/^[-*]{3,}$/gm, '');

    return cleaned;
  }

  /**
   * 完整清理流程
   * 先清理思考过程，再移除Markdown符号
   */
  static cleanArticleContent(content: string): string {
    if (!content || content.trim().length === 0) {
      return content;
    }

    // 第一步：移除思考过程
    let cleaned = this.removeThinkingProcess(content);

    // 第二步：移除Markdown符号
    cleaned = this.removeMarkdownSymbols(cleaned);

    // 第三步：清理多余的空行（保留段落结构）
    // 将3个或更多连续换行替换为2个换行
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // 去除首尾空白
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * 验证清理后的内容
   * 确保内容不为空且长度合理
   */
  static validateCleanedContent(content: string): boolean {
    if (!content || content.trim().length === 0) {
      return false;
    }

    // 内容至少应该有10个字符
    if (content.trim().length < 10) {
      return false;
    }

    return true;
  }
}
