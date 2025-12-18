// ========== 抖音AI声明修复代码 ==========
// 位置: server/src/services/adapters/DouyinAdapter.ts
// 查找: console.log('[抖音号] 🖱️  点击"添加自主声明"按钮...');
// 替换整个AI声明代码块（从点击按钮到声明添加完成）

console.log('[抖音号] 🖱️  点击"添加自主声明"按钮...');
await page.click(addDeclarationButton);

// 关键修复：增加等待时间，确保侧滑页完全加载
console.log('[抖音号] ⏳ 等待侧滑页弹出和完全加载（8秒）...');
await new Promise(resolve => setTimeout(resolve, 8000));
console.log('[抖音号] ✅ 侧滑页应该已完全加载');

// 截图查看侧边栏状态
try {
  await page.screenshot({ path: 'douyin-declaration-sidebar.png', fullPage: true });
  console.log('[抖音号] 📸 已保存侧边栏截图到: douyin-declaration-sidebar.png');
} catch (e) {
  console.log('[抖音号] 截图失败:', e);
}

// 使用用户提供的精确选择器点击"内容由AI生成"选项
console.log('[抖音号] 🔍 查找"内容由AI生成"选项...');

// 用户提供的精确选择器
const aiOptionSelector = 'body > div:nth-child(26) > div > div.semi-sidesheet-inner.semi-sidesheet-inner-wrap > div > div.semi-sidesheet-body > section > div > div:nth-child(3) > label';

console.log(`[抖音号] 使用精确选择器: ${aiOptionSelector.substring(0, 80)}...`);
console.log('[抖音号] ⏳ 等待"内容由AI生成"选项出现（10秒）...');

try {
  await page.waitForSelector(aiOptionSelector, { visible: true, timeout: 10000 });
  console.log('[抖音号] ✅ 找到"内容由AI生成"选项');
  
  // 获取元素信息用于调试
  const optionInfo = await page.$eval(aiOptionSelector, el => {
    const rect = el.getBoundingClientRect();
    return {
      text: el.textContent?.trim(),
      visible: rect.width > 0 && rect.height > 0,
      x: rect.x,
      y: rect.y
    };
  });
  console.log('[抖音号] 选项信息:', JSON.stringify(optionInfo, null, 2));
  
  console.log('[抖音号] 🖱️  点击"内容由AI生成"选项...');
  await page.click(aiOptionSelector);
  console.log('[抖音号] ✅ 已点击选项');
  
  // 关键修复：增加等待时间，确保选项选中后再继续
  console.log('[抖音号] ⏳ 等待选项选中状态更新（3秒）...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('[抖音号] ✅ 选项应该已选中');
  
} catch (error: any) {
  console.log('[抖音号] ⚠️ 精确选择器失败，尝试备用方案...');
  console.log('[抖音号] 错误信息:', error.message);
  
  // 备用方案：使用XPath查找
  const aiOptionXPath = "//*[contains(text(), '内容由AI生成')]";
  console.log(`[抖音号] 备用XPath: ${aiOptionXPath}`);
  
  try {
    await page.waitForXPath(aiOptionXPath, { visible: true, timeout: 5000 });
    const aiElements = await page.$x(aiOptionXPath);
    console.log(`[抖音号] 找到 ${aiElements.length} 个包含"内容由AI生成"的元素`);
    
    for (let i = 0; i < aiElements.length; i++) {
      const element = aiElements[i];
      const elementInfo = await page.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          text: el.textContent?.trim(),
          visible: style.display !== 'none' && 
                  style.visibility !== 'hidden' && 
                  rect.width > 0 && 
                  rect.height > 0
        };
      }, element);
      
      console.log(`[抖音号] 元素 [${i}]:`, JSON.stringify(elementInfo, null, 2));
      
      if (elementInfo.visible) {
        console.log('[抖音号] ✅ 找到可见元素，正在点击...');
        await element.click();
        console.log('[抖音号] ⏳ 等待选项选中（3秒）...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        break;
      }
    }
  } catch (xpathError: any) {
    console.log('[抖音号] ❌ 备用方案也失败:', xpathError.message);
    throw new Error('所有方法都未能找到"内容由AI生成"选项');
  }
}

// 截图保存选中状态
try {
  await page.screenshot({ path: 'douyin-declaration-selected.png', fullPage: true });
  console.log('[抖音号] 📸 已保存选中状态截图到: douyin-declaration-selected.png');
} catch (e) {
  console.log('[抖音号] 截图失败:', e);
}

// 使用用户提供的精确选择器点击确定按钮
console.log('[抖音号] 🔍 查找"确定"按钮...');

// 用户提供的精确选择器
const confirmButtonSelector = 'body > div:nth-child(26) > div > div.semi-sidesheet-inner.semi-sidesheet-inner-wrap > div > div.semi-sidesheet-body > footer > button.semi-button.semi-button-primary.btn-I78nOi';

console.log(`[抖音号] 使用精确选择器: ${confirmButtonSelector.substring(0, 80)}...`);
console.log('[抖音号] ⏳ 等待"确定"按钮出现（10秒）...');

try {
  await page.waitForSelector(confirmButtonSelector, { visible: true, timeout: 10000 });
  console.log('[抖音号] ✅ 找到"确定"按钮');
  
  // 获取按钮信息
  const buttonInfo = await page.$eval(confirmButtonSelector, el => {
    return {
      text: el.textContent?.trim(),
      enabled: !(el as HTMLButtonElement).disabled
    };
  });
  console.log('[抖音号] 按钮信息:', JSON.stringify(buttonInfo, null, 2));
  
  console.log('[抖音号] 🖱️  点击"确定"按钮...');
  await page.click(confirmButtonSelector);
  console.log('[抖音号] ✅ 已点击确定按钮');
  
} catch (error: any) {
  console.log('[抖音号] ⚠️ 精确选择器失败，尝试备用方案...');
  console.log('[抖音号] 错误信息:', error.message);
  
  // 备用方案：使用简化的选择器
  const fallbackSelectors = [
    '.semi-sidesheet-body > footer > button.semi-button-primary',
    'footer button.semi-button-primary',
    'button.semi-button-primary'
  ];
  
  let confirmClicked = false;
  
  for (const selector of fallbackSelectors) {
    try {
      console.log(`[抖音号] 尝试备用选择器: ${selector}`);
      await page.waitForSelector(selector, { visible: true, timeout: 3000 });
      
      const buttonText = await page.$eval(selector, el => el.textContent?.trim());
      console.log(`[抖音号] 找到按钮: "${buttonText}"`);
      
      if (buttonText === '确定' || buttonText === '确认') {
        await page.click(selector);
        confirmClicked = true;
        console.log('[抖音号] ✅ 已点击确定按钮（备用方案）');
        break;
      }
    } catch (e: any) {
      console.log(`[抖音号] 选择器 ${selector} 失败:`, e.message);
      continue;
    }
  }
  
  if (!confirmClicked) {
    console.log('[抖音号] ⚠️ 所有备用方案都失败，尝试XPath...');
    const confirmXPath = "//button[contains(text(), '确定') or contains(text(), '确认')]";
    try {
      await page.waitForXPath(confirmXPath, { visible: true, timeout: 5000 });
      const confirmButtons = await page.$x(confirmXPath);
      if (confirmButtons.length > 0) {
        await confirmButtons[0].click();
        console.log('[抖音号] ✅ 已点击确定按钮（XPath方案）');
      }
    } catch (xpathError: any) {
      console.log('[抖音号] ❌ XPath方案也失败:', xpathError.message);
    }
  }
}

// 关键修复：增加等待时间，确保侧滑页完全关闭
console.log('[抖音号] ⏳ 等待侧滑页关闭（5秒）...');
await new Promise(resolve => setTimeout(resolve, 5000));
console.log('[抖音号] ✅ 侧滑页应该已关闭，自主声明添加完成');
