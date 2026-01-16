#!/bin/bash

# 导出所有表的完整结构
# 用于 PostgreSQL 迁移审计

OUTPUT_DIR="./temp/db-schema-audit"
mkdir -p "$OUTPUT_DIR"

echo "开始导出所有表结构..."

# 需要迁移到 Windows 端的表
WINDOWS_TABLES=(
  "articles"
  "albums"
  "images"
  "knowledge_bases"
  "knowledge_documents"
  "platform_accounts"
  "publishing_tasks"
  "publishing_records"
  "publishing_logs"
  "conversion_targets"
  "distillations"
  "topics"
  "article_settings"
  "distillation_config"
  "image_usage"
  "distillation_usage"
  "topic_usage"
)

# 导出每个表的详细结构
for table in "${WINDOWS_TABLES[@]}"; do
  echo "导出表: $table"
  ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@124.221.247.107 \
    "sudo -u postgres psql -d geo_system -c '\\d+ $table'" \
    > "$OUTPUT_DIR/${table}_structure.txt" 2>&1
done

# 导出所有函数
echo "导出所有函数..."
ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@124.221.247.107 \
  "sudo -u postgres psql -d geo_system -c \"SELECT proname, prosrc FROM pg_proc WHERE pronamespace = 'public'::regnamespace;\"" \
  > "$OUTPUT_DIR/all_functions.txt" 2>&1

# 导出所有触发器
echo "导出所有触发器..."
ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@124.221.247.107 \
  "sudo -u postgres psql -d geo_system -c \"SELECT tgname, tgrelid::regclass, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgisinternal = false;\"" \
  > "$OUTPUT_DIR/all_triggers.txt" 2>&1

echo "导出完成！文件保存在: $OUTPUT_DIR"
