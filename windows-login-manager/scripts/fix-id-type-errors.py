#!/usr/bin/env python3
"""修复所有 ID 类型转换错误"""

import re

print("开始修复 ID 类型转换错误...")

# 1. 修复 articleHandlers.ts:257
print("1. 修复 articleHandlers.ts...")
with open('windows-login-manager/electron/ipc/handlers/articleHandlers.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 修复 markAsPublished 调用 - 第一个参数应该是 number
content = re.sub(
    r'await articleService\.markAsPublished\(id, publishedAt\);',
    'await articleService.markAsPublished(parseInt(id), publishedAt);',
    content
)

with open('windows-login-manager/electron/ipc/handlers/articleHandlers.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ articleHandlers.ts 修复完成")

# 2. 修复 localGalleryHandlers.ts:83
print("2. 修复 localGalleryHandlers.ts...")
with open('windows-login-manager/electron/ipc/handlers/localGalleryHandlers.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 修复 findByIdWithStats 调用
content = re.sub(
    r'const album = await albumService\.findByIdWithStats\(albumId\);',
    'const album = await albumService.findByIdWithStats(parseInt(albumId));',
    content
)

with open('windows-login-manager/electron/ipc/handlers/localGalleryHandlers.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ localGalleryHandlers.ts 修复完成")

# 3. 修复 localKnowledgeHandlers.ts
print("3. 修复 localKnowledgeHandlers.ts...")
with open('windows-login-manager/electron/ipc/handlers/localKnowledgeHandlers.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 修复 uploadDocument 参数名 (228行)
content = re.sub(
    r'knowledge_base_id: knowledgeBaseId,',
    'knowledgeBaseId: knowledgeBaseId,',
    content
)

# 修复 findDocumentById 调用 (295行)
content = re.sub(
    r'const document = await knowledgeService\.findDocumentById\(docId\);',
    'const document = await knowledgeService.findDocumentById(parseInt(docId));',
    content
)

# 修复 deleteDocument 调用 (320行)
content = re.sub(
    r'await knowledgeService\.deleteDocument\(docId\);',
    'await knowledgeService.deleteDocument(parseInt(docId));',
    content
)

with open('windows-login-manager/electron/ipc/handlers/localKnowledgeHandlers.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ localKnowledgeHandlers.ts 修复完成")

# 4. 修复 taskHandlers.ts
print("4. 修复 taskHandlers.ts...")
with open('windows-login-manager/electron/ipc/handlers/taskHandlers.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 修复所有 task ID 转换
content = re.sub(
    r'const task = await taskService\.findById\(taskId\);',
    'const task = await taskService.findById(parseInt(taskId));',
    content
)

content = re.sub(
    r'await taskService\.delete\(taskId\);',
    'await taskService.delete(parseInt(taskId));',
    content
)

content = re.sub(
    r'const tasks = await taskService\.findByBatchId\(batchId\);',
    'const tasks = await taskService.findByBatchId(batchId); // batchId is string',
    content
)

with open('windows-login-manager/electron/ipc/handlers/taskHandlers.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ taskHandlers.ts 修复完成")

print("\n所有 ID 类型转换错误修复完成！")
print("现在运行: npm run build:electron")
