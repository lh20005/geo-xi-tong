/**
 * 测试API返回的套餐数据格式
 */

import { productManagementService } from '../services/ProductManagementService';

async function testAPIResponse() {
  console.log('========================================');
  console.log('测试API返回的套餐数据格式');
  console.log('========================================\n');

  try {
    const plans = await productManagementService.getAllPlans(true);
    
    console.log('获取到', plans.length, '个套餐\n');
    
    plans.forEach(plan => {
      console.log(`套餐: ${plan.planName} (${plan.planCode})`);
      console.log('功能配额:');
      
      plan.features?.forEach(feature => {
        console.log(`  - ${feature.featureName}: ${feature.featureValue} ${feature.featureUnit}`);
        
        if (feature.featureCode === 'storage_space') {
          if (feature.featureUnit === 'bytes') {
            console.log('    ❌ 错误：单位是 bytes，应该是 MB');
          } else if (feature.featureUnit === 'MB') {
            console.log('    ✅ 正确：单位是 MB');
          }
        }
      });
      
      console.log('');
    });
    
    // 输出JSON格式，方便查看
    console.log('========================================');
    console.log('JSON格式（前端会收到的数据）:');
    console.log('========================================');
    console.log(JSON.stringify(plans, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testAPIResponse();
