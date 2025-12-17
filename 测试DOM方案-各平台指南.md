# 测试DOM方案 - 各平台发布指南

## 🎯 测试目标

验证所有平台适配器的DOM方案是否正常工作，特别是图片发布功能。

## 📋 测试准备

### 1. 准备测试文章

确保数据库中有包含图片的测试文章：

```sql
-- 查看文章内容
SELECT id, title, LEFT(content, 200) as content_preview 
FROM articles 
WHERE content LIKE '%![%](%' 
LIMIT 5;
```

### 2. 确保图片文件存在

```bash
# 检查图片目录
ls -la server/uploads/gallery/

# 确认图片可访问
file server/uploads/gallery/*.png
file server/uploads/gallery/*.jpg
```

### 3. 配置平台账号

确保在数据库中已配置各平台的登录信息（包含cookies）：

```sql
-- 查看已配置的平台
SELECT platform_id, username, 
       CASE WHEN cookies IS NOT NULL THEN 'Yes' ELSE 'No' END as has_cookies
FROM platform_accounts;
```

## 🧪 测试步骤

### 方法1：通过前端界面测试

1. 启动服务：
```bash
cd server && npm start
cd client && npm start
```

2. 访问发布任务页面：`http://localhost:3000/publishing-tasks`

3. 创建新发布任务：
   - 选择文章（包含图片的文章）
   - 选择平台
   - 点击"创建任务"

4. 执行任务：
   - 点击"执行"按钮
   - 观察浏览器窗口（headless: false）
   - 查看控制台日志

### 方法2：通过API直接测试

创建测试脚本 `test-dom-publishing.sh`：

```bash
#!/bin/bash

# 测试单个平台的发布功能
PLATFORM_ID="csdn"  # 可改为其他平台：toutiao, zhihu, bilibili等
ARTICLE_ID=1        # 改为实际的文章ID

echo "🧪 测试 ${PLATFORM_ID} 平台的DOM发布方案..."

# 1. 创建发布任务
TASK_RESPONSE=$(curl -s -X POST http://localhost:3001/api/publishing/tasks \
  -H "Content-Type: application/json" \
  -d "{
    \"article_id\": ${ARTICLE_ID},
    \"platforms\": [\"${PLATFORM_ID}\"],
    \"config\": {}
  }")

TASK_ID=$(echo $TASK_RESPONSE | jq -r '.task.id')
echo "✅ 任务已创建: ID = ${TASK_ID}"

# 2. 执行任务
echo "🚀 开始执行任务..."
curl -X POST "http://localhost:3001/api/publishing/tasks/${TASK_ID}/execute"

# 3. 等待执行完成
sleep 10

# 4. 查看任务状态
echo ""
echo "📊 任务状态:"
curl -s "http://localhost:3001/api/publishing/tasks/${TASK_ID}" | jq '.'

echo ""
echo "✅ 测试完成！请检查浏览器窗口和日志输出。"
```

使用方法：
```bash
chmod +x test-dom-publishing.sh
./test-dom-publishing.sh
```

## 🔍 观察要点

### 1. 浏览器行为
- ✅ 浏览器窗口正常打开（非headless）
- ✅ 成功导航到发布页面
- ✅ 标题正确填写
- ✅ 内容区域显示文字和图片
- ✅ 图片正常显示（不是占位符）

### 2. 控制台日志
查看关键日志：

```
[平台名] ✅ 标题已填写: xxx
[平台名] 📷 找到 N 张图片
[平台名] ✅ 图片已转换为base64: /uploads/gallery/xxx.png
[平台名] 🔧 使用DOM直接设置编辑器内容
[平台名] ✅ 内容已通过DOM设置
✅ [平台名]文章发布成功
```

### 3. 错误处理
如果看到以下日志，说明DOM方案失败但后备方案生效：

```
[平台名] ⚠️ DOM方案失败，使用纯文本后备方案
```

这种情况需要：
- 检查编辑器选择器是否正确
- 确认页面结构是否变化
- 查看详细错误信息

## 📝 各平台测试清单

### 优先测试（已有成功案例）
- [ ] 头条号 (toutiao) - 参考实现
- [ ] CSDN (csdn)
- [ ] 知乎 (zhihu)

### 次要测试
- [ ] 百家号 (baijiahao)
- [ ] 哔哩哔哩 (bilibili)
- [ ] 简书 (jianshu)
- [ ] 企鹅号 (qie)

### 特殊平台
- [ ] 微信公众号 (wechat) - iframe编辑器
- [ ] 小红书 (xiaohongshu) - 移动端为主
- [ ] 抖音号 (douyin) - 短视频为主

### 其他平台
- [ ] 搜狐号 (souhu)
- [ ] 网易号 (wangyi)

## 🐛 常见问题排查

### 问题1：图片显示为 [IMAGE_PLACEHOLDER]

**原因**：DOM方案未生效，使用了旧的剪贴板方案

**解决**：
1. 检查 `buildHtmlWithImages()` 是否被调用
2. 确认图片文件路径正确
3. 查看base64转换是否成功

### 问题2：编辑器选择器找不到

**错误日志**：`Waiting for selector xxx failed: timeout`

**解决**：
1. 手动访问平台发布页面
2. 使用浏览器开发者工具检查实际选择器
3. 更新 `getPublishSelectors()` 中的选择器

### 问题3：内容设置后立即消失

**原因**：页面有JavaScript监听器覆盖了内容

**解决**：
1. 增加等待时间
2. 尝试多次触发事件
3. 检查是否需要点击特定按钮激活编辑器

### 问题4：图片过大导致超时

**现象**：图片转换base64后内容过大

**解决**：
```typescript
// 在 buildHtmlWithImages 中添加图片大小检查
const stats = await fs.stat(fullPath);
const fileSizeMB = stats.size / (1024 * 1024);

if (fileSizeMB > 5) {
  console.warn(`[${this.platformName}] ⚠️ 图片过大: ${fileSizeMB.toFixed(2)}MB`);
  // 可以选择跳过或压缩
}
```

## 📊 测试记录模板

```markdown
## 平台：[平台名称]
- 测试日期：2024-XX-XX
- 测试文章ID：XXX
- 图片数量：X张

### 测试结果
- [ ] 登录成功
- [ ] 标题填写成功
- [ ] 内容填写成功
- [ ] 图片显示正常
- [ ] 发布成功

### 问题记录
1. [描述问题]
   - 错误信息：
   - 解决方案：

### 选择器验证
- 标题输入框：`selector`
- 内容编辑器：`selector`
- 发布按钮：`selector`

### 备注
[其他需要记录的信息]
```

## 🎓 最佳实践

1. **逐个平台测试**：不要一次测试所有平台，先确保一个平台完全正常
2. **保持浏览器可见**：使用 `headless: false` 观察实际操作
3. **详细日志**：确保每个关键步骤都有日志输出
4. **截图保存**：在关键步骤截图，便于问题排查
5. **选择器更新**：平台页面可能更新，定期验证选择器

## 🔗 相关文档

- `头条号自动发布-经验总结.md` - 技术方案详解
- `DOM方案应用完成-所有平台.md` - 实现总结
- `发布任务故障排查指南.md` - 问题排查

## ✅ 验收标准

一个平台的DOM方案被认为成功，需要满足：

1. ✅ 能够自动登录（Cookie或表单）
2. ✅ 能够填写标题
3. ✅ 能够设置内容（文字+图片）
4. ✅ 图片在编辑器中正常显示
5. ✅ 能够点击发布按钮
6. ✅ 发布后能够验证成功

如果以上6点都满足，该平台的DOM方案即为成功！
