"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.distillationRouter = void 0;
const express_1 = require("express");
const database_1 = require("../db/database");
const ConfigHelper_1 = require("../services/ConfigHelper");
const distillationService_1 = require("../services/distillationService");
const adminAuth_1 = require("../middleware/adminAuth");
const tenantContext_1 = require("../middleware/tenantContext");
const UsageTrackingService_1 = require("../services/UsageTrackingService");
exports.distillationRouter = (0, express_1.Router)();
const distillationService = new distillationService_1.DistillationService();
// 应用认证和租户中间件
exports.distillationRouter.use(adminAuth_1.authenticate);
exports.distillationRouter.use(tenantContext_1.setTenantContext);
exports.distillationRouter.use(tenantContext_1.requireTenantContext);
// 执行关键词蒸馏
exports.distillationRouter.post('/', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const { keyword } = req.body;
        if (!keyword) {
            return res.status(400).json({ error: '请提供关键词' });
        }
        // ========== 配额检查 ==========
        const quota = await UsageTrackingService_1.usageTrackingService.checkQuota(userId, 'keyword_distillation');
        if (!quota.hasQuota || quota.remaining < 1) {
            return res.status(403).json({
                error: '关键词蒸馏配额不足',
                message: `您本月的蒸馏配额不足。剩余 ${quota.remaining} 次`,
                quota: {
                    remaining: quota.remaining,
                    total: quota.quotaLimit
                }
            });
        }
        // 使用ConfigHelper获取AI服务（自动解密）
        const aiService = await ConfigHelper_1.ConfigHelper.getAIService();
        const currentConfig = await ConfigHelper_1.ConfigHelper.getCurrentConfig();
        if (!currentConfig) {
            return res.status(400).json({ error: '系统未配置AI服务，请联系管理员' });
        }
        // 获取关键词蒸馏配置（优先用户配置，其次全局配置）
        const distillConfigResult = await database_1.pool.query('SELECT prompt, topic_count FROM distillation_config WHERE is_active = true AND (user_id = $1 OR user_id IS NULL) ORDER BY user_id DESC NULLS LAST LIMIT 1', [userId]);
        let promptTemplate;
        let topicCount;
        if (distillConfigResult.rows.length > 0) {
            promptTemplate = distillConfigResult.rows[0].prompt;
            topicCount = distillConfigResult.rows[0].topic_count;
        }
        // 执行蒸馏（使用配置的prompt和数量）
        const questions = await aiService.distillKeyword(keyword, promptTemplate, topicCount);
        // 保存蒸馏记录（关联用户）
        const distillationResult = await database_1.pool.query('INSERT INTO distillations (keyword, provider, user_id) VALUES ($1, $2, $3) RETURNING id', [keyword, currentConfig.provider, userId]);
        const distillationId = distillationResult.rows[0].id;
        // 保存话题
        for (const question of questions) {
            await database_1.pool.query('INSERT INTO topics (distillation_id, question) VALUES ($1, $2)', [distillationId, question]);
        }
        // ========== 记录配额使用 ==========
        await UsageTrackingService_1.usageTrackingService.recordUsage(userId, 'keyword_distillation', 'distillation', distillationId, 1);
        res.json({
            success: true,
            distillationId,
            keyword,
            questions,
            count: questions.length
        });
    }
    catch (error) {
        console.error('蒸馏错误:', error);
        res.status(500).json({
            error: '关键词蒸馏失败',
            details: error.message
        });
    }
});
// 手动批量输入蒸馏结果
exports.distillationRouter.post('/manual', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const { keyword, questions } = req.body;
        // 参数验证
        if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
            return res.status(400).json({ error: '请提供关键词' });
        }
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: '请至少提供一个蒸馏结果' });
        }
        // ========== 配额检查 ==========
        const quota = await UsageTrackingService_1.usageTrackingService.checkQuota(userId, 'keyword_distillation');
        if (!quota.hasQuota || quota.remaining < 1) {
            return res.status(403).json({
                error: '关键词蒸馏配额不足',
                message: `您本月的蒸馏配额不足。剩余 ${quota.remaining} 次`,
                quota: {
                    remaining: quota.remaining,
                    total: quota.quotaLimit
                }
            });
        }
        // 验证每个问题都是非空字符串
        const validQuestions = questions
            .map(q => typeof q === 'string' ? q.trim() : '')
            .filter(q => q.length > 0);
        if (validQuestions.length === 0) {
            return res.status(400).json({ error: '请提供有效的蒸馏结果' });
        }
        // 使用事务保存数据
        const client = await database_1.pool.connect();
        try {
            await client.query('BEGIN');
            // 保存蒸馏记录（provider标记为'manual'表示手动输入，关联用户）
            const distillationResult = await client.query('INSERT INTO distillations (keyword, provider, user_id) VALUES ($1, $2, $3) RETURNING id', [keyword.trim(), 'manual', userId]);
            const distillationId = distillationResult.rows[0].id;
            // 批量保存话题
            for (const question of validQuestions) {
                await client.query('INSERT INTO topics (distillation_id, question) VALUES ($1, $2)', [distillationId, question]);
            }
            await client.query('COMMIT');
            // ========== 记录配额使用 ==========
            await UsageTrackingService_1.usageTrackingService.recordUsage(userId, 'keyword_distillation', 'distillation', distillationId, 1);
            res.json({
                success: true,
                distillationId,
                keyword: keyword.trim(),
                questions: validQuestions,
                count: validQuestions.length
            });
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('手动输入蒸馏结果错误:', error);
        res.status(500).json({
            error: '保存蒸馏结果失败',
            details: error.message
        });
    }
});
// ==================== 特定路径路由（必须在 /:id 之前）====================
// 获取所有唯一的关键词列表
exports.distillationRouter.get('/keywords', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        // 从 topics 表获取当前用户的关键词（topics 独立存储 keyword 和 user_id）
        const result = await database_1.pool.query('SELECT DISTINCT keyword FROM topics WHERE user_id = $1 AND keyword IS NOT NULL ORDER BY keyword', [userId]);
        const keywords = result.rows.map(row => row.keyword);
        res.json({ keywords });
    }
    catch (error) {
        console.error('获取关键词列表错误:', error);
        res.status(500).json({
            error: '获取关键词列表失败',
            details: error.message
        });
    }
});
// 获取蒸馏历史（扩展版：支持排序、筛选、分页）
exports.distillationRouter.get('/history', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        // 解析查询参数
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const sortBy = req.query.sortBy || 'created_at';
        const sortOrder = req.query.sortOrder || 'desc';
        const filterUsage = req.query.filterUsage || 'all';
        // 参数验证
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            return res.status(400).json({ error: '无效的分页参数' });
        }
        if (!['created_at', 'usage_count'].includes(sortBy)) {
            return res.status(400).json({ error: '无效的排序字段' });
        }
        if (!['asc', 'desc'].includes(sortOrder)) {
            return res.status(400).json({ error: '无效的排序顺序' });
        }
        if (!['all', 'used', 'unused'].includes(filterUsage)) {
            return res.status(400).json({ error: '无效的筛选条件' });
        }
        // 构建WHERE子句（添加 user_id 过滤）
        let whereClause = 'WHERE d.user_id = $1';
        const params = [userId];
        let paramIndex = 2;
        if (filterUsage === 'used') {
            whereClause += ' AND d.usage_count > 0';
        }
        else if (filterUsage === 'unused') {
            whereClause += ' AND d.usage_count = 0';
        }
        // 构建ORDER BY子句
        const orderByClause = `ORDER BY d.${sortBy} ${sortOrder.toUpperCase()}`;
        // 计算偏移量
        const offset = (page - 1) * pageSize;
        // 查询总数（只统计有话题的distillation记录）
        const countQuery = `
      SELECT COUNT(DISTINCT d.id) as total
      FROM distillations d
      INNER JOIN topics t ON d.id = t.distillation_id
      ${whereClause}
    `;
        const countResult = await database_1.pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);
        // 查询数据（包含usage_count和lastUsedAt）
        // 只显示有话题的distillation记录（topic_count > 0）
        const dataQuery = `
      SELECT 
        d.id, 
        d.keyword, 
        d.provider, 
        d.created_at,
        d.usage_count,
        COUNT(t.id) as topic_count,
        (
          SELECT MAX(du.used_at)
          FROM distillation_usage du
          WHERE du.distillation_id = d.id
        ) as last_used_at
      FROM distillations d
      LEFT JOIN topics t ON d.id = t.distillation_id
      ${whereClause}
      GROUP BY d.id
      HAVING COUNT(t.id) > 0
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
        const result = await database_1.pool.query(dataQuery, [...params, pageSize, offset]);
        res.json({
            data: result.rows,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    }
    catch (error) {
        console.error('获取历史记录失败:', error);
        res.status(500).json({
            error: '获取历史记录失败',
            details: error.message
        });
    }
});
// 获取带引用次数的蒸馏结果列表（新的表格视图API）
exports.distillationRouter.get('/results', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const keyword = req.query.keyword;
        const provider = req.query.provider;
        const search = req.query.search;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        // 参数验证
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            return res.status(400).json({ error: '无效的分页参数' });
        }
        if (provider && !['deepseek', 'gemini', 'ollama'].includes(provider)) {
            return res.status(400).json({ error: '无效的AI模型参数' });
        }
        // 调用服务层方法（添加 userId 过滤）
        // search参数优先级最高，如果提供了search，其他筛选条件会被忽略
        const result = await distillationService.getResultsWithReferences({
            keyword,
            provider,
            search,
            page,
            pageSize,
            userId
        });
        res.json(result);
    }
    catch (error) {
        console.error('获取蒸馏结果列表错误:', error);
        res.status(500).json({
            error: '获取蒸馏结果列表失败',
            details: error.message
        });
    }
});
// 获取蒸馏结果列表（包含使用统计）
// Task 2.1: 扩展蒸馏结果列表API - 已完成，现在使用扩展的service方法
exports.distillationRouter.get('/stats', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const sortBy = req.query.sortBy || 'usage_count';
        const sortOrder = req.query.sortOrder || 'asc';
        const filterUsage = req.query.filterUsage || 'all';
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            return res.status(400).json({ error: '无效的分页参数' });
        }
        if (!['created_at', 'usage_count'].includes(sortBy)) {
            return res.status(400).json({ error: '无效的排序字段' });
        }
        if (!['asc', 'desc'].includes(sortOrder)) {
            return res.status(400).json({ error: '无效的排序顺序' });
        }
        if (!['all', 'used', 'unused'].includes(filterUsage)) {
            return res.status(400).json({ error: '无效的筛选条件' });
        }
        const result = await distillationService.getDistillationsWithStats(page, pageSize, sortBy, sortOrder, filterUsage, userId);
        res.json(result);
    }
    catch (error) {
        console.error('获取使用统计错误:', error);
        res.status(500).json({
            error: '获取使用统计失败',
            details: error.message
        });
    }
});
// 获取推荐的蒸馏结果
exports.distillationRouter.get('/recommended', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const limit = parseInt(req.query.limit) || 3;
        if (limit < 1 || limit > 10) {
            return res.status(400).json({ error: '推荐数量必须在1-10之间' });
        }
        const result = await distillationService.getRecommendedDistillations(limit, userId);
        res.json(result);
    }
    catch (error) {
        console.error('获取推荐结果错误:', error);
        res.status(500).json({
            error: '获取推荐结果失败',
            details: error.message
        });
    }
});
// 修复使用计数API
exports.distillationRouter.post('/fix-usage-count', async (req, res) => {
    try {
        const { distillationId } = req.body;
        // 如果提供了distillationId,只修复单个
        if (distillationId !== undefined) {
            const id = parseInt(distillationId);
            if (isNaN(id) || id <= 0) {
                return res.status(400).json({ error: '无效的蒸馏结果ID' });
            }
            // 检查记录是否存在
            const checkResult = await database_1.pool.query('SELECT id, keyword, usage_count FROM distillations WHERE id = $1', [id]);
            if (checkResult.rows.length === 0) {
                return res.status(404).json({ error: '蒸馏结果不存在' });
            }
            const oldCount = checkResult.rows[0].usage_count;
            // 重新计算usage_count
            const countResult = await database_1.pool.query('SELECT COUNT(*) as actual_count FROM distillation_usage WHERE distillation_id = $1', [id]);
            const actualCount = parseInt(countResult.rows[0].actual_count);
            // 更新usage_count
            await database_1.pool.query('UPDATE distillations SET usage_count = $1 WHERE id = $2', [actualCount, id]);
            res.json({
                success: true,
                message: '使用计数修复完成',
                fixedCount: 1,
                details: [{
                        distillationId: id,
                        keyword: checkResult.rows[0].keyword,
                        oldCount,
                        newCount: actualCount,
                        actualCount
                    }]
            });
        }
        else {
            // 修复所有蒸馏结果
            const allDistillations = await database_1.pool.query('SELECT id, keyword, usage_count FROM distillations');
            const details = [];
            let fixedCount = 0;
            for (const dist of allDistillations.rows) {
                const oldCount = dist.usage_count;
                // 重新计算usage_count
                const countResult = await database_1.pool.query('SELECT COUNT(*) as actual_count FROM distillation_usage WHERE distillation_id = $1', [dist.id]);
                const actualCount = parseInt(countResult.rows[0].actual_count);
                if (oldCount !== actualCount) {
                    // 更新usage_count
                    await database_1.pool.query('UPDATE distillations SET usage_count = $1 WHERE id = $2', [actualCount, dist.id]);
                    details.push({
                        distillationId: dist.id,
                        keyword: dist.keyword,
                        oldCount,
                        newCount: actualCount,
                        actualCount
                    });
                    fixedCount++;
                }
            }
            res.json({
                success: true,
                message: `使用计数修复完成,共修复${fixedCount}条记录`,
                fixedCount,
                details
            });
        }
    }
    catch (error) {
        console.error('修复使用计数错误:', error);
        res.status(500).json({
            error: '修复使用计数失败',
            details: error.message
        });
    }
});
// ==================== 其他操作（必须在动态路由之前）====================
// 批量删除话题
exports.distillationRouter.delete('/topics', async (req, res) => {
    try {
        const { topicIds } = req.body;
        // 参数验证
        if (!topicIds || !Array.isArray(topicIds)) {
            return res.status(400).json({ error: '请提供要删除的话题ID数组' });
        }
        if (topicIds.length === 0) {
            return res.json({ success: true, deletedCount: 0 });
        }
        // 尝试将所有ID转换为数字
        const convertedIds = topicIds.map(id => {
            const num = typeof id === 'string' ? parseInt(id, 10) : Number(id);
            return { original: id, converted: num };
        });
        // 验证转换后的值是否为有效的正整数
        const invalidIds = convertedIds.filter(({ converted }) => !Number.isInteger(converted) || converted <= 0);
        if (invalidIds.length > 0) {
            console.error('批量删除话题验证失败 - 无效的ID:', invalidIds.map(({ original }) => original));
            return res.status(400).json({
                error: '部分话题ID无效',
                details: '话题ID必须是正整数',
                invalidIds: invalidIds.map(({ original }) => original)
            });
        }
        // 使用转换后的有效数字ID
        const validIds = convertedIds.map(({ converted }) => converted);
        // 调用服务层方法
        const result = await distillationService.deleteTopics(validIds);
        res.json(result);
    }
    catch (error) {
        console.error('批量删除话题错误:', error);
        res.status(500).json({
            error: '批量删除话题失败',
            details: error.message
        });
    }
});
// 按关键词删除所有蒸馏结果
exports.distillationRouter.delete('/topics/by-keyword', async (req, res) => {
    try {
        const { keyword } = req.body;
        // 参数验证
        if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
            return res.status(400).json({ error: '请提供有效的关键词' });
        }
        // 调用服务层方法
        const result = await distillationService.deleteTopicsByKeyword(keyword.trim());
        res.json(result);
    }
    catch (error) {
        console.error('按关键词删除话题错误:', error);
        res.status(500).json({
            error: '按关键词删除话题失败',
            details: error.message
        });
    }
});
// 删除当前筛选条件下的所有话题
exports.distillationRouter.delete('/topics/by-filter', async (req, res) => {
    try {
        const { keyword, provider, search } = req.body;
        // 至少需要一个筛选条件
        if (!keyword && !provider && !search) {
            return res.status(400).json({
                error: '请提供至少一个筛选条件',
                details: '支持的筛选条件：keyword, provider, search'
            });
        }
        // 调用服务层方法
        const result = await distillationService.deleteTopicsByFilter({
            keyword,
            provider,
            search
        });
        res.json(result);
    }
    catch (error) {
        console.error('按筛选条件删除话题错误:', error);
        res.status(500).json({
            error: '按筛选条件删除话题失败',
            details: error.message
        });
    }
});
// ==================== 动态路由（必须在特定路径之后）====================
// 获取单条蒸馏记录的详细信息（扩展版：包含usage_count和lastUsedAt）
exports.distillationRouter.get('/:id', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const { id } = req.params;
        // 验证ID格式
        const distillationId = parseInt(id);
        if (isNaN(distillationId) || distillationId <= 0) {
            return res.status(400).json({ error: '无效的记录ID' });
        }
        // 获取蒸馏记录和所有关联的话题（包含usage_count和lastUsedAt，验证所有权）
        const result = await database_1.pool.query(`SELECT 
        d.id, 
        d.keyword, 
        d.provider, 
        d.created_at,
        d.usage_count,
        COALESCE(json_agg(t.question ORDER BY t.created_at) FILTER (WHERE t.question IS NOT NULL), '[]') as questions,
        (
          SELECT MAX(du.used_at)
          FROM distillation_usage du
          WHERE du.distillation_id = d.id
        ) as last_used_at
       FROM distillations d
       LEFT JOIN topics t ON d.id = t.distillation_id
       WHERE d.id = $1 AND d.user_id = $2
       GROUP BY d.id`, [distillationId, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '记录不存在或无权访问' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('获取记录详情错误:', error);
        res.status(500).json({
            error: '获取记录详情失败',
            details: error.message
        });
    }
});
// 删除单条蒸馏记录
exports.distillationRouter.delete('/:id', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const { id } = req.params;
        // 验证ID格式
        const distillationId = parseInt(id);
        if (isNaN(distillationId) || distillationId <= 0) {
            return res.status(400).json({ error: '无效的记录ID' });
        }
        // 检查记录是否存在且验证所有权
        const checkResult = await database_1.pool.query('SELECT id FROM distillations WHERE id = $1 AND user_id = $2', [distillationId, userId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: '记录不存在或无权访问' });
        }
        // 使用事务确保数据一致性
        const client = await database_1.pool.connect();
        try {
            await client.query('BEGIN');
            // 先删除关联的 topics 记录（蒸馏结果）
            const topicsResult = await client.query('DELETE FROM topics WHERE distillation_id = $1 RETURNING id', [distillationId]);
            const deletedTopicsCount = topicsResult.rowCount || 0;
            // 再删除 distillations 记录
            await client.query('DELETE FROM distillations WHERE id = $1 AND user_id = $2', [distillationId, userId]);
            await client.query('COMMIT');
            res.json({
                success: true,
                message: '记录删除成功',
                deletedTopicsCount
            });
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('删除记录错误:', error);
        res.status(500).json({
            error: '删除记录失败',
            details: error.message
        });
    }
});
// 更新蒸馏记录的关键词
exports.distillationRouter.patch('/:id', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const { id } = req.params;
        const { keyword } = req.body;
        // 验证ID格式
        const distillationId = parseInt(id);
        if (isNaN(distillationId) || distillationId <= 0) {
            return res.status(400).json({ error: '无效的记录ID' });
        }
        // 验证关键词
        if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
            return res.status(400).json({ error: '关键词不能为空' });
        }
        // 检查记录是否存在且验证所有权
        const checkResult = await database_1.pool.query('SELECT id FROM distillations WHERE id = $1 AND user_id = $2', [distillationId, userId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: '记录不存在或无权访问' });
        }
        // 更新关键词
        await database_1.pool.query('UPDATE distillations SET keyword = $1 WHERE id = $2 AND user_id = $3', [keyword.trim(), distillationId, userId]);
        res.json({
            success: true,
            message: '关键词更新成功'
        });
    }
    catch (error) {
        console.error('更新关键词错误:', error);
        res.status(500).json({
            error: '更新关键词失败',
            details: error.message
        });
    }
});
// 删除所有蒸馏记录
exports.distillationRouter.delete('/all/records', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        // 使用事务确保数据一致性
        const client = await database_1.pool.connect();
        try {
            await client.query('BEGIN');
            // 获取删除前的记录数量（仅当前用户）
            const countResult = await client.query('SELECT COUNT(*) as count FROM distillations WHERE user_id = $1', [userId]);
            const deletedCount = parseInt(countResult.rows[0].count);
            // 先删除所有关联的 topics 记录（通过 distillation_id 关联）
            const topicsResult = await client.query(`DELETE FROM topics WHERE distillation_id IN (
          SELECT id FROM distillations WHERE user_id = $1
        ) RETURNING id`, [userId]);
            const deletedTopicsCount = topicsResult.rowCount || 0;
            // 再删除所有 distillations 记录
            await client.query('DELETE FROM distillations WHERE user_id = $1', [userId]);
            await client.query('COMMIT');
            res.json({
                success: true,
                message: '所有记录删除成功',
                deletedCount,
                deletedTopicsCount
            });
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('删除所有记录错误:', error);
        res.status(500).json({
            error: '删除所有记录失败',
            details: error.message
        });
    }
});
// 获取单条蒸馏结果的使用历史（扩展版）
exports.distillationRouter.get('/:id/usage', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const distillationId = parseInt(req.params.id);
        if (isNaN(distillationId) || distillationId <= 0) {
            return res.status(400).json({ error: '无效的记录ID' });
        }
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            return res.status(400).json({ error: '无效的分页参数' });
        }
        // 检查蒸馏结果是否存在且验证所有权
        const distCheck = await database_1.pool.query('SELECT id, keyword, usage_count FROM distillations WHERE id = $1 AND user_id = $2', [distillationId, userId]);
        if (distCheck.rows.length === 0) {
            return res.status(404).json({ error: '蒸馏结果不存在或无权访问' });
        }
        const { keyword, usage_count } = distCheck.rows[0];
        // 计算偏移量
        const offset = (page - 1) * pageSize;
        // 查询总数
        const countResult = await database_1.pool.query('SELECT COUNT(*) as total FROM distillation_usage WHERE distillation_id = $1', [distillationId]);
        const total = parseInt(countResult.rows[0].total);
        // 查询使用历史
        const historyResult = await database_1.pool.query(`SELECT 
        du.id,
        du.task_id,
        du.article_id,
        du.used_at,
        a.title as article_title,
        CASE WHEN a.id IS NULL THEN true ELSE false END as article_deleted
       FROM distillation_usage du
       LEFT JOIN articles a ON du.article_id = a.id
       WHERE du.distillation_id = $1
       ORDER BY du.used_at DESC
       LIMIT $2 OFFSET $3`, [distillationId, pageSize, offset]);
        res.json({
            distillationId,
            keyword,
            totalUsageCount: usage_count,
            usageHistory: historyResult.rows,
            total,
            page,
            pageSize
        });
    }
    catch (error) {
        console.error('获取使用历史错误:', error);
        res.status(500).json({
            error: '获取使用历史失败',
            details: error.message
        });
    }
});
// 保留旧的API路径以保持向后兼容
exports.distillationRouter.get('/:id/usage-history', async (req, res) => {
    try {
        const distillationId = parseInt(req.params.id);
        if (isNaN(distillationId) || distillationId <= 0) {
            return res.status(400).json({ error: '无效的记录ID' });
        }
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            return res.status(400).json({ error: '无效的分页参数' });
        }
        const result = await distillationService.getUsageHistory(distillationId, page, pageSize);
        res.json(result);
    }
    catch (error) {
        console.error('获取使用历史错误:', error);
        res.status(500).json({
            error: '获取使用历史失败',
            details: error.message
        });
    }
});
// 重置单条蒸馏结果的使用统计
exports.distillationRouter.post('/:id/reset-usage', async (req, res) => {
    try {
        const distillationId = parseInt(req.params.id);
        if (isNaN(distillationId) || distillationId <= 0) {
            return res.status(400).json({ error: '无效的记录ID' });
        }
        // 检查记录是否存在
        const checkResult = await database_1.pool.query('SELECT id FROM distillations WHERE id = $1', [distillationId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: '记录不存在' });
        }
        await distillationService.resetUsageStats(distillationId);
        res.json({
            success: true,
            message: '使用统计重置成功'
        });
    }
    catch (error) {
        console.error('重置使用统计错误:', error);
        res.status(500).json({
            error: '重置使用统计失败',
            details: error.message
        });
    }
});
// 重置所有蒸馏结果的使用统计
exports.distillationRouter.post('/reset-all-usage', async (req, res) => {
    try {
        await distillationService.resetAllUsageStats();
        res.json({
            success: true,
            message: '所有使用统计重置成功'
        });
    }
    catch (error) {
        console.error('重置所有使用统计错误:', error);
        res.status(500).json({
            error: '重置所有使用统计失败',
            details: error.message
        });
    }
});
// 修复使用统计（重新计算usage_count）
exports.distillationRouter.post('/repair-usage-stats', async (req, res) => {
    try {
        const result = await distillationService.repairUsageStats();
        res.json({
            success: true,
            message: `修复完成，共修复${result.fixed}条记录`,
            ...result
        });
    }
    catch (error) {
        console.error('修复使用统计错误:', error);
        res.status(500).json({
            error: '修复使用统计失败',
            details: error.message
        });
    }
});
