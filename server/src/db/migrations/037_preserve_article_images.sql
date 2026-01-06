-- ==================== UP ====================
-- 迁移：保留被文章引用的图片文件
-- 问题：删除图库或图片时，文章中引用的图片文件也被删除，导致文章预览时看不到图片
-- 解决方案：在删除图库/图片时，检查图片是否被文章引用，如果被引用则保留文件
-- 
-- 注意：此迁移不涉及数据库结构变更，仅记录业务逻辑变更
-- 实际变更在 server/src/routes/gallery.ts 中：
-- 1. DELETE /api/gallery/albums/:id - 删除相册时保留被文章引用的图片文件
-- 2. DELETE /api/gallery/images/:id - 删除单张图片时保留被文章引用的图片文件

-- 创建一个辅助函数，用于检查图片是否被文章引用
CREATE OR REPLACE FUNCTION is_image_referenced_by_article(image_path VARCHAR)
RETURNS BOOLEAN AS $
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM articles WHERE image_url = image_path
  );
END;
$ LANGUAGE plpgsql;

-- 添加函数注释
COMMENT ON FUNCTION is_image_referenced_by_article(VARCHAR) IS '检查图片路径是否被文章引用，用于决定删除图库时是否保留图片文件';

-- ==================== DOWN ====================
-- 回滚：删除辅助函数

DROP FUNCTION IF EXISTS is_image_referenced_by_article(VARCHAR);
