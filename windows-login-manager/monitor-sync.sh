#!/bin/bash

# 实时监控文章同步状态
# 使用方法: bash monitor-sync.sh

echo "🔍 开始监控文章同步状态..."
echo "按 Ctrl+C 停止监控"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取初始状态
echo "📊 初始状态:"
echo "----------------------------------------"

LOCAL_COUNT=$(psql -U lzc -d geo_windows -t -A -c "SELECT COUNT(*) FROM articles WHERE user_id = 1;")
SERVER_COUNT=$(ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@124.221.247.107 "sudo -u postgres psql -d geo_system -t -A -c 'SELECT COUNT(*) FROM articles WHERE user_id = 1;'")

echo -e "${BLUE}本地文章数:${NC} $LOCAL_COUNT"
echo -e "${BLUE}服务器文章数:${NC} $SERVER_COUNT"

if [ "$LOCAL_COUNT" -eq "$SERVER_COUNT" ]; then
  echo -e "${GREEN}✅ 数据一致${NC}"
else
  echo -e "${YELLOW}⚠️  数据不一致，差异: $((SERVER_COUNT - LOCAL_COUNT)) 篇${NC}"
fi

echo ""
echo "🔄 开始实时监控（每 5 秒检查一次）..."
echo "----------------------------------------"
echo ""

PREV_LOCAL_COUNT=$LOCAL_COUNT
PREV_SERVER_COUNT=$SERVER_COUNT

while true; do
  sleep 5
  
  # 获取当前状态
  CURRENT_LOCAL_COUNT=$(psql -U lzc -d geo_windows -t -A -c "SELECT COUNT(*) FROM articles WHERE user_id = 1;")
  CURRENT_SERVER_COUNT=$(ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@124.221.247.107 "sudo -u postgres psql -d geo_system -t -A -c 'SELECT COUNT(*) FROM articles WHERE user_id = 1;'")
  
  # 检查是否有变化
  LOCAL_CHANGED=false
  SERVER_CHANGED=false
  
  if [ "$CURRENT_LOCAL_COUNT" -ne "$PREV_LOCAL_COUNT" ]; then
    LOCAL_CHANGED=true
  fi
  
  if [ "$CURRENT_SERVER_COUNT" -ne "$PREV_SERVER_COUNT" ]; then
    SERVER_CHANGED=true
  fi
  
  # 如果有变化，显示详细信息
  if [ "$LOCAL_CHANGED" = true ] || [ "$SERVER_CHANGED" = true ]; then
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$TIMESTAMP]"
    
    if [ "$SERVER_CHANGED" = true ]; then
      SERVER_DIFF=$((CURRENT_SERVER_COUNT - PREV_SERVER_COUNT))
      echo -e "${BLUE}📥 服务器新增:${NC} $SERVER_DIFF 篇 (总计: $CURRENT_SERVER_COUNT)"
      
      # 显示新增的文章
      NEW_ARTICLES=$(ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@124.221.247.107 "sudo -u postgres psql -d geo_system -t -A -F'|' -c \"SELECT id, title, task_id FROM articles WHERE user_id = 1 ORDER BY created_at DESC LIMIT $SERVER_DIFF;\"")
      
      echo "$NEW_ARTICLES" | while IFS='|' read -r id title task_id; do
        echo -e "   ${YELLOW}→${NC} [文章 $id] [任务 $task_id] $title"
      done
    fi
    
    if [ "$LOCAL_CHANGED" = true ]; then
      LOCAL_DIFF=$((CURRENT_LOCAL_COUNT - PREV_LOCAL_COUNT))
      echo -e "${GREEN}💾 本地新增:${NC} $LOCAL_DIFF 篇 (总计: $CURRENT_LOCAL_COUNT)"
      
      # 显示新增的文章
      NEW_LOCAL_ARTICLES=$(psql -U lzc -d geo_windows -t -A -F'|' -c "SELECT id, title, task_id FROM articles WHERE user_id = 1 ORDER BY created_at DESC LIMIT $LOCAL_DIFF;")
      
      echo "$NEW_LOCAL_ARTICLES" | while IFS='|' read -r id title task_id; do
        echo -e "   ${GREEN}→${NC} [文章 $id] [任务 $task_id] $title"
      done
    fi
    
    # 检查同步状态
    if [ "$CURRENT_LOCAL_COUNT" -eq "$CURRENT_SERVER_COUNT" ]; then
      echo -e "${GREEN}✅ 同步完成，数据一致${NC}"
    else
      DIFF=$((CURRENT_SERVER_COUNT - CURRENT_LOCAL_COUNT))
      if [ "$DIFF" -gt 0 ]; then
        echo -e "${RED}❌ 同步延迟，缺少 $DIFF 篇文章${NC}"
        
        # 显示缺失的文章
        echo -e "${YELLOW}缺失的文章:${NC}"
        MISSING_ARTICLES=$(ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@124.221.247.107 "sudo -u postgres psql -d geo_system -t -A -F'|' -c \"SELECT a.id, a.title, a.task_id FROM articles a WHERE a.user_id = 1 AND NOT EXISTS (SELECT 1 FROM articles WHERE task_id = a.task_id AND title = a.title LIMIT 1) ORDER BY a.created_at DESC;\"" 2>/dev/null || echo "无法获取缺失文章列表")
        
        if [ -n "$MISSING_ARTICLES" ]; then
          echo "$MISSING_ARTICLES" | head -5 | while IFS='|' read -r id title task_id; do
            echo -e "   ${RED}→${NC} [文章 $id] [任务 $task_id] $title"
          done
        fi
      else
        echo -e "${YELLOW}⚠️  本地文章数多于服务器${NC}"
      fi
    fi
    
    echo ""
    
    # 更新上一次的计数
    PREV_LOCAL_COUNT=$CURRENT_LOCAL_COUNT
    PREV_SERVER_COUNT=$CURRENT_SERVER_COUNT
  fi
done
