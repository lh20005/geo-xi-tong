const axios = require('axios');

async function testGeminiAPI() {
  const apiKey = 'AIzaSyAel_A-iQbyVMwut6k1ZYknf_WbGhOeGPk';
  
  console.log('测试Gemini API...\n');
  
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{ text: '请说"你好"' }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ API调用成功！');
    console.log('响应:', response.data.candidates[0].content.parts[0].text);
  } catch (error) {
    console.error('❌ API调用失败:');
    console.error('状态码:', error.response?.status);
    console.error('错误信息:', error.response?.data);
  }
}

testGeminiAPI();
