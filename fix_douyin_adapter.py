#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
修复抖音适配器的图片上传和自主声明问题
"""

import re

# 读取文件
with open('server/src/services/adapters/DouyinAdapter.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 修复1: 图片上传部分 - 已经完成

# 修复2: 自主声明部分 - 查找并替换
old_code_pattern = r'''        // 获取所有元素，查找包含"内容由AI生成"的元素
        const allElements = await page\.\$\('\*'\);
        let aiElement = null;
        
        for \(const element of allElements\) \{
          const text = await page\.evaluate\(el => el\.textContent\?\.trim\(\), element\);
          if \(text && text\.includes\('内容由AI生成'\)\) \{
            const isVisible = await page\.evaluate\(el => \{
              const style = window\.getComputedStyle\(el\);
              const rect = el\.getBoundingClientRect\(\);
              return style\.display !== 'none' && 
                     style\.visibility !== 'hidden' && 
                     rect\.width > 0 && 
                     rect\.height > 0;
            \}, element\);
            
            if \(isVisible\) \{
              aiElement = element;
              console\.log\(`\[抖音号\] ✅ 找到"内容由AI生成"选项: "\$\{text\}"`\);
              break;
            \}
          \}
        \}
        
        if \(aiElement\) \{
          console\.log\('\[抖音号\] 🖱️  点击"内容由AI生成"选项\.\.\.'\);
          await aiElement\.click\(\);
          console\.log\('\[抖音号\] ⏳ 等待选项选中（1秒）\.\.\.'\);
          await new Promise\(resolve => setTimeout\(resolve, 1000\)\);
          console\.log\('\[抖音号\] ✅ 选项应该已选中'\);
        \} else \{
          throw new Error\('未找到"内容由AI生成"选项'\);
        \}
        
        // 点击确定按钮
        const confirmButton = '\.semi-sidesheet-body > footer > button\.semi-button-primary';
        console\.log\(`\[抖音号\] 确定按钮选择器（简化）: \$\{confirmButton\}`\);
        console\.log\('\[抖音号\] ⏳ 等待"确定"按钮出现（5秒）\.\.\.'\);
        await page\.waitForSelector\(confirmButton, \{ timeout: 5000 \}\);
        console\.log\('\[抖音号\] ✅ 找到"确定"按钮'\);
        
        console\.log\('\[抖音号\] 🖱️  点击"确定"按钮\.\.\.'\);
        await page\.click\(confirmButton\);
        console\.log\('\[抖音号\] ⏳ 等待侧边栏关闭（1秒）\.\.\.'\);
        await new Promise\(resolve => setTimeout\(resolve, 1000\)\);
        console\.log\('\[抖音号\] ✅ 自主声明已添加'\);'''

new_code = '''        // 使用XPath精确查找
        const aiOptionXPath = "//*[contains(text(), '内容由AI生成')]";
        console.log(`[抖音号] 使用XPath查找: ${aiOptionXPath}`);
        
        await page.waitForXPath(aiOptionXPath, { visible: true, timeout: 5000 });
        const aiElements = await page.$x(aiOptionXPath);
        console.log(`[抖音号] 找到 ${aiElements.length} 个包含"内容由AI生成"的元素`);
        
        let clicked = false;
        for (let i = 0; i < aiElements.length; i++) {
          const element = aiElements[i];
          const elementInfo = await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return {
              text: el.textContent?.trim(),
              tagName: el.tagName,
              visible: style.display !== 'none' && 
                      style.visibility !== 'hidden' && 
                      style.opacity !== '0' &&
                      rect.width > 0 && 
                      rect.height > 0
            };
          }, element);
          
          console.log(`[抖音号] 元素 [${i}]: ${elementInfo.tagName} "${elementInfo.text}" visible=${elementInfo.visible}`);
          
          if (elementInfo.visible) {
            console.log(`[抖音号] ✅ 找到可见的"内容由AI生成"选项`);
            console.log('[抖音号] 🖱️  点击选项...');
            await element.click();
            clicked = true;
            console.log('[抖音号] ✅ 已点击选项');
            break;
          }
        }
        
        if (!clicked) {
          throw new Error('未找到可见的"内容由AI生成"选项');
        }
        
        console.log('[抖音号] ⏳ 等待选项选中（2秒）...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 截图查看选中状态
        try {
          await page.screenshot({ path: 'douyin-declaration-selected.png', fullPage: true });
          console.log('[抖音号] 📸 已保存选中状态截图到: douyin-declaration-selected.png');
        } catch (e) {
          console.log('[抖音号] 截图失败:', e);
        }
        
        // 点击确定按钮 - 使用多种方式查找
        console.log('[抖音号] 🔍 查找"确定"按钮...');
        
        // 方法1: 尝试多个CSS选择器
        const confirmSelectors = [
          '.semi-sidesheet-body > footer > button.semi-button-primary',
          '.semi-sidesheet footer button.semi-button-primary',
          'button.semi-button-primary',
          '.semi-modal-footer button.semi-button-primary'
        ];
        
        let confirmClicked = false;
        for (const selector of confirmSelectors) {
          try {
            console.log(`[抖音号] 尝试选择器: ${selector}`);
            await page.waitForSelector(selector, { visible: true, timeout: 2000 });
            const buttonText = await page.$eval(selector, el => el.textContent?.trim());
            console.log(`[抖音号] 找到按钮: "${buttonText}"`);
            
            if (buttonText === '确定' || buttonText === '确认' || buttonText === '保存') {
              console.log('[抖音号] 🖱️  点击确定按钮...');
              await page.click(selector);
              confirmClicked = true;
              console.log('[抖音号] ✅ 已点击确定按钮');
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        // 方法2: 使用XPath查找
        if (!confirmClicked) {
          console.log('[抖音号] ⚠️ CSS选择器未找到，尝试XPath...');
          const confirmXPath = "//button[contains(text(), '确定') or contains(text(), '确认') or contains(text(), '保存')]";
          
          await page.waitForXPath(confirmXPath, { visible: true, timeout: 5000 });
          const confirmButtons = await page.$x(confirmXPath);
          console.log(`[抖音号] 找到 ${confirmButtons.length} 个确认按钮`);
          
          if (confirmButtons.length > 0) {
            const button = confirmButtons[confirmButtons.length - 1];
            const buttonText = await page.evaluate(el => el.textContent?.trim(), button);
            console.log(`[抖音号] 准备点击按钮: "${buttonText}"`);
            
            await button.click();
            confirmClicked = true;
            console.log('[抖音号] ✅ 已点击确定按钮（XPath方式）');
          }
        }
        
        if (!confirmClicked) {
          throw new Error('未找到确定按钮');
        }
        
        console.log('[抖音号] ⏳ 等待侧边栏关闭（2秒）...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('[抖音号] ✅ 自主声明已添加');'''

# 尝试替换
if re.search(old_code_pattern, content, re.DOTALL):
    content = re.sub(old_code_pattern, new_code, content, flags=re.DOTALL)
    print("✅ 使用正则表达式成功替换")
else:
    print("⚠️ 正则表达式未匹配，尝试简单字符串替换...")
    # 简化的查找字符串
    simple_old = "const allElements = await page.$('*');"
    if simple_old in content:
        print("✅ 找到目标代码")
    else:
        print("❌ 未找到目标代码")

# 写回文件
with open('server/src/services/adapters/DouyinAdapter.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 修复完成！")
