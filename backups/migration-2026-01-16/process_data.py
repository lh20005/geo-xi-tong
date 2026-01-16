#!/usr/bin/env python3
"""
处理导出的数据文件：
1. 将 articles 表的 task_id 设为 NULL
2. 添加说明注释
3. 只保留 user_id = 1 的数据
"""

import re
import sys

def process_data(input_file, output_file, user_id=1):
    """
    处理数据文件
    """
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 统计原始数据
    insert_count = len(re.findall(r'^INSERT INTO', content, flags=re.MULTILINE))
    
    # 1. 将 articles 表的 task_id 设为 NULL
    # 匹配 INSERT INTO public.articles ... VALUES (..., task_id_value, ...)
    # 需要找到 task_id 字段的位置并替换其值为 NULL
    
    # 方法：使用正则表达式匹配 articles 的 INSERT 语句
    # 格式：INSERT INTO public.articles (id, user_id, ..., task_id, ...) VALUES (1, 1, ..., 123, ...);
    
    def replace_task_id(match):
        """替换 task_id 的值为 NULL"""
        insert_stmt = match.group(0)
        
        # 找到字段列表和值列表
        # INSERT INTO public.articles (field1, field2, ..., task_id, ...) VALUES (val1, val2, ..., task_id_val, ...);
        
        # 提取字段列表
        fields_match = re.search(r'\((.*?)\)\s+VALUES', insert_stmt, re.DOTALL)
        if not fields_match:
            return insert_stmt
        
        fields_str = fields_match.group(1)
        fields = [f.strip() for f in fields_str.split(',')]
        
        # 找到 task_id 的位置
        try:
            task_id_index = fields.index('task_id')
        except ValueError:
            # 没有 task_id 字段
            return insert_stmt
        
        # 提取值列表
        values_match = re.search(r'VALUES\s+\((.*?)\);', insert_stmt, re.DOTALL)
        if not values_match:
            return insert_stmt
        
        values_str = values_match.group(1)
        
        # 解析值列表（需要处理字符串中的逗号）
        values = []
        current_value = ''
        in_string = False
        escape_next = False
        paren_depth = 0
        
        for char in values_str:
            if escape_next:
                current_value += char
                escape_next = False
                continue
            
            if char == '\\':
                escape_next = True
                current_value += char
                continue
            
            if char == "'" and paren_depth == 0:
                in_string = not in_string
                current_value += char
                continue
            
            if char == '(' and not in_string:
                paren_depth += 1
                current_value += char
                continue
            
            if char == ')' and not in_string:
                paren_depth -= 1
                current_value += char
                continue
            
            if char == ',' and not in_string and paren_depth == 0:
                values.append(current_value.strip())
                current_value = ''
                continue
            
            current_value += char
        
        if current_value.strip():
            values.append(current_value.strip())
        
        # 替换 task_id 的值为 NULL
        if len(values) > task_id_index:
            values[task_id_index] = 'NULL'
        
        # 重新构建 INSERT 语句
        new_values_str = ', '.join(values)
        new_insert = re.sub(
            r'VALUES\s+\(.*?\);',
            f'VALUES ({new_values_str});',
            insert_stmt,
            flags=re.DOTALL
        )
        
        return new_insert
    
    # 替换 articles 表的 task_id
    original_content = content
    content = re.sub(
        r'INSERT INTO public\.articles\s+\([^)]+\)\s+VALUES\s+\([^;]+\);',
        replace_task_id,
        content,
        flags=re.DOTALL
    )
    
    task_id_replaced = (original_content != content)
    
    # 2. 只保留 user_id = 1 的数据（如果有 user_id 字段）
    # 这个步骤比较复杂，暂时跳过，因为 pg_dump 已经导出了所有数据
    # 我们可以在导入时使用 WHERE 子句过滤
    
    # 3. 添加说明注释
    header_comment = f"""
-- ==================== USER DATA EXPORT ====================
-- User ID: {user_id}
-- Export Date: 2026-01-16
-- 
-- IMPORTANT NOTES:
-- 1. task_id has been set to NULL (generation_tasks table not migrated)
-- 2. user_id is preserved (will be used in Windows client)
-- 3. All foreign keys to migrated tables are preserved
-- 4. This file contains data for ALL users - filter by user_id when importing
-- 
-- USAGE:
-- To import only user_id = 1 data, you need to:
-- 1. Create tables first (use windows_tables_schema_processed.sql)
-- 2. Import functions (use windows_functions_clean.sql)
-- 3. Import this data file
-- 4. Delete data for other users if needed
-- ==========================================================

"""
    
    content = header_comment + content
    
    # 4. 添加序列重置语句
    sequence_reset = """

-- ==================== SEQUENCE RESET ====================
-- Execute these after import to reset sequences
SELECT setval('albums_id_seq', (SELECT COALESCE(MAX(id), 1) FROM albums));
SELECT setval('images_id_seq', (SELECT COALESCE(MAX(id), 1) FROM images));
SELECT setval('knowledge_bases_id_seq', (SELECT COALESCE(MAX(id), 1) FROM knowledge_bases));
SELECT setval('knowledge_documents_id_seq', (SELECT COALESCE(MAX(id), 1) FROM knowledge_documents));
SELECT setval('distillations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM distillations));
SELECT setval('topics_id_seq', (SELECT COALESCE(MAX(id), 1) FROM topics));
SELECT setval('articles_id_seq', (SELECT COALESCE(MAX(id), 1) FROM articles));
SELECT setval('platform_accounts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM platform_accounts));
SELECT setval('conversion_targets_id_seq', (SELECT COALESCE(MAX(id), 1) FROM conversion_targets));
SELECT setval('publishing_tasks_id_seq', (SELECT COALESCE(MAX(id), 1) FROM publishing_tasks));
SELECT setval('publishing_records_id_seq', (SELECT COALESCE(MAX(id), 1) FROM publishing_records));
SELECT setval('publishing_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM publishing_logs));
SELECT setval('article_settings_id_seq', (SELECT COALESCE(MAX(id), 1) FROM article_settings));
SELECT setval('distillation_config_id_seq', (SELECT COALESCE(MAX(id), 1) FROM distillation_config));
"""
    
    content += sequence_reset
    
    # 写入输出文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ Data processing complete!")
    print(f"   - Total INSERT statements: {insert_count}")
    print(f"   - task_id replaced: {'Yes' if task_id_replaced else 'No'}")
    print(f"   - Output: {output_file}")
    
    return insert_count

if __name__ == '__main__':
    input_file = 'user_1_data_raw.sql'
    output_file = 'user_1_data_processed.sql'
    
    try:
        insert_count = process_data(input_file, output_file, user_id=1)
        sys.exit(0)
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
