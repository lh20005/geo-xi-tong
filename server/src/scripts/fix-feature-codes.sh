#!/bin/bash

# 修复所有使用旧 feature_code 的文件
# articles_per_day -> articles_per_month
# publish_per_day -> publish_per_month

echo "修复 feature_code..."

# 修复 articleGeneration.ts
sed -i '' "s/'articles_per_day'/'articles_per_month'/g" src/routes/articleGeneration.ts

# 修复 publishingTasks.ts
sed -i '' "s/'publish_per_day'/'publish_per_month'/g" src/routes/publishingTasks.ts

# 修复 test-quota-system.ts
sed -i '' "s/'articles_per_day'/'articles_per_month'/g" src/scripts/test-quota-system.ts
sed -i '' "s/'publish_per_day'/'publish_per_month'/g" src/scripts/test-quota-system.ts

# 修复 articleGenerationService.ts
sed -i '' "s/'articles_per_day'/'articles_per_month'/g" src/services/articleGenerationService.ts

# 修复 PublishingService.ts
sed -i '' "s/'publish_per_day'/'publish_per_month'/g" src/services/PublishingService.ts

echo "✅ 修复完成"
