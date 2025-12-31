// ========================================
// 手动全屏测试脚本
// 在BrowserView的Console中运行此脚本
// ========================================

(function() {
  console.log('='.repeat(80));
  console.log('🔥 手动全屏测试开始');
  console.log('='.repeat(80));
  
  // 1. 检查当前状态
  console.log('📊 当前状态:');
  console.log('  视口尺寸:', window.innerWidth, 'x', window.innerHeight);
  console.log('  HTML尺寸:', document.documentElement.offsetWidth, 'x', document.documentElement.offsetHeight);
  console.log('  Body尺寸:', document.body.offsetWidth, 'x', document.body.offsetHeight);
  
  // 2. 注入CSS
  console.log('\n📝 注入CSS样式...');
  let styleTag = document.getElementById('manual-fullscreen-style');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'manual-fullscreen-style';
    document.head.appendChild(styleTag);
  }
  
  styleTag.textContent = `
    /* 强制html和body全屏 */
    html {
      width: 100vw !important;
      height: 100vh !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: auto !important;
      box-sizing: border-box !important;
    }
    
    body {
      width: 100vw !important;
      min-height: 100vh !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: auto !important;
      box-sizing: border-box !important;
    }
    
    /* 强制所有顶层元素全屏 */
    body > * {
      width: 100% !important;
      max-width: 100vw !important;
      box-sizing: border-box !important;
    }
    
    /* 隐藏滚动条 */
    * {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    
    *::-webkit-scrollbar {
      display: none !important;
    }
  `;
  
  console.log('✅ CSS已注入');
  
  // 3. 强制修改所有可能限制宽度的元素
  console.log('\n🔧 修复固定宽度元素...');
  let fixedCount = 0;
  
  document.querySelectorAll('*').forEach(el => {
    const computed = window.getComputedStyle(el);
    const width = parseInt(computed.width);
    const maxWidth = computed.maxWidth;
    
    // 如果元素宽度小于视口宽度的90%，强制设为100%
    if (width > 0 && width < window.innerWidth * 0.9) {
      el.style.width = '100%';
      el.style.maxWidth = '100vw';
      fixedCount++;
    }
    
    // 如果有max-width限制，也移除
    if (maxWidth !== 'none' && parseInt(maxWidth) < window.innerWidth) {
      el.style.maxWidth = '100vw';
      fixedCount++;
    }
  });
  
  console.log('✅ 修复了', fixedCount, '个元素');
  
  // 4. 触发重排
  console.log('\n🔄 触发页面重排...');
  document.body.offsetHeight;
  window.dispatchEvent(new Event('resize'));
  console.log('✅ 重排完成');
  
  // 5. 检查结果
  console.log('\n📊 修复后状态:');
  console.log('  视口尺寸:', window.innerWidth, 'x', window.innerHeight);
  console.log('  HTML尺寸:', document.documentElement.offsetWidth, 'x', document.documentElement.offsetHeight);
  console.log('  Body尺寸:', document.body.offsetWidth, 'x', document.body.offsetHeight);
  
  // 6. 查找可能的问题元素
  console.log('\n🔍 检查顶层元素:');
  document.querySelectorAll('body > *').forEach((el, index) => {
    const computed = window.getComputedStyle(el);
    console.log(`  元素 ${index}:`, {
      标签: el.tagName,
      类名: el.className,
      宽度: computed.width,
      最大宽度: computed.maxWidth,
      外边距: computed.margin
    });
  });
  
  console.log('\n='.repeat(80));
  console.log('✅ 手动全屏测试完成');
  console.log('='.repeat(80));
  
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    html: { width: document.documentElement.offsetWidth, height: document.documentElement.offsetHeight },
    body: { width: document.body.offsetWidth, height: document.body.offsetHeight },
    fixedCount: fixedCount
  };
})();
