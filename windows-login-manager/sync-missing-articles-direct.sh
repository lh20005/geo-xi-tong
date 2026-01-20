#!/bin/bash

# 直接从服务器数据库同步缺失的文章到本地数据库
# 使用方法：cd windows-login-manager && bash sync-missing-articles-direct.sh

echo "🔍 开始同步缺失的文章..."
echo ""

# 今天生成的 5 篇文章的 ID
ARTICLE_IDS=(57 58 59 60 61)

for ARTICLE_ID in "${ARTICLE_IDS[@]}"; do
  echo "📥 正在同步文章 ID: $ARTICLE_ID"
  
  # 从服务器获取文章数据
  ARTICLE_DATA=$(ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@124.221.247.107 \
    "sudo -u postgres psql -d geo_system -t -A -F'|' -c \"SELECT title, keyword, content, image_url, provider, task_id, distillation_keyword_snapshot, topic_question_snapshot FROM articles WHERE id = $ARTICLE_ID;\"")
  
  if [ -z "$ARTICLE_DATA" ]; then
    echo "❌ 文章 ID $ARTICLE_ID 不存在"
    continue
  fi
  
  # 解析数据
  IFS='|' read -r TITLE KEYWORD CONTENT IMAGE_URL PROVIDER TASK_ID DISTILLATION_KEYWORD TOPIC_QUESTION <<< "$ARTICLE_DATA"
  
  # 转义单引号
  TITLE_ESCAPED=$(echo "$TITLE" | sed "s/'/''/g")
  KEYWORD_ESCAPED=$(echo "$KEYWORD" | sed "s/'/''/g")
  CONTENT_ESCAPED=$(echo "$CONTENT" | sed "s/'/''/g")
  DISTILLATION_KEYWORD_ESCAPED=$(echo "$DISTILLATION_KEYWORD" | sed "s/'/''/g")
  TOPIC_QUESTION_ESCAPED=$(echo "$TOPIC_QUESTION" | sed "s/'/''/g")
  
  # 检查本地是否已存在
  EXISTS=$(psql -U lzc -d geo_windows -t -A -c "SELECT 1 FROM articles WHERE task_id = $TASK_ID AND title = '$TITLE_ESCAPED';")
  
  if [ "$EXISTS" = "1" ]; then
    echo "⏭️  文章已存在，跳过: $TITLE"
    continue
  fi
  
  # 插入到本地数据库
  psql -U lzc -d geo_windows -c "
    INSERT INTO articles (
      user_id, title, keyword, content, image_url, provider,
      distillation_keyword_snapshot, topic_question_snapshot,
      task_id, is_published, created_at, updated_at
    ) VALUES (
      1,
      '$TITLE_ESCAPED',
      '$KEYWORD_ESCAPED',
      '$CONTENT_ESCAPED',
      $([ -n "$IMAGE_URL" ] && echo "'$IMAGE_URL'" || echo "NULL"),
      '$PROVIDER',
      '$DISTILLATION_KEYWORD_ESCAPED',
      '$TOPIC_QUESTION_ESCAPED',
      $TASK_ID,
      false,
      NOW(),
      NOW()
    );
  " > /dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    echo "✅ 同步成功: $TITLE"
  else
    echo "❌ 同步失败: $TITLE"
  fi
  
  echo ""
done

echo "📊 同步完成！"
echo ""
echo "验证结果："
psql -U lzc -d geo_windows -c "SELECT COUNT(*) as total, MAX(created_at) as latest FROM articles WHERE user_id = 1;"
