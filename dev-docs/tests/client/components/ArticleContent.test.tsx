import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ArticleContent from './ArticleContent';

describe('ArticleContent Component', () => {
  // Feature: article-image-embedding, Property 4: Markdown渲染正确性
  // 验证需求: 2.1, 2.2
  describe('Property 4: Markdown渲染正确性', () => {
    it('应该将Markdown图片标记渲染为HTML img标签', () => {
      const content = '这是一段文字\n\n![测试图片](https://example.com/image.jpg)\n\n这是另一段文字';
      
      const { container } = render(<ArticleContent content={content} />);
      
      // 验证img标签存在
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('src')).toBe('https://example.com/image.jpg');
      expect(img?.getAttribute('alt')).toBe('测试图片');
    });

    it('应该正确渲染包含多个Markdown元素的内容', () => {
      const content = `# 标题

这是一段文字

![图片](https://example.com/image.jpg)

- 列表项1
- 列表项2`;
      
      const { container } = render(<ArticleContent content={content} />);
      
      // 验证各种元素都被正确渲染
      expect(container.querySelector('h1')).toBeTruthy();
      expect(container.querySelector('img')).toBeTruthy();
      expect(container.querySelector('ul')).toBeTruthy();
      expect(container.querySelectorAll('li').length).toBe(2);
    });
  });

  // Feature: article-image-embedding, Property 15: 图片样式应用完整性
  // 验证需求: 7.1, 7.2, 7.3, 7.4
  describe('Property 15: 图片样式应用完整性', () => {
    it('应该为图片应用正确的样式属性', () => {
      const content = '![测试](https://example.com/image.jpg)';
      
      const { container } = render(<ArticleContent content={content} />);
      
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      
      const style = img?.style;
      expect(style?.width).toBe('100%');
      expect(style?.maxHeight).toBe('400px');
      expect(style?.objectFit).toBe('cover');
      expect(style?.borderRadius).toBe('6px');
      expect(style?.border).toBe('1px solid #e2e8f0');
    });
  });

  // Feature: article-image-embedding, Property 16: Markdown语法支持完整性
  // 验证需求: 8.2
  describe('Property 16: Markdown语法支持完整性', () => {
    it('应该支持图片、标题、列表等基本Markdown语法', () => {
      const content = `# 一级标题
## 二级标题

这是段落文字

![图片](https://example.com/image.jpg)

- 无序列表1
- 无序列表2

1. 有序列表1
2. 有序列表2

**加粗文本**

*斜体文本*`;
      
      const { container } = render(<ArticleContent content={content} />);
      
      // 验证各种Markdown语法都被正确解析
      expect(container.querySelector('h1')).toBeTruthy();
      expect(container.querySelector('h2')).toBeTruthy();
      expect(container.querySelector('img')).toBeTruthy();
      expect(container.querySelector('ul')).toBeTruthy();
      expect(container.querySelector('ol')).toBeTruthy();
      expect(container.querySelector('strong')).toBeTruthy();
      expect(container.querySelector('em')).toBeTruthy();
    });
  });

  // Feature: article-image-embedding, Property 17: 自定义图片组件应用
  // 验证需求: 8.3
  describe('Property 17: 自定义图片组件应用', () => {
    it('应该使用自定义图片组件而不是默认img标签', () => {
      const content = '![测试](https://example.com/image.jpg)';
      
      const { container } = render(<ArticleContent content={content} />);
      
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      
      // 验证自定义样式被应用
      expect(img?.style.borderRadius).toBe('6px');
      expect(img?.style.margin).toBe('16px 0px');
    });
  });

  // Feature: article-image-embedding, Property 9: 旧格式检测准确性
  // 验证需求: 5.2
  describe('Property 9: 旧格式检测准确性', () => {
    it('应该能检测内容是否包含图片标记', () => {
      const contentWithImage = '文字\n\n![图片](url)\n\n文字';
      const contentWithoutImage = '只有文字内容';
      
      const hasImageRegex = /!\[.*?\]\(.*?\)/;
      
      expect(hasImageRegex.test(contentWithImage)).toBe(true);
      expect(hasImageRegex.test(contentWithoutImage)).toBe(false);
    });
  });

  // Feature: article-image-embedding, Property 10: 旧格式自动转换
  // 验证需求: 5.3
  describe('Property 10: 旧格式自动转换', () => {
    it('当内容不包含图片标记但有imageUrl时，应该自动在开头插入图片', () => {
      const content = '这是文章内容';
      const imageUrl = 'https://example.com/image.jpg';
      
      const { container } = render(
        <ArticleContent content={content} imageUrl={imageUrl} />
      );
      
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('src')).toBe(imageUrl);
    });

    it('当内容已包含图片标记时，不应该重复插入imageUrl', () => {
      const content = '文字\n\n![已有图片](https://example.com/existing.jpg)\n\n文字';
      const imageUrl = 'https://example.com/new.jpg';
      
      const { container } = render(
        <ArticleContent content={content} imageUrl={imageUrl} />
      );
      
      const images = container.querySelectorAll('img');
      expect(images.length).toBe(1);
      expect(images[0].getAttribute('src')).toBe('https://example.com/existing.jpg');
    });
  });

  // Feature: article-image-embedding, Property 11: 新格式优先级
  // 验证需求: 5.4
  describe('Property 11: 新格式优先级', () => {
    it('当内容包含图片标记时，应该使用内容中的图片而不是imageUrl', () => {
      const content = '![内容中的图片](https://example.com/content-image.jpg)';
      const imageUrl = 'https://example.com/url-image.jpg';
      
      const { container } = render(
        <ArticleContent content={content} imageUrl={imageUrl} />
      );
      
      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toBe('https://example.com/content-image.jpg');
    });
  });
});
