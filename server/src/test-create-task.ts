import { ArticleGenerationService } from './services/articleGenerationService';
import { pool } from './db/database';

async function test() {
  const service = new ArticleGenerationService();
  
  console.log('测试创建文章生成任务...\n');
  
  try {
    const taskId = await service.createTask({
      distillationId: 2,
      albumId: 1,
      knowledgeBaseId: 1,
      articleSettingId: 1,
      articleCount: 2
    });
    
    console.log('任务创建成功，ID:', taskId);
    
    // 等待一会儿让任务执行
    console.log('等待任务执行...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 查看任务状态
    const task = await service.getTaskDetail(taskId);
    console.log('\n任务状态:');
    console.log('  状态:', task?.status);
    console.log('  生成数量:', task?.generatedCount);
    console.log('  错误信息:', task?.errorMessage);
    
  } catch (error: any) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

test();
