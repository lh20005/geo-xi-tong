#!/usr/bin/env python3
"""
修复最后的编译错误
1. localKnowledgeHandlers.ts: 参数名和 ID 类型转换
2. taskHandlers.ts: ID 类型转换
3. ArticleServicePostgres.ts: 删除重复方法
"""

import re

def fix_knowledge_handlers():
    """修复 localKnowledgeHandlers.ts"""
    file_path = '../electron/ipc/handlers/localKnowledgeHandlers.ts'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修复第 228 行：knowledge_base_id -> knowledgeBaseId
    content = re.sub(
        r'knowledgeBaseId: parseInt\(knowledge_base_id\)',
        'knowledgeBaseId: parseInt(kbId)',
        content
    )
    
    # 修复第 295 行：parseInt(docId)
    content = re.sub(
        r'const doc = await knowledgeBaseService\.findDocumentById\(docId\);',
        'const doc = await knowledgeBaseService.findDocumentById(parseInt(docId));',
        content
    )
    
    # 修复第 320 行：parseInt(docId)
    content = re.sub(
        r'await knowledgeBaseService\.deleteDocument\(docId\);',
        'await knowledgeBaseService.deleteDocument(parseInt(docId));',
        content
    )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f'✅ 修复完成: {file_path}')

def fix_task_handlers():
    """修复 taskHandlers.ts"""
    file_path = '../electron/ipc/handlers/taskHandlers.ts'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修复第 100 行：parseInt(id)
    content = re.sub(
        r'await taskService\.updateStatus\(id, status, errorMessage\);',
        'await taskService.updateStatus(parseInt(id), status, errorMessage);',
        content
    )
    
    # 修复第 121 行：parseInt(id)
    content = re.sub(
        r'await taskService\.updateStatus\(id, \'cancelled\', \'用户手动取消\'\);',
        'await taskService.updateStatus(parseInt(id), \'cancelled\', \'用户手动取消\');',
        content
    )
    
    # 修复第 289 行：parseInt(taskId)
    content = re.sub(
        r'const logs = await recordService\.findByTaskId\(taskId\);',
        'const logs = await recordService.findByTaskId(parseInt(taskId));',
        content
    )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f'✅ 修复完成: {file_path}')

def fix_article_service():
    """修复 ArticleServicePostgres.ts - 删除重复的 markAsPublished 方法"""
    file_path = '../electron/services/ArticleServicePostgres.ts'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 找到第一个 markAsPublished 方法（保留这个）
    first_method_pattern = r'(  /\*\*\s+\* 标记文章为已发布\s+\*\s+\* @param id 文章 ID\s+\* @param publishingStatus 发布状态\s+\*/\s+async markAsPublished\(id: number, publishingStatus\?: string\): Promise<Article> \{\s+return await this\.update\(id, \{\s+is_published: true,\s+publishingStatus: publishingStatus \|\| \'published\',\s+publishedAt: this\.now\(\)\s+\}\);\s+\})'
    
    # 找到第二个 markAsPublished 方法（删除这个）
    second_method_pattern = r'\s+/\*\*\s+\* 标记文章为已发布\s+\*\s+\* @param id 文章 ID\s+\* @param publishingStatus 发布状态\s+\*/\s+async markAsPublished\(id: number, publishingStatus\?: string\): Promise<Article> \{\s+return await this\.update\(id, \{\s+is_published: true,\s+publishing_status: publishingStatus \|\| \'published\',\s+published_at: this\.now\(\)\s+\}\);\s+\}'
    
    # 删除第二个方法
    content = re.sub(second_method_pattern, '', content)
    
    # 修复第一个方法中的字段名（使用 snake_case）
    content = re.sub(
        r'(async markAsPublished\(id: number, publishingStatus\?: string\): Promise<Article> \{\s+return await this\.update\(id, \{)\s+is_published: true,\s+publishingStatus: publishingStatus \|\| \'published\',\s+publishedAt: this\.now\(\)',
        r'\1\n      is_published: true,\n      publishing_status: publishingStatus || \'published\',\n      published_at: this.now()',
        content
    )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f'✅ 修复完成: {file_path}')

if __name__ == '__main__':
    print('开始修复最后的编译错误...\n')
    
    fix_knowledge_handlers()
    fix_task_handlers()
    fix_article_service()
    
    print('\n✅ 所有修复完成！')
    print('\n下一步：运行 npm run build:electron 验证编译')
