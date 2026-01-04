import * as fs from 'fs';
import * as path from 'path';

/**
 * 修复所有配额问题的脚本
 * 
 * 修复内容：
 * 1. distillation.ts - 添加配额检查和记录
 * 2. platformAccounts.ts - 添加配额检查和记录  
 * 3. publishingTasks.ts - 添加配额记录
 */

console.log('=== 配额系统代码修复 ===\n');

const fixes = [
  {
    file: 'distillation.ts',
    description: '关键词蒸馏 - 添加配额检查和记录',
    status: 'pending'
  },
  {
    file: 'platformAccounts.ts',
    description: '平台账号 - 添加配额检查和记录',
    status: 'pending'
  },
  {
    file: 'publishingTasks.ts',
    description: '发布任务 - 添加配额记录',
    status: 'pending'
  }
];

console.log('需要修复的文件:');
fixes.forEach((fix, index) => {
  console.log(`${index + 1}. ${fix.file} - ${fix.description}`);
});

console.log('\n⚠️  这些修复需要手动完成，因为涉及复杂的代码逻辑');
console.log('请按照以下指南进行修复:\n');

console.log('=== 修复指南 ===\n');

console.log('1. distillation.ts');
console.log('   位置: server/src/routes/distillation.ts');
console.log('   需要添加:');
console.log('   a) 在文件顶部导入:');
console.log('      import { usageTrackingService } from \'../services/UsageTrackingService\';');
console.log('');
console.log('   b) 在蒸馏操作前添加配额检查:');
console.log(`      const quota = await usageTrackingService.checkQuota(userId, 'keyword_distillation');
      if (!quota.hasQuota || quota.remaining < 1) {
        return res.status(403).json({ 
          error: '关键词蒸馏配额不足',
          message: \`您本月的蒸馏配额不足。剩余 \${quota.remaining} 次\`,
          quota: {
            remaining: quota.remaining,
            total: quota.quotaLimit
          }
        });
      }`);
console.log('');
console.log('   c) 在蒸馏成功后添加配额记录:');
console.log(`      await usageTrackingService.recordUsage(
        userId,
        'keyword_distillation',
        'distillation',
        distillationId,
        1
      );`);
console.log('');

console.log('2. platformAccounts.ts');
console.log('   位置: server/src/routes/platformAccounts.ts');
console.log('   需要添加:');
console.log('   a) 在文件顶部导入:');
console.log('      import { usageTrackingService } from \'../services/UsageTrackingService\';');
console.log('');
console.log('   b) 在添加账号前添加配额检查:');
console.log(`      const quota = await usageTrackingService.checkQuota(userId, 'platform_accounts');
      if (!quota.hasQuota || quota.remaining < 1) {
        return res.status(403).json({ 
          error: '平台账号配额不足',
          message: \`您的平台账号数量已达上限。当前 \${quota.currentUsage}/\${quota.quotaLimit}\`,
          quota: {
            current: quota.currentUsage,
            total: quota.quotaLimit
          }
        });
      }`);
console.log('');
console.log('   c) 在添加成功后添加配额记录:');
console.log(`      await usageTrackingService.recordUsage(
        userId,
        'platform_accounts',
        'platform_account',
        accountId,
        1
      );`);
console.log('');
console.log('   d) 在删除账号后减少配额:');
console.log(`      await usageTrackingService.recordUsage(
        userId,
        'platform_accounts',
        'platform_account',
        accountId,
        -1  // 负数表示减少
      );`);
console.log('');

console.log('3. publishingTasks.ts');
console.log('   位置: server/src/routes/publishingTasks.ts');
console.log('   需要添加:');
console.log('   a) 确认已导入 usageTrackingService');
console.log('   b) 在发布成功后添加配额记录:');
console.log(`      await usageTrackingService.recordUsage(
        userId,
        'publish_per_month',
        'publish',
        taskId,
        1
      );`);
console.log('');

console.log('=== 验证步骤 ===\n');
console.log('修复完成后，运行以下命令验证:');
console.log('1. npx ts-node src/scripts/audit-quota-system.ts');
console.log('2. 手动测试每个功能');
console.log('3. 检查配额是否正确扣减');
console.log('');

// 生成修复清单
const checklistPath = path.join(__dirname, '../../..', '配额修复清单.md');
const checklist = `# 配额系统修复清单

## 修复项目

### 1. distillation.ts ❌
- [ ] 导入 usageTrackingService
- [ ] 添加配额检查（蒸馏前）
- [ ] 添加配额记录（蒸馏成功后）
- [ ] 测试：蒸馏后配额减少
- [ ] 测试：配额不足时拒绝蒸馏

### 2. platformAccounts.ts ❌
- [ ] 导入 usageTrackingService
- [ ] 添加配额检查（添加账号前）
- [ ] 添加配额记录（添加成功后）
- [ ] 添加配额减少（删除账号后）
- [ ] 测试：添加账号后配额减少
- [ ] 测试：删除账号后配额增加
- [ ] 测试：配额不足时拒绝添加

### 3. publishingTasks.ts ❌
- [ ] 确认已导入 usageTrackingService
- [ ] 添加配额记录（发布成功后）
- [ ] 测试：发布后配额减少
- [ ] 测试：配额不足时拒绝发布

## 验证清单

### 功能测试
- [ ] 文章生成：配额检查 ✅ 配额记录 ✅
- [ ] 关键词蒸馏：配额检查 ❌ 配额记录 ❌
- [ ] 平台账号：配额检查 ❌ 配额记录 ❌
- [ ] 发布任务：配额检查 ✅ 配额记录 ❌
- [ ] 存储空间：配额检查 ✅ 配额记录 ✅

### 集成测试
- [ ] 生成文章 -> 配额减少 -> 配额显示正确
- [ ] 蒸馏关键词 -> 配额减少 -> 配额显示正确
- [ ] 添加账号 -> 配额减少 -> 配额显示正确
- [ ] 删除账号 -> 配额增加 -> 配额显示正确
- [ ] 发布文章 -> 配额减少 -> 配额显示正确
- [ ] 上传图片 -> 存储减少 -> 存储显示正确

### 边界测试
- [ ] 配额为 0 时无法操作
- [ ] 配额不足时显示正确错误信息
- [ ] 配额重置后恢复正常
- [ ] 多个操作并发时配额正确

## 完成标准

所有 ❌ 变为 ✅，所有测试通过。
`;

fs.writeFileSync(checklistPath, checklist);
console.log(`📋 修复清单已生成: 配额修复清单.md\n`);
