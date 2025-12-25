// 在浏览器控制台执行这段代码来测试商品管理API

console.log('=== 开始测试商品管理API ===');

const token = localStorage.getItem('auth_token');
console.log('Token:', token ? token.substring(0, 30) + '...' : '无');

if (!token) {
  console.error('❌ 没有token');
} else {
  fetch('http://localhost:3000/api/admin/products', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  .then(res => {
    console.log('响应状态:', res.status, res.statusText);
    return res.json();
  })
  .then(data => {
    console.log('API响应:', data);
    if (data.success) {
      console.log('✅ API调用成功');
      console.log('套餐数量:', data.data.length);
      console.log('套餐列表:', data.data);
    } else {
      console.error('❌ API返回失败:', data.message);
    }
  })
  .catch(err => {
    console.error('❌ 请求失败:', err);
  });
}
