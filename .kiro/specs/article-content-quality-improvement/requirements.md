# 需求文档

## 简介

本规范旨在改进文章生成模块的内容质量和文章管理模块的功能，解决当前存在的三个主要问题：
1. 生成的文章内容包含大模型的思考过程
2. 生成的文章包含Markdown格式符号（#、*等）
3. 文章管理模块预览时无法显示图片，且缺少编辑功能

## 术语表

- **System**: 文章生成和管理系统
- **AI Provider**: 人工智能服务提供商（DeepSeek、Gemini、Ollama）
- **Article Content**: 文章正文内容
- **Thinking Process**: AI模型在生成内容时的推理过程文本
- **Markdown Symbols**: Markdown格式标记符号，如#（标题）、*（加粗/斜体）、-（列表）等
- **Preview Mode**: 文章预览显示模式
- **Edit Mode**: 文章编辑模式
- **Image URL**: 图片的访问路径

## 需求

### 需求 1：清理AI思考过程

**用户故事：** 作为内容编辑，我希望生成的文章内容不包含AI的思考过程，以便获得干净、可直接使用的文章内容。

#### 验收标准

1. WHEN System调用AI生成文章 THEN System SHALL在保存前移除所有思考过程标记和内容
2. WHEN AI响应包含"让我思考"、"首先"、"分析"等思考过程关键词 THEN System SHALL识别并删除这些段落
3. WHEN AI响应包含XML标签（如`<thinking>`、`<analysis>`）THEN System SHALL移除标签及其包含的内容
4. WHEN 清理完成后 THEN System SHALL验证剩余内容不为空且长度合理

### 需求 2：移除Markdown格式符号

**用户故事：** 作为内容编辑，我希望生成的文章是纯文本格式，不包含任何Markdown符号，以便内容更易读且适合多种发布渠道。

#### 验收标准

1. WHEN System处理生成的文章内容 THEN System SHALL移除所有标题标记符号（#）
2. WHEN 文章内容包含加粗或斜体标记（*、**、_、__）THEN System SHALL移除这些符号但保留文本内容
3. WHEN 文章内容包含列表标记（-、*、数字加点）THEN System SHALL转换为纯文本格式
4. WHEN 文章内容包含代码块标记（```）THEN System SHALL移除标记但保留代码内容
5. WHEN 文章内容包含链接格式（[text](url)）THEN System SHALL转换为"text (url)"格式
6. WHEN 清理完成后 THEN System SHALL保持文章的段落结构和换行

### 需求 3：文章预览显示图片

**用户故事：** 作为内容编辑，我希望在文章管理模块预览文章时能看到关联的图片，以便完整查看文章效果。

#### 验收标准

1. WHEN 用户在文章列表中点击查看文章 THEN System SHALL在预览模态框中显示文章关联的图片
2. WHEN 文章有关联的image_url THEN System SHALL在文章内容上方显示该图片
3. WHEN 图片URL无效或图片加载失败 THEN System SHALL显示占位图或错误提示
4. WHEN 文章没有关联图片 THEN System SHALL仅显示文章内容不显示图片区域
5. WHEN 显示图片 THEN System SHALL设置合适的图片尺寸和样式以保持良好的视觉效果

### 需求 4：文章编辑功能

**用户故事：** 作为内容编辑，我希望能够编辑已生成的文章内容和标题，以便对AI生成的内容进行优化和调整。

#### 验收标准

1. WHEN 用户在文章详情模态框中 THEN System SHALL提供"编辑"按钮
2. WHEN 用户点击编辑按钮 THEN System SHALL切换到编辑模式并显示可编辑的表单
3. WHEN 在编辑模式下 THEN System SHALL允许用户修改文章标题和内容
4. WHEN 用户修改完成并点击保存 THEN System SHALL验证输入并更新数据库中的文章记录
5. WHEN 保存成功 THEN System SHALL更新updated_at时间戳并返回预览模式
6. WHEN 用户点击取消 THEN System SHALL放弃修改并返回预览模式
7. WHEN 标题为空或内容为空 THEN System SHALL阻止保存并显示验证错误提示

### 需求 5：优化AI提示词

**用户故事：** 作为系统管理员，我希望优化发送给AI的提示词，以便从源头减少思考过程和Markdown符号的出现。

#### 验收标准

1. WHEN System构建AI提示词 THEN System SHALL明确指示AI直接输出文章内容
2. WHEN 提示词中 THEN System SHALL包含"不要包含思考过程"的明确指令
3. WHEN 提示词中 THEN System SHALL包含"使用纯文本格式，不使用Markdown符号"的明确指令
4. WHEN 提示词中 THEN System SHALL指定期望的输出格式（标题和正文）
5. WHEN 提示词发送给AI THEN System SHALL确保指令清晰且不会被其他内容覆盖
