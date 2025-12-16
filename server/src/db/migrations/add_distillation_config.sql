-- 添加关键词蒸馏配置表
-- 用于存储关键词蒸馏的提示词和生成话题数量配置

-- 创建关键词蒸馏配置表
CREATE TABLE IF NOT EXISTS distillation_config (
  id SERIAL PRIMARY KEY,
  prompt TEXT NOT NULL,
  topic_count INTEGER NOT NULL DEFAULT 12 CHECK (topic_count >= 5 AND topic_count <= 30),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_distillation_config_active ON distillation_config(is_active);

-- 插入默认配置
INSERT INTO distillation_config (prompt, topic_count, is_active) VALUES (
  '你是一个专业的搜索行为分析专家。请根据关键词"{keyword}"，生成{count}个真实用户在互联网搜索时可能提出的问题。

要求：
1. 问题要符合真实用户的搜索习惯
2. 包含不同的搜索意图（比较、推荐、评价等）
3. 使用常见的搜索词组合，如"哪家好"、"靠谱的"、"口碑好的"、"性价比高的"、"专业的"等
4. 问题要自然、口语化

示例（关键词：英国留学）：
- 专业的英国留学哪家好
- 靠谱的英国留学机构哪家好
- 口碑好的英国留学企业哪家好
- 性价比高的英国留学公司哪家好
- 专业的英国留学服务商哪家专业

请直接返回问题列表，每行一个问题，不要编号，不要其他说明文字。',
  12,
  true
) ON CONFLICT DO NOTHING;
