// 在浏览器控制台运行此脚本，查看页面上的所有input元素

console.log('========== 头条号页面诊断 ==========');
console.log('当前URL:', window.location.href);
console.log('');

// 查找所有input元素
const allInputs = document.querySelectorAll('input');
console.log(`找到 ${allInputs.length} 个input元素：`);
console.log('');

allInputs.forEach((input, index) => {
  console.log(`Input #${index + 1}:`);
  console.log('  - type:', input.type);
  console.log('  - placeholder:', input.placeholder);
  console.log('  - name:', input.name);
  console.log('  - id:', input.id);
  console.log('  - class:', input.className);
  console.log('  - value:', input.value);
  console.log('');
});

// 查找所有contenteditable元素
const editables = document.querySelectorAll('[contenteditable="true"]');
console.log(`找到 ${editables.length} 个contenteditable元素：`);
console.log('');

editables.forEach((el, index) => {
  console.log(`Editable #${index + 1}:`);
  console.log('  - tagName:', el.tagName);
  console.log('  - class:', el.className);
  console.log('  - textContent:', el.textContent?.substring(0, 50));
  console.log('');
});

// 查找标题输入框（根据placeholder）
const titleInput = document.querySelector('input[placeholder*="标题"]');
if (titleInput) {
  console.log('✅ 找到标题输入框:');
  console.log('  - placeholder:', titleInput.placeholder);
  console.log('  - selector:', 'input[placeholder*="标题"]');
  titleInput.style.border = '3px solid red';  // 高亮显示
  console.log('  - 已用红色边框高亮显示');
} else {
  console.log('❌ 未找到标题输入框');
}

console.log('');
console.log('========== 诊断完成 ==========');
