/**
 * 蒸馏模块 IPC 处理器（本地 PostgreSQL）
 * 处理蒸馏记录的本地 CRUD 操作
 * Requirements: Phase 6 - PostgreSQL 迁移
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { serviceFactory } from '../../services/ServiceFactory';
import { storageManager } from '../../storage/manager';
import { getPool } from '../../database/postgres';

/**
 * 注册蒸馏相关 IPC 处理器
 */
export function registerLocalDistillationHandlers(): void {
  log.info('Registering local distillation IPC handlers (PostgreSQL)...');

  // 创建蒸馏记录
  ipcMain.handle('distillation:local:create', async (_event, params: any) => {
    try {
      log.info('IPC: distillation:local:create');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const distillation = await distillationService.create(params);

      return { success: true, data: distillation };
    } catch (error: any) {
      log.error('IPC: distillation:local:create failed:', error);
      return { success: false, error: error.message || '创建蒸馏记录失败' };
    }
  });

  // 获取所有蒸馏记录（分页）
  ipcMain.handle('distillation:local:findAll', async (_event, params?: any) => {
    try {
      log.info('IPC: distillation:local:findAll');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const result = await distillationService.findPaginated(
        params || {},
        ['keyword', 'industry', 'target_audience']
      );

      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: distillation:local:findAll failed:', error);
      return { success: false, error: error.message || '获取蒸馏记录列表失败' };
    }
  });

  // 根据 ID 获取蒸馏记录
  ipcMain.handle('distillation:local:findById', async (_event, id: number) => {
    try {
      log.info(`IPC: distillation:local:findById - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const distillation = await distillationService.findById(id);

      if (!distillation) {
        return { success: false, error: '蒸馏记录不存在' };
      }

      return { success: true, data: distillation };
    } catch (error: any) {
      log.error('IPC: distillation:local:findById failed:', error);
      return { success: false, error: error.message || '获取蒸馏记录失败' };
    }
  });

  // 更新蒸馏记录
  ipcMain.handle('distillation:local:update', async (_event, id: number, params: any) => {
    try {
      log.info(`IPC: distillation:local:update - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const distillation = await distillationService.update(id, params);

      return { success: true, data: distillation };
    } catch (error: any) {
      log.error('IPC: distillation:local:update failed:', error);
      return { success: false, error: error.message || '更新蒸馏记录失败' };
    }
  });

  // 删除蒸馏记录
  ipcMain.handle('distillation:local:delete', async (_event, id: number) => {
    try {
      log.info(`IPC: distillation:local:delete - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      await distillationService.delete(id);

      return { success: true };
    } catch (error: any) {
      log.error('IPC: distillation:local:delete failed:', error);
      return { success: false, error: error.message || '删除蒸馏记录失败' };
    }
  });

  // 批量删除蒸馏记录
  ipcMain.handle('distillation:local:deleteBatch', async (_event, ids: number[]) => {
    try {
      log.info(`IPC: distillation:local:deleteBatch - ${ids.length} records`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const count = await distillationService.deleteMany(ids);

      return { success: true, data: { deletedCount: count } };
    } catch (error: any) {
      log.error('IPC: distillation:local:deleteBatch failed:', error);
      return { success: false, error: error.message || '批量删除蒸馏记录失败' };
    }
  });

  // 根据关键词获取蒸馏记录
  ipcMain.handle('distillation:local:getByKeyword', async (_event, keyword: string) => {
    try {
      log.info(`IPC: distillation:local:getByKeyword - ${keyword}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const distillations = await distillationService.findByKeyword(keyword);

      return { success: true, data: distillations };
    } catch (error: any) {
      log.error('IPC: distillation:local:getByKeyword failed:', error);
      return { success: false, error: error.message || '获取蒸馏记录失败' };
    }
  });

  // 搜索蒸馏记录
  ipcMain.handle('distillation:local:search', async (_event, searchTerm: string) => {
    try {
      log.info(`IPC: distillation:local:search - ${searchTerm}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const distillations = await distillationService.search(searchTerm);

      return { success: true, data: distillations };
    } catch (error: any) {
      log.error('IPC: distillation:local:search failed:', error);
      return { success: false, error: error.message || '搜索蒸馏记录失败' };
    }
  });

  // 获取最近的蒸馏记录
  ipcMain.handle('distillation:local:findRecent', async (_event, limit: number = 10) => {
    try {
      log.info(`IPC: distillation:local:findRecent - limit: ${limit}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const distillations = await distillationService.findRecent(limit);

      return { success: true, data: distillations };
    } catch (error: any) {
      log.error('IPC: distillation:local:findRecent failed:', error);
      return { success: false, error: error.message || '获取最近蒸馏记录失败' };
    }
  });

  // 获取统计信息
  ipcMain.handle('distillation:local:getStats', async () => {
    try {
      log.info('IPC: distillation:local:getStats');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const stats = await distillationService.getStats();

      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: distillation:local:getStats failed:', error);
      return { success: false, error: error.message || '获取统计信息失败' };
    }
  });

  // 检查蒸馏记录是否存在
  ipcMain.handle('distillation:local:exists', async (_event, id: number) => {
    try {
      log.info(`IPC: distillation:local:exists - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const exists = await distillationService.exists(id);

      return { success: true, data: { exists } };
    } catch (error: any) {
      log.error('IPC: distillation:local:exists failed:', error);
      return { success: false, error: error.message || '检查蒸馏记录失败' };
    }
  });

  // 获取蒸馏结果列表（用于结果页面）
  ipcMain.handle('distillation:local:getResults', async (_event, filters?: any) => {
    try {
      log.info('IPC: distillation:local:getResults', filters);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const pool = getPool();

      // 构建查询条件
      const conditions: string[] = ['t.user_id = $1'];
      const params: any[] = [user.id];
      let paramIndex = 2;

      // 关键词筛选
      if (filters?.keyword) {
        conditions.push(`d.keyword = $${paramIndex}`);
        params.push(filters.keyword);
        paramIndex++;
      }

      // 搜索
      if (filters?.search) {
        conditions.push(`t.question ILIKE $${paramIndex}`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 分页参数
      const page = filters?.page || 1;
      const pageSize = filters?.pageSize || 10;
      const offset = (page - 1) * pageSize;

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM topics t
        JOIN distillations d ON t.distillation_id = d.id
        ${whereClause}
      `;
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // 查询数据（包含引用次数）
      const dataQuery = `
        SELECT 
          t.id,
          t.question,
          t.distillation_id,
          t.created_at as "createdAt",
          d.keyword,
          COALESCE(
            (SELECT COUNT(*) FROM articles a WHERE a.topic_id = t.id),
            0
          ) as "referenceCount"
        FROM topics t
        JOIN distillations d ON t.distillation_id = d.id
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(pageSize, offset);
      const dataResult = await pool.query(dataQuery, params);

      // 获取统计信息
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT t.id) as "totalTopics",
          COUNT(DISTINCT d.id) as "totalKeywords",
          COALESCE(SUM(
            (SELECT COUNT(*) FROM articles a WHERE a.topic_id = t.id)
          ), 0) as "totalReferences"
        FROM topics t
        JOIN distillations d ON t.distillation_id = d.id
        WHERE t.user_id = $1
      `;
      const statsResult = await pool.query(statsQuery, [user.id]);

      return {
        success: true,
        data: {
          data: dataResult.rows,
          total,
          page,
          pageSize,
          statistics: {
            totalTopics: parseInt(statsResult.rows[0].totalTopics) || 0,
            totalKeywords: parseInt(statsResult.rows[0].totalKeywords) || 0,
            totalReferences: parseInt(statsResult.rows[0].totalReferences) || 0,
          },
        },
      };
    } catch (error: any) {
      log.error('IPC: distillation:local:getResults failed:', error);
      return { success: false, error: error.message || '获取蒸馏结果失败' };
    }
  });

  // 获取所有唯一关键词列表（只返回有话题的关键词）
  ipcMain.handle('distillation:local:getKeywords', async () => {
    try {
      log.info('IPC: distillation:local:getKeywords');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const pool = getPool();

      // 只返回有话题的关键词
      const query = `
        SELECT DISTINCT d.keyword
        FROM distillations d
        INNER JOIN topics t ON d.id = t.distillation_id
        WHERE d.user_id = $1
        ORDER BY d.keyword ASC
      `;
      const result = await pool.query(query, [user.id]);

      return {
        success: true,
        data: {
          keywords: result.rows.map((row: any) => row.keyword),
        },
      };
    } catch (error: any) {
      log.error('IPC: distillation:local:getKeywords failed:', error);
      return { success: false, error: error.message || '获取关键词列表失败' };
    }
  });

  // 批量删除话题
  ipcMain.handle('distillation:local:deleteTopics', async (_event, topicIds: number[]) => {
    try {
      log.info(`IPC: distillation:local:deleteTopics - ${topicIds.length} topics`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const pool = getPool();

      // 验证所有 ID 都是有效的整数
      const validIds = topicIds.filter((id) => Number.isInteger(id) && id > 0);
      if (validIds.length !== topicIds.length) {
        return { success: false, error: '部分话题 ID 无效' };
      }

      // 删除话题
      const query = `
        DELETE FROM topics
        WHERE id = ANY($1) AND user_id = $2
        RETURNING id
      `;
      const result = await pool.query(query, [validIds, user.id]);

      return {
        success: true,
        data: {
          deletedCount: result.rowCount || 0,
        },
      };
    } catch (error: any) {
      log.error('IPC: distillation:local:deleteTopics failed:', error);
      return { success: false, error: error.message || '删除话题失败' };
    }
  });

  // 按关键词删除所有话题（同时清理空的 distillations 记录）
  ipcMain.handle('distillation:local:deleteTopicsByKeyword', async (_event, keyword: string) => {
    try {
      log.info(`IPC: distillation:local:deleteTopicsByKeyword - ${keyword}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const pool = getPool();

      // 开始事务
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. 删除话题
        const deleteTopicsQuery = `
          DELETE FROM topics t
          USING distillations d
          WHERE t.distillation_id = d.id
            AND d.keyword = $1
            AND t.user_id = $2
          RETURNING t.id
        `;
        const deleteResult = await client.query(deleteTopicsQuery, [keyword, user.id]);
        const deletedCount = deleteResult.rowCount || 0;

        // 2. 删除没有话题的 distillations 记录
        const deleteDistillationsQuery = `
          DELETE FROM distillations d
          WHERE d.keyword = $1
            AND d.user_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM topics t WHERE t.distillation_id = d.id
            )
          RETURNING d.id
        `;
        const distillationResult = await client.query(deleteDistillationsQuery, [keyword, user.id]);
        const deletedDistillations = distillationResult.rowCount || 0;

        await client.query('COMMIT');

        log.info(`Deleted ${deletedCount} topics and ${deletedDistillations} distillations for keyword: ${keyword}`);

        return {
          success: true,
          data: {
            deletedCount,
            deletedDistillations,
            keyword,
          },
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      log.error('IPC: distillation:local:deleteTopicsByKeyword failed:', error);
      return { success: false, error: error.message || '按关键词删除话题失败' };
    }
  });

  log.info('Local distillation IPC handlers registered (PostgreSQL)');
}
