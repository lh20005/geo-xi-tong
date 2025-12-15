import { TopicSelectionService } from './services/topicSelectionService';
import { pool } from './db/database';

async function test() {
  const service = new TopicSelectionService();
  
  console.log('测试话题选择服务...\n');
  
  try {
    // 测试1: 为蒸馏结果2选择话题
    console.log('测试1: 为蒸馏结果2选择话题');
    const topic = await service.selectLeastUsedTopic(2);
    console.log('选中的话题:', topic);
    console.log('');
    
    // 测试2: 批量选择话题
    console.log('测试2: 批量选择话题（蒸馏结果2, 3, 4）');
    const topicMap = await service.selectTopicsForDistillations([2, 3, 4]);
    console.log('选中的话题:');
    for (const [distId, topicData] of topicMap.entries()) {
      console.log(`  蒸馏结果${distId}: 话题ID=${topicData.topicId}, 问题="${topicData.question.substring(0, 30)}...", 使用次数=${topicData.usageCount}`);
    }
    console.log('');
    
    // 测试3: 查看蒸馏结果2的所有话题统计
    console.log('测试3: 查看蒸馏结果2的所有话题统计');
    const stats = await service.getDistillationTopicsStats(2);
    console.log(`共有 ${stats.length} 个话题:`);
    stats.slice(0, 5).forEach(s => {
      console.log(`  话题ID=${s.topicId}, 问题="${s.question.substring(0, 30)}...", 使用次数=${s.usageCount}`);
    });
    
  } catch (error: any) {
    console.error('测试失败:', error.message);
    console.error(error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

test();
