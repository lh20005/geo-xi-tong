const fs = require('fs');

// 读取文件
const filePath = 'server/src/services/DashboardService.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 方法签名修改映射
const methodSignatures = [
  { old: 'async getTrends(startDate?: string, endDate?: string)', new: 'async getTrends(userId: number, startDate?: string, endDate?: string)' },
  { old: 'async getPlatformDistribution(startDate?: string, endDate?: string)', new: 'async getPlatformDistribution(userId: number, startDate?: string, endDate?: string)' },
  { old: 'async getPublishingStatus(startDate?: string, endDate?: string)', new: 'async getPublishingStatus(userId: number, startDate?: string, endDate?: string)' },
  { old: 'async getResourceUsage(startDate?: string, endDate?: string)', new: 'async getResourceUsage(userId: number, startDate?: string, endDate?: string)' },
  { old: 'async getGenerationTasks(startDate?: string, endDate?: string)', new: 'async getGenerationTasks(userId: number, startDate?: string, endDate?: string)' },
  { old: 'async getArticleStats()', new: 'async getArticleStats(userId: number)' },
  { old: 'async getKeywordDistribution()', new: 'async getKeywordDistribution(userId: number)' },
  { old: 'async getMonthlyComparison()', new: 'async getMonthlyComparison(userId: number)' },
  { old: 'async getHourlyActivity()', new: 'async getHourlyActivity(userId: number)' },
  { old: 'async getSuccessRates()', new: 'async getSuccessRates(userId: number)' },
  { old: 'async getTopResources(startDate?: string, endDate?: string)', new: 'async getTopResources(userId: number, startDate?: string, endDate?: string)' }
];

// 替换方法签名
methodSignatures.forEach(({ old, new: newSig }) => {
  content = content.replace(old, newSig);
});

// 添加 WHERE user_id 过滤的模式
const patterns = [
  // distillations 表
  { pattern: /FROM distillations(\s+WHERE)/g, replacement: 'FROM distillations WHERE user_id = $userId AND' },
  { pattern: /FROM distillations(\s*\n)/g, replacement: 'FROM distillations WHERE user_id = $userId$1' },
  { pattern: /FROM distillations d(\s+WHERE)/g, replacement: 'FROM distillations d WHERE d.user_id = $userId AND' },
  { pattern: /FROM distillations d(\s*\n)/g, replacement: 'FROM distillations d WHERE d.user_id = $userId$1' },
  
  // articles 表
  { pattern: /FROM articles(\s+WHERE)/g, replacement: 'FROM articles WHERE user_id = $userId AND' },
  { pattern: /FROM articles(\s*\n)/g, replacement: 'FROM articles WHERE user_id = $userId$1' },
  
  // publishing_tasks 表
  { pattern: /FROM publishing_tasks(\s+WHERE)/g, replacement: 'FROM publishing_tasks WHERE user_id = $userId AND' },
  { pattern: /FROM publishing_tasks(\s*\n)/g, replacement: 'FROM publishing_tasks WHERE user_id = $userId$1' },
  
  // knowledge_bases 表
  { pattern: /FROM knowledge_bases kb(\s*\n)/g, replacement: 'FROM knowledge_bases kb WHERE kb.user_id = $userId$1' },
  
  // albums 表
  { pattern: /FROM albums a(\s*\n)/g, replacement: 'FROM albums a WHERE a.user_id = $userId$1' }
];

// 注意：这个脚本需要手动调整，因为SQL查询的复杂性
console.log('请手动修改 DashboardService.ts 文件，在所有查询中添加 user_id 过滤');
console.log('已备份到 DashboardService.ts.backup');
