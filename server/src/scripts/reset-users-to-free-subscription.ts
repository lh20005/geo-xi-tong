/**
 * 为现有无订阅用户重置为免费版配额
 * 
 * 使用方法:
 * npx ts-node src/scripts/reset-users-to-free-subscription.ts
 */

import { freeSubscriptionService } from '../services/FreeSubscriptionService';
import { pool } from '../db/database';

async function main() {
  console.log('========================================');
  console.log('为现有无订阅用户重置免费版配额');
  console.log('========================================\n');

  try {
    // 执行批量重置
    const result = await freeSubscriptionService.resetExistingUsersToFree();
    
    console.log('\n========================================');
    console.log('批量重置完成');
    console.log('========================================');
    console.log(`总用户数: ${result.total}`);
    console.log(`成功: ${result.success}`);
    console.log(`失败: ${result.failed}`);
    console.log('========================================\n');
    
    if (result.failed > 0) {
      console.warn('⚠️  部分用户处理失败，请查看上方日志了解详情');
      process.exit(1);
    } else {
      console.log('✅ 所有用户处理成功');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ 批量重置失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
