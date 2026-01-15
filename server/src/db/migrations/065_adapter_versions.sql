-- 迁移文件: 065_adapter_versions.sql
-- 功能: 适配器版本管理
-- 用于平台适配器热更新支持

-- ==================== UP ====================

-- 适配器版本表
CREATE TABLE IF NOT EXISTS adapter_versions (
    id SERIAL PRIMARY KEY,
    
    -- 平台信息
    platform VARCHAR(50) NOT NULL UNIQUE,      -- 平台标识（xiaohongshu, douyin 等）
    platform_name VARCHAR(100) NOT NULL,       -- 平台显示名称
    
    -- 版本信息
    version VARCHAR(20) NOT NULL,              -- 版本号（语义化版本）
    min_client_version VARCHAR(20),            -- 最低客户端版本要求
    
    -- 适配器代码
    code_path VARCHAR(500),                    -- 代码文件路径
    code_hash VARCHAR(64),                     -- 代码文件 SHA-256 哈希
    
    -- 更新日志
    changelog JSONB DEFAULT '[]',              -- 更新日志数组
    
    -- 状态
    status VARCHAR(20) DEFAULT 'active',       -- 'active', 'deprecated', 'disabled'
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_adapter_versions_platform ON adapter_versions(platform);
CREATE INDEX idx_adapter_versions_status ON adapter_versions(status);

-- 注释
COMMENT ON TABLE adapter_versions IS '适配器版本管理表，用于平台适配器热更新';
COMMENT ON COLUMN adapter_versions.platform IS '平台标识';
COMMENT ON COLUMN adapter_versions.platform_name IS '平台显示名称';
COMMENT ON COLUMN adapter_versions.version IS '版本号（语义化版本）';
COMMENT ON COLUMN adapter_versions.min_client_version IS '最低客户端版本要求';
COMMENT ON COLUMN adapter_versions.code_path IS '适配器代码文件路径';
COMMENT ON COLUMN adapter_versions.code_hash IS '代码文件 SHA-256 哈希';
COMMENT ON COLUMN adapter_versions.changelog IS '更新日志（JSON数组）';
COMMENT ON COLUMN adapter_versions.status IS '状态：active-活跃, deprecated-已弃用, disabled-已禁用';

-- 插入初始适配器版本数据
INSERT INTO adapter_versions (platform, platform_name, version, min_client_version, changelog, status) VALUES
('xiaohongshu', '小红书', '1.0.0', '1.0.0', '[{"version": "1.0.0", "date": "2026-01-15", "changes": ["初始版本"]}]', 'active'),
('douyin', '抖音', '1.0.0', '1.0.0', '[{"version": "1.0.0", "date": "2026-01-15", "changes": ["初始版本"]}]', 'active'),
('toutiao', '头条号', '1.0.0', '1.0.0', '[{"version": "1.0.0", "date": "2026-01-15", "changes": ["初始版本"]}]', 'active'),
('zhihu', '知乎', '1.0.0', '1.0.0', '[{"version": "1.0.0", "date": "2026-01-15", "changes": ["初始版本"]}]', 'active'),
('baijiahao', '百家号', '1.0.0', '1.0.0', '[{"version": "1.0.0", "date": "2026-01-15", "changes": ["初始版本"]}]', 'active'),
('wangyi', '网易号', '1.0.0', '1.0.0', '[{"version": "1.0.0", "date": "2026-01-15", "changes": ["初始版本"]}]', 'active'),
('sohu', '搜狐号', '1.0.0', '1.0.0', '[{"version": "1.0.0", "date": "2026-01-15", "changes": ["初始版本"]}]', 'active'),
('csdn', 'CSDN', '1.0.0', '1.0.0', '[{"version": "1.0.0", "date": "2026-01-15", "changes": ["初始版本"]}]', 'active'),
('jianshu', '简书', '1.0.0', '1.0.0', '[{"version": "1.0.0", "date": "2026-01-15", "changes": ["初始版本"]}]', 'active'),
('wechat', '微信公众号', '1.0.0', '1.0.0', '[{"version": "1.0.0", "date": "2026-01-15", "changes": ["初始版本"]}]', 'active'),
('qie', '企鹅号', '1.0.0', '1.0.0', '[{"version": "1.0.0", "date": "2026-01-15", "changes": ["初始版本"]}]', 'active'),
('bilibili', 'B站', '1.0.0', '1.0.0', '[{"version": "1.0.0", "date": "2026-01-15", "changes": ["初始版本"]}]', 'active')
ON CONFLICT (platform) DO NOTHING;

-- ==================== DOWN ====================
-- 注意：DOWN 部分仅用于手动回滚，不会自动执行
-- 如需回滚，请手动执行以下 SQL：
/*
DROP TABLE IF EXISTS adapter_versions;
*/
