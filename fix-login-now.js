// 在浏览器Console中运行此脚本来立即修复登录问题

console.log('=== 登录问题诊断和修复 ===\n');

// 1. 检查当前localStorage
console.log('1. 当前localStorage状态:');
const currentToken = localStorage.getItem('auth_token');
const currentRefresh = localStorage.getItem('refresh_token');
const currentUser = localStorage.getItem('user_info');

console.log('  auth_token:', currentToken ? '存在 ✓' : '缺失 ✗');
console.log('  refresh_token:', currentRefresh ? '存在 ✓' : '缺失 ✗');
console.log('  user_info:', currentUser ? '存在 ✓' : '缺失 ✗');

if (currentRefresh === 'undefined' || currentRefresh === null) {
    console.log('\n⚠️ 发现问题: refresh_token 是 undefined 或 null\n');
}

// 2. 检查URL参数
console.log('\n2. 检查URL参数:');
const params = new URLSearchParams(window.location.search);
const urlToken = params.get('token');
const urlRefresh = params.get('refresh_token');
const urlUser = params.get('user_info');

console.log('  URL中的token:', urlToken ? '存在 ✓' : '缺失 ✗');
console.log('  URL中的refresh_token:', urlRefresh);
console.log('  URL中的user_info:', urlUser ? '存在 ✓' : '缺失 ✗');

// 3. 如果URL中有token但refresh_token是undefined，尝试重新登录
if (urlToken && urlRefresh === 'undefined') {
    console.log('\n⚠️ URL中refresh_token是undefined，需要重新登录\n');
    console.log('解决方案:');
    console.log('1. 清除localStorage');
    console.log('2. 返回登录页重新登录\n');
    
    const shouldFix = confirm('是否立即清除localStorage并返回登录页？');
    if (shouldFix) {
        localStorage.clear();
        window.location.href = 'http://localhost:8080/login';
    }
} else if (urlToken && urlRefresh && urlRefresh !== 'undefined') {
    console.log('\n✓ URL参数正常，保存到localStorage\n');
    localStorage.setItem('auth_token', urlToken);
    localStorage.setItem('refresh_token', urlRefresh);
    localStorage.setItem('user_info', urlUser);
    
    // 清除URL参数并刷新
    window.history.replaceState({}, document.title, window.location.pathname);
    console.log('✓ 已保存token并清除URL参数');
    console.log('正在刷新页面...');
    setTimeout(() => window.location.reload(), 500);
} else {
    console.log('\n3. 测试登录API:');
    console.log('运行以下命令测试登录:\n');
    console.log(`
fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
})
.then(r => r.json())
.then(data => {
    console.log('登录响应:', data);
    if (data.success && data.data.refreshToken) {
        console.log('✓ API返回了refreshToken');
        localStorage.setItem('auth_token', data.data.token);
        localStorage.setItem('refresh_token', data.data.refreshToken);
        localStorage.setItem('user_info', JSON.stringify(data.data.user));
        console.log('✓ 已保存到localStorage');
        console.log('现在可以点击"进入系统"');
    } else {
        console.log('✗ API没有返回refreshToken');
    }
});
    `);
}

console.log('\n=== 诊断完成 ===');
