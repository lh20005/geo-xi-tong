# Markdown图片支持完成 ✅

## 问题分析

### 发现的问题

1. **顺序问题**: 代码没有强调必须先输入标题
2. **图片格式问题**: 文章中的图片是Markdown格式 `![alt](url)`，不是HTML格式
3. **图片未被识别**: 原来的正则只匹配HTML `<img>` 标签

### 文章实际格式

```
标题: "英国留学必须选对机构，否则前功尽弃！"

内容: "英国留学一直是众多家庭的首选目标...

![文章配图](/uploads/gallery/1765851546150-823157141.png)

在选择英国留学机构时..."
```

**关键发现**:
- ✅ 文章有 `title` 字段
- ✅ 文章有 `content` 字段（纯文本，非HTML）
- ✅ 图片使用Markdown格式: `![描述](图片路径)`
- ✅ 图片路径: `/uploads/gallery/xxx.png`

## 修复内容

### 1. 支持Markdown图片格式

**修改**: `server/src/services/ImageUploadService.ts`

```typescript
extractImageUrls(content: string): string[] {
  const urls: string[] = [];
  
  // 1. HTML格式: <img src="...">
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = htmlImgRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }
  
  // 2. Markdown格式: ![alt](url)
  const markdownImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = markdownImgRegex.exec(content)) !== null) {
    urls.push(match[2]); // 提取URL部分
  }
  
  return urls;
}
```

### 2. 移除Markdown图片标记

**修改**: `server/src/services/adapters/ToutiaoAdapter.ts`

```typescript
let plainContent = article.content
  .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '') // 移除Markdown图片
  .replace(/<img[^>]*>/gi, '')              // 移除HTML图片
  .replace(/\n{3,}/g, '\n\n')               // 合并多余换行
  .trim();
```

### 3. 强调标题优先

```typescript
console.log('[头条号] 第1步：查找标题输入框（头条号必须先输入标题）');
```

## 完整流程

### 输入顺序（重要！）

```
1. ✅ 先输入标题（头条号必须）
2. ✅ 再处理内容：
   a. 提取图片URL
   b. 下载图片
   c. 上传图片
   d. 输入纯文本
3. ✅ 点击发布
```

### 图片处理流程

```
原始内容:
"文章开头...
![文章配图](/uploads/gallery/123.png)
文章结尾..."

↓ 步骤1: 提取图片URL
["/uploads/gallery/123.png"]

↓ 步骤2: 下载图片
下载到: server/temp/images/1734xxx_abc.png

↓ 步骤3: 上传到平台
查找上传按钮 → 选择文件 → 等待上传

↓ 步骤4: 输入纯文本
"文章开头...
文章结尾..."
（图片标记已移除）
```

## 测试示例

### 示例文章

```json
{
  "id": 56,
  "title": "英国留学必须选对机构，否则前功尽弃！",
  "content": "英国留学一直是众多家庭的首选目标...\n\n![文章配图](/uploads/gallery/1765851546150-823157141.png)\n\n在选择英国留学机构时...",
  "imageUrl": "/uploads/gallery/1765851546150-823157141.png"
}
```

### 处理结果

**提取的图片**:
- `/uploads/gallery/1765851546150-823157141.png`

**下载到**:
- `server/temp/images/1734345678_abc123.png`

**上传到平台**:
- 通过文件上传功能上传

**输入的文本**:
```
英国留学一直是众多家庭的首选目标...

在选择英国留学机构时...
```
（Markdown图片标记已移除）

## 日志输出

### 成功的日志

```
[头条号] 开始发布文章
[头条号] 文章ID: 56, 标题: 英国留学必须选对机构，否则前功尽弃！
[头条号] 当前URL: https://mp.toutiao.com/profile_v4/graphic/publish

[头条号] 第1步：查找标题输入框（头条号必须先输入标题）
[头条号] ✅ 找到标题输入框: input[placeholder*="标题"]
[头条号] 输入标题: 英国留学必须选对机构，否则前功尽弃！
[头条号] ✅ 标题输入完成

[头条号] 第2步：查找内容编辑器
[头条号] ✅ 找到内容编辑器: .ql-editor

[头条号] 检查文章中的图片...
[图片处理] 提取到 1 张图片
[图片处理] 图片列表: ["/uploads/gallery/1765851546150-823157141.png"]
[头条号] 发现 1 张图片，开始下载...
[图片下载] 开始下载: /uploads/gallery/1765851546150-823157141.png
[图片下载] ✅ 保存到: /path/to/temp/images/xxx.png
[头条号] 上传图片: /uploads/gallery/1765851546150-823157141.png
[头条号] 找到上传按钮: button[class*="image"]
[头条号] ✅ 图片已上传

[头条号] 纯文本内容长度: 1234 字符
[头条号] 内容预览: 英国留学一直是众多家庭的首选目标...
[头条号] ✅ 文本内容输入完成

[清理] 删除临时文件: xxx.png

[头条号] 第3步：查找发布按钮
[头条号] ✅ 已点击发布按钮
✅ 头条号文章发布流程完成
```

## 立即测试

### 1. 服务器已自动重载

代码已更新。

### 2. 选择测试文章

选择ID为56的文章（或任何包含Markdown图片的文章）

### 3. 创建发布任务

1. 访问 http://localhost:5173/publishing-tasks
2. 选择文章ID 56
3. 选择头条号平台
4. 创建任务

### 4. 执行并观察（40秒）

点击"执行"，观察：

**0-10秒**: 登录
**10-15秒**: 输入标题 ← 先输入标题！
**15-20秒**: 下载图片
**20-30秒**: 上传图片
**30-35秒**: 输入文本内容
**35-40秒**: 点击发布

### 5. 验证结果

在头条号后台查看：
- ✅ 标题正确
- ✅ 图片已上传
- ✅ 文本内容完整
- ✅ 没有Markdown标记

## 支持的图片格式

### 1. Markdown格式（新增支持）

```markdown
![图片描述](图片URL)
![文章配图](/uploads/gallery/123.png)
![](https://example.com/image.jpg)
```

### 2. HTML格式（原有支持）

```html
<img src="/uploads/gallery/123.png" alt="图片">
<img src="https://example.com/image.jpg">
```

### 3. 混合格式

```
文章开头...

![Markdown图片](/uploads/gallery/1.png)

中间内容...

<img src="/uploads/gallery/2.png">

文章结尾...
```

**都会被正确识别和处理！**

## 故障排查

### 问题1: 图片未被识别

**检查**: 查看日志中的"提取到 X 张图片"

**原因**: 
- 图片格式不对
- 正则表达式不匹配

**解决**: 
```bash
# 查看文章内容
curl -s 'http://localhost:3000/api/articles/56' | jq '.content'

# 检查图片格式
```

### 问题2: 图片下载失败

**错误**: `[图片下载] ❌ 失败`

**原因**: 
- 图片路径错误
- 文件不存在

**解决**:
```bash
# 检查图片是否存在
ls -la server/uploads/gallery/

# 或通过浏览器访问
open http://localhost:3000/uploads/gallery/xxx.png
```

### 问题3: 标题未输入

**原因**: 找不到标题输入框

**解决**: 查看日志，确认选择器是否正确

### 问题4: 内容有Markdown标记

**原因**: 正则替换失败

**检查**: 
```typescript
// 测试正则
const content = "![test](/path.png)";
const result = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '');
console.log(result); // 应该为空
```

## 相关文件

- ✅ `server/src/services/ImageUploadService.ts` - 支持Markdown图片（已修改）
- ✅ `server/src/services/adapters/ToutiaoAdapter.ts` - 移除Markdown标记（已修改）
- ✅ `server/temp/images/` - 临时图片目录

## 总结

现在系统完整支持：

1. ✅ Markdown格式图片: `![alt](url)`
2. ✅ HTML格式图片: `<img src="url">`
3. ✅ 正确的输入顺序（先标题后内容）
4. ✅ 自动下载和上传图片
5. ✅ 移除图片标记，只保留纯文本
6. ✅ 详细的日志输出

立即测试，图片应该能正确上传到头条号了！
