import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

async function testUserManagement() {
  console.log('🧪 开始测试用户管理系统...\n');

  try {
    // 1. 测试注册
    console.log('1️⃣ 测试用户注册...');
    const registerResponse = await axios.post(`${API_URL}/auth/register`, {
      username: 'testuser123',
      password: 'password123'
    });
    
    console.log('✅ 注册成功!');
    console.log('用户信息:', registerResponse.data.data.user);
    console.log('邀请码:', registerResponse.data.data.user.invitationCode);
    
    const token = registerResponse.data.data.token;
    const invitationCode = registerResponse.data.data.user.invitationCode;
    
    // 2. 测试使用邀请码注册
    console.log('\n2️⃣ 测试使用邀请码注册...');
    const registerWithCodeResponse = await axios.post(`${API_URL}/auth/register`, {
      username: 'inviteduser456',
      password: 'password456',
      invitationCode: invitationCode
    });
    
    console.log('✅ 使用邀请码注册成功!');
    console.log('被邀请用户:', registerWithCodeResponse.data.data.user.username);
    
    // 3. 测试获取邀请统计
    console.log('\n3️⃣ 测试获取邀请统计...');
    const statsResponse = await axios.get(`${API_URL}/invitations/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ 获取邀请统计成功!');
    console.log('邀请码:', statsResponse.data.data.invitationCode);
    console.log('总邀请数:', statsResponse.data.data.totalInvites);
    console.log('被邀请用户:', statsResponse.data.data.invitedUsers);
    
    // 4. 测试登录
    console.log('\n4️⃣ 测试登录...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: 'testuser123',
      password: 'password123'
    });
    
    console.log('✅ 登录成功!');
    console.log('用户角色:', loginResponse.data.data.user.role);
    console.log('是否临时密码:', loginResponse.data.data.user.isTempPassword);
    
    // 5. 测试获取用户资料
    console.log('\n5️⃣ 测试获取用户资料...');
    const profileResponse = await axios.get(`${API_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ 获取用户资料成功!');
    console.log('用户名:', profileResponse.data.data.username);
    console.log('邀请码:', profileResponse.data.data.invitation_code);
    
    // 6. 测试修改密码
    console.log('\n6️⃣ 测试修改密码...');
    const changePasswordResponse = await axios.put(
      `${API_URL}/users/password`,
      {
        currentPassword: 'password123',
        newPassword: 'newpassword123'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    console.log('✅ 修改密码成功!');
    console.log('消息:', changePasswordResponse.data.message);
    
    // 7. 测试用新密码登录
    console.log('\n7️⃣ 测试用新密码登录...');
    const newLoginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: 'testuser123',
      password: 'newpassword123'
    });
    
    console.log('✅ 新密码登录成功!');
    
    console.log('\n🎉 所有测试通过！');
    
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.response?.data || error.message);
    process.exit(1);
  }
}

testUserManagement();
