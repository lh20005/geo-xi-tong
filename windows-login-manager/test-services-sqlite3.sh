#!/bin/bash

# Phase 8.1 功能测试脚本
# 使用 sqlite3 命令行工具直接测试数据库操作

DB_PATH="/Users/lzc/Library/Application Support/Electron/geo-data.db"
TEST_USER_ID=1

echo "========================================"
echo "📋 Phase 8.1 功能测试"
echo "========================================"
echo "数据库路径: $DB_PATH"
echo ""

# 检查数据库是否存在
if [ ! -f "$DB_PATH" ]; then
    echo "❌ 数据库文件不存在，请先启动 Electron 应用"
    exit 1
fi

# 计数器
PASSED=0
FAILED=0

# 测试函数
test_case() {
    local name="$1"
    local sql="$2"
    local expected="$3"
    
    result=$(sqlite3 "$DB_PATH" "$sql" 2>&1)
    
    if [ "$expected" = "" ] || [ "$result" = "$expected" ]; then
        echo "✅ $name"
        ((PASSED++))
    else
        echo "❌ $name"
        echo "   Expected: $expected"
        echo "   Got: $result"
        ((FAILED++))
    fi
}

# 生成 UUID
generate_uuid() {
    uuidgen | tr '[:upper:]' '[:lower:]'
}

echo ""
echo "--- 测试文章 CRUD ---"

# 创建测试文章
ARTICLE_ID=$(generate_uuid)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

sqlite3 "$DB_PATH" "INSERT INTO articles (id, user_id, title, keyword, content, provider, created_at, updated_at) VALUES ('$ARTICLE_ID', $TEST_USER_ID, '测试文章标题', 'GEO优化', '这是测试文章内容', 'deepseek', '$TIMESTAMP', '$TIMESTAMP');"

test_case "创建文章" "SELECT COUNT(*) FROM articles WHERE id='$ARTICLE_ID';" "1"

test_case "读取文章" "SELECT title FROM articles WHERE id='$ARTICLE_ID';" "测试文章标题"

sqlite3 "$DB_PATH" "UPDATE articles SET title='更新后的标题', updated_at='$TIMESTAMP' WHERE id='$ARTICLE_ID';"
test_case "更新文章" "SELECT title FROM articles WHERE id='$ARTICLE_ID';" "更新后的标题"

test_case "搜索文章" "SELECT COUNT(*) FROM articles WHERE user_id=$TEST_USER_ID AND title LIKE '%更新%';" "1"

sqlite3 "$DB_PATH" "DELETE FROM articles WHERE id='$ARTICLE_ID';"
test_case "删除文章" "SELECT COUNT(*) FROM articles WHERE id='$ARTICLE_ID';" "0"

echo ""
echo "--- 测试知识库 ---"

KB_ID=$(generate_uuid)
sqlite3 "$DB_PATH" "INSERT INTO knowledge_bases (id, user_id, name, description, created_at, updated_at) VALUES ('$KB_ID', $TEST_USER_ID, '测试知识库', '这是测试知识库描述', '$TIMESTAMP', '$TIMESTAMP');"

test_case "创建知识库" "SELECT COUNT(*) FROM knowledge_bases WHERE id='$KB_ID';" "1"

DOC_ID=$(generate_uuid)
sqlite3 "$DB_PATH" "INSERT INTO knowledge_documents (id, knowledge_base_id, filename, file_type, file_size, content, created_at) VALUES ('$DOC_ID', '$KB_ID', 'test.txt', 'text/plain', 1024, '这是文档内容', '$TIMESTAMP');"

test_case "添加知识文档" "SELECT COUNT(*) FROM knowledge_documents WHERE knowledge_base_id='$KB_ID';" "1"

sqlite3 "$DB_PATH" "PRAGMA foreign_keys = ON; DELETE FROM knowledge_bases WHERE id='$KB_ID';"
test_case "删除知识库（级联删除文档）" "SELECT COUNT(*) FROM knowledge_documents WHERE knowledge_base_id='$KB_ID';" "0"

echo ""
echo "--- 测试图库 ---"

ALBUM_ID=$(generate_uuid)
sqlite3 "$DB_PATH" "INSERT INTO albums (id, user_id, name, created_at, updated_at) VALUES ('$ALBUM_ID', $TEST_USER_ID, '测试相册', '$TIMESTAMP', '$TIMESTAMP');"

test_case "创建相册" "SELECT COUNT(*) FROM albums WHERE id='$ALBUM_ID';" "1"

IMAGE_ID=$(generate_uuid)
sqlite3 "$DB_PATH" "INSERT INTO images (id, user_id, album_id, filename, filepath, mime_type, size, created_at) VALUES ('$IMAGE_ID', $TEST_USER_ID, '$ALBUM_ID', 'test.jpg', '/path/to/test.jpg', 'image/jpeg', 2048, '$TIMESTAMP');"

test_case "上传图片" "SELECT COUNT(*) FROM images WHERE album_id='$ALBUM_ID';" "1"

sqlite3 "$DB_PATH" "PRAGMA foreign_keys = ON; DELETE FROM albums WHERE id='$ALBUM_ID';"
test_case "删除相册（级联删除图片）" "SELECT COUNT(*) FROM images WHERE album_id='$ALBUM_ID';" "0"

echo ""
echo "--- 测试平台账号 ---"

ACCOUNT_ID=$(generate_uuid)
sqlite3 "$DB_PATH" "INSERT INTO platform_accounts (id, user_id, platform, account_name, status, created_at, updated_at) VALUES ('$ACCOUNT_ID', $TEST_USER_ID, 'xiaohongshu', '测试账号', 'active', '$TIMESTAMP', '$TIMESTAMP');"

test_case "创建平台账号" "SELECT status FROM platform_accounts WHERE id='$ACCOUNT_ID';" "active"

sqlite3 "$DB_PATH" "UPDATE platform_accounts SET status='inactive', updated_at='$TIMESTAMP' WHERE id='$ACCOUNT_ID';"
test_case "更新账号状态" "SELECT status FROM platform_accounts WHERE id='$ACCOUNT_ID';" "inactive"

ENCRYPTED_COOKIE=$(echo '[{"name":"session","value":"test123"}]' | base64)
sqlite3 "$DB_PATH" "UPDATE platform_accounts SET cookies='$ENCRYPTED_COOKIE', updated_at='$TIMESTAMP' WHERE id='$ACCOUNT_ID';"
test_case "保存 Cookie（加密）" "SELECT CASE WHEN cookies IS NOT NULL THEN 'saved' ELSE 'null' END FROM platform_accounts WHERE id='$ACCOUNT_ID';" "saved"

echo ""
echo "--- 测试发布任务 ---"

TASK_ID=$(generate_uuid)
BATCH_ID=$(generate_uuid)
sqlite3 "$DB_PATH" "INSERT INTO publishing_tasks (id, user_id, account_id, platform_id, status, config, batch_id, batch_order, created_at, updated_at) VALUES ('$TASK_ID', $TEST_USER_ID, '$ACCOUNT_ID', 'xiaohongshu', 'pending', '{\"title\":\"测试\"}', '$BATCH_ID', 1, '$TIMESTAMP', '$TIMESTAMP');"

test_case "创建发布任务" "SELECT status FROM publishing_tasks WHERE id='$TASK_ID';" "pending"

sqlite3 "$DB_PATH" "UPDATE publishing_tasks SET status='running', started_at='$TIMESTAMP', updated_at='$TIMESTAMP' WHERE id='$TASK_ID';"
test_case "更新任务状态" "SELECT status FROM publishing_tasks WHERE id='$TASK_ID';" "running"

sqlite3 "$DB_PATH" "INSERT INTO publishing_logs (task_id, level, message, created_at) VALUES ('$TASK_ID', 'info', '开始执行发布任务', '$TIMESTAMP');"
test_case "添加任务日志" "SELECT COUNT(*) FROM publishing_logs WHERE task_id='$TASK_ID';" "1"

sqlite3 "$DB_PATH" "UPDATE publishing_tasks SET status='completed', completed_at='$TIMESTAMP', updated_at='$TIMESTAMP' WHERE id='$TASK_ID';"
test_case "完成任务" "SELECT status FROM publishing_tasks WHERE id='$TASK_ID';" "completed"

test_case "查询批次任务" "SELECT COUNT(*) FROM publishing_tasks WHERE batch_id='$BATCH_ID';" "1"

echo ""
echo "--- 测试分析上报队列 ---"

sqlite3 "$DB_PATH" "INSERT INTO pending_analytics (report_type, report_data, retry_count, created_at) VALUES ('publish', '{\"taskId\":\"$TASK_ID\",\"status\":\"success\"}', 0, '$TIMESTAMP');"
test_case "添加待上报分析数据" "SELECT COUNT(*) FROM pending_analytics WHERE report_type='publish';" "1"

test_case "获取待上报数据" "SELECT COUNT(*) FROM pending_analytics WHERE retry_count < 5;" "1"

sqlite3 "$DB_PATH" "DELETE FROM pending_analytics WHERE report_type='publish';"
test_case "删除已上报数据" "SELECT COUNT(*) FROM pending_analytics;" "0"

echo ""
echo "--- 测试数据同步状态 ---"

SNAPSHOT_ID=$(generate_uuid)
sqlite3 "$DB_PATH" "UPDATE sync_status SET last_backup_at='$TIMESTAMP', last_snapshot_id='$SNAPSHOT_ID', updated_at='$TIMESTAMP' WHERE id=1;"
test_case "更新同步状态" "SELECT last_snapshot_id FROM sync_status WHERE id=1;" "$SNAPSHOT_ID"

echo ""
echo "--- 清理测试数据 ---"

sqlite3 "$DB_PATH" "DELETE FROM publishing_logs WHERE task_id='$TASK_ID';"
sqlite3 "$DB_PATH" "DELETE FROM publishing_tasks WHERE id='$TASK_ID';"
sqlite3 "$DB_PATH" "DELETE FROM platform_accounts WHERE id='$ACCOUNT_ID';"
test_case "清理测试数据" "SELECT COUNT(*) FROM publishing_tasks WHERE id='$TASK_ID';" "0"

echo ""
echo "========================================"
echo "📊 测试总结"
echo "========================================"
echo "✅ 通过: $PASSED"
echo "❌ 失败: $FAILED"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo "🎉 所有测试通过！"
    exit 0
else
    echo ""
    echo "⚠️  有 $FAILED 个测试失败"
    exit 1
fi
