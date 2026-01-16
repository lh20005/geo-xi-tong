#!/bin/bash
# 导出指定用户的数据
# 用法: ./export_user_data.sh <user_id>

USER_ID=${1:-1}
OUTPUT_DIR="/var/www/geo-system/backups/migration-2026-01-16"
OUTPUT_FILE="$OUTPUT_DIR/user_${USER_ID}_data.sql"

echo "========================================="
echo "导出用户数据"
echo "========================================="
echo "用户 ID: $USER_ID"
echo "输出文件: $OUTPUT_FILE"
echo ""

# 创建临时 SQL 文件
TEMP_SQL="/tmp/export_user_data_${USER_ID}.sql"

cat > $TEMP_SQL << 'EOF'
-- ==================== USER DATA EXPORT ====================
-- User ID: USER_ID_PLACEHOLDER
-- Export Date: EXPORT_DATE_PLACEHOLDER
-- 
-- IMPORTANT NOTES:
-- 1. task_id has been set to NULL (generation_tasks table not migrated)
-- 2. user_id is preserved (will be used in Windows client)
-- 3. All foreign keys to migrated tables are preserved
-- ==========================================================

\set ON_ERROR_STOP on

BEGIN;

-- Disable triggers temporarily
SET session_replication_role = replica;

-- ==================== ALBUMS ====================
INSERT INTO albums (id, user_id, name, created_at, updated_at)
SELECT id, user_id, name, created_at, updated_at
FROM albums
WHERE user_id = USER_ID_PLACEHOLDER;

-- ==================== IMAGES ====================
INSERT INTO images (id, user_id, album_id, filename, filepath, mime_type, size, usage_count, deleted_at, is_orphan, reference_count, created_at)
SELECT id, user_id, album_id, filename, filepath, mime_type, size, usage_count, deleted_at, is_orphan, reference_count, created_at
FROM images
WHERE user_id = USER_ID_PLACEHOLDER;

-- ==================== KNOWLEDGE_BASES ====================
INSERT INTO knowledge_bases (id, user_id, name, description, created_at, updated_at)
SELECT id, user_id, name, description, created_at, updated_at
FROM knowledge_bases
WHERE user_id = USER_ID_PLACEHOLDER;

-- ==================== KNOWLEDGE_DOCUMENTS ====================
INSERT INTO knowledge_documents (id, knowledge_base_id, filename, file_type, file_size, content, created_at)
SELECT kd.id, kd.knowledge_base_id, kd.filename, kd.file_type, kd.file_size, kd.content, kd.created_at
FROM knowledge_documents kd
INNER JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id
WHERE kb.user_id = USER_ID_PLACEHOLDER;

-- ==================== DISTILLATIONS ====================
INSERT INTO distillations (id, user_id, keyword, topics_count, created_at, updated_at)
SELECT id, user_id, keyword, topics_count, created_at, updated_at
FROM distillations
WHERE user_id = USER_ID_PLACEHOLDER;

-- ==================== TOPICS ====================
INSERT INTO topics (id, distillation_id, question, keyword_snapshot, created_at, updated_at, user_id)
SELECT t.id, t.distillation_id, t.question, t.keyword_snapshot, t.created_at, t.updated_at, t.user_id
FROM topics t
INNER JOIN distillations d ON t.distillation_id = d.id
WHERE d.user_id = USER_ID_PLACEHOLDER;

-- ==================== ARTICLES ====================
-- IMPORTANT: task_id is set to NULL
INSERT INTO articles (id, user_id, title, keyword, distillation_id, topic_id, task_id, image_id, requirements, content, image_url, image_size_bytes, provider, is_published, publishing_status, published_at, distillation_keyword_snapshot, topic_question_snapshot, created_at, updated_at)
SELECT id, user_id, title, keyword, distillation_id, topic_id, 
       NULL as task_id,  -- Set to NULL (generation_tasks not migrated)
       image_id, requirements, content, image_url, image_size_bytes, provider, is_published, publishing_status, published_at, distillation_keyword_snapshot, topic_question_snapshot, created_at, updated_at
FROM articles
WHERE user_id = USER_ID_PLACEHOLDER;

-- ==================== PLATFORM_ACCOUNTS ====================
INSERT INTO platform_accounts (id, user_id, platform, account_name, cookies, credentials, status, last_login_at, created_at, updated_at, login_method, account_identifier, is_active)
SELECT id, user_id, platform, account_name, cookies, credentials, status, last_login_at, created_at, updated_at, login_method, account_identifier, is_active
FROM platform_accounts
WHERE user_id = USER_ID_PLACEHOLDER;

-- ==================== CONVERSION_TARGETS ====================
INSERT INTO conversion_targets (id, user_id, name, type, url, qr_code_url, description, is_active, display_order, created_at, updated_at, platform)
SELECT id, user_id, name, type, url, qr_code_url, description, is_active, display_order, created_at, updated_at, platform
FROM conversion_targets
WHERE user_id = USER_ID_PLACEHOLDER;

-- ==================== PUBLISHING_TASKS ====================
INSERT INTO publishing_tasks (id, user_id, article_id, platforms, status, scheduled_at, executed_at, created_at, updated_at, batch_id, batch_index, batch_interval, conversion_target_id, account_id, title, content, cover_image, publish_time, result)
SELECT id, user_id, article_id, platforms, status, scheduled_at, executed_at, created_at, updated_at, batch_id, batch_index, batch_interval, conversion_target_id, account_id, title, content, cover_image, publish_time, result
FROM publishing_tasks
WHERE user_id = USER_ID_PLACEHOLDER;

-- ==================== PUBLISHING_RECORDS ====================
INSERT INTO publishing_records (id, user_id, task_id, platform, account_id, status, error_message, published_url, published_at, created_at, updated_at, article_id)
SELECT pr.id, pr.user_id, pr.task_id, pr.platform, pr.account_id, pr.status, pr.error_message, pr.published_url, pr.published_at, pr.created_at, pr.updated_at, pr.article_id
FROM publishing_records pr
WHERE pr.user_id = USER_ID_PLACEHOLDER;

-- ==================== PUBLISHING_LOGS ====================
INSERT INTO publishing_logs (id, task_id, message, level, created_at, user_id)
SELECT pl.id, pl.task_id, pl.message, pl.level, pl.created_at, pl.user_id
FROM publishing_logs pl
INNER JOIN publishing_tasks pt ON pl.task_id = pt.id
WHERE pt.user_id = USER_ID_PLACEHOLDER;

-- ==================== ARTICLE_SETTINGS ====================
INSERT INTO article_settings (id, user_id, name, prompt, created_at, updated_at)
SELECT id, user_id, name, prompt, created_at, updated_at
FROM article_settings
WHERE user_id = USER_ID_PLACEHOLDER;

-- ==================== DISTILLATION_CONFIG ====================
INSERT INTO distillation_config (id, user_id, name, prompt, created_at, updated_at, topic_count)
SELECT id, user_id, name, prompt, created_at, updated_at, topic_count
FROM distillation_config
WHERE user_id = USER_ID_PLACEHOLDER;

-- ==================== IMAGE_USAGE ====================
INSERT INTO image_usage (image_id, article_id, used_at, user_id)
SELECT iu.image_id, iu.article_id, iu.used_at, iu.user_id
FROM image_usage iu
WHERE iu.user_id = USER_ID_PLACEHOLDER;

-- ==================== DISTILLATION_USAGE ====================
INSERT INTO distillation_usage (distillation_id, article_id, used_at, user_id)
SELECT du.distillation_id, du.article_id, du.used_at, du.user_id
FROM distillation_usage du
WHERE du.user_id = USER_ID_PLACEHOLDER;

-- ==================== TOPIC_USAGE ====================
INSERT INTO topic_usage (topic_id, article_id, used_at, user_id)
SELECT tu.topic_id, tu.article_id, tu.used_at, tu.user_id
FROM topic_usage tu
WHERE tu.user_id = USER_ID_PLACEHOLDER;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

COMMIT;

-- ==================== SEQUENCE RESET ====================
-- These will be executed after import to reset sequences
-- SELECT setval('albums_id_seq', (SELECT MAX(id) FROM albums));
-- SELECT setval('images_id_seq', (SELECT MAX(id) FROM images));
-- SELECT setval('knowledge_bases_id_seq', (SELECT MAX(id) FROM knowledge_bases));
-- SELECT setval('knowledge_documents_id_seq', (SELECT MAX(id) FROM knowledge_documents));
-- SELECT setval('distillations_id_seq', (SELECT MAX(id) FROM distillations));
-- SELECT setval('topics_id_seq', (SELECT MAX(id) FROM topics));
-- SELECT setval('articles_id_seq', (SELECT MAX(id) FROM articles));
-- SELECT setval('platform_accounts_id_seq', (SELECT MAX(id) FROM platform_accounts));
-- SELECT setval('conversion_targets_id_seq', (SELECT MAX(id) FROM conversion_targets));
-- SELECT setval('publishing_tasks_id_seq', (SELECT MAX(id) FROM publishing_tasks));
-- SELECT setval('publishing_records_id_seq', (SELECT MAX(id) FROM publishing_records));
-- SELECT setval('publishing_logs_id_seq', (SELECT MAX(id) FROM publishing_logs));
-- SELECT setval('article_settings_id_seq', (SELECT MAX(id) FROM article_settings));
-- SELECT setval('distillation_config_id_seq', (SELECT MAX(id) FROM distillation_config));

EOF

# 替换占位符
sed -i "s/USER_ID_PLACEHOLDER/$USER_ID/g" $TEMP_SQL
sed -i "s/EXPORT_DATE_PLACEHOLDER/$(date '+%Y-%m-%d %H:%M:%S')/g" $TEMP_SQL

# 执行导出
echo "正在导出数据..."
sudo -u postgres psql -d geo_system -f $TEMP_SQL > $OUTPUT_FILE 2>&1

if [ $? -eq 0 ]; then
    echo "✅ 数据导出成功！"
    echo "输出文件: $OUTPUT_FILE"
    
    # 统计导出的记录数
    echo ""
    echo "导出统计:"
    sudo -u postgres psql -d geo_system -t -c "
        SELECT 'articles: ' || COUNT(*) FROM articles WHERE user_id = $USER_ID
        UNION ALL SELECT 'albums: ' || COUNT(*) FROM albums WHERE user_id = $USER_ID
        UNION ALL SELECT 'images: ' || COUNT(*) FROM images WHERE user_id = $USER_ID
        UNION ALL SELECT 'knowledge_bases: ' || COUNT(*) FROM knowledge_bases WHERE user_id = $USER_ID
        UNION ALL SELECT 'platform_accounts: ' || COUNT(*) FROM platform_accounts WHERE user_id = $USER_ID
        UNION ALL SELECT 'publishing_tasks: ' || COUNT(*) FROM publishing_tasks WHERE user_id = $USER_ID
        UNION ALL SELECT 'distillations: ' || COUNT(*) FROM distillations WHERE user_id = $USER_ID
        UNION ALL SELECT 'topics: ' || COUNT(*) FROM topics WHERE user_id = $USER_ID;
    "
else
    echo "❌ 数据导出失败！"
    cat $OUTPUT_FILE
    exit 1
fi

# 清理临时文件
rm -f $TEMP_SQL

echo ""
echo "========================================="
echo "导出完成！"
echo "========================================="
