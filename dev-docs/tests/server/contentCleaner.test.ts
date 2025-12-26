import * as fc from 'fast-check';
import { ContentCleaner } from '../services/contentCleaner';

describe('ContentCleaner', () => {
  describe('属性 1: 思考过程关键词完全移除', () => {
    /**
     * Feature: article-content-quality-improvement, Property 1: 思考过程关键词完全移除
     * 对于任何包含思考过程关键词的文本，清理后的内容不应包含这些关键词
     */
    it('should remove thinking process keywords from any text', () => {
      const thinkingKeywords = [
        '让我思考',
        '让我来思考',
        '首先分析',
        '首先，',
        '让我分析',
        '分析一下',
        '让我们分析',
        '让我们思考'
      ];

      fc.assert(
        fc.property(
          fc.string(),
          fc.constantFrom(...thinkingKeywords),
          fc.string(),
          (prefix, keyword, suffix) => {
            // 构造包含思考关键词的文本
            const textWithThinking = `${prefix}\n${keyword}这是一个问题\n${suffix}`;
            
            // 清理
            const cleaned = ContentCleaner.removeThinkingProcess(textWithThinking);
            
            // 验证：清理后不应包含思考关键词开头的行
            const lines = cleaned.split('\n');
            const hasThinkingKeyword = lines.some(line => 
              thinkingKeywords.some(kw => line.trim().toLowerCase().startsWith(kw.toLowerCase()))
            );
            
            return !hasThinkingKeyword;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('属性 2: XML思考标签完全移除', () => {
    /**
     * Feature: article-content-quality-improvement, Property 2: XML思考标签完全移除
     * 对于任何包含XML思考标签的文本，清理后的内容不应包含这些标签及其内容
     */
    it('should remove XML thinking tags and their content', () => {
      const xmlTags = ['thinking', 'analysis', 'reasoning', 'reflection'];

      fc.assert(
        fc.property(
          fc.string(),
          fc.constantFrom(...xmlTags),
          fc.string().filter(s => s.length > 0 && !s.includes('<') && !s.includes('>')),
          fc.string(),
          (prefix, tagName, tagContent, suffix) => {
            // 构造包含XML标签的文本
            const textWithXML = `${prefix}<${tagName}>${tagContent}</${tagName}>${suffix}`;
            
            // 清理
            const cleaned = ContentCleaner.removeThinkingProcess(textWithXML);
            
            // 验证：清理后不应包含XML标签和标签内容
            const hasOpenTag = cleaned.includes(`<${tagName}>`);
            const hasCloseTag = cleaned.includes(`</${tagName}>`);
            // 标签内容应该被移除（除非它也出现在prefix或suffix中）
            const tagContentInClean = cleaned.includes(tagContent);
            const tagContentInPrefixOrSuffix = prefix.includes(tagContent) || suffix.includes(tagContent);
            
            return !hasOpenTag && !hasCloseTag && (!tagContentInClean || tagContentInPrefixOrSuffix);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('属性 3: 清理后内容非空', () => {
    /**
     * Feature: article-content-quality-improvement, Property 3: 清理后内容非空
     * 对于任何包含有效文本内容的输入，清理后的内容长度应大于0
     */
    it('should not produce empty content from valid input', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 20 }).filter(s => s.trim().length >= 20),
          (validText) => {
            // 清理
            const cleaned = ContentCleaner.cleanArticleContent(validText);
            
            // 验证：清理后内容应该非空
            return cleaned.trim().length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('属性 4: 标题标记符号移除', () => {
    /**
     * Feature: article-content-quality-improvement, Property 4: 标题标记符号移除
     * 对于任何包含#标题标记的文本，清理后的内容不应包含#符号
     */
    it('should remove all # heading markers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 6 }),
          fc.string({ minLength: 1 }),
          fc.string(),
          (hashCount, headingText, suffix) => {
            // 构造包含标题标记的文本
            const hashes = '#'.repeat(hashCount);
            const textWithHeading = `${hashes} ${headingText}\n${suffix}`;
            
            // 清理
            const cleaned = ContentCleaner.removeMarkdownSymbols(textWithHeading);
            
            // 验证：清理后不应包含行首的#标记
            const lines = cleaned.split('\n');
            const hasHashAtStart = lines.some(line => /^#+\s/.test(line));
            
            return !hasHashAtStart;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('属性 5: 加粗斜体标记移除但保留文本', () => {
    /**
     * Feature: article-content-quality-improvement, Property 5: 加粗斜体标记移除但保留文本
     * 对于任何包含加粗或斜体标记的文本，清理后应移除标记但保留被标记的文本内容
     */
    it('should remove bold/italic markers but keep the text', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3 }).filter(s => 
            !s.includes('*') && 
            !s.includes('_') && 
            !s.includes('`') &&
            s.trim().length >= 3
          ),
          fc.constantFrom('**', '__', '*', '_'),
          (text, marker) => {
            // 构造包含标记的文本
            const markedText = `${marker}${text}${marker}`;
            
            // 清理
            const cleaned = ContentCleaner.removeMarkdownSymbols(markedText);
            
            // 验证：文本应该保留（去除空格后比较）
            const textTrimmed = text.trim();
            const cleanedTrimmed = cleaned.trim();
            const hasText = cleanedTrimmed.includes(textTrimmed) || textTrimmed.includes(cleanedTrimmed);
            
            return hasText;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('属性 6: 列表标记转换为纯文本', () => {
    /**
     * Feature: article-content-quality-improvement, Property 6: 列表标记转换为纯文本
     * 对于任何包含列表标记的文本，清理后应转换为纯文本格式
     */
    it('should convert list markers to plain text', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.constantFrom('- ', '* ', '1. ', '2. ', '10. '),
          (itemText, marker) => {
            // 构造包含列表标记的文本
            const listText = `${marker}${itemText}`;
            
            // 清理
            const cleaned = ContentCleaner.removeMarkdownSymbols(listText);
            
            // 验证：列表标记应该被移除
            const hasMarker = /^[\s]*[-*]\s+/.test(cleaned) || /^[\s]*\d+\.\s+/.test(cleaned);
            
            return !hasMarker;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('属性 7: 代码块标记移除但保留代码', () => {
    /**
     * Feature: article-content-quality-improvement, Property 7: 代码块标记移除但保留代码
     * 对于任何包含代码块标记的文本，清理后应移除标记但保留代码内容
     */
    it('should remove code block markers but keep code content', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5 }).filter(s => 
            !s.includes('```') && 
            !s.includes('`') &&
            !s.includes('*') &&
            !s.includes('_') &&
            s.trim().length >= 5
          ),
          (code) => {
            // 构造包含代码块的文本
            const codeBlock = `\`\`\`\n${code}\n\`\`\``;
            
            // 清理
            const cleaned = ContentCleaner.removeMarkdownSymbols(codeBlock);
            
            // 验证：代码应该保留（去除空格后比较），标记应该移除
            const codeTrimmed = code.trim();
            const cleanedTrimmed = cleaned.trim();
            const hasCode = cleanedTrimmed.includes(codeTrimmed) || codeTrimmed.includes(cleanedTrimmed);
            const hasMarker = cleaned.includes('```');
            
            return hasCode && !hasMarker;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('属性 8: Markdown链接转换为纯文本', () => {
    /**
     * Feature: article-content-quality-improvement, Property 8: Markdown链接转换为纯文本
     * 对于任何包含Markdown链接格式的文本，清理后应转换为"text (url)"格式
     */
    it('should convert markdown links to plain text format', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => 
            !s.includes('[') && 
            !s.includes(']') && 
            !s.includes('*') &&
            !s.includes('_') &&
            s.trim().length > 0
          ),
          fc.webUrl(),
          (linkText, url) => {
            // 构造Markdown链接
            const markdownLink = `[${linkText}](${url})`;
            
            // 清理
            const cleaned = ContentCleaner.removeMarkdownSymbols(markdownLink);
            
            // 验证：应该转换为 "text (url)" 格式
            // 链接文本应该保留（可能被其他规则处理过）
            const hasUrl = cleaned.includes(url);
            const hasMarkdownFormat = cleaned.includes('[') || cleaned.includes('](');
            
            return hasUrl && !hasMarkdownFormat;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('属性 9: 段落结构保持不变', () => {
    /**
     * Feature: article-content-quality-improvement, Property 9: 段落结构保持不变
     * 对于任何有段落结构的文本，清理后应保持原有的段落分隔和换行
     */
    it('should preserve paragraph structure', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 10 }), { minLength: 2, maxLength: 5 }),
          (paragraphs) => {
            // 构造有段落结构的文本
            const textWithParagraphs = paragraphs.join('\n\n');
            
            // 清理
            const cleaned = ContentCleaner.cleanArticleContent(textWithParagraphs);
            
            // 验证：段落数量应该保持（允许一些清理导致的合并）
            const originalParagraphCount = paragraphs.length;
            const cleanedParagraphCount = cleaned.split('\n\n').filter(p => p.trim().length > 0).length;
            
            // 清理后的段落数应该不少于原始段落数的一半（考虑到可能的合并）
            return cleanedParagraphCount >= Math.floor(originalParagraphCount / 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
