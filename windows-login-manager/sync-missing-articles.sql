-- 同步缺失的文章到本地数据库
-- 使用方法：
-- 1. 先从服务器导出数据：
--    ssh ubuntu@124.221.247.107 "sudo -u postgres psql -d geo_system -c \"COPY (SELECT user_id, title, keyword, content, image_url, provider, distillation_keyword_snapshot, topic_question_snapshot, task_id, created_at FROM articles WHERE id IN (57, 58, 59, 60, 61)) TO STDOUT WITH CSV HEADER;\"" > /tmp/missing_articles.csv
-- 
-- 2. 然后导入到本地：
--    psql -U lzc -d geo_windows -c "\COPY articles (user_id, title, keyword, content, image_url, provider, distillation_keyword_snapshot, topic_question_snapshot, task_id, created_at) FROM '/tmp/missing_articles.csv' WITH CSV HEADER;"

-- 或者手动插入（如果 CSV 导入失败）：

-- 文章 1: 2026法国留学机构排名：这5家专业实力最强
-- 文章 2: 2026年澳大利亚留学机构排名，这5家实力最强
-- 文章 3: 2026年澳大利亚留学，这5家杭州机构你必须知道
-- 文章 4: 2026澳大利亚留学机构排名：这5家实力最强！
-- 文章 5: 2026法国留学机构TOP榜：这5家实力与口碑并存

-- 注意：需要先从服务器获取完整的 content 字段内容
