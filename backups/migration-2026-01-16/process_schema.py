#!/usr/bin/env python3
"""
处理 PostgreSQL schema 文件，移除跨数据库的外键约束
"""

import re
import sys

def process_schema(input_file, output_file):
    """
    处理 schema 文件：
    1. 移除 user_id 外键约束（引用 users 表）
    2. 移除 task_id 外键约束（引用 generation_tasks 表）
    3. 保留表间外键约束
    """
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 需要移除的外键约束模式
    # 匹配 ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY (user_id) REFERENCES users(id)
    user_id_fk_pattern = r'ALTER TABLE [^;]+ADD CONSTRAINT [^;]+FOREIGN KEY \(user_id\) REFERENCES (?:public\.)?users\([^)]+\)[^;]*;'
    
    # 匹配 ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY (task_id) REFERENCES generation_tasks(id)
    task_id_fk_pattern = r'ALTER TABLE [^;]+ADD CONSTRAINT [^;]+FOREIGN KEY \(task_id\) REFERENCES (?:public\.)?generation_tasks\([^)]+\)[^;]*;'
    
    # 移除 user_id 外键约束
    original_content = content
    content = re.sub(user_id_fk_pattern, '-- REMOVED: user_id foreign key (cross-database reference)', content, flags=re.IGNORECASE | re.MULTILINE)
    user_id_removed = len(re.findall(user_id_fk_pattern, original_content, flags=re.IGNORECASE | re.MULTILINE))
    
    # 移除 task_id 外键约束
    content = re.sub(task_id_fk_pattern, '-- REMOVED: task_id foreign key (cross-database reference)', content, flags=re.IGNORECASE | re.MULTILINE)
    task_id_removed = len(re.findall(task_id_fk_pattern, original_content, flags=re.IGNORECASE | re.MULTILINE))
    
    # 添加说明注释
    header_comment = """
-- ==================== MIGRATION NOTES ====================
-- This schema has been processed for Windows client migration
-- 
-- REMOVED FOREIGN KEYS (cross-database references):
--   - user_id foreign keys ({} constraints) - users table stays on server
--   - task_id foreign keys ({} constraints) - generation_tasks table stays on server
--
-- PRESERVED FOREIGN KEYS (same-database references):
--   - All table-to-table foreign keys within migrated tables
--   - Examples: articles -> topics, images -> albums, etc.
--
-- DATA INTEGRITY:
--   - user_id: Will be obtained from JWT token (server-signed, secure)
--   - task_id: Will be set to NULL during migration
--   - Application layer will enforce data integrity
-- ==========================================================

""".format(user_id_removed, task_id_removed)
    
    # 在 SET 语句之后插入注释
    content = content.replace('SET row_security = off;', 'SET row_security = off;\n' + header_comment)
    
    # 写入输出文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ Schema processing complete!")
    print(f"   - Removed {user_id_removed} user_id foreign key constraints")
    print(f"   - Removed {task_id_removed} task_id foreign key constraints")
    print(f"   - Output: {output_file}")
    
    return user_id_removed + task_id_removed

if __name__ == '__main__':
    input_file = 'windows_tables_schema.sql'
    output_file = 'windows_tables_schema_processed.sql'
    
    try:
        removed_count = process_schema(input_file, output_file)
        sys.exit(0)
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)
