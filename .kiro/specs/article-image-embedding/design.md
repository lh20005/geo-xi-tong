# 设计文档

## 概述

文章图片嵌入功能通过改进文章生成和渲染逻辑，使图片能够自然地嵌入到文章内容中，而不是作为独立元素显示。该功能采用Markdown格式存储图片标记，并使用React Markdown库进行渲染，确保生成的文章更接近互联网上的标准高质量图文文章。

核心改进包括：
- 文章生成时在内容中插入Markdown格式的图片标记
- 使用React Markdown库渲染包含图片的文章内容
- 支持编辑时修改图片位置和URL
- 向后兼容现有的旧格式文章数据
- 提供优雅的图片加载失败处理

## 架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (React)                            │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ ArticleListPage  │  │ ArticleGeneration│                     │
│  │                  │  │ Page             │                     │
│  │ - Markdown渲染   │  │                  │                     │
│  │ - 图片样式       │  │                  │                     │
│  │ - 编辑支持       │  │                  │                     │
│  └──────────────────┘  └──────────────────┘                     │
│           │                      │                               │
│           │                      │                               │
│  ┌────────▼──────────────────────▼────────┐                     │
│  │     React Markdown 组件                │                     │
│  │  - 解析Markdown语法                    │                     │
│  │  - 自定义图片渲染                      │                     │
│  │  - 错误处理                            │                     │
│  └────────────────────────────────────────┘                     │
│                              │ HTTP/REST API                     │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                              │          后端层 (Express)         │
│                      ┌───────▼────────┐                          │
│                      │  Service层     │                          │
│                      │ ArticleGen     │                          │
│                      │ Service        │                          │
│                      │                │                          │
│                      │ - 图片标记插入 │                          │
│                      │ - AI提示词优化 │                          │
│                      │ - 占位符替换   │                          │
│                      └───────┬────────┘                          │
│                              │                                   │
│                      ┌───────▼────────┐                          │
│                      │  AIService     │                          │
│                      │  (DeepSeek/    │                          │
│                      │   Gemini/      │                          │
│                      │   Ollama)      │                          │
│                      └────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### 技术栈

- **前端**: React 18, TypeScript, Ant Design 5, react-markdown, remark-gfm
- **后端**: Node.js, Express, TypeScript
- **数据库**: PostgreSQL (使用现有schema)
- **Markdown处理**: react-markdown (前端), marked (后端可选)

## 组件和接口

### 前端组件

#### 1. ArticleContent 组件（新增）

专门用于渲染包含Markdown的文章内容。

**Props**:
```typescript
interface ArticleContentProps {
  content: string;
  imageUrl?: string; // 用于向后兼容旧格式
  className?: string;
  style?: React.CSSProperties;
}
```

**功能**:
- 使用react-markdown渲染Markdown内容
- 自定义图片组件，应用统一样式
- 处理图片加载失败
- 向后兼容：如果内容不包含图片标记但有imageUrl，自动在开头插入

**示例**:
```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ArticleContent: React.FC<ArticleContentProps> = ({ 
  content, 
  imageUrl, 
  className, 
  style 
}) => {
  // 向后兼容：检查内容是否包含图片标记
  const hasImageInContent = /!\[.*?\]\(.*?\)/.test(content);
  
  // 如果没有图片标记但有imageUrl，在开头插入
  const finalContent = !hasImageInContent && imageUrl
    ? `![文章配图](${imageUrl})\n\n${content}`
    : content;

  return (
    <ReactMarkdown
      className={className}
      style={style}
      remarkPlugins={[remarkGfm]}
      components={{
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
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E图片加载失败%3C/text%3E%3C/svg%3E';
            }}
          />
        ),
      }}
    >
      {finalContent}
    </ReactMarkdown>
  );
};
```

#### 2. ArticleListPage 组件更新

更新文章详情Modal，使用ArticleContent组件。

**主要变更**:
- 移除独立的图片显示区域
- 使用ArticleContent组件渲染内容
- 编辑模式下提示用户可以使用Markdown语法

#### 3. ArticleGenerationPage 组件更新

更新文章预览，使用ArticleContent组件。

**主要变更**:
- 使用ArticleContent组件替代纯文本显示
- 支持Markdown格式预览

### 后端服务

#### ArticleGenerationService 更新

**新增/修改方法**:

```typescript
class ArticleGenerationService {
  /**
   * 在文章内容中插入图片标记
   */
  private insertImageIntoContent(
    content: string,
    imageUrl: string
  ): string {
    // 检查内容是否已包含图片占位符（AI生成的）
    const placeholderRegex = /\[IMAGE_PLACEHOLDER\]/i;
    if (placeholderRegex.test(content)) {
      // 替换占位符为实际图片
      return content.replace(
        placeholderRegex,
        `![文章配图](${imageUrl})`
      );
    }

    // 如果没有占位符，智能插入图片
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    
    if (paragraphs.length === 0) {
      // 空内容，直接返回图片
      return `![文章配图](${imageUrl})\n\n${content}`;
    } else if (paragraphs.length === 1) {
      // 只有一段，图片放在末尾
      return `${content}\n\n![文章配图](${imageUrl})`;
    } else {
      // 多段，图片放在第一段或第二段后
      const insertIndex = 1; // 在第一段后插入
      paragraphs.splice(
        insertIndex,
        0,
        `![文章配图](${imageUrl})`
      );
      return paragraphs.join('\n\n');
    }
  }

  /**
   * 构建包含图片指示的AI提示词
   */
  private buildPromptWithImageInstruction(
    basePrompt: string,
    keyword: string,
    topics: string[],
    knowledgeContent: string
  ): string {
    const topicsList = topics.map((t, i) => `${i + 1}. ${t}`).join('\n');

    let prompt = '【重要输出要求】\n';
    prompt += '1. 直接输出文章内容，不要包含任何思考过程\n';
    prompt += '2. 使用纯文本格式，不要使用Markdown符号（如#、*、-等）\n';
    prompt += '3. 在文章的适当位置（建议在第一段或第二段之后）插入 [IMAGE_PLACEHOLDER] 标记，用于后续插入配图\n';
    prompt += '4. 按照"标题：[标题内容]"格式开始，然后是正文\n';
    prompt += '5. 文章内容要自然流畅，段落之间用空行分隔\n\n';
    prompt += basePrompt + '\n\n';
    prompt += `核心关键词：${keyword}\n\n`;
    prompt += '相关话题：\n' + topicsList;

    if (knowledgeContent && knowledgeContent.trim().length > 0) {
      prompt += '\n\n企业知识库参考资料：\n' + knowledgeContent;
    }

    prompt += '\n\n请撰写一篇专业、高质量的文章。严格按照以下格式输出：\n\n';
    prompt += '标题：[文章标题]\n\n[文章正文内容，在适当位置包含 [IMAGE_PLACEHOLDER]]';

    return prompt;
  }

  /**
   * 生成单篇文章（更新版本）
   */
  async generateSingleArticle(
    keyword: string,
    topics: string[],
    imageUrl: string,
    knowledgeContent: string,
    articlePrompt: string,
    aiConfig: any
  ): Promise<{ success: boolean; title?: string; content?: string; error?: string }> {
    try {
      // 构建包含图片指示的AI prompt
      const prompt = this.buildPromptWithImageInstruction(
        articlePrompt,
        keyword,
        topics,
        knowledgeContent
      );

      // 调用AI服务
      const aiService = new AIService({
        provider: aiConfig.provider,
        apiKey: aiConfig.api_key,
        ollamaBaseUrl: aiConfig.ollama_base_url,
        ollamaModel: aiConfig.ollama_model
      });

      const response = await aiService['callAI'](prompt);

      if (!response || response.trim().length === 0) {
        throw new Error('AI返回了空响应');
      }

      // 解析响应提取标题和内容
      const parsed = this.parseArticleResponse(response);
      
      // 在内容中插入图片
      const contentWithImage = this.insertImageIntoContent(
        parsed.content,
        imageUrl
      );

      return {
        success: true,
        title: parsed.title,
        content: contentWithImage
      };
    } catch (error: any) {
      return {
        success: false,
        error: `生成文章失败 (关键词: ${keyword}): ${error.message}`
      };
    }
  }
}
```

## 数据模型

### 数据库Schema

不需要修改现有的数据库schema。`articles`表已经有`content`和`image_url`字段：
- `content`: 存储包含Markdown图片标记的完整文章内容
- `image_url`: 保留用于向后兼容和备用引用

### TypeScript类型定义

```typescript
// 文章实体（无需修改）
interface Article {
  id: number;
  title: string;
  content: string; // 现在包含Markdown格式的图片标记
  keyword: string;
  distillationId: number;
  taskId: number | null;
  imageUrl: string | null; // 保留用于向后兼容
  provider: string;
  createdAt: string;
  updatedAt: string;
}

// Markdown渲染配置
interface MarkdownRenderConfig {
  remarkPlugins: any[];
  components: {
    img: (props: any) => JSX.Element;
    // 可以添加其他自定义组件
  };
}
```

## 正确性属性

*属性是指在系统的所有有效执行中都应该成立的特征或行为——本质上是关于系统应该做什么的正式声明。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*


### 属性 1: 图片标记插入完整性

*对于任意*文章内容和图片URL，插入图片后的内容应该包含正确格式的Markdown图片标记 `![alt](url)`
**验证: 需求 1.1, 1.3**

### 属性 2: 多段落图片位置正确性

*对于任意*包含多个段落的文章内容，图片标记应该出现在第一段或第二段之后
**验证: 需求 1.2**

### 属性 3: 内容持久化完整性

*对于任意*生成的文章，保存到数据库后查询的content字段应该包含图片标记
**验证: 需求 1.4**

### 属性 4: Markdown渲染正确性

*对于任意*包含Markdown图片标记的内容，渲染后应该包含对应的HTML img标签
**验证: 需求 2.1, 2.2**

### 属性 5: 图片URL格式正确性

*对于任意*图片选择操作，返回的URL应该是完整的路径格式
**验证: 需求 3.1, 3.2**

### 属性 6: 编辑保存一致性

*对于任意*编辑后的文章内容，保存后查询应该返回相同的内容（包括Markdown标记）
**验证: 需求 4.1, 4.4**

### 属性 7: 图片标记语法验证

*对于任意*文章内容，验证函数应该能正确识别Markdown图片语法是否正确
**验证: 需求 4.2**

### 属性 8: 向后兼容性保持

*对于任意*现有文章记录，升级后image_url字段应该保持不变
**验证: 需求 5.1**

### 属性 9: 旧格式检测准确性

*对于任意*文章内容，检测函数应该能准确判断是否包含图片标记
**验证: 需求 5.2**

### 属性 10: 旧格式自动转换

*对于任意*不包含图片标记但有image_url的文章，渲染时应该自动在开头插入图片
**验证: 需求 5.3**

### 属性 11: 新格式优先级

*对于任意*包含图片标记的文章，渲染时应该使用内容中的图片而不是image_url字段
**验证: 需求 5.4**

### 属性 12: AI提示词包含占位符指示

*对于任意*AI提示词构建，生成的提示词应该包含图片占位符的插入指示
**验证: 需求 6.1**

### 属性 13: 占位符替换正确性

*对于任意*包含 [IMAGE_PLACEHOLDER] 的内容，替换后应该包含正确的Markdown图片标记
**验证: 需求 6.2**

### 属性 14: 无占位符自动插入

*对于任意*不包含占位符的多段落内容，应该在第一段后自动插入图片标记
**验证: 需求 6.3**

### 属性 15: 图片样式应用完整性

*对于任意*渲染的图片，应该包含最大宽度、最大高度、圆角和边框等样式属性
**验证: 需求 7.1, 7.2, 7.3, 7.4**

### 属性 16: Markdown语法支持完整性

*对于任意*包含图片、标题、列表等Markdown语法的内容，解析后应该正确转换为对应的HTML元素
**验证: 需求 8.2**

### 属性 17: 自定义图片组件应用

*对于任意*Markdown图片标记，渲染时应该使用自定义的图片组件而不是默认的img标签
**验证: 需求 8.3**

## 错误处理

### 客户端错误处理

1. **图片加载失败**:
   - 使用onError事件处理器
   - 显示SVG占位图
   - 不影响文章其他内容的显示

2. **Markdown解析失败**:
   - 捕获解析异常
   - 降级显示纯文本内容
   - 记录错误日志

3. **编辑验证错误**:
   - 实时验证Markdown语法
   - 显示警告但允许保存
   - 提供语法帮助提示

### 服务端错误处理

1. **图片URL无效**:
   - 验证URL格式
   - 使用默认占位图URL
   - 记录警告日志

2. **内容插入失败**:
   - 捕获插入异常
   - 返回原始内容
   - 记录错误信息

3. **数据库保存失败**:
   - 使用事务确保一致性
   - 回滚失败操作
   - 返回详细错误信息

## 测试策略

### 单元测试

1. **图片插入函数测试**:
   - 测试单段落内容
   - 测试多段落内容
   - 测试包含占位符的内容
   - 测试空内容

2. **Markdown渲染测试**:
   - 测试图片标记渲染
   - 测试其他Markdown语法
   - 测试混合内容

3. **向后兼容测试**:
   - 测试旧格式文章检测
   - 测试自动转换逻辑
   - 测试新格式优先级

4. **URL处理测试**:
   - 测试正常URL
   - 测试包含特殊字符的URL
   - 测试相对路径和绝对路径

### 属性测试

使用fast-check进行属性测试，最小迭代次数100次：

1. **图片插入属性**: 生成随机文章内容和URL，验证插入后包含正确的Markdown标记
2. **位置正确性属性**: 生成随机多段落内容，验证图片位置符合规则
3. **渲染一致性属性**: 生成随机Markdown内容，验证渲染结果正确
4. **URL格式属性**: 生成随机URL，验证格式正确性
5. **向后兼容属性**: 生成随机旧格式数据，验证转换逻辑
6. **占位符替换属性**: 生成包含占位符的随机内容，验证替换正确
7. **样式应用属性**: 验证所有渲染的图片都包含必需的样式

### 集成测试

1. **端到端文章生成**: 测试从生成到保存到渲染的完整流程
2. **编辑保存流程**: 测试编辑包含Markdown的文章并保存
3. **旧数据迁移**: 测试现有文章数据的兼容性
4. **多种AI提供商**: 测试不同AI返回内容的处理

### 测试配置

- **属性测试库**: fast-check
- **最小迭代次数**: 100次
- **属性测试标记格式**: `// Feature: article-image-embedding, Property {number}: {property_text}`

## 安全考虑

1. **XSS防护**: 
   - React Markdown自动转义HTML
   - 验证图片URL格式
   - 不允许执行JavaScript

2. **URL验证**:
   - 验证图片URL协议（http/https）
   - 防止路径遍历攻击
   - 限制URL长度

3. **内容验证**:
   - 限制文章内容长度
   - 验证Markdown语法
   - 过滤危险标签

## 性能考虑

1. **Markdown解析优化**:
   - 使用高性能的react-markdown库
   - 启用必要的插件（remark-gfm）
   - 避免不必要的重新解析

2. **图片加载优化**:
   - 使用懒加载（可选）
   - 设置合理的图片尺寸限制
   - 使用CDN加速图片加载

3. **渲染性能**:
   - 使用React.memo优化组件
   - 避免不必要的重渲染
   - 虚拟化长文章列表

4. **缓存策略**:
   - 浏览器缓存图片资源
   - 缓存解析后的Markdown结果
   - 使用Service Worker（可选）

## 部署注意事项

1. **依赖安装**:
   ```bash
   # 前端依赖
   cd client
   npm install react-markdown remark-gfm
   ```

2. **数据迁移**:
   - 不需要修改数据库schema
   - 现有数据自动兼容
   - 建议备份数据库

3. **配置更新**:
   - 更新前端构建配置
   - 确保Markdown库正确打包
   - 测试生产环境渲染

4. **回滚计划**:
   - 保留旧版本代码
   - 数据格式向后兼容
   - 可以无缝回滚

## 未来扩展

1. **富文本编辑器**:
   - 集成Markdown编辑器
   - 提供可视化编辑模式
   - 支持拖拽插入图片

2. **多图片支持**:
   - 支持文章中插入多张图片
   - 智能分布图片位置
   - 图片画廊功能

3. **图片优化**:
   - 自动压缩图片
   - 生成多种尺寸
   - 响应式图片加载

4. **更多Markdown功能**:
   - 支持表格
   - 支持代码高亮
   - 支持数学公式

5. **内容预览**:
   - 实时Markdown预览
   - 移动端预览
   - 分享预览链接

6. **SEO优化**:
   - 自动生成图片alt文本
   - 优化图片文件名
   - 结构化数据标记
