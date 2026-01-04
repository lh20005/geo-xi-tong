/**
 * 测试更新套餐功能
 */

import { productManagementService } from '../services/ProductManagementService';

async function testUpdatePlan() {
  try {
    console.log('=== 测试更新套餐功能 ===\n');
    
    // 1. 获取第一个套餐
    console.log('1. 获取套餐列表...');
    const plans = await productManagementService.getAllPlans(true);
    
    if (plans.length === 0) {
      console.error('❌ 没有找到任何套餐');
      process.exit(1);
    }
    
    const plan = plans[0];
    console.log('✅ 找到套餐:', {
      id: plan.id,
      planCode: plan.planCode,
      planName: plan.planName,
      price: plan.price,
      features: plan.features
    });
    
    // 2. 尝试更新套餐
    console.log('\n2. 尝试更新套餐...');
    const updates = {
      planName: plan.planName,
      price: plan.price,
      billingCycle: plan.billingCycle,
      description: plan.description,
      displayOrder: plan.displayOrder,
      isActive: plan.isActive,
      features: plan.features
    };
    
    console.log('更新数据:', JSON.stringify(updates, null, 2));
    
    const updatedPlan = await productManagementService.updatePlan(
      plan.id,
      updates,
      1 // 假设管理员ID为1
    );
    
    console.log('\n✅ 更新成功!');
    console.log('更新后的套餐:', JSON.stringify(updatedPlan, null, 2));
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  }
}

testUpdatePlan();
