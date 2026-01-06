/**
 * 孤儿图片清理定时任务
 * 可通过 cron 定期执行，或在服务器启动时调度
 * 
 * 使用方式：
 * - 手动执行: npx tsx src/scripts/cleanupOrphanImages.ts
 * - Cron: 0 3 * * * cd /path/to/server && npx tsx src/scripts/cleanupOrphanImages.ts
 */

import { orphanImageCleanupService } from '../services/OrphanImageCleanupService';
import { pool } from '../db/database';

async function main() {
  console.log('='.repeat(60));
  console.log('[定时清理] 开始执行孤儿图片清理任务');
  console.log(`[定时清理] 时间: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  try {
    // 获取清理前的统计
    const beforeStats = await orphanImageCleanupService.getOrphanStats();
    console.log(`[定时清理] 清理前统计:`);
    console.log(`  - 孤儿图片数: ${beforeStats.totalOrphans}`);
    console.log(`  - 占用空间: ${formatBytes(beforeStats.totalSize)}`);
    if (beforeStats.oldestOrphan) {
      console.log(`  - 最早孤儿: ${beforeStats.oldestOrphan.toISOString()}`);
    }

    // 执行清理（24小时以上的孤儿图片）
    const result = await orphanImageCleanupService.cleanupOrphanImages(24);

    console.log('\n[定时清理] 清理结果:');
    console.log(`  - 扫描数量: ${result.scannedCount}`);
    console.log(`  - 删除数量: ${result.deletedCount}`);
    console.log(`  - 释放空间: ${formatBytes(result.freedBytes)}`);
    
    if (result.errors.length > 0) {
      console.log(`  - 错误数量: ${result.errors.length}`);
      result.errors.forEach((err, i) => {
        console.log(`    ${i + 1}. ${err}`);
      });
    }

    // 获取清理后的统计
    const afterStats = await orphanImageCleanupService.getOrphanStats();
    console.log(`\n[定时清理] 清理后统计:`);
    console.log(`  - 剩余孤儿图片: ${afterStats.totalOrphans}`);
    console.log(`  - 剩余占用空间: ${formatBytes(afterStats.totalSize)}`);

  } catch (error) {
    console.error('[定时清理] 执行失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n[定时清理] 任务完成');
    console.log('='.repeat(60));
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

main();
