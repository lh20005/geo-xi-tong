#!/usr/bin/env python3
import re

# 读取文件
with open('server/src/routes/knowledgeBase.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 修复 SQL 参数占位符
content = re.sub(
    r'updates\.push\(`name = \$\{paramIndex\+\+\}`\);',
    r'updates.push(`name = $${paramIndex++}`);',
    content
)

content = re.sub(
    r'updates\.push\(`description = \$\{paramIndex\+\+\}`\);',
    r'updates.push(`description = $${paramIndex++}`);',
    content
)

# 修复 UPDATE 语句
old_update = r'`UPDATE knowledge_bases SET \$\{updates\.join\(\', \'\)\} WHERE id = \$\{paramIndex\} RETURNING id, name, description, updated_at`'
new_update = r'`UPDATE knowledge_bases \n       SET ${updates.join(\', \')} \n       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}\n       RETURNING id, name, description, updated_at`'

content = re.sub(old_update, new_update, content)

# 写回文件
with open('server/src/routes/knowledgeBase.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 修复完成")
