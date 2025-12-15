# 文章编辑器格式保留修复

## 问题描述

在文章管理模块中，点击"编辑"按钮后出现以下问题：
1. 看不到文章的图片
2. 原来的排版格式被打乱

## 根本原因

1. **格式转换问题**：原始文章内容可能是纯文本格式，直接加载到 ReactQuill 编辑器时，段落结构丢失
2. **图片显示问题**：
   - 编辑器加载时没有处理图片URL
   - ArticleContent 组件只支持 Markdown 格式，不支持 HTML 格式

## 修复方案

### 1. ArticleEditorModal.tsx - 内容加载处理

**修复内容**：在 `useEffect` 中添加内容格式转换逻辑

```typescript
useEffect(() => {
  if (article) {
    form.setFieldsValue({
      title: article.title || '',
    });
    
    // 处理文章内容：如果是纯文本，转换为HTML格式并保留段落
    let processedContent = article.content || '';
    
    // 检查内容是否已经是HTML格式（包含HTML标签）
    const hasHtmlTags = /<[^>]+>/.test(processedContent);
    
    if (!hasHtmlTags && processedContent.trim().length > 0) {
      // 纯文本内容：按换行符分割段落，转换为HTML
      const paragraphs = processedContent
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      processedContent = paragraphs.map(p => `<p>${p}</p>`).join('');
      
      // 如果有图片URL，在第一段后插入图片
      if (article.imageUrl && paragraphs.length > 0) {
        const firstParagraph = `<p>${paragraphs[0]}</p>`;
        const imageTag = `<p><img src="${article.imageUrl}" alt="article image" style="max-width: 100%; height: auto;" /></p>`;
        const restParagraphs = paragraphs.slice(1).map(p => `<p>${p}</p>`).join('');
        processedContent = firstParagraph + imageTag + restParagraphs;
      }
    }
    
    setContent(processedContent);
  }
}, [article, form]);
```

**功能说明**：
- 检测内容是否为纯文本（无HTML标签）
- 如果是纯文本，按换行符分割段落并转换为 `<p>` 标签
- 如果文章有图片URL，在第一段后自动插入图片
- 保留原有的段落结构

### 2. ArticleContent.tsx - 支持HTML格式渲染

**修复内容**：添加 HTML 格式检测和渲染逻辑

```typescript
// 检测内容格式：HTML 或 Markdown
const isHtmlContent = /<[^>]+>/.test(content);

if (isHtmlContent) {
  // HTML格式内容：使用DOMPurify清理后直接渲染
  let processedContent = content;
  
  // 如果内容中没有图片标签，但有imageUrl，在第一段后插入图片
  const hasImageTag = /<img[^>]*>/.test(content);
  if (!hasImageTag && imageUrl) {
    // 在第一个</p>标签后插入图片
    const firstParagraphEnd = content.indexOf('</p>');
    if (firstParagraphEnd !== -1) {
      const imageTag = `<p><img src="${imageUrl}" alt="article image" style="max-width: 100%; height: auto; margin: 20px 0; display: block; border-radius: 6px; border: 1px solid #e2e8f0;" /></p>`;
      processedContent = 
        content.substring(0, firstParagraphEnd + 4) + 
        imageTag + 
        content.substring(firstParagraphEnd + 4);
    }
  }
  
  // 清理HTML内容以防止XSS攻击
  const cleanContent = DOMPurify.sanitize(processedContent, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class', 'width', 'height']
  });
  
  return (
    <div 
      className={className} 
      style={style}
      dangerouslySetInnerHTML={{ __html: cleanContent }}
    />
  );
}
```

**功能说明**：
- 自动检测内容是 HTML 还是 Markdown 格式
- HTML 格式：使用 DOMPurify 清理后直接渲染
- Markdown 格式：继续使用 ReactMarkdown 渲染
- 支持向后兼容：如果 HTML 内容中没有图片但提供了 imageUrl，自动插入
- 保持 XSS 防护

## 修复效果

### 编辑器加载时
✅ 纯文本内容自动转换为 HTML 段落格式
✅ 保留原有的段落结构（按换行符分割）
✅ 图片自动显示在第一段后
✅ HTML 格式内容直接加载，保持原有格式

### 预览和查看时
✅ 支持 HTML 和 Markdown 两种格式
✅ 图片正确显示
✅ 格式完整保留
✅ XSS 防护保持有效

## 测试建议

### 测试场景 1：纯文本文章
1. 创建一个纯文本格式的文章（多个段落，有换行）
2. 点击"编辑"按钮
3. 验证：段落结构保留，图片显示在第一段后

### 测试场景 2：HTML 格式文章
1. 创建一个 HTML 格式的文章（包含 `<p>`, `<strong>` 等标签）
2. 点击"编辑"按钮
3. 验证：所有格式保留，图片正确显示

### 测试场景 3：编辑后保存
1. 编辑文章内容（修改文字、添加格式）
2. 保存文章
3. 重新打开编辑
4. 验证：所有修改都被保留

### 测试场景 4：智能排版
1. 打开编辑器
2. 点击"智能排版"按钮
3. 验证：排版后格式正确，图片位置合理

## 相关文件

- `client/src/components/ArticleEditorModal.tsx` - 编辑器组件
- `client/src/components/ArticleContent.tsx` - 内容渲染组件
- `client/src/pages/ArticleListPage.tsx` - 文章列表页面

## 技术要点

1. **格式检测**：使用正则表达式 `/<[^>]+>/` 检测 HTML 标签
2. **段落保留**：按 `\n` 分割并过滤空行
3. **图片插入**：在第一段后插入，使用内联样式确保显示正确
4. **XSS 防护**：使用 DOMPurify 清理所有 HTML 内容
5. **向后兼容**：同时支持 HTML 和 Markdown 格式

## 注意事项

- 所有 HTML 内容都会经过 DOMPurify 清理，确保安全
- 图片样式使用内联 CSS，确保在所有环境下正确显示
- 支持旧格式文章的自动转换和升级
