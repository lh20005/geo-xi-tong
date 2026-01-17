-- 迁移文件: 063_sync_snapshots.sql
-- 功能: 数据同步快照管理
-- 用于 Windows 端数据备份和恢复

-- ==================== UP ====================

-- 同步快照表
CREATE TABLE IF NOT EXISTS sync_snapshots (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 文件信息
    file_path VARCHAR(500) NOT NULL,           -- 服务器上的文件路径
    file_size BIGINT NOT NULL,                 -- 文件大小（字节）
    checksum VARCHAR(64) NOT NULL,             -- SHA-256 校验和
    
    -- 元数据
    metadata JSONB DEFAULT '{}',               -- 快照元数据（版本、文章数、账号数等）
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT NOW(),
    last_downloaded_at TIMESTAMP,              -- 最后下载时间
    expires_at TIMESTAMP NOT NULL,             -- 过期时间（90天后）
    
    -- 状态
    status VARCHAR(20) DEFAULT 'active'        -- 'active', 'expired', 'deleted'
);

-- 索引
CREATE INDEX idx_sync_snapshots_user ON sync_snapshots(user_id);
CREATE INDEX idx_sync_snapshots_user_status ON sync_snapshots(user_id, status);
CREATE INDEX idx_sync_snapshots_expires ON sync_snapshots(expires_at) WHERE status = 'active';
CREATE INDEX idx_sync_snapshots_created ON sync_snapshots(user_id, created_at DESC);

-- 注释
COMMENT ON TABLE sync_snapshots IS '数据同步快照表，用于 Windows 端数据备份和恢复';
COMMENT ON COLUMN sync_snapshots.id IS '快照唯一标识（UUID）';
COMMENT ON COLUMN sync_snapshots.user_id IS '所属用户ID';
COMMENT ON COLUMN sync_snapshots.file_path IS '服务器上的文件存储路径';
COMMENT ON COLUMN sync_snapshots.file_size IS '文件大小（字节）';
COMMENT ON COLUMN sync_snapshots.checksum IS 'SHA-256 校验和，用于验证文件完整性';
COMMENT ON COLUMN sync_snapshots.metadata IS '快照元数据（JSON格式），包含版本、文章数、账号数等';
COMMENT ON COLUMN sync_snapshots.created_at IS '创建时间';
COMMENT ON COLUMN sync_snapshots.last_downloaded_at IS '最后下载时间，下载后重置过期时间';
COMMENT ON COLUMN sync_snapshots.expires_at IS '过期时间，默认90天后过期';
COMMENT ON COLUMN sync_snapshots.status IS '状态：active-活跃, expired-已过期, deleted-已删除';

-- 获取用户快照数量的函数
CREATE OR REPLACE FUNCTION get_user_snapshot_count(p_user_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM sync_snapshots
        WHERE user_id = p_user_id AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_snapshot_count(INTEGER) IS '获取用户活跃快照数量';

-- 清理过期快照的函数
CREATE OR REPLACE FUNCTION cleanup_expired_snapshots()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- 将过期的快照标记为 expired
    UPDATE sync_snapshots
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_snapshots() IS '清理过期快照，将状态更新为 expired';

-- 删除用户最旧快照的函数（保留最新的 N 个）
CREATE OR REPLACE FUNCTION delete_oldest_snapshots(
    p_user_id INTEGER,
    p_keep_count INTEGER DEFAULT 3
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 删除超出保留数量的最旧快照
    WITH to_delete AS (
        SELECT id
        FROM sync_snapshots
        WHERE user_id = p_user_id AND status = 'active'
        ORDER BY created_at DESC
        OFFSET p_keep_count
    )
    UPDATE sync_snapshots
    SET status = 'deleted'
    WHERE id IN (SELECT id FROM to_delete);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION delete_oldest_snapshots(INTEGER, INTEGER) IS '删除用户最旧的快照，保留最新的 N 个';

-- ==================== DOWN ====================
-- 注意：DOWN 部分仅用于手动回滚，不会自动执行
-- 如需回滚，请手动执行以下 SQL：
/*
DROP FUNCTION IF EXISTS delete_oldest_snapshots(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS cleanup_expired_snapshots();
DROP FUNCTION IF EXISTS get_user_snapshot_count(INTEGER);
DROP TABLE IF EXISTS sync_snapshots;
*/
