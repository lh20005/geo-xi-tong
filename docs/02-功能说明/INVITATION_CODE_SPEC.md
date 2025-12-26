# 邀请码系统规范

## 概述

邀请码系统用于用户邀请和追踪功能。每个用户在注册时会自动获得一个唯一的邀请码，可以分享给其他人用于注册。

## 邀请码格式规范

### 基本规则
- **长度**: 固定 6 个字符
- **字符集**: 小写字母 (a-z) 和数字 (0-9)，共 36 个字符
- **正则表达式**: `^[a-z0-9]{6}$`
- **大小写**: 仅小写，不包含大写字母
- **特殊字符**: 不包含任何特殊字符、空格或标点符号

### 有效邀请码示例
```
suvboa  ✓ 正确
xr2w8q  ✓ 正确
d50t3s  ✓ 正确
4sq9ar  ✓ 正确
abc123  ✓ 正确
```

### 无效邀请码示例
```
TEST01  ✗ 错误 - 包含大写字母
ABC123  ✗ 错误 - 包含大写字母
test-1  ✗ 错误 - 包含特殊字符
test 1  ✗ 错误 - 包含空格
test    ✗ 错误 - 长度不足
test123 ✗ 错误 - 长度超过 6 位
```

## 生成算法

### 实现代码
```typescript
import crypto from 'crypto';

class InvitationService {
  private readonly CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';
  private readonly CODE_LENGTH = 6;
  private readonly MAX_RETRY_ATTEMPTS = 10;

  /**
   * 生成随机邀请码
   * 使用 crypto.randomBytes 生成加密安全的随机数
   */
  private generateRandomCode(): string {
    const bytes = crypto.randomBytes(this.CODE_LENGTH);
    let code = '';
    
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      const index = bytes[i] % this.CHARSET.length;
      code += this.CHARSET[index];
    }
    
    return code;
  }

  /**
   * 生成唯一的邀请码
   * 如果生成的代码已存在，会重试最多 MAX_RETRY_ATTEMPTS 次
   */
  async generate(): Promise<string> {
    for (let attempt = 0; attempt < this.MAX_RETRY_ATTEMPTS; attempt++) {
      const code = this.generateRandomCode();
      
      // 检查唯一性
      const isUnique = await this.isUnique(code);
      
      if (isUnique) {
        console.log(`[Invitation] 生成邀请码成功: ${code}`);
        return code;
      }
      
      console.log(`[Invitation] 邀请码冲突，重试 (${attempt + 1}/${this.MAX_RETRY_ATTEMPTS}): ${code}`);
    }
    
    throw new Error('无法生成唯一的邀请码，已达到最大重试次数');
  }
}
```

### 命令行生成
```bash
# 在 server 目录下执行
node -e "const crypto = require('crypto'); const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'; const CODE_LENGTH = 6; const bytes = crypto.randomBytes(CODE_LENGTH); let code = ''; for (let i = 0; i < CODE_LENGTH; i++) { const index = bytes[i] % CHARSET.length; code += CHARSET[index]; } console.log(code);"
```

## 唯一性保证

### 冲突检测
每次生成邀请码后，系统会检查数据库中是否已存在相同的邀请码：

```sql
SELECT COUNT(*) as count 
FROM users 
WHERE invitation_code = $1
```

### 重试机制
- 如果生成的邀请码已存在，系统会自动重试
- 最多重试 10 次
- 如果 10 次都失败，抛出错误

### 冲突概率
- 字符集大小: 36 (26个字母 + 10个数字)
- 可能的组合数: 36^6 = 2,176,782,336 (约 21.7 亿)
- 在用户数量较少时，冲突概率极低

## 验证规则

### 格式验证
```typescript
validateFormat(code: string): boolean {
  if (!code || code.length !== this.CODE_LENGTH) {
    return false;
  }
  
  const regex = /^[a-z0-9]{6}$/;
  return regex.test(code);
}
```

### 存在性验证
```typescript
async exists(code: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM users WHERE invitation_code = $1',
    [code]
  );
  
  return parseInt(result.rows[0].count) > 0;
}
```

### 完整验证
```typescript
async validateCode(code: string): Promise<{ valid: boolean; inviterUsername?: string }> {
  // 1. 格式验证
  if (!this.validateFormat(code)) {
    return { valid: false };
  }
  
  // 2. 存在性验证
  const inviterUsername = await this.getInviterUsername(code);
  
  if (inviterUsername) {
    return {
      valid: true,
      inviterUsername
    };
  }
  
  return { valid: false };
}
```

## 使用场景

### 1. 用户注册
用户注册时会自动生成邀请码：

```typescript
// 生成唯一的邀请码
const invitationCode = await invitationService.generate();

// 创建用户
const result = await pool.query(
  `INSERT INTO users (username, password_hash, invitation_code, invited_by_code, role, is_temp_password) 
   VALUES ($1, $2, $3, $4, $5, $6) 
   RETURNING *`,
  [username, passwordHash, invitationCode, invitedByCode || null, 'user', false]
);
```

### 2. 邀请他人
用户可以分享自己的邀请码给其他人：

```typescript
// 获取用户的邀请统计
const stats = await invitationService.getInvitationStats(userId);

console.log(`邀请码: ${stats.invitationCode}`);
console.log(`已邀请: ${stats.totalInvites} 人`);
```

### 3. 使用邀请码注册
新用户可以使用邀请码注册，建立邀请关系：

```typescript
// 验证邀请码
const validation = await invitationService.validateCode(invitationCode);

if (validation.valid) {
  console.log(`邀请者: ${validation.inviterUsername}`);
  // 继续注册流程
}
```

## 数据库设计

### users 表结构
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  invitation_code VARCHAR(6) NOT NULL UNIQUE,  -- 用户的邀请码
  invited_by_code VARCHAR(6),                   -- 邀请者的邀请码
  role VARCHAR(20) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  is_temp_password BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_invited_by 
    FOREIGN KEY (invited_by_code) 
    REFERENCES users(invitation_code) 
    ON DELETE SET NULL
);

-- 索引
CREATE INDEX idx_users_invitation_code ON users(invitation_code);
CREATE INDEX idx_users_invited_by_code ON users(invited_by_code);
```

### 查询邀请关系
```sql
-- 查询某个用户邀请的所有用户
SELECT u2.id, u2.username, u2.created_at
FROM users u1
JOIN users u2 ON u2.invited_by_code = u1.invitation_code
WHERE u1.username = 'testuser';

-- 查询某个用户的邀请者
SELECT u2.id, u2.username
FROM users u1
JOIN users u2 ON u1.invited_by_code = u2.invitation_code
WHERE u1.username = 'invited_user';
```

## 安全性考虑

### 1. 加密随机生成
- 使用 `crypto.randomBytes()` 而不是 `Math.random()`
- 确保生成的邀请码具有加密安全性
- 防止被预测或暴力破解

### 2. 唯一性约束
- 数据库层面的 UNIQUE 约束
- 应用层面的唯一性检查
- 双重保障防止重复

### 3. 格式限制
- 只允许小写字母和数字
- 避免混淆字符（如 0 和 O，1 和 l）
- 固定长度便于输入和验证

### 4. 可选性
- 邀请码是可选的
- 没有邀请码也可以注册
- 不强制要求邀请关系

## 测试用例

### 格式验证测试
```typescript
describe('邀请码格式验证', () => {
  it('应该接受有效的邀请码', () => {
    expect(invitationService.validateFormat('abc123')).toBe(true);
    expect(invitationService.validateFormat('suvboa')).toBe(true);
    expect(invitationService.validateFormat('000000')).toBe(true);
  });

  it('应该拒绝无效的邀请码', () => {
    expect(invitationService.validateFormat('ABC123')).toBe(false); // 大写
    expect(invitationService.validateFormat('test-1')).toBe(false); // 特殊字符
    expect(invitationService.validateFormat('test')).toBe(false);   // 长度不足
    expect(invitationService.validateFormat('test123')).toBe(false); // 长度超过
  });
});
```

### 生成唯一性测试
```typescript
describe('邀请码生成', () => {
  it('应该生成符合格式的邀请码', async () => {
    const code = await invitationService.generate();
    expect(code).toMatch(/^[a-z0-9]{6}$/);
  });

  it('应该生成唯一的邀请码', async () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      const code = await invitationService.generate();
      expect(codes.has(code)).toBe(false);
      codes.add(code);
    }
  });
});
```

## 常见问题

### Q: 为什么只用小写字母和数字？
A: 
1. 避免大小写混淆（如 O 和 o）
2. 便于口头传达和输入
3. 减少字符集大小，但仍有足够的组合数
4. 统一格式，便于验证

### Q: 6 位长度够用吗？
A: 
- 36^6 = 2,176,782,336 种组合
- 对于大多数应用场景足够
- 如果需要更多，可以调整 CODE_LENGTH

### Q: 如果 10 次重试都失败怎么办？
A: 
- 在实际应用中极少发生
- 可以增加重试次数
- 或者增加邀请码长度
- 记录错误日志，人工介入

### Q: 可以自定义邀请码吗？
A: 
- 当前系统不支持自定义
- 所有邀请码都是自动生成的
- 这样可以确保唯一性和安全性

## 相关文件

- `server/src/services/InvitationService.ts` - 邀请码服务实现
- `server/src/services/AuthService.ts` - 使用邀请码的认证服务
- `server/src/routes/invitations.ts` - 邀请码相关 API 路由
- `server/src/__tests__/auth.property.test.ts` - 邀请码测试用例
