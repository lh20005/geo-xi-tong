#!/usr/bin/env node
/**
 * 创建每日存储快照
 * 
 * 此脚本应该通过 cron 任务每天运行一次
 * 例如: 0 0 * * * cd /path/to/project && node dist/scripts/create-daily-snapshots.js
 */

import { pool } from '../db/database';
import { storageService } from '../services/StorageService';

async function createDailySnapshots() {
  console.log('[DailySnapshot] 开始创建每日快照...');
  
  try {
    // 获取所有用户
    const result = await pool.query(
      'SELECT user_id FROM user_storage_usage ORDER BY user_id'
    );

    const userIds = result.rows.map(row => row.user_id);
    console.log(`[DailySnapshot] 找到 ${userIds.length} 个用户`);

    let successCount = 0;
    let errorCount = 0;

    // 为每个用户创建快照
    for (const userId of userIds) {
      try {
        await storageService.createDailySnapshot(userId);
        successCount++;
      } catch (error) {
        console.error(`[DailySnapshot] 用户 ${userId} 快照创建失败:`, error);
        errorCount++;
      }
    }

    console.log(`[DailySnapshot] 完成! 成功: ${successCount}, 失败: ${errorCount}`);
  } catch (error) {
    console.error('[DailySnapshot] 创建快照失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 运行脚本
createDailySnapshots();
